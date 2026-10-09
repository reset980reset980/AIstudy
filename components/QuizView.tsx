import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, CheckCircle, XCircle, Trophy, Lightbulb, Loader2, RotateCcw, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import type { ProblemHistoryItem, QuizQuestion, QuizResult, UserSettings } from '../types';
import { gradeAnswer, pickProvider } from '../services/aiClient';
import { addQuizResult, fetchQuizResults } from '../services/userData';
import SafeSvg from './SafeSvg';

interface Props {
  uid: string;
  history: ProblemHistoryItem[];
  settings: UserSettings;
  admin: boolean;
  onExit: () => void;
}

type Phase = 'start' | 'question' | 'finished';

function buildPool(history: ProblemHistoryItem[]): QuizQuestion[] {
  const pool: QuizQuestion[] = [];
  history.forEach((item) => {
    (item.similarProblems || []).forEach((p, i) => {
      if (!p?.question || !p?.answer) return;
      pool.push({
        id: `${item.id}-${i}`,
        question: p.question,
        answer: p.answer,
        hint: p.hint || '',
        svgCode: p.svgCode || '',
        steps: p.steps || [],
        sourceTitle: (item.tags || []).slice(0, 2).join(' · ') || item.dateString,
        originalProblemId: item.id,
      });
    });
  });
  return pool;
}

const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

const QuizView: React.FC<Props> = ({ uid, history, settings, admin, onExit }) => {
  const pool = useMemo(() => buildPool(history), [history]);
  const canAutoGrade = !!pickProvider(settings, admin);

  const [phase, setPhase] = useState<Phase>('start');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [grading, setGrading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [needSelfGrade, setNeedSelfGrade] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [isRetry, setIsRetry] = useState(false);

  useEffect(() => {
    fetchQuizResults(uid).then(setResults).catch(() => setResults([]));
  }, [uid]);

  const start = (qs: QuizQuestion[], retry = false) => {
    setQuestions(qs.map((q) => ({ ...q, userAnswer: undefined, isCorrect: undefined, feedback: undefined })));
    setIndex(0);
    setIsRetry(retry);
    resetQuestion();
    setPhase('question');
  };

  const resetQuestion = () => {
    setInput(''); setChecked(false); setNeedSelfGrade(false); setShowHint(false); setShowSteps(false);
  };

  const update = (patch: Partial<QuizQuestion>) => {
    setQuestions((list) => list.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const submit = async () => {
    const q = questions[index];
    setGrading(true);
    try {
      const r = await gradeAnswer(q, input, settings, admin);
      update({ userAnswer: input, isCorrect: r.correct, feedback: r.feedback });
      setChecked(true);
    } catch {
      // 키가 없거나 AI 오류 → 스스로 채점
      update({ userAnswer: input });
      setNeedSelfGrade(true);
      setChecked(true);
    } finally {
      setGrading(false);
    }
  };

  const selfGrade = (correct: boolean) => {
    update({ isCorrect: correct, feedback: correct ? '스스로 맞았다고 표시했어요.' : '다음에 다시 풀어 봐요.' });
    setNeedSelfGrade(false);
  };

  const next = async () => {
    if (index < questions.length - 1) {
      setIndex(index + 1);
      resetQuestion();
      return;
    }
    setPhase('finished');
    const correct = questions.filter((q) => q.isCorrect).length;
    if (!isRetry) {
      const r: QuizResult = { timestamp: Date.now(), total: questions.length, correct };
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
        <p className="text-slate-500 dark:text-slate-400 mt-2">문제를 하나 분석하면 AI가 만든 유사 문제 3개가 시험 문제로 쌓여요.</p>
        <button onClick={onExit} className="mt-6 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">문제 분석하러 가기</button>
      </div>
    );
  }

  if (phase === 'start') {
    const sizes = [5, 10].filter((n, i) => i === 0 || pool.length > 5);
    return (
      <div className="max-w-xl mx-auto mt-6 space-y-6 animate-fade-in">
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
            <GraduationCap size={32} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">나만의 시험</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            지금까지 분석한 문제로 만든 <b className="text-blue-600">유사 문제 {pool.length}개</b> 중에서 무작위로 출제해요.
          </p>
          <p className="text-xs mt-2 text-slate-400">
            {canAutoGrade ? '답을 입력하면 AI가 자동으로 채점해요.' : 'AI 키가 없어서 정답을 보고 스스로 채점해요.'}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            {sizes.map((n) => (
              <button key={n} onClick={() => start(shuffle(pool).slice(0, n))} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none">
                {Math.min(n, pool.length)}문제 시작
              </button>
            ))}
          </div>
        </div>
        {results.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-3 text-sm">최근 시험 기록</h3>
            <ul className="space-y-2">
              {results.slice(0, 5).map((r, i) => (
                <li key={r.id || i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{new Date(r.timestamp).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{Math.round((r.correct / r.total) * 100)}점 <span className="text-slate-400 font-normal">({r.correct}/{r.total})</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'finished') {
    const correct = questions.filter((q) => q.isCorrect).length;
    const wrong = questions.filter((q) => !q.isCorrect);
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 text-center animate-fade-in max-w-lg mx-auto mt-6 shadow-lg">
        <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
          <Trophy size={40} className="text-yellow-600 dark:text-yellow-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-1">{isRetry ? '오답 다시 풀기 끝!' : '시험 끝!'}</h2>
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
            <button onClick={() => start(wrong, true)} className="w-full py-3 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 flex items-center justify-center gap-2">
              <RotateCcw size={18} /> 틀린 {wrong.length}문제 다시 풀기
            </button>
          )}
          <button onClick={() => setPhase('start')} className="w-full py-3 bg-slate-800 dark:bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700">처음으로</button>
        </div>
      </div>
    );
  }

  const q = questions[index];
  return (
    <div className="max-w-2xl mx-auto mt-4 animate-fade-in">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{isRetry && '오답 · '}문제 {index + 1} / {questions.length}</span>
        <button onClick={() => setPhase('start')} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">그만하기</button>
      </div>
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full mb-6">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${((index + (checked ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-700">
        <span className="inline-block px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full mb-4">{q.sourceTitle}</span>
        {q.svgCode && (
          <div className="w-full max-w-[260px] aspect-square mx-auto mb-4 bg-slate-50 dark:bg-slate-100 rounded-xl p-2 border border-slate-100">
            <SafeSvg svg={q.svgCode} />
          </div>
        )}
        <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white leading-relaxed mb-6 whitespace-pre-wrap">{q.question}</h3>

        {!checked ? (
          <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) submit(); }} className="space-y-3">
            <input
              type="text"
              autoFocus
              placeholder="정답을 입력하세요"
              className="w-full p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:border-blue-400 dark:text-white text-lg"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={grading}
            />
            {q.hint && (
              showHint ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3"><b>힌트</b> {q.hint}</p>
              ) : (
                <button type="button" onClick={() => setShowHint(true)} className="text-sm text-slate-500 hover:text-emerald-600 flex items-center gap-1"><Lightbulb size={14} /> 힌트 보기</button>
              )
            )}
            <button type="submit" disabled={!input.trim() || grading} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {grading ? <><Loader2 size={18} className="animate-spin" /> 채점 중...</> : '제출하기'}
            </button>
          </form>
        ) : (
          <div className="animate-fade-in space-y-4">
            {needSelfGrade ? (
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-5 border border-slate-100 dark:border-slate-700 text-center">
                <p className="text-sm text-slate-500 mb-1">정답</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">{q.answer}</p>
                <p className="text-sm text-slate-500 mb-4">내 답: {q.userAnswer}</p>
                <p className="text-slate-700 dark:text-slate-300 font-medium mb-3">맞았나요?</p>
                <div className="flex gap-3">
                  <button onClick={() => selfGrade(false)} className="flex-1 py-3 border-2 border-rose-200 text-rose-500 rounded-xl font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center justify-center gap-2"><XCircle size={18} /> 틀렸어요</button>
                  <button onClick={() => selfGrade(true)} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 flex items-center justify-center gap-2"><CheckCircle size={18} /> 맞았어요</button>
                </div>
              </div>
            ) : (
              <div className={`rounded-xl p-5 border ${q.isCorrect ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800'}`}>
                <p className={`font-bold text-lg flex items-center gap-2 ${q.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {q.isCorrect ? <><CheckCircle size={20} /> 정답이에요!</> : <><XCircle size={20} /> 아쉬워요</>}
                </p>
                {q.feedback && <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">{q.feedback}</p>}
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">내 답 <b>{q.userAnswer}</b> · 정답 <b>{q.answer}</b></p>
              </div>
            )}

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

            {!needSelfGrade && (
              <button onClick={next} className="w-full py-4 bg-slate-800 dark:bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700 flex items-center justify-center gap-2">
                {index < questions.length - 1 ? <>다음 문제 <ArrowRight size={18} /></> : '결과 보기'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizView;
