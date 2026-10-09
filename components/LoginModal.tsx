import React, { useState } from 'react';
import { X, Mail, Lock, Loader2 } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

type Mode = 'login' | 'signup' | 'reset';

function authMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return '이메일 주소 형식이 올바르지 않습니다.';
    case 'auth/user-disabled': return '사용이 중지된 계정입니다.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return '이메일 또는 비밀번호가 올바르지 않습니다.';
    case 'auth/email-already-in-use': return '이미 가입된 이메일입니다. 로그인해 주세요.';
    case 'auth/weak-password': return '비밀번호는 6자리 이상이어야 합니다.';
    case 'auth/too-many-requests': return '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    case 'auth/network-request-failed': return '인터넷 연결을 확인해 주세요.';
    case 'auth/unauthorized-domain': return `이 주소(${window.location.hostname})는 아직 로그인 허용 목록에 없습니다. 관리자에게 알려 주세요.`;
    case 'auth/operation-not-allowed': return '이 로그인 방식이 아직 켜져 있지 않습니다. 관리자에게 알려 주세요.';
    default: return '로그인 중 문제가 생겼습니다. 다시 시도해 주세요.';
  }
}

const inputCls =
  'w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 bg-slate-50 dark:bg-slate-700 dark:text-white transition-all';

const LoginModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (m: Mode) => { setMode(m); setError(null); setNotice(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setNotice(null); setBusy(true);
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        setNotice('비밀번호 재설정 메일을 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.');
      } else if (mode === 'signup') {
        await createUserWithEmailAndPassword(auth, email, password);
        onClose();
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        onClose();
      }
    } catch (err: any) {
      setError(authMessage(err?.code));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null); setBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onClose();
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider); // 팝업이 막힌 휴대폰·앱 브라우저용
        return;
      }
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setError(authMessage(err?.code));
      }
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'signup' ? '회원가입' : mode === 'reset' ? '비밀번호 찾기' : '로그인';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-7 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="닫기">
          <X size={22} />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 text-center">{title}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">이메일</span>
            <span className="relative block">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="email" autoComplete="email" placeholder="example@email.com" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </span>
          </label>
          {mode !== 'reset' && (
            <label className="block space-y-1">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">비밀번호</span>
              <span className="relative block">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder="6자리 이상"
                  minLength={6}
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </span>
            </label>
          )}

          {error && <p className="text-rose-600 dark:text-rose-400 text-sm font-medium text-center bg-rose-50 dark:bg-rose-900/20 p-2.5 rounded-lg">{error}</p>}
          {notice && <p className="text-emerald-700 dark:text-emerald-400 text-sm font-medium text-center bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-lg">{notice}</p>}

          <button type="submit" disabled={busy} className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <Loader2 size={18} className="animate-spin" />}
            {mode === 'signup' ? '가입하기' : mode === 'reset' ? '재설정 메일 보내기' : '로그인'}
          </button>
        </form>

        <div className="mt-4 flex justify-between text-sm">
          {mode === 'login' ? (
            <>
              <button onClick={() => switchMode('reset')} className="text-slate-500 dark:text-slate-400 hover:text-blue-600">비밀번호를 잊으셨나요?</button>
              <button onClick={() => switchMode('signup')} className="text-blue-600 dark:text-blue-400 font-bold">회원가입</button>
            </>
          ) : (
            <button onClick={() => switchMode('login')} className="mx-auto text-slate-500 dark:text-slate-400 hover:text-blue-600">← 로그인으로 돌아가기</button>
          )}
        </div>

        {mode !== 'reset' && (
          <>
            <div className="my-6 flex items-center gap-2">
              <div className="h-px bg-slate-200 dark:bg-slate-600 flex-1" />
              <span className="text-slate-400 text-xs font-bold">또는</span>
              <div className="h-px bg-slate-200 dark:bg-slate-600 flex-1" />
            </div>
            <button onClick={handleGoogle} disabled={busy} className="w-full flex items-center justify-center gap-2 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-700 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-60">
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 4.36c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.09 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google 계정으로 계속하기
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
