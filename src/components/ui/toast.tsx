'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'warning' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

const ToastContext = createContext<{
  show: (kind: ToastKind, title: string, description?: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((kind: ToastKind, title: string, description?: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, title, description }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  const icons = {
    success: <CheckCircle2 className="size-4 text-positive" />,
    error: <XCircle className="size-4 text-negative" />,
    warning: <AlertTriangle className="size-4 text-warning" />,
    info: <Info className="size-4 text-accent" />,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[320px] flex-col gap-1.5">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-lg bg-surface p-2.5 shadow-[var(--shadow-overlay)] animate-in-fast',
            )}
          >
            <span className="mt-px shrink-0">{icons[t.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium leading-tight">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-ink-3">{t.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Izvan providera — degradiramo na konzolu umjesto rušenja.
    return {
      success: (t: string) => console.info(t),
      error: (t: string) => console.error(t),
      warning: (t: string) => console.warn(t),
      info: (t: string) => console.info(t),
    };
  }
  return {
    success: (title: string, description?: string) => ctx.show('success', title, description),
    error: (title: string, description?: string) => ctx.show('error', title, description),
    warning: (title: string, description?: string) => ctx.show('warning', title, description),
    info: (title: string, description?: string) => ctx.show('info', title, description),
  };
}
