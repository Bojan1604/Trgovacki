'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Segmentirani kontrolnik (iOS segmented control)                            */
/* -------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; badge?: number }[];
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md bg-surface-3 p-[2px] no-select',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[6px] font-medium transition-all duration-100',
              size === 'sm' ? 'h-[22px] px-2 text-sm' : 'h-[26px] px-2.5 text-base',
              active
                ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]'
                : 'text-ink-3 hover:text-ink',
            )}
          >
            {o.label}
            {o.badge !== undefined && o.badge > 0 && (
              <span className="rounded-full bg-ink-4/20 px-1 text-2xs tnum">{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Kartice s poveznicama (tabovi ekrana)                                      */
/* -------------------------------------------------------------------------- */

export function LinkTabs({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5 rounded-md bg-surface-3 p-[2px] no-select w-fit">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'inline-flex h-[26px] items-center gap-1.5 rounded-[6px] px-2.5 text-base font-medium transition-all duration-100',
              active ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'text-ink-3 hover:text-ink',
            )}
          >
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span className="rounded-full bg-ink-4/20 px-1 text-2xs tnum">{item.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/*  Straničenje                                                                */
/* -------------------------------------------------------------------------- */

export function Pagination({
  page,
  pageSize,
  total,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const go = useCallback(
    (next: number) => {
      const sp = new URLSearchParams(params.toString());
      sp.set('page', String(next));
      router.push(`${pathname}?${sp.toString()}`);
    },
    [params, pathname, router],
  );

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className={cn('flex items-center justify-between gap-3 px-1 py-2', className)}>
      <p className="text-sm text-ink-3 tnum">
        {from}–{to} od {total.toLocaleString('hr-HR')}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          className="grid size-7 place-items-center rounded-md text-ink-2 hover:bg-surface-3 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="px-1.5 text-sm text-ink-2 tnum">
          {page} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => go(page + 1)}
          className="grid size-7 place-items-center rounded-md text-ink-2 hover:bg-surface-3 disabled:opacity-30 disabled:pointer-events-none"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Filtri vezani uz URL                                                       */
/* -------------------------------------------------------------------------- */

export function useUrlFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') sp.delete(key);
        else sp.set(key, value);
      }
      if (!('page' in updates)) sp.delete('page');
      router.push(`${pathname}${sp.size ? `?${sp.toString()}` : ''}`);
    },
    [params, pathname, router],
  );
}
