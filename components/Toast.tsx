import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: Kind; message: string }

const ToastContext = createContext<(message: string, kind?: Kind) => void>(() => {});

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = (id: number) => setItems((list) => list.filter((t) => t.id !== id));

  const show = useCallback((message: string, kind: Kind = 'info') => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list.slice(-2), { id, kind, message }]);
    setTimeout(() => remove(id), kind === 'error' ? 7000 : 3500);
  }, []);

  const style: Record<Kind, string> = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-slate-800 text-white dark:bg-slate-700',
  };
  const Icon = { success: CheckCircle2, error: CircleAlert, info: Info };

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed z-[80] top-20 inset-x-0 flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <div key={t.id} className={`pointer-events-auto max-w-md w-full shadow-xl rounded-xl px-4 py-3 flex items-start gap-3 animate-fade-in ${style[t.kind]}`}>
              <I size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium whitespace-pre-line flex-1">{t.message}</p>
              <button onClick={() => remove(t.id)} className="opacity-70 hover:opacity-100" aria-label="닫기"><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
