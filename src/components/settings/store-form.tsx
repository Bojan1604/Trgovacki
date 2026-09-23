'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select, Switch } from '@/components/ui/field';
import { Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { parseNumber } from '@/lib/format';
import { STORE_TYPE } from '@/lib/labels';

interface Option {
  id: string;
  name: string;
}

export interface StoreValues {
  id?: string;
  companyId: string;
  code: string;
  name: string;
  type: string;
  status: string;
  addressLine: string;
  city: string;
  postalCode: string;
  region: string;
  phone: string;
  email: string;
  managerName: string;
  squareMeters: string;
  priceListId: string;
  allowNegativeStock: boolean;
  fiscalEnabled: boolean;
}

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Aktivna' },
  { value: 'IN_PREPARATION', label: 'U pripremi' },
  { value: 'INACTIVE', label: 'Neaktivna' },
  { value: 'CLOSED', label: 'Zatvorena' },
];

/** Obrazac za otvaranje i izmjenu poslovnice. */
export function StoreForm({
  companies,
  priceLists,
  initial,
}: {
  companies: Option[];
  priceLists: Option[];
  initial?: StoreValues;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(initial?.id);

  const [form, setForm] = useState<StoreValues>(
    initial ?? {
      companyId: companies[0]?.id ?? '',
      code: '',
      name: '',
      type: 'RETAIL',
      status: 'ACTIVE',
      addressLine: '',
      city: '',
      postalCode: '',
      region: '',
      phone: '',
      email: '',
      managerName: '',
      squareMeters: '',
      priceListId: '',
      allowNegativeStock: false,
      fiscalEnabled: true,
    },
  );
  // Broj blagajni se zadaje samo pri otvaranju; poslije se dodaju pojedinačno.
  const [registerCount, setRegisterCount] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof StoreValues>(key: K, value: StoreValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        code: form.code,
        name: form.name,
        type: form.type,
        status: form.status,
        addressLine: form.addressLine,
        city: form.city,
        postalCode: form.postalCode,
        region: form.region,
        phone: form.phone,
        email: form.email,
        managerName: form.managerName,
        priceListId: form.priceListId,
        allowNegativeStock: form.allowNegativeStock,
        fiscalEnabled: form.fiscalEnabled,
      };
      const area = parseNumber(form.squareMeters);
      if (area && area > 0) payload.squareMeters = area;
      else if (editing) payload.squareMeters = null;

      if (!editing) {
        payload.companyId = form.companyId;
        payload.registerCount = Math.max(1, Math.min(20, Number(registerCount) || 1));
      }

      const res = await fetch(editing ? `/api/settings/stores/${initial!.id}` : '/api/settings/stores', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.fields?.[0]?.message ?? data.error ?? 'Spremanje nije uspjelo.');
        return;
      }

      toast.success(editing ? 'Poslovnica je spremljena.' : `Otvorena poslovnica ${data.code} · ${data.name}`);
      router.push(`/settings/stores/${editing ? initial!.id : data.id}`);
      router.refresh();
    } catch {
      setError('Poslužitelj nije dostupan. Pokušajte ponovno.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[820px]">
      <PageHeader
        title={editing ? `Poslovnica ${form.code}` : 'Nova poslovnica'}
        subtitle={
          editing
            ? 'Izmjena podataka lokacije'
            : 'Uz poslovnicu se odmah otvaraju prodajno skladište i blagajne'
        }
        actions={
          <>
            <Link href={editing ? `/settings/stores/${initial!.id}` : '/settings/stores'}>
              <Button size="sm" variant="ghost" icon={<ArrowLeft className="size-3.5" />}>
                Odustani
              </Button>
            </Link>
            <Button
              size="sm"
              variant="primary"
              loading={saving}
              icon={<Save className="size-3.5" />}
              onClick={save}
              disabled={!form.code.trim() || form.name.trim().length < 2 || !form.companyId}
            >
              {editing ? 'Spremi' : 'Otvori poslovnicu'}
            </Button>
          </>
        }
      />

      {error && (
        <p className="mb-2.5 rounded-md bg-negative-soft px-2.5 py-2 text-sm text-negative">{error}</p>
      )}

      <Card className="mb-2.5">
        <CardHeader title="Osnovni podaci" />
        <div className="grid grid-cols-2 gap-2.5">
          <Input
            label="Oznaka poslovnog prostora"
            required
            value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            help="Koristi se u broju računa i fiskalizaciji, npr. POSLOVNICA1"
          />
          <Input
            label="Naziv"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Split Poljud"
          />
          <Select
            label="Tvrtka"
            required
            value={form.companyId}
            disabled={editing}
            onChange={(e) => set('companyId', e.target.value)}
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            help={editing ? 'Tvrtku nije moguće mijenjati nakon otvaranja.' : undefined}
          />
          <Select
            label="Vrsta"
            value={form.type}
            onChange={(e) => set('type', e.target.value)}
            options={Object.entries(STORE_TYPE).map(([value, label]) => ({ value, label }))}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Cjenik"
            value={form.priceListId}
            onChange={(e) => set('priceListId', e.target.value)}
            placeholder="Zadani cjenik organizacije"
            options={priceLists.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      </Card>

      <Card className="mb-2.5">
        <CardHeader title="Adresa i kontakt" />
        <div className="grid grid-cols-2 gap-2.5">
          <Input label="Adresa" value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} />
          <Input label="Grad" value={form.city} onChange={(e) => set('city', e.target.value)} />
          <Input label="Poštanski broj" value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
          <Input label="Regija" value={form.region} onChange={(e) => set('region', e.target.value)} help="Skupina za izvještavanje" />
          <Input label="Telefon" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <Input label="E-pošta" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          <Input label="Voditelj" value={form.managerName} onChange={(e) => set('managerName', e.target.value)} />
          <Input
            label="Kvadratura"
            value={form.squareMeters}
            onChange={(e) => set('squareMeters', e.target.value.replace(/[^\d,.]/g, ''))}
            suffix="m²"
            inputMode="decimal"
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Rad poslovnice" />
        <div className="space-y-1">
          <Switch
            label="Fiskalizacija"
            description="Računi ove poslovnice šalju se u fiskalizaciju."
            checked={form.fiscalEnabled}
            onChange={(v) => set('fiscalEnabled', v)}
          />
          <Switch
            label="Dopusti prodaju u minus"
            description="Blagajna prodaje i kad je knjigovodstvena zaliha nula."
            checked={form.allowNegativeStock}
            onChange={(v) => set('allowNegativeStock', v)}
          />
          {!editing && (
            <div className="pt-1.5">
              <Input
                label="Broj blagajni"
                value={registerCount}
                onChange={(e) => setRegisterCount(e.target.value.replace(/\D/g, ''))}
                className="max-w-[120px]"
                inputMode="numeric"
                help="Otvaraju se odmah, kasnije ih možete dodati ili preimenovati."
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
