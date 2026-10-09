// 학습 이력: 유사 문제를 풀 때마다 문제별 정답/오답을 기록하고,
// 간격 반복(틀리면 바로, 맞히면 1→3→7일 뒤) 방식으로 복습할 문제를 고릅니다.

import { collection, doc, getDocs, setDoc } from 'firebase/firestore/lite';
import { db } from '../firebase';
import type { ProblemHistoryItem, QuizQuestion } from '../types';

export interface ProblemStat {
  key: string; // `${problemId}_${index}`
  problemId: string;
  index: number;
  question: string;
  tags: string[];
  attempts: number;
  wrong: number;
  streak: number; // 연속 정답 수 (틀리면 0)
  lastCorrect: boolean;
  lastAt: number;
  lastAnswer: string;
}

export type StatsMap = Record<string, ProblemStat>;

export const MASTERED_STREAK = 3;
const DAY = 24 * 60 * 60 * 1000;
const INTERVAL_DAYS = [0, 1, 3, 7]; // 연속 정답 수에 따른 다음 복습까지 간격

export const statKey = (problemId: string, index: number) => `${problemId}_${index}`;

const statsCol = (uid: string) => collection(db, 'users', uid, 'problemStats');

export async function fetchStats(uid: string): Promise<StatsMap> {
  const snap = await getDocs(statsCol(uid));
  const map: StatsMap = {};
  snap.docs.forEach((d) => { map[d.id] = d.data() as ProblemStat; });
  return map;
}

/** 새 기록을 계산해 저장하고, 화면에 바로 반영할 값을 돌려줍니다. */
export function applyAttempt(
  prev: ProblemStat | undefined,
  info: { problemId: string; index: number; question: string; tags: string[] },
  correct: boolean,
  answer: string,
): ProblemStat {
  return {
    key: statKey(info.problemId, info.index),
    problemId: info.problemId,
    index: info.index,
    question: info.question.slice(0, 500),
    tags: (info.tags || []).slice(0, 5),
    attempts: (prev?.attempts || 0) + 1,
    wrong: (prev?.wrong || 0) + (correct ? 0 : 1),
    streak: correct ? (prev?.streak || 0) + 1 : 0,
    lastCorrect: correct,
    lastAt: Date.now(),
    lastAnswer: answer.slice(0, 200),
  };
}

export async function saveStat(uid: string, stat: ProblemStat): Promise<void> {
  await setDoc(doc(statsCol(uid), stat.key), stat);
}

export const isMastered = (s?: ProblemStat) => !!s && s.streak >= MASTERED_STREAK;

export function isDue(s: ProblemStat | undefined, now = Date.now()): boolean {
  if (!s || isMastered(s)) return false;
  if (!s.lastCorrect) return true;
  const days = INTERVAL_DAYS[Math.min(s.streak, INTERVAL_DAYS.length - 1)];
  return now - s.lastAt >= days * DAY;
}

// ---------- 객관식 ----------

const CIRCLED = ['①', '②', '③', '④', '⑤'];

/** 문제에 ①~⑤가 있으면 객관식 보기 번호 목록 */
export function getChoices(question: string): string[] {
  const found = CIRCLED.filter((c) => question.includes(c));
  return found.length >= 2 ? found : [];
}

/** 정답 문자열에서 보기 번호(①~⑤)를 찾아냄: "①", "1", "1번", "① 국가의..." 모두 처리 */
export function answerChoice(answer: string): string | null {
  const a = answer.trim();
  const circled = CIRCLED.find((c) => a.startsWith(c)) || CIRCLED.find((c) => a.includes(c));
  if (circled) return circled;
  const m = /^\(?([1-5])\)?(?!\d)/.exec(a);
  return m ? CIRCLED[Number(m[1]) - 1] : null;
}

// ---------- 분석 ----------

export interface ConceptStat { tag: string; attempts: number; wrong: number; accuracy: number }

export function weakConcepts(stats: StatsMap, validIds: Set<string>): ConceptStat[] {
  const byTag = new Map<string, { attempts: number; wrong: number }>();
  Object.values(stats).forEach((s) => {
    if (!validIds.has(s.problemId)) return;
    (s.tags || []).forEach((t) => {
      const v = byTag.get(t) || { attempts: 0, wrong: 0 };
      v.attempts += s.attempts;
      v.wrong += s.wrong;
      byTag.set(t, v);
    });
  });
  return [...byTag.entries()]
    .map(([tag, v]) => ({ tag, ...v, accuracy: v.attempts ? Math.round(((v.attempts - v.wrong) / v.attempts) * 100) : 0 }))
    .filter((c) => c.wrong > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong);
}

/** 기록 속 모든 유사 문제를 시험 문제 형태로 */
export function buildPool(history: ProblemHistoryItem[]): QuizQuestion[] {
  const pool: QuizQuestion[] = [];
  history.forEach((item) => {
    (item.similarProblems || []).forEach((p, i) => {
      if (!p?.question || !p?.answer) return;
      pool.push({
        id: statKey(item.id, i),
        question: p.question,
        answer: p.answer,
        hint: p.hint || '',
        svgCode: p.svgCode || '',
        steps: p.steps || [],
        sourceTitle: (p.fromWrong !== undefined ? '오답 연습 · ' : '') + ((item.tags || []).slice(0, 2).join(' · ') || item.dateString),
        originalProblemId: item.id,
        index: i,
        tags: item.tags || [],
        subject: subjectOf(item),
        unit: unitOf(item),
      });
    });
  });
  return pool;
}

/** 복습 우선순위: 최근에 틀린 것 → 많이 틀린 것 → 오래된 것 */
export function reviewQueue(pool: QuizQuestion[], stats: StatsMap): QuizQuestion[] {
  const now = Date.now();
  return pool
    .filter((q) => isDue(stats[q.id], now))
    .sort((a, b) => {
      const sa = stats[a.id]!, sb = stats[b.id]!;
      if (sa.lastCorrect !== sb.lastCorrect) return sa.lastCorrect ? 1 : -1;
      const ra = sa.wrong / sa.attempts, rb = sb.wrong / sb.attempts;
      if (ra !== rb) return rb - ra;
      return sa.lastAt - sb.lastAt;
    });
}

// ---------- 과목·단원 ----------

export const UNCLASSIFIED = '미분류';
export const subjectOf = (p: { subject?: string }) => (p.subject && p.subject.trim()) || UNCLASSIFIED;
export const unitOf = (p: { unit?: string }) => (p.unit && p.unit.trim()) || '단원 미지정';

export interface GroupStat { name: string; problems: number; attempts: number; wrong: number; accuracy: number | null; due: number }

/** 과목별(또는 한 과목 안의 단원별) 문제 수·정답률·복습할 문제 수 */
export function groupStats(pool: QuizQuestion[], stats: StatsMap, by: 'subject' | 'unit'): GroupStat[] {
  const now = Date.now();
  const map = new Map<string, GroupStat>();
  pool.forEach((q) => {
    const name = by === 'subject' ? q.subject : q.unit;
    const g = map.get(name) || { name, problems: 0, attempts: 0, wrong: 0, accuracy: null, due: 0 };
    g.problems += 1;
    const st = stats[q.id];
    if (st) { g.attempts += st.attempts; g.wrong += st.wrong; if (isDue(st, now)) g.due += 1; }
    map.set(name, g);
  });
  return [...map.values()]
    .map((g) => ({ ...g, accuracy: g.attempts ? Math.round(((g.attempts - g.wrong) / g.attempts) * 100) : null }))
    .sort((a, b) => (a.name === UNCLASSIFIED ? 1 : b.name === UNCLASSIFIED ? -1 : a.name.localeCompare(b.name, 'ko')));
}
