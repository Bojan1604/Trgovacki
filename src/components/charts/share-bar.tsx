'use client';

import { SERIES_VARS } from './tokens';
import { formatAmount, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface ShareSegment {
  label: string;
  value: number;
}

/**
 * Udio u cjelini — jedna složena traka s legendom i ispisanim vrijednostima.
 * Najviše tri segmenta; ostatak se zbraja u "Ostalo".
 */
export function ShareBar({
  segments,
  unit = '€',
  className,
}: {
  segments: ShareSegment[];
  unit?: string;
  className?: string;
}) {
  const top = segments.slice(0, 3);
  const rest = segments.slice(3);
  const items =
    rest.length > 0
      ? [...top, { label: 'Ostalo', value: rest.reduce((a, s) => a + s.value, 0) }]
      : top;

  const total = items.reduce((acc, s) => acc + s.value, 0);
  if (total <= 0) return <p className="py-4 text-center text-sm text-ink-4">Nema podataka</p>;

  const color = (i: number) => (i < 3 ? SERIES_VARS[i] : 'var(--color-ink-4)');

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex h-[10px] w-full gap-[2px] overflow-hidden">
        {items.map((s, i) => (
          <span
            key={s.label}
            className="h-full rounded-[3px] transition-[flex-grow] duration-300"
            style={{ flexGrow: Math.max(s.value, 0.0001), backgroundColor: color(i) }}
            title={`${s.label}: ${formatAmount(s.value)} ${unit}`}
          />
        ))}
      </div>
      <ul className="space-y-[3px]">
        {items.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5 text-base">
            <span className="size-[7px] shrink-0 rounded-[2px]" style={{ backgroundColor: color(i) }} />
            <span className="flex-1 truncate text-ink-2">{s.label}</span>
            <span className="font-mono text-sm tnum">{formatAmount(s.value, 0)} {unit}</span>
            <span className="w-[46px] text-right text-sm text-ink-4 tnum">
              {formatPercent((s.value / total) * 100, 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
