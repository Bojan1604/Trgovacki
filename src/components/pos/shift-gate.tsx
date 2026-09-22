'use client';

import { useState } from 'react';
import { LockKeyhole, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { formatAmount } from '@/lib/format';
import { Numpad, numpadValue } from './numpad';
import type { PosSession } from './types';

/** Zaslon otvaranja smjene — blagajna ne radi dok smjena nije otvorena. */
export function ShiftGate({
  session,
  onOpened,
}: {
  session: PosSession;
  onOpened: () => void;
}) {
  const [registerId, setRegisterId] = useState(session.registers[0]?.id ?? '');
  const [amount, setAmount] = useState('150');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pos/shift', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          storeId: session.store.id,
          registerId,
          openingFloat: numpadValue(amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Smjenu nije moguće otvoriti.');
        return;
      }
      onOpened();
    } catch {
      setError('Poslužitelj nije dostupan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid h-full place-items-center p-6">
      <div className="w-full max-w-[380px]">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2.5 grid size-11 place-items-center rounded-2xl bg-accent text-white">
            <LockKeyhole className="size-5" />
          </div>
          <h1 className="text-lg font-semibold">Otvaranje smjene</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            {session.store.name} · {session.user.name}
          </p>
        </div>

        <div className="rounded-xl bg-surface p-3.5 shadow-[var(--shadow-card)]">
          <Select
            label="Blagajna"
            value={registerId}
            onChange={(e) => setRegisterId(e.target.value)}
            options={session.registers.map((r) => ({ value: r.id, label: r.name }))}
            className="mb-3"
          />

          <label className="mb-1 block text-sm font-medium text-ink-2">Početni saldo u ladici</label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ''))}
            className="mb-2 h-11 text-right text-xl font-semibold tnum"
            suffix="€"
            inputMode="decimal"
          />

          <Numpad value={amount} onChange={setAmount} className="mb-3" />

          {error && <p className="mb-2 rounded-md bg-negative-soft px-2 py-1.5 text-sm text-negative">{error}</p>}

          <Button
            variant="primary"
            size="lg"
            block
            loading={loading}
            disabled={!registerId}
            icon={<LogIn className="size-4" />}
            onClick={open}
          >
            Otvori smjenu · {formatAmount(numpadValue(amount))} €
          </Button>
        </div>

        <p className="mt-3 text-center text-2xs text-ink-4">
          Svaka prodaja se veže uz smjenu. Na zatvaranju sustav uspoređuje prebrojanu gotovinu
          s očekivanim stanjem i bilježi razliku.
        </p>
      </div>
    </div>
  );
}
