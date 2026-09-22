import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Kartica                                                                    */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  padded = true,
  inset,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  inset?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-surface rounded-lg shadow-[var(--shadow-card)]',
        padded && (inset ? 'p-2.5' : 'p-3.5'),
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
  compact,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3', compact ? 'mb-2' : 'mb-3', className)}>
      <div className="min-w-0">
        <h3 className="text-md font-semibold leading-tight truncate">{title}</h3>
        {subtitle && <p className="text-sm text-ink-3 mt-0.5 truncate">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Oznake i statusi                                                           */
/* -------------------------------------------------------------------------- */

export type Tone = 'neutral' | 'accent' | 'positive' | 'warning' | 'negative' | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-ink-2',
  accent: 'bg-accent-soft text-accent',
  positive: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  negative: 'bg-negative-soft text-negative',
  info: 'bg-info-soft text-info',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-1.5 py-[1px] text-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-[5px] rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

/** Mala oznaka za status dokumenta s točkom u boji. */
export function StatusDot({ tone = 'neutral', className }: { tone?: Tone; className?: string }) {
  const color: Record<Tone, string> = {
    neutral: 'bg-ink-4',
    accent: 'bg-accent',
    positive: 'bg-positive',
    warning: 'bg-warning',
    negative: 'bg-negative',
    info: 'bg-info',
  };
  return <span className={cn('inline-block size-[6px] rounded-full', color[tone], className)} />;
}

/* -------------------------------------------------------------------------- */
/*  Prazno stanje                                                              */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-16')}>
      {icon && (
        <div className="mb-2.5 grid size-10 place-items-center rounded-xl bg-surface-3 text-ink-4">{icon}</div>
      )}
      <p className="text-md font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Razdjelnici i rasporedi                                                    */
/* -------------------------------------------------------------------------- */

export function Divider({ className, vertical }: { className?: string; vertical?: boolean }) {
  return vertical ? (
    <span className={cn('w-px self-stretch bg-hairline', className)} />
  ) : (
    <div className={cn('h-px w-full bg-hairline', className)} />
  );
}

/** Redak "oznaka → vrijednost" za detaljne prikaze. */
export function DetailRow({
  label,
  children,
  mono,
  className,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-[5px]', className)}>
      <span className="text-sm text-ink-3 shrink-0">{label}</span>
      <span className={cn('text-base text-right min-w-0 truncate', mono && 'font-mono text-sm tnum')}>
        {children}
      </span>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  tabs,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <div className="mb-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight truncate">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </div>
      {tabs && <div className="mt-2.5">{tabs}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sitni prikazi podataka                                                     */
/* -------------------------------------------------------------------------- */

export function Avatar({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  // Stabilna boja iz imena.
  const hue = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-full font-semibold text-white', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: `hsl(${hue} 62% 48%)`,
      }}
    >
      {letters}
    </span>
  );
}

export function Progress({ value, tone = 'accent', className }: { value: number; tone?: Tone; className?: string }) {
  const color: Record<Tone, string> = {
    neutral: 'bg-ink-4',
    accent: 'bg-accent',
    positive: 'bg-positive',
    warning: 'bg-warning',
    negative: 'bg-negative',
    info: 'bg-info',
  };
  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', color[tone])}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

export function KeyHint({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-4 min-w-4 items-center justify-center rounded-[3px] border border-hairline-strong/70 bg-surface-2 px-1 font-mono text-2xs text-ink-3">
      {children}
    </kbd>
  );
}
