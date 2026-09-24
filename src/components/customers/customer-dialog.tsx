'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Input, Select, Switch, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';
import { parseNumber } from '@/lib/format';

export interface CustomerValues {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  vatId: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
  groupId: string | null;
  discountPct: number;
  creditLimit: number;
  paymentTerms: number;
  marketingOptIn: boolean;
  isActive: boolean;
}

const TYPES = [
  { value: 'RETAIL', label: 'Fizička osoba' },
  { value: 'BUSINESS', label: 'Pravna osoba' },
  { value: 'EMPLOYEE', label: 'Djelatnik' },
];

const EMPTY = {
  type: 'RETAIL', firstName: '', lastName: '', companyName: '', vatId: '', email: '', phone: '',
  addressLine: '', city: '', postalCode: '', groupId: '',
  discountPct: '0', creditLimit: '0', paymentTerms: '0', marketingOptIn: false, isActive: true,
};

/** Unos i izmjena kupca. */
export function CustomerDialog({
  customer,
  groups,
}: {
  customer?: CustomerValues;
  groups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(customer);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    setForm(
      customer
        ? {
            type: customer.type,
            firstName: customer.firstName ?? '', lastName: customer.lastName ?? '',
            companyName: customer.companyName ?? '', vatId: customer.vatId ?? '',
            email: customer.email ?? '', phone: customer.phone ?? '',
            addressLine: customer.addressLine ?? '', city: customer.city ?? '',
            postalCode: customer.postalCode ?? '', groupId: customer.groupId ?? '',
            discountPct: String(customer.discountPct), creditLimit: String(customer.creditLimit),
            paymentTerms: String(customer.paymentTerms),
            marketingOptIn: customer.marketingOptIn, isActive: customer.isActive,
          }
        : EMPTY,
    );
    setError(null);
    setOpen(true);
  }

  const set = (key: keyof typeof EMPTY, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));
  const isCompany = form.type === 'BUSINESS';

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        type: form.type,
        firstName: form.firstName, lastName: form.lastName, companyName: form.companyName,
        vatId: form.vatId, email: form.email, phone: form.phone,
        addressLine: form.addressLine, city: form.city, postalCode: form.postalCode,
        groupId: form.groupId,
        discountPct: parseNumber(form.discountPct) ?? 0,
        creditLimit: parseNumber(form.creditLimit) ?? 0,
        paymentTerms: Number(form.paymentTerms) || 0,
        marketingOptIn: form.marketingOptIn,
      };
      if (editing) payload.isActive = form.isActive;

      const res = await fetch(editing ? `/api/customers/${customer!.id}` : '/api/customers', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.fields?.[0]?.message ?? data.error ?? 'Spremanje nije uspjelo.');
        return;
      }
      toast.success(editing ? 'Kupac je spremljen.' : `Kreiran kupac ${data.code} · ${data.name}`);
      setOpen(false);
      router.refresh();
    } catch {
      setError('Poslužitelj nije dostupan. Pokušajte ponovno.');
    } finally {
      setSaving(false);
    }
  }

  const valid = isCompany ? form.companyName.trim().length > 1 : form.firstName.trim() && form.lastName.trim();
  const num = (v: string) => v.replace(/[^\d,.]/g, '');

  return (
    <>
      {editing ? (
        <IconButton size="sm" variant="ghost" label="Izmijeni kupca"
          icon={<Pencil className="size-3.5" />} onClick={start} />
      ) : (
        <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={start}>
          Novi kupac
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={editing ? 'Izmjena kupca' : 'Novi kupac'}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Odustani</Button>
            <Button size="sm" variant="primary" loading={saving} disabled={!valid} onClick={submit}>
              {editing ? 'Spremi' : 'Dodaj'}
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          {error && <p className="rounded-md bg-negative-soft px-2 py-1.5 text-sm text-negative">{error}</p>}
          <div className="grid grid-cols-3 gap-2.5">
            <Select label="Vrsta" value={form.type} onChange={(e) => set('type', e.target.value)} options={TYPES} />
            <Select label="Skupina" value={form.groupId} onChange={(e) => set('groupId', e.target.value)}
              placeholder="Bez skupine" options={groups.map((g) => ({ value: g.id, label: g.name }))} />
            <Input label="OIB" value={form.vatId} onChange={(e) => set('vatId', e.target.value)} />
          </div>

          {isCompany ? (
            <Input label="Naziv tvrtke" required value={form.companyName}
              onChange={(e) => set('companyName', e.target.value)} />
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              <Input label="Ime" required value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
              <Input label="Prezime" required value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <Input label="E-pošta" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Input label="Telefon" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Input label="Adresa" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} />
            <Input label="Grad" value={form.city} onChange={(e) => set('city', e.target.value)} />
            <Input label="Poštanski broj" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Input label="Rabat" value={form.discountPct} suffix="%" inputMode="decimal"
              onChange={(e) => set('discountPct', num(e.target.value))} />
            <Input label="Kreditni limit" value={form.creditLimit} suffix="€" inputMode="decimal"
              onChange={(e) => set('creditLimit', num(e.target.value))} />
            <Input label="Rok plaćanja" value={form.paymentTerms} suffix="dana" inputMode="numeric"
              onChange={(e) => set('paymentTerms', e.target.value.replace(/\D/g, ''))} />
          </div>
          <Switch label="Privola za marketing"
            description="Bilježi se datum davanja privole."
            checked={form.marketingOptIn} onChange={(v) => set('marketingOptIn', v)} />
          {editing && <Switch label="Aktivan" checked={form.isActive} onChange={(v) => set('isActive', v)} />}
        </div>
      </Modal>
    </>
  );
}
