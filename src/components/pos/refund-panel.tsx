'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Input, Select, Checkbox } from '@/components/ui/field';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatAmount, formatDateTime, formatQty } from '@/lib/format';
import { roundAmount } from '@/lib/money';
import type { PaymentMethodOption } from './types';

interface RefundableSale {
  id: string;
  number: string;
  issuedAt: string;
  storeName: string;
  total: number;
  status: string;
  payments: { id: string; name: string; amount: number }[];
  lines: {
    id: string; sku: string; name: string; quantity: number;
    refundedQty: number; available: number; unitPrice: number; lineTotal: number;
  }[];
}

const REASONS = [
  'Kupac se predomislio',
  'Neispravan artikl',
  'Pogrešno naplaćen artikl',
  'Oštećena ambalaža',
  'Zamjena artikla',
];

/** Povrat robe po izvornom računu, s mogućnošću djelomičnog povrata. */
export function RefundPanel({
  open,
  onClose,
  methods,
  shiftId,
  registerId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  methods: PaymentMethodOption[];
  shiftId: string;
  registerId: string;
  onDone: (number: string) => void;
}) {
  const [number, setNumber] = useState('');
  const [sale, setSale] = useState<RefundableSale | null>(null);
  const [selection, setSelection] = useState<Record<string, number>>({});
  const [reason, setReason] = useState(REASONS[0]);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setNumber('');
      setSale(null);
      setSelection({});
      setError(null);
    }
  }, [open]);

  async function findSale() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pos/refund?number=${encodeURIComponent(number.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Račun nije pronađen.');
        setSale(null);
        return;
      }
      setSale(data);
      setSelection(Object.fromEntries(data.lines.map((l: { id: string }) => [l.id, 0])));
      setMethodId(data.payments[0]?.id ?? methods[0]?.id ?? '');
    } finally {
      setLoading(false);
    }
  }

  const refundTotal = sale
    ? roundAmount(sale.lines.reduce((acc, l) => acc + (selection[l.id] ?? 0) * l.unitPrice, 0))
    : 0;

  async function submit() {
    if (!sale) return;
    const lines = Object.entries(selection)
      .filter(([, qty]) => qty > 0)
      .map(([saleLineId, quantity]) => ({ saleLineId, quantity, restock: true }));

    if (lines.length === 0) {
      setError('Odaberite barem jednu stavku za povrat.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/pos/refund', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ saleId: sale.id, shiftId, registerId, paymentMethodId: methodId, reason, lines }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Povrat nije proveden.');
        return;
      }
      onDone(data.number);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Povrat robe"
      description="Unesite broj izvornog računa i odaberite stavke"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Odustani</Button>
          <Button variant="danger" loading={loading} disabled={!sale || refundTotal <= 0} onClick={submit}>
            Provedi povrat · {formatAmount(refundTotal)} €
          </Button>
        </>
      }
    >
      <div className="mb-3 flex items-end gap-2">
        <Input
          label="Broj računa"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && findSale()}
          placeholder="npr. 1234/1/2"
          containerClassName="flex-1"
          autoFocus
        />
        <Button variant="secondary" icon={<Search className="size-3.5" />} loading={loading} onClick={findSale}>
          Pronađi
        </Button>
      </div>

      {error && <p className="mb-2 rounded-md bg-negative-soft px-2 py-1.5 text-sm text-negative">{error}</p>}

      {sale && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-surface-2 px-2.5 py-2 text-sm">
            <span><span className="text-ink-3">Račun:</span> <b className="font-mono">{sale.number}</b></span>
            <span><span className="text-ink-3">Izdan:</span> {formatDateTime(sale.issuedAt)}</span>
            <span><span className="text-ink-3">Poslovnica:</span> {sale.storeName}</span>
            <span><span className="text-ink-3">Iznos:</span> <b className="tnum">{formatAmount(sale.total)} €</b></span>
          </div>

          <Table>
            <THead>
              <TR>
                <TH width={34} />
                <TH width={80}>Šifra</TH>
                <TH>Naziv</TH>
                <TH numeric width={80}>Kupljeno</TH>
                <TH numeric width={90}>Raspoloživo</TH>
                <TH numeric width={90}>Vrati</TH>
                <TH numeric width={90}>Iznos</TH>
              </TR>
            </THead>
            <TBody>
              {sale.lines.map((line) => {
                const selected = selection[line.id] ?? 0;
                return (
                  <TR key={line.id} muted={line.available <= 0}>
                    <TD>
                      <Checkbox
                        checked={selected > 0}
                        disabled={line.available <= 0}
                        onChange={(checked) =>
                          setSelection((prev) => ({ ...prev, [line.id]: checked ? line.available : 0 }))
                        }
                      />
                    </TD>
                    <TD className="font-mono text-sm text-ink-3">{line.sku}</TD>
                    <TD className="truncate">{line.name}</TD>
                    <TD numeric className="text-ink-3">{formatQty(line.quantity, 2)}</TD>
                    <TD numeric>{formatQty(line.available, 2)}</TD>
                    <TD numeric>
                      <input
                        type="number"
                        min={0}
                        max={line.available}
                        step="any"
                        value={selected || ''}
                        disabled={line.available <= 0}
                        onChange={(e) => {
                          const value = Math.min(Number(e.target.value) || 0, line.available);
                          setSelection((prev) => ({ ...prev, [line.id]: value }));
                        }}
                        className="h-6 w-[70px] rounded-md border border-hairline-strong/60 bg-surface px-1 text-right text-sm tnum focus:border-accent focus:outline-none"
                      />
                    </TD>
                    <TD numeric className="font-medium">{formatAmount(selected * line.unitPrice)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <Select
              label="Razlog povrata"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              options={REASONS.map((r) => ({ value: r, label: r }))}
            />
            <Select
              label="Povrat novca putem"
              value={methodId}
              onChange={(e) => setMethodId(e.target.value)}
              options={methods.map((m) => ({ value: m.id, label: m.name }))}
            />
          </div>
        </>
      )}
    </Modal>
  );
}
