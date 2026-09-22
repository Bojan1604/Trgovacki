'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CornerDownLeft, Receipt, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KeyHint } from '@/components/ui/primitives';

interface Hit {
  type: 'product' | 'customer' | 'sale';
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const ICONS = {
  product: Box,
  customer: Users,
  sale: Receipt,
};

const TYPE_LABEL = {
  product: 'Artikl',
  customer: 'Kupac',
  sale: 'Račun',
};

/** Globalna pretraga (⌘K / Ctrl+K) — artikli, kupci i računi na jednom mjestu. */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else {
      setQuery('');
      setHits([]);
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setHits(data.hits ?? []);
        setCursor(0);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const go = (hit: Hit) => {
    setOpen(false);
    router.push(hit.href);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-7 w-[200px] items-center gap-1.5 rounded-md border border-hairline-strong/50 bg-surface-2 px-2 text-ink-4 hover:border-hairline-strong"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left text-sm">Pretraži…</span>
        <KeyHint>⌘K</KeyHint>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh]">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-[560px] animate-sheet overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-overlay)]">
            <div className="flex items-center gap-2 px-3 h-11 hairline-b">
              <Search className="size-4 text-ink-4" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCursor((c) => Math.min(c + 1, hits.length - 1));
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCursor((c) => Math.max(c - 1, 0));
                  }
                  if (e.key === 'Enter' && hits[cursor]) go(hits[cursor]);
                }}
                placeholder="Artikl, barkod, kupac ili broj računa…"
                className="flex-1 bg-transparent text-md placeholder:text-ink-4 focus:outline-none"
              />
              {loading && <span className="text-xs text-ink-4">tražim…</span>}
            </div>

            <div className="max-h-[50vh] overflow-y-auto scroll-thin p-1.5">
              {hits.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-ink-4">
                  {query.length < 2 ? 'Upišite barem dva znaka' : 'Nema rezultata'}
                </p>
              ) : (
                hits.map((hit, index) => {
                  const Icon = ICONS[hit.type];
                  return (
                    <button
                      key={`${hit.type}-${hit.id}`}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(hit)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left',
                        index === cursor ? 'bg-accent text-white' : 'hover:bg-surface-3',
                      )}
                    >
                      <Icon className={cn('size-4 shrink-0', index === cursor ? 'opacity-90' : 'text-ink-4')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium">{hit.title}</span>
                        <span className={cn('block truncate text-sm', index === cursor ? 'opacity-75' : 'text-ink-3')}>
                          {hit.subtitle}
                        </span>
                      </span>
                      <span className={cn('text-2xs', index === cursor ? 'opacity-70' : 'text-ink-4')}>
                        {TYPE_LABEL[hit.type]}
                      </span>
                      {index === cursor && <CornerDownLeft className="size-3 opacity-70" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
