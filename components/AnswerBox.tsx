import React, { useState } from 'react';
import { CheckCircle, XCircle, Loader2, RotateCcw } from 'lucide-react';
import { getChoices } from '../services/learning';

export interface GradeResult { correct: boolean; feedback: string }

interface Props {
  question: string;
  /** 자동 채점이 안 될 때 스스로 채점용으로만 보여 줌 */
  answer: string;
  onGrade: (userAnswer: string) => Promise<GradeResult>;
  /** 채점이 끝났을 때 (기록 저장 등) */
  onResult?: (r: GradeResult, userAnswer: string) => void;
  /** 결과 후 '다시 풀기' 버튼 표시 */
  allowRetry?: boolean;
  size?: 'sm' | 'lg';
  autoFocus?: boolean;
}

const AnswerBox: React.FC<Props> = ({ question, answer, onGrade, onResult, allowRetry = true, size = 'sm', autoFocus }) => {
  const choices = getChoices(question);
  const [input, setInput] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState('');

  const submit = async (value: string) => {
    if (!value.trim() || grading) return;
    setGrading(true); setError(null);
    try {
      const r = await onGrade(value);
      setResult(r);
      onResult?.(r, value);
    } catch (e: any) {
      setPending(value);
      setError(e?.message || '자동 채점을 하지 못했어요.');
    } finally {
      setGrading(false);
    }
  };

  const reset = () => { setInput(''); setPicked(null); setResult(null); setError(null); setPending(''); };
  const lg = size === 'lg';

  return (
    <div className="space-y-2">
      {choices.length > 0 ? (
        <div className="flex gap-2" role="group" aria-label="보기 선택">
          {choices.map((c) => {
            const isPicked = picked === c;
            const state = result && isPicked ? (result.correct ? 'ok' : 'bad') : null;
            return (
              <button
                key={c}
                disabled={!!result || grading}
                onClick={() => { setPicked(c); submit(c); }}
                className={`flex-1 ${lg ? 'py-4 text-2xl' : 'py-2.5 text-xl'} rounded-xl border-2 font-bold transition-colors disabled:cursor-default
                  ${state === 'ok' ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' :
                    state === 'bad' ? 'border-rose-500 bg-rose-50 text-rose-600 dark:bg-rose-900/30' :
                    isPicked ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30' :
                    'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700'}`}
              >
                {grading && isPicked ? <Loader2 size={18} className="animate-spin mx-auto" /> : c}
              </button>
            );
          })}
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(input); }} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!!result || grading}
            autoFocus={autoFocus}
            placeholder="답 입력"
            className={`flex-1 min-w-0 px-3 ${lg ? 'py-4 text-lg' : 'py-2.5 text-sm'} rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 dark:text-white focus:outline-none focus:border-blue-400 disabled:opacity-70`}
          />
          {!result && (
            <button type="submit" disabled={!input.trim() || grading} className={`${lg ? 'px-6' : 'px-4'} rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 shrink-0`}>
              {grading ? <Loader2 size={16} className="animate-spin" /> : '채점'}
            </button>
          )}
        </form>
      )}

      {result && (
        <div className={`rounded-xl px-3 py-2.5 text-sm animate-fade-in ${result.correct ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400'}`}>
          <div className="flex items-center gap-2 font-bold">
            {result.correct ? <CheckCircle size={16} /> : <XCircle size={16} />}
            {result.correct ? '정답이에요!' : '아쉬워요, 다시 생각해 볼까요?'}
            {allowRetry && !result.correct && (
              <button onClick={reset} className="ml-auto text-xs font-medium underline flex items-center gap-1"><RotateCcw size={12} /> 다시 풀기</button>
            )}
          </div>
          {result.feedback && <p className="mt-1 text-slate-600 dark:text-slate-300">{result.feedback}</p>}
        </div>
      )}
      {error && !result && (
        <div className="rounded-xl px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 space-y-2">
          <p className="text-xs text-slate-500">{error} 정답을 보고 스스로 채점해 주세요.</p>
          <p className="text-slate-700 dark:text-slate-200">정답 <b>{answer}</b> · 내 답 <b>{pending}</b></p>
          <div className="flex gap-2">
            {[false, true].map((ok) => (
              <button
                key={String(ok)}
                onClick={() => { const r = { correct: ok, feedback: '' }; setResult(r); setError(null); onResult?.(r, pending); }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold ${ok ? 'bg-emerald-500 text-white' : 'border-2 border-rose-200 text-rose-500'}`}
              >
                {ok ? '맞았어요' : '틀렸어요'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnswerBox;
