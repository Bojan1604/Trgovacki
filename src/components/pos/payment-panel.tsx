'use client';

import { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Gift, Smartphone, Trash2, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/primitives';
import { formatAmount } from '@/lib/format';
import { roundAmount } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Numpad, numpadValue } from './numpad';
import type { PaymentMethodOption } from './types';

export interface DraftPayment {
  paymentMethodId: string;
  name: string;
  type: string;
  amount: number;
  tendered?: number;
  reference?: string;
}

const ICONS: Record<string, typeof Banknote> = {
  CASH: Banknote,
  CARD: CreditCard,
  GIFT_CARD: Gift,
  MOBILE: Smartphone,
  BANK_TRANSFER: Wallet,
  ON_ACCOUNT: Wallet,
};

/**
 * Naplata. Podržava dijeljeno plaćanje (više sredstava na jednom računu),
 * brze iznose gotovine i automatski izračun povrata.
 */
export function PaymentPanel({
  open,
  onClose,
  total,
  methods,
  onConfirm,
  processing,
  error,
}: {
  open: boolean;
  onClose: () => void;
  total: number;
  methods: PaymentMethodOption[];
  onConfirm: (payments: DraftPayment[]) => void;
  processing?: boolean;
  error?: string | null;
}) {
  const [payments, setPayments] = useState<DraftPayment[]>([]);
  const [input, setInput] = useState('');
  const [activeMethod, setActiveMethod] = useState<PaymentMethodOption | null>(null);

  const paid = useMemo(() => roundAmount(payments.reduce((acc, p) => acc + p.amount, 0)), [payments]);
  const remaining = roundAmount(Math.max(total - paid, 0));
  const change = roundAmount(Math.max(paid - total, 0));

  useEffect(() => {
    if (!open) {
      setPayments([]);
      setInput('');
      setActiveMethod(null);
      return;
    }
    setActiveMethod(methods.find((m) => m.type === 'CASH') ?? methods[0] ?? null);
  }, [open, methods]);

  // Brzi iznosi gotovine: točan iznos i sljedeće "okrugle" novčanice.
  const quickValues = useMemo(() => {
    const base = remaining > 0 ? remaining : total;
    const notes = [5, 10, 20, 50, 100, 200];
    const suggestions = notes.filter((n) => n >= base).slice(0, 3);
    return [Number(base.toFixed(2)), ...suggestions];
  }, [remaining, total]);

  const addPayment = (method: PaymentMethodOption, amount: number, tendered?: number) => {
    if (amount <= 0) return;
    setPayments((prev) => [
      ...prev,
      { paymentMethodId: method.id, name: method.name, type: method.type, amount, tendered },
    ]);
    setInput('');
  };

  const handleMethodPress = (method: PaymentMethodOption) => {
    setActiveMethod(method);
    const typed = numpadValue(input);
    if (typed > 0) {
      const amount = method.allowsChange ? Math.min(typed, remaining) : Math.min(typed, remaining);
      addPayment(method, roundAmount(amount), method.allowsChange ? typed : undefined);
    } else {
      // Bez unosa — naplaćuje se cijeli preostali iznos.
      addPayment(method, remaining, method.allowsChange ? remaining : undefined);
    }
  };

  const canConfirm = paid + 0.001 >= total && payments.length > 0 && !processing;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Naplata"
      description={`Za naplatu ${formatAmount(total)} €`}
      closeOnBackdrop={!processing}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={processing}>
            Odustani
          </Button>
          <Button
            variant="success"
            size="lg"
            loading={processing}
            disabled={!canConfirm}
            onClick={() => onConfirm(payments)}
          >
            Zaključi račun · {formatAmount(total)} €
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
        <div>
          {/* Sažetak */}
          <div className="mb-2.5 grid grid-cols-3 gap-1.5">
            <div className="rounded-lg bg-surface-2 p-2">
              <p className="text-2xs text-ink-3">Za naplatu</p>
              <p className="text-lg font-semibold tnum">{formatAmount(total)} €</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <p className="text-2xs text-ink-3">Preostalo</p>
              <p className={cn('text-lg font-semibold tnum', remaining > 0 ? 'text-warning' : 'text-positive')}>
                {formatAmount(remaining)} €
              </p>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <p className="text-2xs text-ink-3">Povrat</p>
              <p className="text-lg font-semibold tnum">{formatAmount(change)} €</p>
            </div>
          </div>

          {/* Načini plaćanja */}
          <div className="mb-2.5 grid grid-cols-3 gap-1.5">
            {methods.map((method) => {
              const Icon = ICONS[method.type] ?? Wallet;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => handleMethodPress(method)}
                  disabled={remaining <= 0 && !method.allowsChange}
                  className={cn(
                    'flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg border text-sm font-medium transition-all',
                    'active:scale-[0.97] disabled:opacity-35',
                    activeMethod?.id === method.id
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-hairline-strong/50 bg-surface hover:bg-surface-3',
                  )}
                >
                  <Icon className="size-4" />
                  {method.name}
                </button>
              );
            })}
          </div>

          {/* Dodana plaćanja */}
          {payments.length > 0 && (
            <div className="space-y-1">
              {payments.map((payment, index) => (
                <div key={index} className="flex items-center gap-2 rounded-md bg-surface-2 px-2 py-1.5">
                  <Badge tone="accent">{payment.name}</Badge>
                  <span className="flex-1 font-mono text-base tnum">{formatAmount(payment.amount)} €</span>
                  {payment.tendered !== undefined && payment.tendered > payment.amount && (
                    <span className="text-2xs text-ink-4">primljeno {formatAmount(payment.tendered)} €</span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPayments((prev) => prev.filter((_, i) => i !== index))}
                    className="grid size-6 place-items-center rounded-md text-ink-4 hover:bg-surface-3 hover:text-negative"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-2 rounded-md bg-negative-soft px-2 py-1.5 text-sm text-negative">{error}</p>}
        </div>

        {/* Numerička tipkovnica */}
        <div>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/[^\d,]/g, ''))}
            placeholder="0,00"
            className="mb-1.5 h-11 text-right text-xl font-semibold tnum"
            suffix="€"
            inputMode="decimal"
          />
          <Numpad
            value={input}
            onChange={setInput}
            quickValues={quickValues}
            onEnter={() => activeMethod && handleMethodPress(activeMethod)}
            enterLabel={activeMethod ? `Dodaj · ${activeMethod.name}` : 'Dodaj'}
            enterDisabled={!activeMethod}
          />
        </div>
      </div>
    </Modal>
  );
}
