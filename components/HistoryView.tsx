import React, { useMemo, useState } from 'react';
import type { ProblemHistoryItem } from '../types';
import { BookOpen, Calendar, ChevronRight, Search, Trash2, X } from 'lucide-react';

interface Props {
  history: ProblemHistoryItem[];
  onSelectProblem: (item: ProblemHistoryItem) => void;
  onDelete: (item: ProblemHistoryItem) => Promise<void>;
}

const difficultyStyle = (d: string) =>
  d === '상' || d === 'High'
    ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
    : d === '중' || d === 'Medium'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';

const HistoryView: React.FC<Props> = ({ history, onSelectProblem, onDelete }) => {
  const [keyword, setKeyword] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const topTags = useMemo(() => {
    const count = new Map<string, number>();
    history.forEach((h) => (h.tags || []).forEach((t) => count.set(t, (count.get(t) || 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
  }, [history]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return history.filter((h) => {
      if (tag && !(h.tags || []).includes(tag)) return false;
      if (!k) return true;
      return [h.ocrText, h.goal, h.finalAnswer, ...(h.tags || [])].some((v) => (v || '').toLowerCase().includes(k));
    });
  }, [history, keyword, tag]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-fade-in">
        <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <BookOpen size={40} className="text-slate-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">아직 학습 기록이 없어요</h3>
        <p className="text-slate-500 dark:text-slate-400">문제를 찍어 올리면 풀이가 여기에 자동으로 저장돼요.</p>
      </div>
    );
  }

  const remove = async (item: ProblemHistoryItem) => {
    setDeletingId(item.id);
    try { await onDelete(item); } finally { setDeletingId(null); setConfirmId(null); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <BookOpen className="text-blue-500" /> 나의 학습 기록
        </h2>
        <span className="text-sm text-slate-400">{filtered.length} / {history.length}개</span>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="문제 내용·개념으로 찾기"
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:border-blue-400"
        />
        {keyword && <button onClick={() => setKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label="검색어 지우기"><X size={16} /></button>}
      </div>

      {topTags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {topTags.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${tag === t ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'}`}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map((item) => (
          <div key={item.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all">
            <button onClick={() => onSelectProblem(item)} className="w-full text-left p-5 group">
              <div className="flex justify-between items-center mb-2">
                <span className="flex items-center gap-1.5 text-slate-400 text-xs"><Calendar size={13} /> {item.dateString}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${difficultyStyle(item.difficulty)}`}>난이도 {item.difficulty}</span>
              </div>
              <p className="text-slate-800 dark:text-slate-100 font-medium mb-3 line-clamp-2">{item.ocrText}</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {(item.tags || []).slice(0, 3).map((t) => (
                    <span key={t} className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded">#{t}</span>
                  ))}
                </div>
                <ChevronRight className="text-slate-300 group-hover:text-blue-500 shrink-0" size={20} />
              </div>
            </button>
            <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-2 flex justify-end">
              {confirmId === item.id ? (
                <span className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">이 기록을 지울까요?</span>
                  <button onClick={() => setConfirmId(null)} className="text-slate-500 hover:underline">취소</button>
                  <button onClick={() => remove(item)} disabled={deletingId === item.id} className="font-bold text-rose-600 hover:underline">{deletingId === item.id ? '지우는 중...' : '삭제'}</button>
                </span>
              ) : (
                <button onClick={() => setConfirmId(item.id)} className="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-1"><Trash2 size={13} /> 삭제</button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-400 py-10">조건에 맞는 기록이 없어요.</p>}
      </div>
    </div>
  );
};

export default HistoryView;
