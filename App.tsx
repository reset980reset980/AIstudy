
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import UploadView from './components/UploadView';
import AnalysisView from './components/AnalysisView';
import ProblemSelector from './components/ProblemSelector';
import HistoryView from './components/HistoryView';
import QuizView from './components/QuizView';
import { analyzeMathProblem, validateApiKey } from './services/geminiService';
import { AnalysisState, ProblemAnalysis, ProblemHistoryItem } from './types';
import { CircleAlert, Home, History, GraduationCap, LogIn, LogOut, User, X, Mail, Lock, Settings, Moon, Sun, Check, Loader2, KeyRound, BrainCircuit, ScanLine, Sparkles } from 'lucide-react';
import { auth, googleProvider, db } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';

// --- Login Modal Component ---
interface LoginModalProps {
  onClose: () => void;
  onGoogleLogin: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose, onGoogleLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      let msg = "오류가 발생했습니다.";
      if (err.code === 'auth/invalid-email') msg = "유효하지 않은 이메일 주소입니다.";
      if (err.code === 'auth/user-disabled') msg = "사용 중지된 계정입니다.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') msg = "이메일 또는 비밀번호가 올바르지 않습니다.";
      if (err.code === 'auth/wrong-password') msg = "비밀번호가 틀렸습니다.";
      if (err.code === 'auth/email-already-in-use') msg = "이미 사용 중인 이메일입니다.";
      if (err.code === 'auth/weak-password') msg = "비밀번호는 6자리 이상이어야 합니다.";
      
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-8 shadow-2xl m-4 relative" onClick={e => e.stopPropagation()}>
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
            <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">
            {isSignUp ? '회원가입' : '로그인'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Email</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="email" 
                        placeholder="example@email.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 bg-slate-50 dark:bg-slate-700 dark:text-white transition-all"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                </div>
            </div>
            <div className="space-y-1">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Password</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="password" 
                        placeholder="******"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 bg-slate-50 dark:bg-slate-700 dark:text-white transition-all"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                </div>
            </div>

            {error && <p className="text-red-500 text-sm font-medium text-center bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>}

            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:bg-slate-300 dark:disabled:bg-slate-600 shadow-lg shadow-blue-200 dark:shadow-none mt-2"
            >
                {isLoading ? '처리 중...' : (isSignUp ? '가입하기' : '로그인')}
            </button>
        </form>

        <div className="mt-4 text-center">
            <button 
                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            >
                {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
        </div>

        <div className="my-6 flex items-center gap-2">
            <div className="h-px bg-slate-200 dark:bg-slate-600 flex-1"></div>
            <span className="text-slate-400 dark:text-slate-500 text-xs font-bold">OR</span>
            <div className="h-px bg-slate-200 dark:bg-slate-600 flex-1"></div>
        </div>

        <button 
            onClick={onGoogleLogin}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
        >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 4.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google 계정으로 계속하기
        </button>
      </div>
    </div>
  );
};

// --- Settings Modal Component ---
interface SettingsModalProps {
  onClose: () => void;
  userId: string;
  initialApiKey: string;
  initialTheme: 'light' | 'dark';
  onSave: (apiKey: string, theme: 'light' | 'dark') => Promise<void>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, userId, initialApiKey, initialTheme, onSave }) => {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [theme, setTheme] = useState<'light' | 'dark'>(initialTheme);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'fail'>('idle');
  const [isSaving, setIsSaving] = useState(false);

  const handleTestKey = async () => {
    if (!apiKey) return;
    setIsTesting(true);
    setTestStatus('idle');
    const isValid = await validateApiKey(apiKey);
    setIsTesting(false);
    setTestStatus(isValid ? 'success' : 'fail');
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(apiKey, theme);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl m-4 relative" onClick={e => e.stopPropagation()}>
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
            <X size={24} />
        </button>

        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Settings size={24} /> 설정
        </h2>

        <div className="space-y-6">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {theme === 'light' ? <Sun size={20}/> : <Moon size={20}/>}
                    </div>
                    <div>
                        <p className="font-bold text-slate-700 dark:text-slate-200">다크 모드</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">화면을 어둡게 설정합니다.</p>
                    </div>
                </div>
                <button 
                    onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                    className={`relative w-12 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
            </div>

            {/* API Key Input */}
            <div className="border-t border-slate-100 dark:border-slate-700 pt-6">
                <div className="flex items-center gap-2 mb-2">
                    <KeyRound size={18} className="text-blue-500" />
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Gemini API 키</label>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    개인 Google AI Studio 키를 사용하면 더 많은 요청을 처리할 수 있습니다.
                </p>
                <div className="relative">
                    <input 
                        type="password" 
                        placeholder="API 키 입력 (AIza...)"
                        className={`w-full pl-4 pr-24 py-3 rounded-xl border focus:outline-none focus:ring-2 bg-slate-50 dark:bg-slate-700 dark:text-white transition-all
                            ${testStatus === 'success' ? 'border-green-500 focus:border-green-500 focus:ring-green-100' : 
                              testStatus === 'fail' ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 
                              'border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-900'}
                        `}
                        value={apiKey}
                        onChange={e => { setApiKey(e.target.value); setTestStatus('idle'); }}
                    />
                    <button 
                        onClick={handleTestKey}
                        disabled={isTesting || !apiKey}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-lg text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-500 transition-colors disabled:opacity-50"
                    >
                        {isTesting ? <Loader2 size={14} className="animate-spin"/> : '테스트'}
                    </button>
                </div>
                {testStatus === 'success' && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><Check size={12}/> 유효한 키입니다.</p>}
                {testStatus === 'fail' && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><CircleAlert size={12}/> 키가 올바르지 않습니다.</p>}
            </div>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium text-sm transition-colors"
            >
                취소
            </button>
            <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 dark:shadow-none disabled:bg-slate-400"
            >
                {isSaving ? '저장 중...' : '설정 저장'}
            </button>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  // --- Auth State ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // --- App View State ---
  const [currentTab, setCurrentTab] = useState<'HOME' | 'HISTORY' | 'QUIZ'>('HOME');

  // --- Analysis State ---
  const [state, setState] = useState<AnalysisState>({
    isLoading: false,
    data: null,
    error: null,
  });
  
  // --- Data State ---
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [finalImageUrl, setFinalImageUrl] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<ProblemHistoryItem[]>([]);

  // --- Settings State ---
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // --- Effects ---
  
  // Theme management
  useEffect(() => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Auth & Data Loading
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && db) {
        // Fetch User Settings
        try {
            const userDoc = await getDoc(doc(db, "users", currentUser.uid, "settings", "config"));
            if (userDoc.exists()) {
                const data = userDoc.data();
                if (data.apiKey) setUserApiKey(data.apiKey);
                if (data.theme) setTheme(data.theme);
            }
        } catch (e) {
            console.error("Failed to load user settings", e);
        }

        fetchHistory(currentUser.uid);
      } else {
        setHistoryItems([]);
        setUserApiKey('');
        setTheme('light'); // Reset to light on logout
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchHistory = async (userId: string) => {
    if (!db) return;
    try {
      // NOTE: Removed orderBy("timestamp", "desc") to avoid requiring a composite index.
      // Sorting is done in memory.
      const q = query(
        collection(db, "problems"), 
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(q);
      const items: ProblemHistoryItem[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as ProblemHistoryItem);
      });
      // Sort in memory (Newest first)
      items.sort((a, b) => b.timestamp - a.timestamp);
      setHistoryItems(items);
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  };

  const saveSettings = async (apiKey: string, newTheme: 'light' | 'dark') => {
    if (!user || !db) return;
    try {
        await setDoc(doc(db, "users", user.uid, "settings", "config"), {
            apiKey: apiKey,
            theme: newTheme,
            updatedAt: Date.now()
        });
        setUserApiKey(apiKey);
        setTheme(newTheme);
    } catch (e) {
        console.error("Failed to save settings", e);
        alert("설정을 저장하는 중 오류가 발생했습니다.");
    }
  };

  const handleGoogleLogin = async () => {
    // Check for Blob URL (Preview Environment Issue)
    if (window.location.protocol === 'blob:') {
        alert("⚠️ 보안 경고 ⚠️\n\n현재 에디터의 '미리보기' 모드에서는 보안상 구글 로그인이 차단됩니다.\n\n브라우저 오른쪽 상단의 [새 탭에서 열기 ↗] 버튼을 눌러주세요.");
        return;
    }

    if (!auth || !googleProvider) {
        alert("Firebase 설정이 완료되지 않았습니다.");
        return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
      setShowLoginModal(false);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        alert(`[도메인 승인 필요]\n\n현재 도메인: ${domain}\n\n이 도메인이 Firebase 승인 목록에 없습니다.\nFirebase Console에 추가해주세요.`);
      } else if (error.code !== 'auth/popup-closed-by-user') {
        alert(`로그인 실패: ${error.message}`);
      }
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    setUser(null);
    setCurrentTab('HOME');
    handleReset();
  };

  // --- Core Logic ---

  const saveToHistory = async (analysis: ProblemAnalysis) => {
    if (!user || !db) return;
    try {
      const newItem: Omit<ProblemHistoryItem, 'id'> = {
        ...analysis,
        userId: user.uid,
        timestamp: Date.now(),
        dateString: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
      };
      const docRef = await addDoc(collection(db, "problems"), newItem);
      // Update local state immediately
      setHistoryItems(prev => [{ id: docRef.id, ...newItem }, ...prev]);
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setRawImageUrl(url);
        setState({ isLoading: false, data: null, error: null });
    } else {
        setState({ isLoading: true, data: null, error: null });
        setRawImageUrl(null);
        
        try {
            const data = await analyzeMathProblem(file, userApiKey); // Pass user API key
            setFinalImageUrl(null); 
            setState({ isLoading: false, data, error: null });
            if (user) saveToHistory(data); // Auto-save
        } catch (error) {
            console.error(error);
            setState({ 
                isLoading: false, 
                data: null, 
                error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다." 
            });
        }
    }
  };

  const handleCropConfirm = async (croppedFile: File) => {
    const url = URL.createObjectURL(croppedFile);
    setFinalImageUrl(url);
    setRawImageUrl(null);
    setState({ isLoading: true, data: null, error: null });

    try {
      const data = await analyzeMathProblem(croppedFile, userApiKey); // Pass user API key
      setState({ isLoading: false, data, error: null });
      if (user) saveToHistory(data); // Auto-save
    } catch (error) {
      console.error(error);
      setState({ 
        isLoading: false, 
        data: null, 
        error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다." 
      });
      setRawImageUrl(null);
    }
  };

  const handleCropCancel = () => {
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    setRawImageUrl(null);
  };

  const handleReset = () => {
    setState({ isLoading: false, data: null, error: null });
    if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
    if (finalImageUrl) URL.revokeObjectURL(finalImageUrl);
    setRawImageUrl(null);
    setFinalImageUrl(null);
  };

  const loadHistoryItem = (item: ProblemHistoryItem) => {
      setState({ isLoading: false, data: item, error: null });
      setRawImageUrl(null);
      setFinalImageUrl(null); 
      setCurrentTab('HOME');
  };

  useEffect(() => {
    return () => {
        if (rawImageUrl) URL.revokeObjectURL(rawImageUrl);
        if (finalImageUrl) URL.revokeObjectURL(finalImageUrl);
    }
  }, []);

  // Determine main content
  let homeContent: React.ReactNode;
  
  if (!user) {
    // Welcome View for non-logged-in users
    homeContent = (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-4 animate-fade-in pb-10">
        <div className="mb-8 relative group cursor-pointer" onClick={() => setShowLoginModal(true)}>
          <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 rounded-full group-hover:opacity-30 transition-opacity"></div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 relative z-10 group-hover:scale-105 transition-transform">
             <BrainCircuit size={80} className="text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight leading-tight">
          스마트 스터디 <span className="text-blue-600 dark:text-blue-400">AI</span>
        </h1>
        
        <p className="text-lg text-slate-600 dark:text-slate-300 mb-10 max-w-lg leading-relaxed font-medium">
          혼자 공부하기 힘드신가요?<br />
          AI 선생님이 <span className="text-blue-600 dark:text-blue-400 font-bold">단계별 풀이</span>부터 <span className="text-purple-600 dark:text-purple-400 font-bold">유사 문제</span>까지<br/>
          완벽하게 도와드립니다.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 w-full max-w-4xl text-left">
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3">
                 <ScanLine size={20} className="text-blue-600 dark:text-blue-400"/>
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-1">1초 만에 스캔</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">문제집 사진을 찍거나 파일을 업로드하세요.</p>
           </div>
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-3">
                 <BrainCircuit size={20} className="text-purple-600 dark:text-purple-400"/>
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-1">AI 심층 분석</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">수식과 개념을 분석해 상세한 풀이를 제공해요.</p>
           </div>
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-3">
                 <Sparkles size={20} className="text-green-600 dark:text-green-400"/>
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white mb-1">완벽한 복습</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">자동으로 생성된 유사 문제로 실력을 다지세요.</p>
           </div>
        </div>

        <button
          onClick={() => setShowLoginModal(true)}
          className="px-10 py-4 bg-blue-600 text-white text-lg rounded-full font-bold shadow-xl shadow-blue-300 dark:shadow-blue-900/20 hover:bg-blue-700 hover:scale-105 transition-all flex items-center gap-2 animate-bounce-subtle"
        >
          <LogIn size={20} />
          로그인하고 시작하기
        </button>
        <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">
           구글 계정으로 3초 만에 시작할 수 있어요.
        </p>
      </div>
    );
  } else if (state.isLoading) {
    homeContent = <UploadView onFileSelect={() => {}} isLoading={true} />;
  } else if (rawImageUrl) {
    homeContent = (
      <ProblemSelector 
        imageUrl={rawImageUrl} 
        onConfirm={handleCropConfirm} 
        onCancel={handleCropCancel} 
      />
    );
  } else if (state.data) {
    homeContent = (
      <AnalysisView 
        analysis={state.data} 
        originalImageUrl={finalImageUrl} 
        onReset={handleReset} 
      />
    );
  } else {
    homeContent = <UploadView onFileSelect={handleFileSelect} isLoading={false} />;
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-slate-900 text-slate-800 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900 flex flex-col transition-colors duration-300">
      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal 
            onClose={() => setShowLoginModal(false)} 
            onGoogleLogin={handleGoogleLogin} 
        />
      )}

      {/* Settings Modal */}
      {showSettingsModal && user && (
          <SettingsModal 
            onClose={() => setShowSettingsModal(false)}
            userId={user.uid}
            initialApiKey={userApiKey}
            initialTheme={theme}
            onSave={saveSettings}
          />
      )}

      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-[#FDFBF7]/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div 
                className="flex items-center gap-2 cursor-pointer" 
                onClick={() => { setCurrentTab('HOME'); handleReset(); }}
            >
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">A</div>
                <span className="font-bold text-lg tracking-tight hidden md:block dark:text-white">스마트 스터디 AI</span>
            </div>
            
            <div className="flex items-center gap-4">
                {user ? (
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                            <User size={14} className="text-slate-400"/>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate max-w-[100px]">
                                {user.displayName || user.email?.split('@')[0]}
                            </span>
                        </div>
                        <button 
                            onClick={() => setShowSettingsModal(true)}
                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            title="설정"
                        >
                            <Settings size={20} />
                        </button>
                        <button 
                            onClick={handleLogout}
                            className="text-sm font-medium text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 transition-colors flex items-center gap-1"
                        >
                            <LogOut size={16} /> <span className="hidden md:inline">로그아웃</span>
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowLoginModal(true)}
                            className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg font-bold hover:bg-slate-700 transition-colors flex items-center gap-2"
                        >
                            <LogIn size={16} /> 로그인
                        </button>
                    </div>
                )}
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 pb-24 px-4 flex-grow w-full max-w-7xl mx-auto">
        {state.error && (
            <div className="max-w-xl mx-auto mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400 animate-fade-in">
                <CircleAlert size={20} />
                <p>오류가 발생했습니다: {state.error}</p>
                <button onClick={() => setState(s => ({...s, error: null}))} className="ml-auto text-sm underline">닫기</button>
            </div>
        )}

        {currentTab === 'HOME' && homeContent}

        {currentTab === 'HISTORY' && (
            user ? (
                <HistoryView history={historyItems} onSelectProblem={loadHistoryItem} />
            ) : (
                <div className="text-center mt-20 p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md mx-auto shadow-sm">
                    <History size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">학습 기록 보기</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">로그인하면 내가 푼 문제들을 저장하고<br/> 언제든지 복습할 수 있어요.</p>
                    <div className="flex gap-3 justify-center">
                         <button onClick={() => setShowLoginModal(true)} className="px-5 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm hover:bg-blue-600 transition-colors">로그인하기</button>
                    </div>
                </div>
            )
        )}

        {currentTab === 'QUIZ' && (
            user ? (
                <QuizView history={historyItems} onExit={() => setCurrentTab('HOME')} />
            ) : (
                <div className="text-center mt-20 p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 max-w-md mx-auto shadow-sm">
                    <GraduationCap size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">나만의 시험 보기</h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">지금까지 푼 문제들을 바탕으로<br/>AI가 시험 문제를 만들어드려요.</p>
                    <div className="flex gap-3 justify-center">
                         <button onClick={() => setShowLoginModal(true)} className="px-5 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm hover:bg-blue-600 transition-colors">로그인하기</button>
                    </div>
                </div>
            )
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 pb-safe z-40 transition-colors duration-300">
        <div className="max-w-md mx-auto flex justify-around p-2">
            <button 
                onClick={() => { setCurrentTab('HOME'); if(!state.data) handleReset(); }}
                className={`flex flex-col items-center p-2 rounded-xl w-20 transition-colors ${currentTab === 'HOME' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >
                <Home size={24} />
                <span className="text-[10px] font-bold mt-1">홈</span>
            </button>
            <button 
                onClick={() => setCurrentTab('HISTORY')}
                className={`flex flex-col items-center p-2 rounded-xl w-20 transition-colors ${currentTab === 'HISTORY' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >
                <History size={24} />
                <span className="text-[10px] font-bold mt-1">기록</span>
            </button>
            <button 
                onClick={() => setCurrentTab('QUIZ')}
                className={`flex flex-col items-center p-2 rounded-xl w-20 transition-colors ${currentTab === 'QUIZ' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
            >
                <GraduationCap size={24} />
                <span className="text-[10px] font-bold mt-1">시험</span>
            </button>
        </div>
      </nav>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export default App;
