import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, CheckCircle, XCircle, Trophy, Lightbulb, RotateCcw, ChevronDown, ChevronUp, ArrowRight, Brain, Target, Sparkles, Shuffle, AlertTriangle } from 'lucide-react';
import type { ProblemHistoryItem, QuizQuestion, QuizResult } from '../types';
import { addQuizResult, fetchQuizResults } from '../services/userData';
import { buildPool, groupStats, isDue, isMastered, reviewQueue, weakConcepts, type StatsMap } from '../services/learning';
import AnswerBox, { type GradeResult } from './AnswerBox';
import SafeSvg from './SafeSvg';

interface Props {
  uid: string;
  history: ProblemHistoryItem[];
  stats: StatsMap;
  onGrade: (q: { question: string; answer: string }, answer: string) => Promise<GradeResult>;
  onRecord: (q: QuizQuestion, correct: boolean, answer: string) => void;
  onExit: () => void;
}

type Phase = 'start' | 'question' | 'finished';
const ALL = '전체';
const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`shrink-0 text-sm font-medium px-3.5 py-1.5 rounded-full border transition-colors ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'}`}
  >
    {children}
  </button>
);

const Bar: React.FC<{ value: number | null }> = ({ value }) => (
  <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
    {value !== null && (
      <div className={`h-full rounded-full ${value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${Math.max(value, 4)}%` }} />
    )}
  </div>
);

const QuizView: React.FC<Props> = ({ uid, history, stats, onGrade, onRecord, onExit }) => {
  const pool = useMemo(() => buildPool(history), [history]);
  const [subject, setSubject] = useState(ALL);
  const [unit, setUnit] = useState(ALL);

  const [phase, setPhase] = useState<Phase>('start');
  const [modeLabel, setModeLabel] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [isRetry, setIsRetry] = useState(false);

  useEffect(() => { fetchQuizResults(uid).then(setResults).catch(() => setResults([])); }, [uid]);

  // ----- 범위(과목·단원) -----
  const subjects = useMemo(() => groupStats(pool, stats, 'subject'), [pool, stats]);
  const inSubject = useMemo(() => (subject === ALL ? pool : pool.filter((q) => q.subject === subject)), [pool, subject]);
  const units = useMemo(() => (subject === ALL ? [] : groupStats(inSubject, stats, 'unit')), [inSubject, subject, stats]);
  const scope = useMemo(() => (unit === ALL ? inSubject : inSubject.filter((q) => q.unit === unit)), [inSubject, unit]);

  // ----- 범위 안의 학습 상태 -----
  const tried = scope.filter((q) => stats[q.id]);
  const attempts = tried.reduce((n, q) => n + stats[q.id].attempts, 0);
  const wrongs = tried.reduce((n, q) => n + stats[q.id].wrong, 0);
  const accuracy = attempts ? Math.round(((attempts - wrongs) / attempts) * 100) : null;
  const due = useMemo(() => reviewQueue(scope, stats), [scope, stats]);
  const fresh = scope.filter((q) => !stats[q.id]);
  const mastered = scope.filter((q) => isMastered(stats[q.id])).length;
  const weak = useMemo(() => weakConcepts(stats, new Set(scope.map((q) => q.originalProblemId))), [stats, scope]);
  const frequentWrong = useMemo(
    () => tried.filter((q) => stats[q.id].wrong > 0 && !isMastered(stats[q.id])).sort((a, b) => stats[b.id].wrong - stats[a.id].wrong).slice(0, 5),
    [tried, stats],
  );

  const start = (qs: QuizQuestion[], label: string, retry = false) => {
    if (qs.length === 0) return;
    setQuestions(qs.map((q) => ({ ...q, userAnswer: undefined, isCorrect: undefined, feedback: undefined })));
    setIndex(0); setIsRetry(retry); setModeLabel(label);
    setChecked(false); setShowHint(false); setShowSteps(false);
    setPhase('question');
  };

  const startWeak = () => {
    const tag = weak[0]?.tag;
    if (!tag) return;
    const qs = scope.filter((q) => q.tags.includes(tag) && !isMastered(stats[q.id]));
    // 틀린 적 있는 문제 먼저, 그다음 아직 안 푼 문제
    const sorted = [...qs].sort((a, b) => (stats[b.id]?.wrong || 0) - (stats[a.id]?.wrong || 0));
    start(sorted.slice(0, 10), `약한 개념 · #${tag}`);
  };

  const handleResult = (r: GradeResult, answer: string) => {
    const q = questions[index];
    setQuestions((list) => list.map((x, i) => (i === index ? { ...x, userAnswer: answer, isCorrect: r.correct, feedback: r.feedback } : x)));
    onRecord(q, r.correct, answer);
    setChecked(true);
  };

  const next = () => {
    if (index < questions.length - 1) {
      setIndex(index + 1); setChecked(false); setShowHint(false); setShowSteps(false);
      return;
    }
    setPhase('finished');
    if (!isRetry) {
      const r: QuizResult = { timestamp: Date.now(), total: questions.length, correct: questions.filter((q) => q.isCorrect).length };
      setResults((list) => [r, ...list].slice(0, 10));
      addQuizResult(uid, r).catch(() => {});
    }
  };

  // ---------- 화면 ----------

  if (pool.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-fade-in">
        <GraduationCap size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">아직 시험 문제가 없어요</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-2">문제를 하나 분석하면 AI가 만든 유사 문제가 여기에 쌓여요.</p>
        <button onClick={onExit} className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">문제 분석하러 가기</button>
      </div>
    );
  }

  if (phase === 'start') {
    const modes = [
      { icon: Brain, title: '맞춤 복습', desc: due.length ? `복습할 때가 된 문제 ${due.length}개 (틀린 문제 우선)` : '지금 복습할 문제가 없어요', count: due.length, onClick: () => start(due.slice(0, 10), '맞춤 복습'), color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
      { icon: Target, title: '약한 개념 집중', desc: weak[0] ? `#${weak[0].tag} 정답률 ${weak[0].accuracy}%` : '틀린 개념이 아직 없어요', count: weak[0] ? 1 : 0, onClick: startWeak, color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30' },
      { icon: Sparkles, title: '새 문제 풀기', desc: fresh.length ? `아직 안 푼 문제 ${fresh.length}개` : '모두 한 번씩 풀었어요', count: fresh.length, onClick: () => start(shuffle(fresh).slice(0, 10), '새 문제'), color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
      { icon: Shuffle, title: '무작위 시험', desc: `범위 안 ${scope.length}문제 중 10개`, count: scope.length, onClick: () => start(shuffle(scope).slice(0, 10), '무작위 시험'), color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/30' },
    ];
    const groups = subject === ALL ? subjects : units;

    return (
      <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><GraduationCap className="text-blue-500" /> 학습 센터</h2>

        {/* 범위 선택 */}
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Chip active={subject === ALL} onClick={() => { setSubject(ALL); setUnit(ALL); }}>전체 과목</Chip>
            {subjects.map((g) => (
              <Chip key={g.name} active={subject === g.name} onClick={() => { setSubject(g.name); setUnit(ALL); }}>{g.name} <span className="opacity-60">{g.problems}</span></Chip>
            ))}
          </div>
          {subject !== ALL && units.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 pl-3 border-l-2 border-blue-200 dark:border-blue-800">
              <Chip active={unit === ALL} onClick={() => setUnit(ALL)}>모든 단원</Chip>
              {units.map((g) => <Chip key={g.name} active={unit === g.name} onClick={() => setUnit(g.name)}>{g.name}</Chip>)}
            </div>
          )}
        </div>

        {/* 요약 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            ['정답률', accuracy === null ? '-' : `${accuracy}%`],
            ['푼 문제', `${tried.length} / ${scope.length}`],
            ['복습할 문제', `${due.length}`],
            ['졸업', `${mastered}`],
          ].map(([k, v]) => (
            <div key={k} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">{k}</p>
              <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">{v}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 -mt-2">틀린 문제는 바로, 맞힌 문제는 1일·3일·7일 뒤에 다시 나와요. 3번 연속 맞히면 졸업!</p>

        {/* 풀기 방법 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {modes.map(({ icon: I, title, desc, count, onClick, color }) => (
            <button
              key={title}
              onClick={onClick}
              disabled={!count}
              className="text-left bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-md transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:shadow-none flex items-center gap-3"
            >
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}><I size={22} /></span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-slate-800 dark:text-white">{title}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{desc}</span>
              </span>
              {!!count && <ArrowRight size={18} className="text-slate-300" />}
            </button>
          ))}
        </div>

        {/* 과목·단원별 정답률 */}
        {groups.some((g) => g.attempts > 0) && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-sm">{subject === ALL ? '과목별 정답률' : `${subject} 단원별 정답률`}</h3>
            <ul className="space-y-3">
              {groups.map((g) => (
                <li key={g.name}>
                  <button
                    onClick={() => (subject === ALL ? (setSubject(g.name), setUnit(ALL)) : setUnit(g.name))}
                    className="w-full text-left"
                  >
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-700 dark:text-slate-200 truncate">{g.name}</span>
                      <span className="text-slate-500 shrink-0 ml-2">
                        {g.accuracy === null ? '아직 안 풂' : `${g.accuracy}%`}
                        {g.due > 0 && <span className="ml-2 text-blue-600 font-medium">복습 {g.due}</span>}
                      </span>
                    </div>
                    <Bar value={g.accuracy} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 약한 개념 */}
        {weak.length > 0 && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-sm flex items-center gap-1.5"><AlertTriangle size={15} className="text-amber-500" /> 자주 틀리는 개념</h3>
            <div className="flex flex-wrap gap-2">
              {weak.slice(0, 8).map((c) => (
                <span key={c.tag} className="text-xs px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">#{c.tag} · {c.accuracy}%</span>
              ))}
            </div>
          </section>
        )}

        {/* 자주 틀리는 문제 */}
        {frequentWrong.length > 0 && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">자주 틀리는 문제</h3>
              <button onClick={() => start(frequentWrong, '자주 틀리는 문제')} className="text-xs font-bold text-blue-600 hover:underline">이 문제들 다시 풀기</button>
            </div>
            <ul className="space-y-2">
              {frequentWrong.map((q) => (
                <li key={q.id} className="flex items-center gap-3 text-sm">
                  <span className="shrink-0 text-xs font-bold text-rose-500 w-14">{stats[q.id].wrong}번 틀림</span>
                  <span className="truncate text-slate-600 dark:text-slate-300">{q.question}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {results.length > 0 && (
          <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-sm">최근 시험 점수</h3>
            <ul className="space-y-2">
              {results.slice(0, 5).map((r, i) => (
                <li key={r.id || i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{new Date(r.timestamp).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round((r.correct / r.total) * 100)}점 <span className="text-slate-400 font-normal">({r.correct}/{r.total})</span></span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  if (phase === 'finished') {
    const correct = questions.filter((q) => q.isCorrect).length;
    const wrong = questions.filter((q) => !q.isCorrect);
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 text-center animate-fade-in max-w-lg mx-auto mt-4 shadow-lg">
        <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
          <Trophy size={40} className="text-yellow-600 dark:text-yellow-500" />
        </div>
        <p className="text-sm text-slate-400">{modeLabel}</p>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{isRetry ? '오답 다시 풀기 끝!' : '끝까지 풀었어요!'}</h2>
        <div className="text-5xl font-black text-blue-600 dark:text-blue-400 my-4">{Math.round((correct / questions.length) * 100)}점</div>
        <p className="text-sm text-slate-400 mb-6">{questions.length}문제 중 {correct}문제 정답</p>
        <ul className="space-y-2 mb-8 text-left">
          {questions.map((q, i) => (
            <li key={q.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-sm">
              {q.isCorrect ? <CheckCircle size={16} className="text-emerald-500 shrink-0" /> : <XCircle size={16} className="text-rose-500 shrink-0" />}
              <span className="text-slate-600 dark:text-slate-200 truncate flex-1">{i + 1}. {q.question}</span>
              {!q.isCorrect && <span className="text-xs text-slate-400 shrink-0">정답 {q.answer}</span>}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3">
          {wrong.length > 0 && (
            <button onClick={() => start(wrong, '오답 다시 풀기', true)} className="w-full py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 flex items-center justify-center gap-2">
              <RotateCcw size={18} /> 틀린 {wrong.length}문제 바로 다시 풀기
            </button>
          )}
          <button onClick={() => setPhase('start')} className="w-full py-3 bg-slate-800 dark:bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700">학습 센터로</button>
        </div>
      </div>
    );
  }

  const q = questions[index];
  const st = stats[q.id];
  return (
    <div className="max-w-2xl mx-auto mt-2 animate-fade-in">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{modeLabel} · {index + 1} / {questions.length}</span>
        <button onClick={() => setPhase('start')} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">그만하기</button>
      </div>
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mb-6">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${((index + (checked ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">{q.subject} · {q.unit}</span>
          {st && !st.lastCorrect && <span className="px-2 py-1 bg-rose-50 dark:bg-rose-900/20 text-rose-500 text-xs font-bold rounded-full">지난번에 틀린 문제</span>}
          {st && isDue(st) && st.lastCorrect && <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 text-xs font-bold rounded-full">복습할 때가 됐어요</span>}
        </div>
        {q.svgCode && (
          <div className="w-full max-w-[260px] aspect-square mx-auto mb-4 bg-white rounded-xl p-2 border border-slate-200">
            <SafeSvg svg={q.svgCode} />
          </div>
        )}
        <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white leading-relaxed mb-6 whitespace-pre-wrap">{q.question}</h3>

        <AnswerBox key={q.id + index} question={q.question} answer={q.answer} onGrade={(a) => onGrade(q, a)} onResult={handleResult} allowRetry={false} size="lg" autoFocus />

        {!checked && q.hint && (
          showHint
            ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3"><b>힌트</b> {q.hint}</p>
            : <button onClick={() => setShowHint(true)} className="mt-3 text-sm text-slate-500 hover:text-emerald-600 flex items-center gap-1"><Lightbulb size={14} /> 힌트 보기</button>
        )}

        {checked && (
          <div className="mt-4 space-y-4 animate-fade-in">
            <p className="text-sm text-slate-600 dark:text-slate-300">정답 <b className="text-blue-600 dark:text-blue-400">{q.answer}</b></p>
            {q.steps.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl">
                <button onClick={() => setShowSteps(!showSteps)} className="w-full flex items-center justify-between p-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                  풀이 보기 {showSteps ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showSteps && (
                  <ol className="px-4 pb-4 space-y-3">
                    {q.steps.map((s, i) => (
                      <li key={i} className="text-sm">
                        <p className="font-bold text-slate-700 dark:text-slate-200">{i + 1}. {s.title}</p>
                        <p className="text-slate-600 dark:text-slate-400">{s.description}</p>
                        {s.equation && <p className="font-mono text-blue-600 dark:text-blue-400 mt-1">{s.equation}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
            <button onClick={next} className="w-full py-4 bg-slate-800 dark:bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700 flex items-center justify-center gap-2">
              {index < questions.length - 1 ? <>다음 문제 <ArrowRight size={18} /></> : '결과 보기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizView;
