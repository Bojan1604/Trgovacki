'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PackageSearch, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';

interface Item {
  variantId: string;
  sku: string;
  name: string;
  category: string | null;
  inAssortment: boolean;
}

type Mode = 'ALL' | 'LISTED_ONLY';

const MODE_OPTIONS = [
  { value: 'ALL', label: 'Cijeli katalog osim isključenih' },
  { value: 'LISTED_ONLY', label: 'Samo uvršteni artikli' },
];

/**
 * Ponuda poslovnice.
 *
 * Lanac rijetko prodaje isto svugdje, pa se ovdje bira što ova lokacija nudi.
 * Zapisi se drže samo za odstupanja od odabranog načina.
 */
export function AssortmentPanel({
  storeId,
  categories,
  initialMode,
  initialDeviations,
}: {
  storeId: string;
  categories: { id: string; name: string }[];
  initialMode: Mode;
  initialDeviations: number;
}) {
  const router = useRouter();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [deviations, setDeviations] = useState(initialDeviations);
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [only, setOnly] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(`/api/settings/stores/${storeId}/assortment`, window.location.origin);
      if (query.trim()) url.searchParams.set('q', query.trim());
      if (category) url.searchParams.set('category', category);
      if (only) url.searchParams.set('only', only);
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items ?? []);
        setMode(data.mode);
        setDeviations(data.deviations);
      }
    } finally {
      setLoading(false);
    }
  }, [storeId, query, category, only]);

  useEffect(() => {
    const timer = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  async function changeMode(next: Mode) {
    const label = MODE_OPTIONS.find((m) => m.value === next)?.label ?? next;
    if (deviations > 0 && !window.confirm(`Promjena na „${label}" briše ${deviations} dosad postavljenih odstupanja. Nastaviti?`)) {
      return;
    }
    const res = await fetch(`/api/settings/stores/${storeId}/assortment`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Izmjena nije uspjela.');
      return;
    }
    toast.success('Način ponude je promijenjen.');
    await load();
    router.refresh();
  }

  async function toggle(item: Item) {
    setBusyId(item.variantId);
    try {
      const res = await fetch(`/api/settings/stores/${storeId}/assortment`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: [{ variantId: item.variantId, inAssortment: !item.inAssortment }] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Izmjena nije uspjela.');
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.variantId === item.variantId ? { ...i, inAssortment: !i.inAssortment } : i)),
      );
      setDeviations(data.deviations);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card padded={false}>
      <CardHeader
        title="Ponuda poslovnice"
        subtitle={
          deviations === 0
            ? mode === 'ALL'
              ? 'Prodaje se cijeli katalog'
              : 'Nijedan artikl još nije uvršten'
            : `${deviations} ${mode === 'ALL' ? 'isključenih artikala' : 'uvrštenih artikala'}`
        }
        actions={
          <Select
            aria-label="Način ponude"
            value={mode}
            onChange={(e) => changeMode(e.target.value as Mode)}
            options={MODE_OPTIONS}
            className="w-[240px]"
          />
        }
      />

      <div className="flex items-center gap-1.5 px-2.5 pb-2.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" />
          <Input
            aria-label="Pretraga artikala"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Traži artikl po nazivu ili šifri…"
            className="pl-7"
          />
        </div>
        <Select
          aria-label="Kategorija"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Sve kategorije"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          className="w-[190px]"
        />
        <Select
          aria-label="Prikaz ponude"
          value={only}
          onChange={(e) => setOnly(e.target.value)}
          options={[
            { value: '', label: 'Svi artikli' },
            { value: 'in', label: 'Samo u ponudi' },
            { value: 'out', label: 'Samo izvan ponude' },
          ]}
          className="w-[170px]"
        />
        {loading && <Loader2 className="size-4 animate-spin text-ink-4" />}
      </div>

      {items.length === 0 && !loading ? (
        <EmptyState
          icon={<PackageSearch className="size-4" />}
          title="Nema artikala"
          description={
            mode === 'LISTED_ONLY'
              ? 'U ovom načinu blagajna prodaje samo artikle koje ovdje uvrstite.'
              : 'Promijenite pretragu ili filtar.'
          }
        />
      ) : (
        <div className="max-h-[420px] overflow-y-auto scroll-thin">
          <Table>
            <THead sticky>
              <TR>
                <TH width={110}>Šifra</TH>
                <TH>Artikl</TH>
                <TH width={160}>Kategorija</TH>
                <TH width={120}>Status</TH>
                <TH width={120} />
              </TR>
            </THead>
            <TBody>
              {items.map((item) => (
                <TR key={item.variantId}>
                  <TD className="font-mono text-sm text-ink-3">{item.sku}</TD>
                  <TD>{item.name}</TD>
                  <TD className="truncate text-ink-2">{item.category ?? '—'}</TD>
                  <TD>
                    <Badge tone={item.inAssortment ? 'positive' : 'neutral'} dot>
                      {item.inAssortment ? 'U ponudi' : 'Izvan ponude'}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busyId === item.variantId}
                        onClick={() => toggle(item)}
                      >
                        {item.inAssortment ? 'Izbaci' : 'Uvrsti'}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <p className="px-2.5 py-2 text-2xs text-ink-4">
        Blagajna prodaje samo artikle iz ponude — izbačeni se ne pojavljuju ni u mreži ni
        skeniranjem barkoda. Cijene po poslovnici postavljaju se kroz cjenik, a ne ovdje.
      </p>
    </Card>
  );
}
