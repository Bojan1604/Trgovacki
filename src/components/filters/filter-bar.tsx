'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Select } from '@/components/ui/field';
import { SearchInput } from '@/components/ui/search-input';
import { useUrlFilter } from '@/components/ui/navigation';
import { Button } from '@/components/ui/button';

export interface FilterSelect {
  param: string;
  placeholder: string;
  value?: string;
  width?: number;
  options: { value: string; label: string }[];
}

/** Jedan red filtara iznad tablice — sve stanje živi u URL-u. */
export function FilterBar({
  searchParam = 'q',
  searchPlaceholder = 'Pretraži…',
  searchValue,
  selects = [],
  children,
  activeCount = 0,
}: {
  searchParam?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  selects?: FilterSelect[];
  children?: ReactNode;
  activeCount?: number;
}) {
  const setFilter = useUrlFilter();

  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
      <SearchInput paramName={searchParam} placeholder={searchPlaceholder} defaultValue={searchValue ?? ''} width={240} />
      {selects.map((s) => (
        <Select
          key={s.param}
          value={s.value ?? ''}
          placeholder={s.placeholder}
          options={s.options}
          onChange={(e) => setFilter({ [s.param]: e.target.value || null })}
          className="h-8 text-sm"
          containerClassName="shrink-0"
          style={{ width: s.width ?? 150 }}
        />
      ))}
      {children}
      {activeCount > 0 && (
        <Button
          size="sm"
          variant="ghost"
          icon={<X className="size-3" />}
          onClick={() =>
            setFilter(Object.fromEntries([searchParam, ...selects.map((s) => s.param)].map((p) => [p, null])))
          }
        >
          Očisti ({activeCount})
        </Button>
      )}
    </div>
  );
}
