'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Input, Select, Switch } from '@/components/ui/field';
import { Modal } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';
import { parseNumber } from '@/lib/format';
import { PAYMENT_TYPE } from '@/lib/labels';

export interface PaymentMethodValues {
  id: string;
  code: string;
  name: string;
  type: string;
  fiscalCode: string | null;
  opensDrawer: boolean;
  allowsChange: boolean;
  requiresRef: boolean;
  feePct: number;
  isActive: boolean;
}

const EMPTY = {
  code: '', name: '', type: 'CARD', fiscalCode: '',
  opensDrawer: false, allowsChange: false, requiresRef: false, feePct: '0', isActive: true,
};

/** Unos i izmjena načina plaćanja. */
export function PaymentMethodDialog({ method }: { method?: PaymentMethodValues }) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(method);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    setForm(
      method
        ? {
            code: method.code, name: method.name, type: method.type,
            fiscalCode: method.fiscalCode ?? '', opensDrawer: method.opensDrawer,
            allowsChange: method.allowsChange, requiresRef: method.requiresRef,
            feePct: String(method.feePct), isActive: method.isActive,
          }
        : EMPTY,
    );
    setError(null);
    setOpen(true);
  }

  const set = (key: keyof typeof EMPTY, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  /** Gotovina otvara ladicu i vraća ostatak; ostalo uglavnom ne. */
  function chooseType(type: string) {
    setForm((f) => ({ ...f, type, opensDrawer: type === 'CASH', allowsChange: type === 'CASH' }));
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        editing ? `/api/settings/payment-methods/${method!.id}` : '/api/settings/payment-methods',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...form, feePct: parseNumber(form.feePct) ?? 0 }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.fields?.[0]?.message ?? data.error ?? 'Spremanje nije uspjelo.');
        return;
      }
      toast.success(editing ? 'Način plaćanja je spremljen.' : `Kreiran način ${data.code} · ${data.name}`);
      setOpen(false);
      router.refresh();
    } catch {
      setError('Poslužitelj nije dostupan. Pokušajte ponovno.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {editing ? (
        <IconButton size="sm" variant="ghost" label="Izmijeni način plaćanja"
          icon={<Pencil className="size-3.5" />} onClick={start} />
      ) : (
        <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={start}>
          Novi način
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Način plaćanja ${method!.code}` : 'Novi način plaćanja'}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Odustani</Button>
            <Button size="sm" variant="primary" loading={saving}
              disabled={!form.code.trim() || form.name.trim().length < 2} onClick={submit}>
              {editing ? 'Spremi' : 'Dodaj'}
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          {error && <p className="rounded-md bg-negative-soft px-2 py-1.5 text-sm text-negative">{error}</p>}
          <div className="grid grid-cols-2 gap-2.5">
            <Input label="Šifra" required value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())} />
            <Input label="Naziv" required value={form.name}
              onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Select label="Vrsta" value={form.type} onChange={(e) => chooseType(e.target.value)}
              options={Object.entries(PAYMENT_TYPE).map(([value, label]) => ({ value, label }))} />
            <Input label="Fiskalna oznaka" value={form.fiscalCode} maxLength={1}
              onChange={(e) => set('fiscalCode', e.target.value.toUpperCase())}
              help="G gotovina, K kartica, C ček, T transakcijski, O ostalo" />
            <Input label="Naknada" value={form.feePct} suffix="%" inputMode="decimal"
              onChange={(e) => set('feePct', e.target.value.replace(/[^\d,.]/g, ''))} />
          </div>
          <div className="space-y-1">
            <Switch label="Otvara ladicu" checked={form.opensDrawer} onChange={(v) => set('opensDrawer', v)} />
            <Switch label="Dopušta ostatak" description="Blagajna računa povrat kad je primljeno više od iznosa."
              checked={form.allowsChange} onChange={(v) => set('allowsChange', v)} />
            <Switch label="Traži referencu" description="Blagajnik mora upisati broj transakcije."
              checked={form.requiresRef} onChange={(v) => set('requiresRef', v)} />
            <Switch label="Aktivan" checked={form.isActive} onChange={(v) => set('isActive', v)} />
          </div>
        </div>
      </Modal>
    </>
  );
}
