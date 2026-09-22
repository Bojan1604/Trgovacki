'use client';

import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Numerička tipkovnica za rad prstom na dodirnom zaslonu. */
export function Numpad({
  value,
  onChange,
  onEnter,
  enterLabel = 'U redu',
  enterDisabled,
  quickValues,
  quickSuffix = '€',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  enterLabel?: string;
  enterDisabled?: boolean;
  quickValues?: number[];
  /** Oznaka uz brze vrijednosti — "€" za iznose, "%" za popuste. */
  quickSuffix?: string;
  className?: string;
}) {
  const press = (key: string) => {
    if (key === 'del') return onChange(value.slice(0, -1));
    if (key === 'clr') return onChange('');
    if (key === ',') {
      if (value.includes(',')) return;
      return onChange(value === '' ? '0,' : `${value},`);
    }
    if (value === '0') return onChange(key);
    onChange(value + key);
  };

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', 'del'];

  return (
    <div className={cn('select-none', className)}>
      {quickValues && quickValues.length > 0 && (
        <div className="mb-1.5 grid grid-cols-4 gap-1.5">
          {quickValues.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onChange(String(amount).replace('.', ','))}
              className="h-9 rounded-lg bg-surface-3 text-base font-medium tnum transition-colors hover:bg-hairline-strong/50 active:scale-[0.97]"
            >
              {amount} {quickSuffix}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-1.5">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className={cn(
              'grid h-12 place-items-center rounded-lg bg-surface text-lg font-medium shadow-[var(--shadow-card)]',
              'transition-transform active:scale-[0.96] hover:bg-surface-3',
              key === 'del' && 'text-ink-3',
            )}
          >
            {key === 'del' ? <Delete className="size-4" /> : key}
          </button>
        ))}
      </div>
      {onEnter && (
        <button
          type="button"
          onClick={onEnter}
          disabled={enterDisabled}
          className="mt-1.5 h-12 w-full rounded-lg bg-accent text-lg font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          {enterLabel}
        </button>
      )}
    </div>
  );
}

/** Pretvara unos s numpada ("12,50") u broj. */
export function numpadValue(input: string): number {
  const n = Number.parseFloat(input.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
