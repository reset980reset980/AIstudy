import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { CircleAlert, Home, History, GraduationCap, LogIn, LogOut, User, Settings, BrainCircuit, ScanLine, Sparkles, ShieldCheck, Loader2 } from 'lucide-react';
import { onAuthStateChanged, signOut, getRedirectResult, type User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import UploadView from './components/UploadView';
import LoginModal from './components/LoginModal';
import { ToastProvider, useToast } from './components/Toast';
import { analyzeProblem, defaultSettings, isAdminUser, moreSimilarProblems, pickProvider } from './services/aiClient';
import { addHistory, deleteHistory, fetchHistory, loadSettings, saveSettings, updateSimilarProblems } from './services/userData';
import { PROVIDERS } from './shared/ai/models';
import type { AnalysisState, ProblemHistoryItem, UserSettings } from './types';

// 큰 화면은 필요할 때만 불러와 첫 화면을 빠르게
const AnalysisView = lazy(() => import('./components/AnalysisView'));
const ProblemSelector = lazy(() => import('./components/ProblemSelector'));
const HistoryView = lazy(() => import('./components/HistoryView'));
const QuizView = lazy(() => import('./components/QuizView'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));

type Tab = 'HOME' | 'HISTORY' | 'QUIZ';

const THEME_KEY = 'aistudy-theme';
function initialTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* 저장소 사용 불가 */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const Spinner = () => (
  <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
);

const WelcomeView: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
  <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center animate-fade-in pb-10">
    <div className="mb-8 relative">
      <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 rounded-full" />
      <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 relative">
        <BrainCircuit size={72} className="text-blue-600 dark:text-blue-400" />
      </div>
    </div>
    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-5 tracking-tight">
      스마트 스터디 <span className="text-blue-600 dark:text-blue-400">AI</span>
    </h1>
    <p className="text-lg text-slate-600 dark:text-slate-300 mb-10 max-w-lg leading-relaxed">
      막힌 문제를 찍어 올리면 AI 선생님이 <b className="text-blue-600 dark:text-blue-400">단계별 풀이</b>와{' '}
      <b className="text-purple-600 dark:text-purple-400">유사 문제</b>, <b className="text-emerald-600 dark:text-emerald-400">자동 채점 시험</b>까지 도와줘요.
    </p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 w-full max-w-4xl text-left">
      {[
        { icon: ScanLine, bg: 'bg-blue-50 dark:bg-blue-900/30', fg: 'text-blue-600 dark:text-blue-400', title: '찍어서 올리기', body: '문제집 사진이나 PDF를 올리고 풀 문제만 골라요.' },
        { icon: BrainCircuit, bg: 'bg-purple-50 dark:bg-purple-900/30', fg: 'text-purple-600 dark:text-purple-400', title: '단계별 풀이', body: '학년 눈높이에 맞춰 개념과 식을 차근차근 설명해요.' },
        { icon: Sparkles, bg: 'bg-emerald-50 dark:bg-emerald-900/30', fg: 'text-emerald-600 dark:text-emerald-400', title: '유사 문제 시험', body: '쌓인 유사 문제로 시험 보고, 틀린 문제는 다시 풀어요.' },
      ].map(({ icon: I, bg, fg, title, body }) => (
        <div key={title} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${bg}`}>
            <I size={20} className={fg} />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white mb-1">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{body}</p>
        </div>
      ))}
    </div>
    <button onClick={onLogin} className="px-10 py-4 bg-blue-600 text-white text-lg rounded-full font-bold shadow-xl shadow-blue-300/50 dark:shadow-none hover:bg-blue-700 hover:scale-105 transition-all flex items-center gap-2">
      <LogIn size={20} /> 로그인하고 시작하기
    </button>
    <p className="mt-4 text-sm text-slate-400">Google 계정이나 이메일로 바로 시작할 수 있어요.</p>
  </div>
);

const LoginRequired: React.FC<{ icon: React.ElementType; title: string; body: string; onLogin: () => void }> = ({ icon: I, title, body, onLogin }) => (
  <div className="text-center mt-16 p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md mx-auto shadow-sm">
    <I size={44} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{title}</h3>
    <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">{body}</p>
    <button onClick={onLogin} className="px-5 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700">로그인하기</button>
  </div>
);

const AppInner: React.FC = () => {
  const toast = useToast();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<Tab>('HOME');

  const [state, setState] = useState<AnalysisState>({ isLoading: false, data: null, error: null });
  const [statusMessage, setStatusMessage] = useState('');
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [finalImageUrl, setFinalImageUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<ProblemHistoryItem[]>([]);

  const [settings, setSettings] = useState<UserSettings>(() => ({ ...defaultSettings(), theme: initialTheme() }));
  const [legacyPlainKeys, setLegacyPlainKeys] = useState(false);

  const admin = isAdminUser(user?.email, user?.emailVerified);
  const activeProvider = pickProvider(settings, admin);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    try { localStorage.setItem(THEME_KEY, settings.theme); } catch { /* 무시 */ }
  }, [settings.theme]);

  useEffect(() => {
    getRedirectResult(auth).catch((e) => {
      if (e?.code === 'auth/unauthorized-domain') toast(`이 주소(${location.hostname})는 로그인 허용 목록에 없습니다.`, 'error');
    });
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) {
        setHistory([]);
        setSettings((s) => ({ ...defaultSettings(), theme: s.theme }));
        return;
      }
      try {
        const { settings: loaded, legacyPlainKeys: legacy } = await loadSettings(u.uid);
        setSettings(loaded);
        setLegacyPlainKeys(legacy && isAdminUser(u.email, u.emailVerified));
      } catch (e) {
        console.error(e);
        toast('설정을 불러오지 못했습니다. Firestore 규칙을 확인해 주세요.', 'error');
      }
      try {
        setHistory(await fetchHistory(u.uid));
      } catch (e) {
        console.error(e);
        toast('학습 기록을 불러오지 못했습니다.', 'error');
      }
    });
  }, [toast]);

  const handleSaveSettings = async (next: UserSettings) => {
    if (!user) return;
    await saveSettings(user.uid, next, admin);
    setSettings(next);
    if (admin) setLegacyPlainKeys(false);
    toast(admin ? '설정을 저장했습니다. 키는 서버에서 암호화되었어요.' : '설정을 저장했습니다.', 'success');
  };

  const clearImages = useCallback(() => {
    setRawImageUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setFinalImageUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
  }, []);

  const handleReset = () => {
    setState({ isLoading: false, data: null, error: null });
    clearImages();
  };

  const runAnalysis = async (file: File) => {
    setState({ isLoading: true, data: null, error: null });
    try {
      const data = await analyzeProblem(file, settings, admin, setStatusMessage);
      setState({ isLoading: false, data, error: null });
      if (user) {
        try {
          const item = await addHistory(user.uid, data);
          setHistory((h) => [item, ...h]);
          setState((st) => (st.data === data ? { ...st, data: item } : st)); // 저장된 id를 붙여 두기
        } catch (e) {
          console.error(e);
          toast('풀이는 완료됐지만 기록 저장에 실패했습니다.', 'error');
        }
      }
    } catch (e: any) {
      console.error(e);
      setState({ isLoading: false, data: null, error: e?.message || '알 수 없는 오류가 발생했습니다.' });
    }
  };

  const handleFileSelect = (file: File) => {
    if (!activeProvider) {
      setState((s) => ({ ...s, error: 'AI 키가 없습니다. 설정에서 Gemini·OpenAI·Claude 중 하나의 키를 등록해 주세요.' }));
      setShowSettings(true);
      return;
    }
    if (file.type.startsWith('image/')) {
      clearImages();
      setRawImageUrl(URL.createObjectURL(file));
      setState({ isLoading: false, data: null, error: null });
    } else {
      clearImages();
      runAnalysis(file);
    }
  };

  const handleCropConfirm = (cropped: File) => {
    setRawImageUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setFinalImageUrl(URL.createObjectURL(cropped));
    runAnalysis(cropped);
  };

  const handleMoreSimilar = async () => {
    const current = state.data;
    if (!current) return;
    try {
      const added = await moreSimilarProblems(current, settings, admin);
      if (added.length === 0) { toast('새 문제를 만들지 못했어요. 다시 눌러 주세요.', 'error'); return; }
      const merged = [...(current.similarProblems || []), ...added];
      const id = (current as Partial<ProblemHistoryItem>).id;
      setState((st) => (st.data ? { ...st, data: { ...st.data, similarProblems: merged } } : st));
      if (id) {
        setHistory((h) => h.map((x) => (x.id === id ? { ...x, similarProblems: merged } : x)));
        updateSimilarProblems(id, merged).catch((e) => { console.error(e); toast('새 문제를 기록에 저장하지 못했습니다.', 'error'); });
      }
      toast(`새 문제 ${added.length}개를 만들었어요!`, 'success');
    } catch (e: any) {
      toast(e?.message || '새 문제를 만들지 못했습니다.', 'error');
    }
  };

  const handleDelete = async (item: ProblemHistoryItem) => {
    try {
      await deleteHistory(item.id);
      setHistory((h) => h.filter((x) => x.id !== item.id));
      toast('기록을 삭제했습니다.', 'success');
    } catch (e) {
      console.error(e);
      toast('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setTab('HOME');
    handleReset();
  };

  let home: React.ReactNode;
  if (!authReady) home = <Spinner />;
  else if (!user) home = <WelcomeView onLogin={() => setShowLogin(true)} />;
  else if (state.isLoading) home = <UploadView onFileSelect={() => {}} isLoading statusMessage={statusMessage} />;
  else if (rawImageUrl) home = <ProblemSelector imageUrl={rawImageUrl} onConfirm={handleCropConfirm} onCancel={clearImages} />;
  else if (state.data) home = <AnalysisView analysis={state.data} originalImageUrl={finalImageUrl} onReset={handleReset} onMore={user && activeProvider ? handleMoreSimilar : undefined} />;
  else home = (
    <UploadView
      onFileSelect={handleFileSelect}
      isLoading={false}
      providerName={activeProvider ? PROVIDERS[activeProvider].name : undefined}
      onOpenSettings={() => setShowSettings(true)}
    />
  );

  const navBtn = (t: Tab, Icon: React.ElementType, label: string) => (
    <button
      onClick={() => { setTab(t); }}
      aria-current={tab === t ? 'page' : undefined}
      className={`flex flex-col items-center py-2 rounded-xl w-20 transition-colors ${tab === t ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
    >
      <Icon size={22} />
      <span className="text-[11px] font-bold mt-1">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-300">
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
      {showSettings && user && (
        <Suspense fallback={null}>
          <SettingsModal initial={settings} admin={admin} legacyPlainKeys={legacyPlainKeys} onClose={() => setShowSettings(false)} onSave={handleSaveSettings} />
        </Suspense>
      )}

      <header className="fixed top-0 w-full z-40 bg-[#FDFBF7]/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <button className="flex items-center gap-2" onClick={() => { setTab('HOME'); handleReset(); }}>
            <span className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><BrainCircuit size={18} /></span>
            <span className="font-bold text-lg tracking-tight hidden sm:block dark:text-white">스마트 스터디 AI</span>
          </button>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden md:flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                {admin ? <ShieldCheck size={14} className="text-emerald-500" /> : <User size={14} className="text-slate-400" />}
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate max-w-[140px]">{user.displayName || user.email?.split('@')[0]}</span>
                {admin && <span className="text-[10px] font-bold text-emerald-600">관리자</span>}
              </span>
              <button onClick={() => setShowSettings(true)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full" aria-label="설정">
                <Settings size={20} />
              </button>
              <button onClick={handleLogout} className="p-2 text-sm font-medium text-slate-500 hover:text-rose-500 dark:text-slate-400 flex items-center gap-1" aria-label="로그아웃">
                <LogOut size={18} /> <span className="hidden md:inline">로그아웃</span>
              </button>
            </div>
          ) : (
            authReady && (
              <button onClick={() => setShowLogin(true)} className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm rounded-lg font-bold hover:bg-slate-700 flex items-center gap-2">
                <LogIn size={16} /> 로그인
              </button>
            )
          )}
        </div>
      </header>

      <main className="pt-20 pb-28 px-4 flex-grow w-full max-w-7xl mx-auto">
        {state.error && tab === 'HOME' && (
          <div role="alert" className="max-w-xl mx-auto mb-6 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-3 text-rose-700 dark:text-rose-400 animate-fade-in">
            <CircleAlert size={20} className="shrink-0 mt-0.5" />
            <p className="text-sm flex-1">{state.error}</p>
            <button onClick={() => setState((s) => ({ ...s, error: null }))} className="text-sm underline shrink-0">닫기</button>
          </div>
        )}

        <Suspense fallback={<Spinner />}>
          {tab === 'HOME' && home}
          {tab === 'HISTORY' && (user
            ? <HistoryView history={history} onDelete={handleDelete} onSelectProblem={(item) => { clearImages(); setState({ isLoading: false, data: item, error: null }); setTab('HOME'); }} />
            : <LoginRequired icon={History} title="학습 기록 보기" body="로그인하면 푼 문제가 저장되고 언제든 다시 볼 수 있어요." onLogin={() => setShowLogin(true)} />)}
          {tab === 'QUIZ' && (user
            ? <QuizView uid={user.uid} history={history} settings={settings} admin={admin} onExit={() => setTab('HOME')} />
            : <LoginRequired icon={GraduationCap} title="나만의 시험 보기" body="분석한 문제의 유사 문제로 시험을 보고 자동 채점을 받아요." onLogin={() => setShowLogin(true)} />)}
        </Suspense>
      </main>

      <nav className="fixed bottom-0 w-full bg-white/95 dark:bg-slate-800/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto flex justify-around p-1.5">
          {navBtn('HOME', Home, '홈')}
          {navBtn('HISTORY', History, '기록')}
          {navBtn('QUIZ', GraduationCap, '시험')}
        </div>
      </nav>
    </div>
  );
};

const App: React.FC = () => (
  <ToastProvider>
    <AppInner />
  </ToastProvider>
);

export default App;
