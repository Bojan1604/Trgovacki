'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconButton } from './button';

/* -------------------------------------------------------------------------- */
/*  Modalni dijalog                                                            */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdrop?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const widths = {
    sm: 'max-w-[360px]',
    md: 'max-w-[520px]',
    lg: 'max-w-[760px]',
    xl: 'max-w-[1040px]',
    full: 'max-w-[calc(100vw-48px)]',
  } as const;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto scroll-thin p-6 sm:p-10">
      <div
        className="fixed inset-0 bg-black/25 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full animate-sheet rounded-xl bg-surface shadow-[var(--shadow-overlay)]',
          widths[size],
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-3 hairline-b">
            <div className="min-w-0">
              {title && <h2 className="text-md font-semibold leading-tight">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
            </div>
            <IconButton label="Zatvori" variant="ghost" size="sm" onClick={onClose}>
              <X className="size-3.5" />
            </IconButton>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto scroll-thin px-4 py-3.5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-2.5 hairline-t bg-surface-2 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/*  Bočna ploča                                                                */
/* -------------------------------------------------------------------------- */

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = 420,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <aside
        style={{ width }}
        className="absolute right-0 top-0 flex h-full flex-col bg-surface shadow-[var(--shadow-overlay)] animate-in-fast"
      >
        <div className="flex items-center justify-between gap-2 px-3.5 h-[44px] hairline-b">
          <h2 className="text-md font-semibold truncate">{title}</h2>
          <IconButton label="Zatvori" variant="ghost" size="sm" onClick={onClose}>
            <X className="size-3.5" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto scroll-thin p-3.5">{children}</div>
        {footer && <div className="hairline-t bg-surface-2 p-2.5">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/*  Padajući izbornik                                                          */
/* -------------------------------------------------------------------------- */

export function Menu({
  trigger,
  children,
  align = 'right',
  width = 180,
}: {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'left' | 'right';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          style={{ width }}
          className={cn(
            'absolute top-[calc(100%+4px)] z-40 animate-in-fast rounded-lg bg-surface p-1 shadow-[var(--shadow-overlay)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  icon,
  danger,
  shortcut,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  shortcut?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-[5px] text-left text-base transition-colors',
        'hover:bg-accent hover:text-white disabled:pointer-events-none disabled:opacity-40',
        danger && 'text-negative hover:bg-negative',
      )}
    >
      {icon && <span className="shrink-0 opacity-80">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <span className="text-xs opacity-50">{shortcut}</span>}
    </button>
  );
}

export function MenuDivider() {
  return <div className="my-1 h-px bg-hairline" />;
}
