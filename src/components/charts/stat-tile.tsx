import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Pojedinačna brojka. Bez grafikona — brojka je poruka.
 * Promjena se prikazuje strelicom i predznakom, nikad samo bojom.
 */
export function StatTile({
  label,
  value,
  unit,
  deltaPct,
  deltaLabel,
  hint,
  icon,
  invertDelta,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  deltaPct?: number | null;
  deltaLabel?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  /** Za pokazatelje gdje je pad dobar (npr. manjak, otpis). */
  invertDelta?: boolean;
  className?: string;
}) {
  const hasDelta = deltaPct !== undefined && deltaPct !== null && Number.isFinite(deltaPct);
  const positive = hasDelta ? (invertDelta ? deltaPct! < 0 : deltaPct! > 0) : false;
  const flat = hasDelta && Math.abs(deltaPct!) < 0.05;

  return (
    <div className={cn('rounded-lg bg-surface p-3 shadow-[var(--shadow-card)]', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm text-ink-3">{label}</p>
        {icon && <span className="shrink-0 text-ink-4">{icon}</span>}
      </div>
      <p className="mt-1.5 text-2xl font-semibold leading-none tracking-tight tnum">
        {value}
        {unit && <span className="ml-1 text-md font-normal text-ink-3">{unit}</span>}
      </p>
      <div className="mt-1.5 flex items-center gap-1.5">
        {hasDelta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-sm px-1 py-[1px] text-xs font-medium tnum',
              flat
                ? 'bg-surface-3 text-ink-3'
                : positive
                  ? 'bg-positive-soft text-positive'
                  : 'bg-negative-soft text-negative',
            )}
          >
            {flat ? (
              <Minus className="size-2.5" />
            ) : deltaPct! > 0 ? (
              <ArrowUpRight className="size-2.5" />
            ) : (
              <ArrowDownRight className="size-2.5" />
            )}
            {deltaPct! > 0 ? '+' : ''}
            {deltaPct!.toFixed(1)}%
          </span>
        )}
        {(deltaLabel || hint) && (
          <span className="truncate text-xs text-ink-4">{deltaLabel ?? hint}</span>
        )}
      </div>
    </div>
  );
}
