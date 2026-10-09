import { collection, addDoc, query, where, getDocs, doc, setDoc, getDoc, deleteDoc, updateDoc, orderBy, limit } from 'firebase/firestore/lite';
import { db } from '../firebase';
import { PROVIDERS, PROVIDER_ORDER, isKnownModel, type ProviderId } from '../shared/ai/models';
import type { ProblemAnalysis, ProblemHistoryItem, QuizResult, SimilarProblem, UserSettings } from '../types';
import { defaultSettings } from './aiClient';

const settingsRef = (uid: string) => doc(db, 'users', uid, 'settings', 'config');

const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export async function loadSettings(uid: string): Promise<{ settings: UserSettings; legacyPlainKeys: boolean }> {
  const s = defaultSettings();
  const snap = await getDoc(settingsRef(uid));
  if (!snap.exists()) return { settings: s, legacyPlainKeys: false };
  const d: any = snap.data();
  if (d.theme === 'dark' || d.theme === 'light') s.theme = d.theme;
  if (typeof d.gradeLevel === 'string') s.gradeLevel = d.gradeLevel;
  if (PROVIDER_ORDER.includes(d.provider)) s.provider = d.provider;
  for (const p of PROVIDER_ORDER) {
    if (isKnownModel(p, d.models?.[p])) s.models[p] = d.models[p];
    if (typeof d.keys?.[p] === 'string' && d.keys[p]) s.keys[p] = d.keys[p];
    if (d.encKeys?.[p]?.cipher) s.encKeys[p] = { cipher: d.encKeys[p].cipher, last4: d.encKeys[p].last4 || '' };
  }
  // 예전 버전: Gemini 키 하나만 apiKey 필드에 저장
  if (typeof d.apiKey === 'string' && d.apiKey && !s.keys.gemini) s.keys.gemini = d.apiKey;
  const legacyPlainKeys = Object.keys(s.keys).length > 0;
  return { settings: s, legacyPlainKeys };
}

/** 관리자는 평문 키를 절대 저장하지 않고 암호문만 저장합니다. */
export async function saveSettings(uid: string, s: UserSettings, admin: boolean): Promise<void> {
  const data: Record<string, unknown> = {
    theme: s.theme,
    gradeLevel: s.gradeLevel,
    provider: s.provider,
    models: s.models,
    updatedAt: Date.now(),
  };
  if (admin) data.encKeys = s.encKeys;
  else data.keys = s.keys;
  await setDoc(settingsRef(uid), clean(data)); // 덮어쓰기 → 예전 apiKey 평문 필드 제거
}

export async function fetchHistory(uid: string): Promise<ProblemHistoryItem[]> {
  const snap = await getDocs(query(collection(db, 'problems'), where('userId', '==', uid)));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProblemHistoryItem);
  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export async function addHistory(uid: string, analysis: ProblemAnalysis): Promise<ProblemHistoryItem> {
  const item: Omit<ProblemHistoryItem, 'id'> = clean({
    ...analysis,
    userId: uid,
    timestamp: Date.now(),
    dateString: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
  });
  const ref = await addDoc(collection(db, 'problems'), item);
  return { id: ref.id, ...item };
}

export async function deleteHistory(id: string): Promise<void> {
  await deleteDoc(doc(db, 'problems', id));
}

export async function addQuizResult(uid: string, r: QuizResult): Promise<void> {
  await addDoc(collection(db, 'users', uid, 'quizResults'), clean(r));
}

export async function fetchQuizResults(uid: string): Promise<QuizResult[]> {
  const snap = await getDocs(query(collection(db, 'users', uid, 'quizResults'), orderBy('timestamp', 'desc'), limit(10)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as QuizResult) }));
}

export function providerLabel(p: ProviderId | undefined): string {
  return p ? PROVIDERS[p].name : '';
}

export async function updateSimilarProblems(id: string, similarProblems: SimilarProblem[]): Promise<void> {
  await updateDoc(doc(db, 'problems', id), { similarProblems: clean(similarProblems) });
}

export async function updateProblemMeta(id: string, meta: { subject: string; unit: string }): Promise<void> {
  await updateDoc(doc(db, 'problems', id), { subject: meta.subject, unit: meta.unit.trim() });
}
