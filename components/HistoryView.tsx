import React, { useMemo, useState } from 'react';
import { SUBJECTS, type ProblemHistoryItem } from '../types';
import { subjectOf, unitOf, UNCLASSIFIED } from '../services/learning';
import { BookOpen, Calendar, ChevronRight, Search, Trash2, X, Pencil } from 'lucide-react';

interface Props {
  history: ProblemHistoryItem[];
  onSelectProblem: (item: ProblemHistoryItem) => void;
  onDelete: (item: ProblemHistoryItem) => Promise<void>;
  onUpdateMeta: (item: ProblemHistoryItem, meta: { subject: string; unit: string }) => Promise<void>;
}

const difficultyStyle = (d: string) =>
  d === '상' || d === 'High'
    ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
    : d === '중' || d === 'Medium'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';

const HistoryView: React.FC<Props> = ({ history, onSelectProblem, onDelete, onUpdateMeta }) => {
  const [keyword, setKeyword] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);

  const subjectCounts = useMemo(() => {
    const m = new Map<string, number>();
    history.forEach((h) => m.set(subjectOf(h), (m.get(subjectOf(h)) || 0) + 1));
    return [...m.entries()].sort((a, b) => (a[0] === UNCLASSIFIED ? 1 : b[0] === UNCLASSIFIED ? -1 : a[0].localeCompare(b[0], 'ko')));
  }, [history]);

  const knownUnits = useMemo(() => [...new Set(history.map((h) => h.unit).filter(Boolean) as string[])].sort(), [history]);

  const openEdit = (item: ProblemHistoryItem) => {
    setEditId(item.id);
    setEditSubject(item.subject && (SUBJECTS as readonly string[]).includes(item.subject) ? item.subject : '수학');
    setEditUnit(item.unit || '');
  };

  const saveMeta = async (item: ProblemHistoryItem) => {
    setSavingMeta(true);
    try { await onUpdateMeta(item, { subject: editSubject, unit: editUnit }); setEditId(null); } finally { setSavingMeta(false); }
  };

  const topTags = useMemo(() => {
    const count = new Map<string, number>();
    history.forEach((h) => (h.tags || []).forEach((t) => count.set(t, (count.get(t) || 0) + 1)));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
  }, [history]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return history.filter((h) => {
      if (subject && subjectOf(h) !== subject) return false;
      if (tag && !(h.tags || []).includes(tag)) return false;
      if (!k) return true;
      return [h.ocrText, h.goal, h.finalAnswer, ...(h.tags || [])].some((v) => (v || '').toLowerCase().includes(k));
    });
  }, [history, keyword, tag, subject]);

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

      {subjectCounts.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[[null, history.length] as const, ...subjectCounts].map(([name, n]) => (
            <button
              key={name ?? 'all'}
              onClick={() => setSubject(name)}
              className={`shrink-0 text-sm font-medium px-3.5 py-1.5 rounded-full border transition-colors ${subject === name ? 'bg-slate-800 border-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
            >
              {name ?? '전체'} <span className="opacity-60">{n}</span>
            </button>
          ))}
        </div>
      )}

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
                <span className="flex items-center gap-2 text-xs min-w-0">
                  <span className={`shrink-0 font-bold px-2 py-0.5 rounded ${item.subject ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-700'}`}>{subjectOf(item)}</span>
                  <span className="text-slate-500 dark:text-slate-400 truncate">{item.unit ? unitOf(item) : ''}</span>
                  <span className="hidden sm:flex items-center gap-1 text-slate-400 shrink-0"><Calendar size={12} /> {item.dateString}</span>
                </span>
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
            {editId === item.id && (
              <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-3 flex flex-col sm:flex-row gap-2">
                <select value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-sm">
                  {SUBJECTS.map((x) => <option key={x}>{x}</option>)}
                </select>
                <input
                  list="unit-options"
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  placeholder="단원 (예: 4학년 1학기 2. 각도)"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={() => setEditId(null)} className="px-3 py-2 text-sm text-slate-500">취소</button>
                  <button onClick={() => saveMeta(item)} disabled={savingMeta} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50">{savingMeta ? '저장 중' : '저장'}</button>
                </div>
              </div>
            )}
            <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-2 flex justify-between">
              <button onClick={() => (editId === item.id ? setEditId(null) : openEdit(item))} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1"><Pencil size={13} /> 과목·단원 {item.subject ? '수정' : '지정'}</button>
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
        <datalist id="unit-options">{knownUnits.map((u) => <option key={u} value={u} />)}</datalist>
      </div>
    </div>
  );
};

export default HistoryView;
