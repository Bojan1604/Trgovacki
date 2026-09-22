'use client';

import { useEffect, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/primitives';
import { formatPercent } from '@/lib/format';
import type { PosCustomer } from './types';

/** Odabir ili brzo kreiranje kupca na blagajni. */
export function CustomerPanel({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: PosCustomer | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PosCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ firstName: '', lastName: '', phone: '', email: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setCreating(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pos/customers?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.items ?? []);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  async function createCustomer() {
    setError(null);
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setError('Ime i prezime su obavezni.');
      return;
    }
    const res = await fetch('/api/pos/customers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Kupca nije moguće kreirati.');
      return;
    }
    onSelect(data);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={creating ? 'Novi kupac' : 'Kupac na računu'}
      description={creating ? 'Osnovni podaci za program vjernosti' : 'Pretraži po imenu, telefonu ili broju kartice'}
      footer={
        creating ? (
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>Natrag</Button>
            <Button variant="primary" onClick={createCustomer}>Spremi i dodaj</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => { onSelect(null); onClose(); }}>
              Bez kupca
            </Button>
            <Button variant="secondary" icon={<UserPlus className="size-3.5" />} onClick={() => setCreating(true)}>
              Novi kupac
            </Button>
          </>
        )
      }
    >
      {creating ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Input label="Ime" required value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} autoFocus />
          <Input label="Prezime" required value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          <Input label="Telefon" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          <Input label="E-pošta" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          {error && <p className="sm:col-span-2 rounded-md bg-negative-soft px-2 py-1.5 text-sm text-negative">{error}</p>}
        </div>
      ) : (
        <>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ime, telefon, e-pošta ili kartica…"
            prefix={<Search className="size-3.5" />}
            className="h-10"
          />
          <div className="mt-2 max-h-[300px] space-y-1 overflow-y-auto scroll-thin">
            {loading && <p className="py-3 text-center text-sm text-ink-4">Tražim…</p>}
            {!loading && query.length >= 2 && results.length === 0 && (
              <p className="py-3 text-center text-sm text-ink-4">Nema rezultata</p>
            )}
            {results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  onSelect(customer);
                  onClose();
                }}
                className="flex w-full items-center gap-2 rounded-md bg-surface-2 px-2.5 py-2 text-left transition-colors hover:bg-accent-soft"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{customer.name}</span>
                  <span className="block truncate text-sm text-ink-3">
                    {[customer.code, customer.phone, customer.email].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {customer.tier && <Badge tone="accent">{customer.tier}</Badge>}
                  {customer.points > 0 && <Badge tone="info">{customer.points} bod.</Badge>}
                  {customer.discountPct > 0 && <Badge tone="positive">−{formatPercent(customer.discountPct, 0)}</Badge>}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
