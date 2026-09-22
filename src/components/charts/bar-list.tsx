'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/format';

export interface BarItem {
  label: string;
  value: number;
  /** Dodatna brojka desno (npr. broj komada). */
  meta?: string;
  href?: string;
}

/**
 * Vodoravna lista traka — usporedba veličina među kategorijama.
 * Vrijednost je uvijek ispisana uz traku (izravna oznaka), pa identitet
 * nikad ne ovisi samo o boji.
 */
export function BarList({
  items,
  unit = '€',
  max: maxOverride,
  className,
  tone = 'primary',
}: {
  items: BarItem[];
  unit?: string;
  max?: number;
  className?: string;
  tone?: 'primary' | 'neutral';
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = maxOverride ?? Math.max(...items.map((i) => Math.abs(i.value)), 1);

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-4">Nema podataka</p>;
  }

  return (
    <ul className={cn('space-y-[3px]', className)}>
      {items.map((item, index) => {
        const pct = (Math.abs(item.value) / max) * 100;
        const Row = (
          <div
            className="group relative flex items-center gap-2 rounded-sm px-1 py-[3px] transition-colors hover:bg-surface-3/60"
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="w-[42%] shrink-0 truncate text-base" title={item.label}>
              {item.label}
            </span>
            <span className="relative h-[10px] flex-1 overflow-hidden rounded-[3px] bg-surface-3">
              <span
                className="absolute inset-y-0 left-0 rounded-[3px] transition-[width] duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: tone === 'primary' ? 'var(--viz-1)' : 'var(--color-ink-4)',
                  opacity: hover === null || hover === index ? 1 : 0.55,
                }}
              />
            </span>
            <span className="w-[86px] shrink-0 text-right font-mono text-sm tnum">
              {formatAmount(item.value, Math.abs(item.value) >= 1000 ? 0 : 2)}
              <span className="ml-0.5 text-ink-4">{unit}</span>
            </span>
            {item.meta && <span className="w-[54px] shrink-0 text-right text-2xs text-ink-4 tnum">{item.meta}</span>}
          </div>
        );

        return (
          <li key={`${item.label}-${index}`}>
            {item.href ? (
              <Link href={item.href} className="block">
                {Row}
              </Link>
            ) : (
              Row
            )}
          </li>
        );
      })}
    </ul>
  );
}
