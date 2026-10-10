import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const remove = (id) => setToasts((t) => t.filter((x) => x.id !== id));
  const show = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => remove(id), 4000);
  }, []);
  const toast = { success: (m) => show(m, 'success'), error: (m) => show(m, 'error') };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed z-[60] bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 flex flex-col gap-2 w-[calc(100%-2rem)] sm:w-96 no-print" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="flex items-start gap-3 rounded-lg bg-white border border-line shadow-pop px-4 py-3">
            {t.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <p className="text-sm text-ink flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-ink-muted hover:text-ink" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
