'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { DetailRow } from '@/components/ui/primitives';
import { formatAmount, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Numpad, numpadValue } from './numpad';

interface ShiftSummary {
  id: string;
  number: string;
  openedAt: string;
  salesCount: number;
  salesTotal: number;
  expectedCash: number;
}

/** Zatvaranje smjene s obračunom gotovine i prikazom razlike. */
export function CloseShiftPanel({
  open,
  onClose,
  shift,
  onClosed,
}: {
  open: boolean;
  onClose: () => void;
  shift: ShiftSummary;
  onClosed: () => void;
}) {
  const [counted, setCounted] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ difference: number; expectedCash: number; countedCash: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setCounted('');
      setError(null);
      setResult(null);
    }
  }, [open]);

  const countedValue = numpadValue(counted);
  const difference = countedValue - shift.expectedCash;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pos/shift', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'close', shiftId: shift.id, countedCash: countedValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Smjenu nije moguće zatvoriti.');
        return;
      }
      setResult(data);
    } catch {
      setError('Poslužitelj nije dostupan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={result ? 'Smjena je zatvorena' : 'Zatvaranje smjene'}
      description={result ? `Z-izvještaj za smjenu ${shift.number}` : 'Prebrojite gotovinu u ladici'}
      footer={
        result ? (
          <Button variant="primary" onClick={onClosed}>U redu</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Odustani</Button>
            <Button variant="primary" loading={loading} disabled={counted === ''} onClick={submit}>
              Zatvori smjenu
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="divide-y divide-hairline">
          <DetailRow label="Promet smjene">{formatAmount(shift.salesTotal)} €</DetailRow>
          <DetailRow label="Broj računa">{shift.salesCount}</DetailRow>
          <DetailRow label="Očekivana gotovina">{formatAmount(result.expectedCash)} €</DetailRow>
          <DetailRow label="Prebrojano">{formatAmount(result.countedCash)} €</DetailRow>
          <DetailRow label="Razlika">
            <span className={cn(Math.abs(result.difference) < 0.01 ? '' : result.difference < 0 ? 'text-negative' : 'text-warning')}>
              {result.difference > 0 ? '+' : ''}{formatAmount(result.difference)} €
            </span>
          </DetailRow>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div>
            <div className="divide-y divide-hairline rounded-lg bg-surface-2 px-2.5">
              <DetailRow label="Smjena">{shift.number}</DetailRow>
              <DetailRow label="Otvorena">{formatTime(shift.openedAt)}</DetailRow>
              <DetailRow label="Računa">{shift.salesCount}</DetailRow>
              <DetailRow label="Promet">{formatAmount(shift.salesTotal)} €</DetailRow>
              <DetailRow label="Očekivano u ladici">{formatAmount(shift.expectedCash)} €</DetailRow>
            </div>

            {counted !== '' && (
              <div
                className={cn(
                  'mt-2.5 rounded-lg px-2.5 py-2',
                  Math.abs(difference) < 0.01
                    ? 'bg-positive-soft text-positive'
                    : Math.abs(difference) < 5
                      ? 'bg-warning-soft text-warning'
                      : 'bg-negative-soft text-negative',
                )}
              >
                <p className="text-sm">Razlika</p>
                <p className="text-xl font-semibold tnum">
                  {difference > 0 ? '+' : ''}{formatAmount(difference)} €
                </p>
                <p className="mt-0.5 text-2xs opacity-85">
                  {Math.abs(difference) < 0.01 ? 'Blagajna je uredna.' : difference < 0 ? 'Manjak u blagajni.' : 'Višak u blagajni.'}
                </p>
              </div>
            )}

            {error && <p className="mt-2 rounded-md bg-negative-soft px-2 py-1.5 text-sm text-negative">{error}</p>}
          </div>

          <div>
            <Input
              value={counted}
              onChange={(e) => setCounted(e.target.value.replace(/[^\d,]/g, ''))}
              placeholder="0,00"
              className="mb-1.5 h-11 text-right text-xl font-semibold tnum"
              suffix="€"
              inputMode="decimal"
              autoFocus
            />
            <Numpad value={counted} onChange={setCounted} />
          </div>
        </div>
      )}
    </Modal>
  );
}
