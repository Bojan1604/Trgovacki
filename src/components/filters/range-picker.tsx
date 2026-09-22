'use client';

import { CalendarRange, Globe, Store } from 'lucide-react';
import { RANGE_PRESETS } from '@/lib/ranges';
import { Segmented, useUrlFilter } from '@/components/ui/navigation';
import { Select } from '@/components/ui/field';

/** Odabir razdoblja i opsega (poslovnica / cijeli lanac) — stanje se drži u URL-u. */
export function RangePicker({
  current,
  scope,
  showScope = true,
}: {
  current: string;
  scope?: 'all' | 'store';
  showScope?: boolean;
}) {
  const setFilter = useUrlFilter();

  return (
    <div className="flex items-center gap-2">
      {showScope && (
        <Segmented
          size="sm"
          value={scope ?? 'store'}
          onChange={(value) => setFilter({ scope: value === 'all' ? 'all' : null })}
          options={[
            { value: 'store', label: <><Store className="size-3" /> Poslovnica</> },
            { value: 'all', label: <><Globe className="size-3" /> Lanac</> },
          ]}
        />
      )}
      <div className="relative">
        <Select
          value={current}
          onChange={(e) => setFilter({ range: e.target.value })}
          options={RANGE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
          className="h-7 w-[132px] pl-7 text-sm"
        />
        <CalendarRange className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" />
      </div>
    </div>
  );
}
