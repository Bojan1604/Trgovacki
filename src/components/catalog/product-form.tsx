'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Select, Switch, Textarea } from '@/components/ui/field';
import { Card, CardHeader, DetailRow, PageHeader } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { formatAmount, formatPercent, parseNumber } from '@/lib/format';
import { calculateRetailPrice } from '@/lib/pricing-math';
import { ean13CheckDigit } from '@/lib/utils';

interface Option {
  id: string;
  name: string;
}

export function ProductForm({
  categories,
  brands,
  units,
  taxRates,
  suppliers,
}: {
  categories: { id: string; name: string; level: number; targetMarginPct: number | null }[];
  brands: Option[];
  units: { id: string; code: string; name: string }[];
  taxRates: { id: string; name: string; rate: number; isDefault: boolean }[];
  suppliers: Option[];
}) {
  const router = useRouter();
  const toast = useToast();
  const defaultTax = taxRates.find((t) => t.isDefault) ?? taxRates[0];

  const [form, setForm] = useState({
    sku: '',
    name: '',
    shortName: '',
    description: '',
    categoryId: '',
    brandId: '',
    unitId: units.find((u) => u.code === 'kom')?.id ?? units[0]?.id ?? '',
    taxRateId: defaultTax?.id ?? '',
    barcode: '',
    supplierId: '',
    purchasePrice: '',
    marginPct: '',
    retailPrice: '',
    depositAmount: '',
    ageRestriction: '',
    trackExpiry: false,
    allowDiscount: true,
    publishedWeb: false,
    isWeighted: false,
  });
  const [saving, setSaving] = useState(false);

  const taxRate = taxRates.find((t) => t.id === form.taxRateId)?.rate ?? 0;
  const category = categories.find((c) => c.id === form.categoryId);

  const calculation = useMemo(() => {
    const cost = parseNumber(form.purchasePrice);
    if (cost <= 0) return null;
    const retail = parseNumber(form.retailPrice);
    const margin = parseNumber(form.marginPct);
    return calculateRetailPrice({
      landedCost: cost,
      taxRate,
      ...(retail > 0 ? { retailPriceWithTax: retail } : { marginPct: margin || category?.targetMarginPct || 25 }),
    });
  }, [form.purchasePrice, form.retailPrice, form.marginPct, taxRate, category]);

  const applyTargetMargin = () => {
    const target = category?.targetMarginPct;
    if (!target) {
      toast.info('Kategorija nema definiranu ciljanu maržu');
      return;
    }
    setForm((prev) => ({ ...prev, marginPct: String(target), retailPrice: '' }));
  };

  const generateBarcode = () => {
    const body = `385${String(Date.now()).slice(-9)}`;
    setForm((prev) => ({ ...prev, barcode: body + ean13CheckDigit(body) }));
  };

  async function submit() {
    if (!form.sku.trim() || !form.name.trim()) {
      toast.error('Šifra i naziv su obavezni');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/catalog/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sku: form.sku.trim(),
          name: form.name.trim(),
          shortName: form.shortName.trim() || undefined,
          description: form.description.trim() || undefined,
          categoryId: form.categoryId || undefined,
          brandId: form.brandId || undefined,
          unitId: form.unitId || undefined,
          taxRateId: form.taxRateId || undefined,
          barcode: form.barcode.trim() || undefined,
          supplierId: form.supplierId || undefined,
          purchasePrice: parseNumber(form.purchasePrice) || undefined,
          retailPrice: calculation?.retailPrice,
          depositAmount: parseNumber(form.depositAmount) || undefined,
          ageRestriction: form.ageRestriction ? Number(form.ageRestriction) : undefined,
          trackExpiry: form.trackExpiry,
          allowDiscount: form.allowDiscount,
          publishedWeb: form.publishedWeb,
          isWeighted: form.isWeighted,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error('Artikl nije spremljen', data.error);
        return;
      }
      toast.success('Artikl je kreiran', form.name);
      router.push(`/catalog/products/${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link href="/catalog/products" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3" /> Artikli
      </Link>

      <PageHeader
        title="Novi artikl"
        subtitle="Osnovni podaci, barkod i kalkulacija maloprodajne cijene"
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => router.back()}>Odustani</Button>
            <Button size="sm" variant="primary" icon={<Save className="size-3.5" />} loading={saving} onClick={submit}>
              Spremi artikl
            </Button>
          </>
        }
      />

      <div className="grid gap-2.5 lg:grid-cols-[1fr_330px]">
        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Osnovni podaci" />
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Input
                label="Šifra artikla"
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="npr. 1001"
              />
              <div className="flex items-end gap-1.5">
                <Input
                  label="Barkod (EAN-13)"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value.replace(/\D/g, '') })}
                  containerClassName="flex-1"
                  placeholder="3850000000000"
                />
                <Button size="md" variant="secondary" icon={<Wand2 className="size-3.5" />} onClick={generateBarcode}>
                  Generiraj
                </Button>
              </div>
              <Input
                label="Naziv"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                containerClassName="sm:col-span-2"
              />
              <Input
                label="Kratki naziv"
                hint="za račun i POS"
                value={form.shortName}
                onChange={(e) => setForm({ ...form, shortName: e.target.value })}
                maxLength={24}
              />
              <Select
                label="Jedinica mjere"
                value={form.unitId}
                onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.code})` }))}
              />
              <Select
                label="Kategorija"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                placeholder="Bez kategorije"
                options={categories.map((c) => ({ value: c.id, label: `${'  '.repeat(c.level)}${c.name}` }))}
              />
              <Select
                label="Brend"
                value={form.brandId}
                onChange={(e) => setForm({ ...form, brandId: e.target.value })}
                placeholder="Bez brenda"
                options={brands.map((b) => ({ value: b.id, label: b.name }))}
              />
              <Textarea
                label="Opis"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="sm:col-span-2"
                rows={3}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              compact
              title="Kalkulacija cijene"
              subtitle="Unesite nabavnu cijenu pa maržu ili maloprodajnu cijenu"
              actions={
                category?.targetMarginPct ? (
                  <Button size="xs" variant="secondary" onClick={applyTargetMargin}>
                    Ciljana marža {formatPercent(category.targetMarginPct, 0)}
                  </Button>
                ) : null
              }
            />
            <div className="grid gap-2.5 sm:grid-cols-4">
              <Select
                label="Dobavljač"
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                placeholder="Bez dobavljača"
                options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                containerClassName="sm:col-span-2"
              />
              <Select
                label="Porezna stopa"
                value={form.taxRateId}
                onChange={(e) => setForm({ ...form, taxRateId: e.target.value })}
                options={taxRates.map((t) => ({ value: t.id, label: t.name }))}
              />
              <Input
                label="Povratna naknada"
                value={form.depositAmount}
                onChange={(e) => setForm({ ...form, depositAmount: e.target.value })}
                suffix="€"
                inputMode="decimal"
              />
              <Input
                label="Nabavna cijena"
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value, retailPrice: '' })}
                suffix="€"
                inputMode="decimal"
              />
              <Input
                label="Marža"
                value={form.marginPct}
                onChange={(e) => setForm({ ...form, marginPct: e.target.value, retailPrice: '' })}
                suffix="%"
                inputMode="decimal"
                help="na neto cijenu"
              />
              <Input
                label="MPC s PDV-om"
                value={form.retailPrice}
                onChange={(e) => setForm({ ...form, retailPrice: e.target.value })}
                suffix="€"
                inputMode="decimal"
                help="ili upišite izravno"
                containerClassName="sm:col-span-2"
              />
            </div>

            {calculation && (
              <div className="mt-3 rounded-lg bg-surface-2 p-2.5">
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <DetailRow label="Neto prodajna cijena">{formatAmount(calculation.netRetail)} €</DetailRow>
                  <DetailRow label="PDV">{formatAmount(calculation.taxAmount)} €</DetailRow>
                  <DetailRow label="Marža u iznosu">{formatAmount(calculation.marginAmount)} €</DetailRow>
                  <DetailRow label="RUC na nabavnu">{formatPercent(calculation.markupPct)}</DetailRow>
                </div>
                <div className="mt-2 flex items-baseline justify-between border-t border-hairline pt-2">
                  <span className="text-md font-semibold">Maloprodajna cijena</span>
                  <span className="text-xl font-semibold tnum">{formatAmount(calculation.retailPrice)} €</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Svojstva" />
            <div className="space-y-2.5">
              <Switch
                checked={form.isWeighted}
                onChange={(v) => setForm({ ...form, isWeighted: v })}
                label="Artikl na vagu"
                description="Količina se unosi u kilogramima"
              />
              <Switch
                checked={form.trackExpiry}
                onChange={(v) => setForm({ ...form, trackExpiry: v })}
                label="Praćenje roka trajanja"
                description="Obavezan unos roka pri zaprimanju"
              />
              <Switch
                checked={form.allowDiscount}
                onChange={(v) => setForm({ ...form, allowDiscount: v })}
                label="Dozvoli popust"
                description="Isključite za duhanske proizvode"
              />
              <Switch
                checked={form.publishedWeb}
                onChange={(v) => setForm({ ...form, publishedWeb: v })}
                label="Objavi na webu"
                description="Sinkronizacija s web shopom"
              />
              <Input
                label="Dobna granica"
                value={form.ageRestriction}
                onChange={(e) => setForm({ ...form, ageRestriction: e.target.value.replace(/\D/g, '') })}
                placeholder="npr. 18"
                suffix="god."
                help="Blagajna traži potvrdu dobi"
              />
            </div>
          </Card>

          <Card className="bg-surface-2">
            <p className="text-sm leading-relaxed text-ink-3">
              Artikl se automatski dodaje u zadani maloprodajni cjenik s izračunatom cijenom.
              Zaliha se stvara tek prvom primkom — do tada je stanje nula u svim poslovnicama.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
