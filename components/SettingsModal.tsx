import React, { useState } from 'react';
import { X, Settings, Moon, Sun, Check, Loader2, KeyRound, CircleAlert, ShieldCheck, ExternalLink, Trash2, GraduationCap } from 'lucide-react';
import { PROVIDERS, PROVIDER_ORDER, checkKeyFormat, type ProviderId } from '../shared/ai/models';
import type { UserSettings } from '../types';
import { encryptKeyOnServer, hasKey, testKey } from '../services/aiClient';

interface Props {
  initial: UserSettings;
  admin: boolean;
  legacyPlainKeys: boolean;
  onClose: () => void;
  onSave: (s: UserSettings) => Promise<void>;
}

const GRADES = ['auto', '초등 1학년', '초등 2학년', '초등 3학년', '초등 4학년', '초등 5학년', '초등 6학년', '중학교 1학년', '중학교 2학년', '중학교 3학년', '고등학교 1학년', '고등학교 2학년', '고등학교 3학년'];

type TestState = { state: 'idle' | 'testing' | 'ok' | 'fail'; message?: string };

const SettingsModal: React.FC<Props> = ({ initial, admin, legacyPlainKeys, onClose, onSave }) => {
  const [s, setS] = useState<UserSettings>(() => structuredClone(initial));
  // 새로 입력한 키 (관리자는 저장 시 서버에서 암호화)
  const [drafts, setDrafts] = useState<Partial<Record<ProviderId, string>>>(() =>
    admin && legacyPlainKeys ? { ...initial.keys } : {},
  );
  const [removed, setRemoved] = useState<Partial<Record<ProviderId, boolean>>>({});
  const [tests, setTests] = useState<Partial<Record<ProviderId, TestState>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setTest = (p: ProviderId, t: TestState) => setTests((m) => ({ ...m, [p]: t }));

  const storedLabel = (p: ProviderId) => {
    if (removed[p]) return null;
    if (admin) return s.encKeys[p] ? `••••${s.encKeys[p]!.last4} · 서버 암호화 저장됨` : null;
    const k = s.keys[p];
    return k ? `••••${k.slice(-4)} · 저장됨` : null;
  };

  const handleTest = async (p: ProviderId) => {
    const draft = drafts[p]?.trim();
    if (draft) {
      const fmt = checkKeyFormat(p, draft);
      if (!fmt.ok) { setTest(p, { state: 'fail', message: fmt.message }); return; }
    }
    setTest(p, { state: 'testing' });
    try {
      const r = await testKey(p, s, admin, draft || undefined);
      setTest(p, { state: r.ok ? 'ok' : 'fail', message: r.message });
    } catch (e: any) {
      setTest(p, { state: 'fail', message: e?.message || '테스트에 실패했습니다.' });
    }
  };

  const handleSave = async () => {
    setError(null);
    for (const p of PROVIDER_ORDER) {
      const d = drafts[p]?.trim();
      if (d) {
        const fmt = checkKeyFormat(p, d);
        if (!fmt.ok) { setError(`${PROVIDERS[p].name}: ${fmt.message}`); return; }
      }
    }
    setSaving(true);
    try {
      const next: UserSettings = structuredClone(s);
      for (const p of PROVIDER_ORDER) {
        const d = drafts[p]?.trim();
        if (removed[p]) { delete next.keys[p]; delete next.encKeys[p]; }
        if (d) {
          if (admin) next.encKeys[p] = await encryptKeyOnServer(p, d);
          else next.keys[p] = d;
        }
      }
      if (admin) next.keys = {};
      await onSave(next);
      onClose();
    } catch (e: any) {
      setError(e?.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const anyKey = PROVIDER_ORDER.some((p) => (drafts[p]?.trim()) || (!removed[p] && hasKey(s, p, admin)));

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="설정" className="bg-white dark:bg-slate-800 w-full sm:max-w-xl max-h-[92vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><Settings size={22} /> 설정</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="닫기"><X size={22} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* 화면·학년 */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setS({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' })}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <span className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
                {s.theme === 'light' ? <Sun size={18} /> : <Moon size={18} />} 다크 모드
              </span>
              <span className={`relative w-11 h-6 rounded-full transition-colors ${s.theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'}`}>
                <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${s.theme === 'dark' ? 'translate-x-5' : ''}`} />
              </span>
            </button>
            <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-600">
              <GraduationCap size={18} className="text-slate-500 shrink-0" />
              <span className="font-bold text-slate-700 dark:text-slate-200 shrink-0">설명 수준</span>
              <select
                value={s.gradeLevel}
                onChange={(e) => setS({ ...s, gradeLevel: e.target.value })}
                className="flex-1 min-w-0 bg-transparent text-sm text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                {GRADES.map((g) => <option key={g} value={g}>{g === 'auto' ? '자동' : g}</option>)}
              </select>
            </label>
          </section>

          {/* AI 키 */}
          <section>
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-1"><KeyRound size={18} className="text-blue-500" /> AI 선택과 API 키</h3>
            {admin ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2.5 mb-3 flex gap-2">
                <ShieldCheck size={16} className="shrink-0" />
                관리자 계정입니다. 키는 서버에서 암호화(AES-256)되어 저장되고, 원래 키는 어디에도 남지 않습니다. AI 호출도 서버에서 처리됩니다.
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                키는 내 계정에만 저장되고 다른 사람은 볼 수 없습니다. 세 곳 중 한 곳의 키만 있어도 됩니다.
              </p>
            )}
            {admin && legacyPlainKeys && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 mb-3">
                예전에 암호화 없이 저장된 키가 있어 아래에 채워 두었습니다. <b>저장</b>을 누르면 암호화 저장으로 옮겨지고 원래 키는 지워집니다.
              </p>
            )}

            <div className="space-y-3">
              {PROVIDER_ORDER.map((p) => {
                const info = PROVIDERS[p];
                const selected = s.provider === p;
                const t = tests[p] || { state: 'idle' };
                const stored = storedLabel(p);
                const draft = drafts[p] || '';
                const fmt = draft.trim() ? checkKeyFormat(p, draft) : null;
                const model = info.models.find((m) => m.id === s.models[p]) || info.models[0];
                return (
                  <div key={p} className={`rounded-2xl border-2 p-4 transition-colors ${selected ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-600'}`}>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="provider" checked={selected} onChange={() => setS({ ...s, provider: p })} className="w-4 h-4 accent-blue-600" />
                      <span className="font-bold text-slate-800 dark:text-white">{info.name}</span>
                      {selected && <span className="text-[11px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">사용 중</span>}
                      <a href={info.keyUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1">
                        키 발급 <ExternalLink size={12} />
                      </a>
                    </label>

                    <div className="mt-3 space-y-2">
                      {stored && !draft && (
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-600">
                          <Check size={14} className="text-emerald-500" /> <span className="flex-1 truncate">{stored}</span>
                          <button onClick={() => handleTest(p)} className="text-xs font-bold text-blue-600 hover:underline">테스트</button>
                          <button onClick={() => { setRemoved({ ...removed, [p]: true }); setTest(p, { state: 'idle' }); }} className="text-slate-400 hover:text-rose-500" aria-label="키 삭제"><Trash2 size={14} /></button>
                        </div>
                      )}
                      <div className="relative">
                        <input
                          type="password"
                          autoComplete="off"
                          spellCheck={false}
                          placeholder={stored ? '새 키로 바꾸려면 입력' : `API 키 입력 (${info.keyHint})`}
                          className="w-full pl-3 pr-20 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 dark:text-white text-sm focus:outline-none focus:border-blue-500"
                          value={draft}
                          onChange={(e) => { setDrafts({ ...drafts, [p]: e.target.value }); setTest(p, { state: 'idle' }); }}
                        />
                        <button
                          onClick={() => handleTest(p)}
                          disabled={!draft.trim() || t.state === 'testing'}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-bold rounded-md bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-100 hover:bg-slate-200 disabled:opacity-40"
                        >
                          {t.state === 'testing' ? <Loader2 size={14} className="animate-spin" /> : '테스트'}
                        </button>
                      </div>
                      {fmt && t.state === 'idle' && (
                        <p className={`text-xs ${fmt.ok ? 'text-slate-500' : 'text-rose-500'}`}>{fmt.ok ? `✓ ${fmt.message}` : fmt.message}</p>
                      )}
                      {t.state === 'ok' && <p className="text-xs text-emerald-600 flex items-center gap-1"><Check size={12} /> {t.message}</p>}
                      {t.state === 'fail' && <p className="text-xs text-rose-500 flex items-start gap-1"><CircleAlert size={12} className="mt-0.5 shrink-0" /> {t.message}</p>}

                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500 dark:text-slate-400 shrink-0">모델</span>
                        <select
                          value={model.id}
                          onChange={(e) => setS({ ...s, models: { ...s.models, [p]: e.target.value } })}
                          className="flex-1 min-w-0 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-100"
                        >
                          {info.models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                      </label>
                      <p className="text-[11px] text-slate-400">{model.note} · 1M 토큰당 입력/출력 {model.price}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 자동 전환 */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-600 p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={s.fallback} onChange={(e) => setS({ ...s, fallback: e.target.checked })} className="mt-1 w-4 h-4 accent-blue-600" />
              <span>
                <span className="block font-bold text-slate-800 dark:text-white text-sm">실패하면 다른 AI로 자동 전환</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">선택한 AI가 한도 초과·서버 오류로 실패하면 키가 있는 다른 AI(OpenAI ↔ Claude)로 다시 시도해요.</span>
              </span>
            </label>
            <label className={`flex items-start gap-3 pl-7 ${s.fallback ? 'cursor-pointer' : 'opacity-40'}`}>
              <input type="checkbox" disabled={!s.fallback} checked={s.fallbackGemini} onChange={(e) => setS({ ...s, fallbackGemini: e.target.checked })} className="mt-1 w-4 h-4 accent-blue-600" />
              <span>
                <span className="block font-bold text-slate-800 dark:text-white text-sm">Gemini도 포함 (선택)</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">켜면 OpenAI·Claude가 모두 실패했을 때 마지막으로 Gemini를 써요.</span>
              </span>
            </label>
            <p className="text-[11px] text-slate-400">
              시도 순서: {(() => {
                const order = [s.provider, ...(['openai', 'anthropic', 'gemini'] as ProviderId[]).filter((p) => p !== s.provider)]
                  .filter((p) => p === s.provider || (s.fallback && (p !== 'gemini' || s.fallbackGemini)));
                return order.map((p) => PROVIDERS[p].name).join(' → ');
              })()}
            </p>
          </section>

          {error && <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3">{error}</p>}
          {!anyKey && <p className="text-xs text-amber-600">키가 하나도 없으면 문제 분석과 자동 채점을 쓸 수 없어요.</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-medium">취소</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} {saving ? (admin ? '암호화하여 저장 중...' : '저장 중...') : '설정 저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
