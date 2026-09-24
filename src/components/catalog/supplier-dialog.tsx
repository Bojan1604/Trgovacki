'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Input, Switch } from '@/components/ui/field';
import { Modal } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';
import { parseNumber } from '@/lib/format';

export interface SupplierValues {
  id: string;
  code: string;
  name: string;
  legalName: string | null;
  vatId: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
  iban: string | null;
  paymentTerms: number;
  leadTimeDays: number;
  minOrderValue: number;
  discountPct: number;
  isActive: boolean;
}

const EMPTY = {
  code: '', name: '', legalName: '', vatId: '', contactPerson: '', email: '', phone: '',
  addressLine: '', city: '', postalCode: '', iban: '',
  paymentTerms: '30', leadTimeDays: '3', minOrderValue: '0', discountPct: '0', isActive: true,
};

/** Unos i izmjena dobavljača. */
export function SupplierDialog({ supplier }: { supplier?: SupplierValues }) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(supplier);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    setForm(
      supplier
        ? {
            code: supplier.code, name: supplier.name,
            legalName: supplier.legalName ?? '', vatId: supplier.vatId ?? '',
            contactPerson: supplier.contactPerson ?? '', email: supplier.email ?? '',
            phone: supplier.phone ?? '', addressLine: supplier.addressLine ?? '',
            city: supplier.city ?? '', postalCode: supplier.postalCode ?? '',
            iban: supplier.iban ?? '',
            paymentTerms: String(supplier.paymentTerms), leadTimeDays: String(supplier.leadTimeDays),
            minOrderValue: String(supplier.minOrderValue), discountPct: String(supplier.discountPct),
            isActive: supplier.isActive,
          }
        : EMPTY,
    );
    setError(null);
    setOpen(true);
  }

  const set = (key: keyof typeof EMPTY, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: form.code, name: form.name, legalName: form.legalName, vatId: form.vatId,
        contactPerson: form.contactPerson, email: form.email, phone: form.phone,
        addressLine: form.addressLine, city: form.city, postalCode: form.postalCode, iban: form.iban,
        paymentTerms: Number(form.paymentTerms) || 0,
        leadTimeDays: Number(form.leadTimeDays) || 0,
        minOrderValue: parseNumber(form.minOrderValue) ?? 0,
        discountPct: parseNumber(form.discountPct) ?? 0,
        isActive: form.isActive,
      };
      const res = await fetch(editing ? `/api/catalog/suppliers/${supplier!.id}` : '/api/catalog/suppliers', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.fields?.[0]?.message ?? data.error ?? 'Spremanje nije uspjelo.');
        return;
      }
      toast.success(editing ? 'Dobavljač je spremljen.' : `Kreiran dobavljač ${data.code} · ${data.name}`);
      setOpen(false);
      router.refresh();
    } catch {
      setError('Poslužitelj nije dostupan. Pokušajte ponovno.');
    } finally {
      setSaving(false);
    }
  }

  const num = (v: string) => v.replace(/[^\d,.]/g, '');

  return (
    <>
      {editing ? (
        <IconButton size="sm" variant="ghost" label="Izmijeni dobavljača"
          icon={<Pencil className="size-3.5" />} onClick={start} />
      ) : (
        <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={start}>
          Novi dobavljač
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={editing ? `Dobavljač ${supplier!.code}` : 'Novi dobavljač'}
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
          <div className="grid grid-cols-3 gap-2.5">
            <Input label="Šifra" required value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} />
            <Input label="Naziv" required value={form.name} onChange={(e) => set('name', e.target.value)} />
            <Input label="OIB" value={form.vatId} onChange={(e) => set('vatId', e.target.value)} />
          </div>
          <Input label="Pravni naziv" value={form.legalName} onChange={(e) => set('legalName', e.target.value)} />
          <div className="grid grid-cols-3 gap-2.5">
            <Input label="Kontakt osoba" value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
            <Input label="E-pošta" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Input label="Telefon" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Input label="Adresa" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} />
            <Input label="Grad" value={form.city} onChange={(e) => set('city', e.target.value)} />
            <Input label="Poštanski broj" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
          </div>
          <Input label="IBAN" value={form.iban} onChange={(e) => set('iban', e.target.value)} />
          <div className="grid grid-cols-4 gap-2.5">
            <Input label="Rok plaćanja" value={form.paymentTerms} suffix="dana" inputMode="numeric"
              onChange={(e) => set('paymentTerms', e.target.value.replace(/\D/g, ''))} />
            <Input label="Rok isporuke" value={form.leadTimeDays} suffix="dana" inputMode="numeric"
              onChange={(e) => set('leadTimeDays', e.target.value.replace(/\D/g, ''))} />
            <Input label="Min. narudžba" value={form.minOrderValue} suffix="€" inputMode="decimal"
              onChange={(e) => set('minOrderValue', num(e.target.value))} />
            <Input label="Rabat" value={form.discountPct} suffix="%" inputMode="decimal"
              onChange={(e) => set('discountPct', num(e.target.value))} />
          </div>
          <Switch label="Aktivan" description="Neaktivan dobavljač se ne nudi u nabavi."
            checked={form.isActive} onChange={(v) => set('isActive', v)} />
        </div>
      </Modal>
    </>
  );
}
