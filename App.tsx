import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import UploadView from './components/UploadView';
import AnalysisView from './components/AnalysisView';
import ProblemSelector from './components/ProblemSelector';
import HistoryView from './components/HistoryView';
import QuizView from './components/QuizView';
import { analyzeMathProblem } from './services/geminiService';
import { AnalysisState, ProblemAnalysis, ProblemHistoryItem } from './types';
import { CircleAlert, Home, History, GraduationCap, LogIn, LogOut, User, X, Mail, Lock } from 'lucide-react';
import { auth, googleProvider, db } from './firebase';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

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
      <div className="bg-white rounded-2xl w-full max-w-sm p-8 shadow-2xl m-4 relative" onClick={e => e.stopPropagation()}>
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
        >
            <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">
            {isSignUp ? '회원가입' : '로그인'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
                <label className="block text-sm font-bold text-slate-700">Email</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="email" 
                        placeholder="example@email.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-slate-50 transition-all"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                </div>
            </div>
            <div className="space-y-1">
                <label className="block text-sm font-bold text-slate-700">Password</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="password" 
                        placeholder="******"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-slate-50 transition-all"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                </div>
            </div>

            {error && <p className="text-red-500 text-sm font-medium text-center bg-red-50 p-2 rounded-lg">{error}</p>}

            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:bg-slate-300 shadow-lg shadow-blue-200 mt-2"
            >
                {isLoading ? '처리 중...' : (isSignUp ? '가입하기' : '로그인')}
            </button>
        </form>

        <div className="mt-4 text-center">
            <button 
                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                className="text-sm text-slate-500 hover:text-blue-600 font-medium transition-colors"
            >
                {isSignUp ? '이미 계정이 있으신가요? 로그인' : '계정이 없으신가요? 회원가입'}
            </button>
        </div>

        <div className="my-6 flex items-center gap-2">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-slate-400 text-xs font-bold">OR</span>
            <div className="h-px bg-slate-200 flex-1"></div>
        </div>

        <button 
            onClick={onGoogleLogin}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-colors"
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

const App: React.FC = () => {
  // --- Auth State ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

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

  // --- Auth & Data Loading Effects ---
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && db) {
        fetchHistory(currentUser.uid);
      } else {
        setHistoryItems([]);
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
            const data = await analyzeMathProblem(file);
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
      const data = await analyzeMathProblem(croppedFile);
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
  
  if (state.isLoading) {
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
    <div className="min-h-screen bg-[#FDFBF7] text-slate-800 selection:bg-blue-100 flex flex-col">
      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal 
            onClose={() => setShowLoginModal(false)} 
            onGoogleLogin={handleGoogleLogin} 
        />
      )}

      {/* Header */}
      <header className="fixed top-0 w-full z-40 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div 
                className="flex items-center gap-2 cursor-pointer" 
                onClick={() => { setCurrentTab('HOME'); handleReset(); }}
            >
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">A</div>
                <span className="font-bold text-lg tracking-tight hidden md:block">스마트 스터디 AI</span>
            </div>
            
            <div className="flex items-center gap-4">
                {user ? (
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-200">
                            <User size={14} className="text-slate-400"/>
                            <span className="text-sm font-medium text-slate-600 truncate max-w-[100px]">
                                {user.displayName || user.email?.split('@')[0]}
                            </span>
                        </div>
                        <button 
                            onClick={handleLogout}
                            className="text-sm font-medium text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1"
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
            <div className="max-w-xl mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 animate-fade-in">
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
                <div className="text-center mt-20 p-6 bg-white rounded-2xl border border-slate-200 max-w-md mx-auto shadow-sm">
                    <History size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">학습 기록 보기</h3>
                    <p className="text-slate-500 mb-6 text-sm">로그인하면 내가 푼 문제들을 저장하고<br/> 언제든지 복습할 수 있어요.</p>
                    <div className="flex gap-3 justify-center">
                         <button onClick={() => setShowLoginModal(true)} className="px-5 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm">로그인하기</button>
                    </div>
                </div>
            )
        )}

        {currentTab === 'QUIZ' && (
            user ? (
                <QuizView history={historyItems} onExit={() => setCurrentTab('HOME')} />
            ) : (
                <div className="text-center mt-20 p-6 bg-white rounded-2xl border border-slate-200 max-w-md mx-auto shadow-sm">
                    <GraduationCap size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">나만의 시험 보기</h3>
                    <p className="text-slate-500 mb-6 text-sm">지금까지 푼 문제들을 바탕으로<br/>AI가 시험 문제를 만들어드려요.</p>
                    <div className="flex gap-3 justify-center">
                         <button onClick={() => setShowLoginModal(true)} className="px-5 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm">로그인하기</button>
                    </div>
                </div>
            )
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 pb-safe z-40">
        <div className="max-w-md mx-auto flex justify-around p-2">
            <button 
                onClick={() => { setCurrentTab('HOME'); if(!state.data) handleReset(); }}
                className={`flex flex-col items-center p-2 rounded-xl w-20 transition-colors ${currentTab === 'HOME' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <Home size={24} />
                <span className="text-[10px] font-bold mt-1">홈</span>
            </button>
            <button 
                onClick={() => setCurrentTab('HISTORY')}
                className={`flex flex-col items-center p-2 rounded-xl w-20 transition-colors ${currentTab === 'HISTORY' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
            >
                <History size={24} />
                <span className="text-[10px] font-bold mt-1">기록</span>
            </button>
            <button 
                onClick={() => setCurrentTab('QUIZ')}
                className={`flex flex-col items-center p-2 rounded-xl w-20 transition-colors ${currentTab === 'QUIZ' ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-slate-600'}`}
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