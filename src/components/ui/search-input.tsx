'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUrlFilter } from './navigation';

/** Pretraga s odgodom koja upisuje pojam u URL — stanje preživi osvježavanje. */
export function SearchInput({
  paramName = 'q',
  placeholder = 'Pretraži…',
  defaultValue = '',
  className,
  autoFocus,
  width = 220,
}: {
  paramName?: string;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
  autoFocus?: boolean;
  width?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const setFilter = useUrlFilter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFilter({ [paramName]: value || null }), 280);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, paramName, setFilter]);

  return (
    <div className={cn('relative', className)} style={{ width }}>
      <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-hairline-strong/60 bg-surface pl-7 pr-7 text-base placeholder:text-ink-4 hover:border-hairline-strong focus:border-accent focus:outline-none focus:ring-[2.5px] focus:ring-accent/18"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-ink-4 hover:bg-surface-3 hover:text-ink-2"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
