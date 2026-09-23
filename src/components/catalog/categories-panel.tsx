'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layers, Pencil, Plus } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Input, Select, Switch, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/overlay';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { formatPercent, parseNumber } from '@/lib/format';

export interface CategoryRow {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  description: string | null;
  level: number;
  targetMarginPct: number | null;
  isActive: boolean;
  productCount: number;
}

const EMPTY = { code: '', name: '', parentId: '', description: '', targetMarginPct: '', isActive: true };

/** Stablo kategorija s dodavanjem i izmjenom. */
export function CategoriesPanel({ categories }: { categories: CategoryRow[] }) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openAdd(parentId = '') {
    setForm({ ...EMPTY, parentId });
    setError(null);
    setEditing(null);
    setAdding(true);
  }

  function openEdit(category: CategoryRow) {
    setForm({
      code: category.code,
      name: category.name,
      parentId: category.parentId ?? '',
      description: category.description ?? '',
      targetMarginPct: category.targetMarginPct !== null ? String(category.targetMarginPct) : '',
      isActive: category.isActive,
    });
    setError(null);
    setAdding(false);
    setEditing(category);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const margin = parseNumber(form.targetMarginPct);
      const payload: Record<string, unknown> = {
        code: form.code,
        name: form.name,
        description: form.description,
        isActive: form.isActive,
        targetMarginPct: form.targetMarginPct.trim() === '' ? (editing ? null : undefined) : margin,
      };
      if (!editing && form.parentId) payload.parentId = form.parentId;

      const res = await fetch(
        editing ? `/api/catalog/categories/${editing.id}` : '/api/catalog/categories',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.fields?.[0]?.message ?? data.error ?? 'Spremanje nije uspjelo.');
        return;
      }

      toast.success(editing ? 'Kategorija je spremljena.' : `Kreirana kategorija ${data.code} · ${data.name}`);
      setAdding(false);
      setEditing(null);
      router.refresh();
    } catch {
      setError('Poslužitelj nije dostupan. Pokušajte ponovno.');
    } finally {
      setSaving(false);
    }
  }

  const open = adding || editing !== null;
  const close = () => {
    setAdding(false);
    setEditing(null);
  };

  // Nadređena može biti samo aktivna kategorija koja nije prekoračila dubinu.
  const parentOptions = categories
    .filter((c) => c.level < 3)
    .map((c) => ({ value: c.id, label: `${'— '.repeat(c.level)}${c.name}` }));

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Kategorije"
        subtitle={`${categories.length} kategorija u stablu`}
        actions={
          <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => openAdd()}>
            Nova kategorija
          </Button>
        }
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={100}>Šifra</TH>
              <TH>Naziv</TH>
              <TH numeric width={90}>Artikala</TH>
              <TH numeric width={110}>Ciljana marža</TH>
              <TH width={90}>Razina</TH>
              <TH width={90}>Status</TH>
              <TH width={90} />
            </TR>
          </THead>
          <TBody>
            {categories.map((category) => (
              <TR key={category.id}>
                <TD className="font-mono text-sm text-ink-3">{category.code}</TD>
                <TD>
                  <span style={{ paddingLeft: category.level * 16 }} className="inline-flex items-center gap-1.5">
                    {category.level > 0 && <span className="text-ink-4">└</span>}
                    <Link
                      href={`/catalog/products?category=${category.id}`}
                      className={category.level === 0 ? 'font-semibold hover:text-accent' : 'hover:text-accent'}
                    >
                      {category.name}
                    </Link>
                  </span>
                </TD>
                <TD numeric>{category.productCount || '—'}</TD>
                <TD numeric className="text-ink-2">
                  {category.targetMarginPct !== null ? formatPercent(category.targetMarginPct, 0) : '—'}
                </TD>
                <TD className="text-ink-3">{category.level === 0 ? 'Glavna' : 'Podkategorija'}</TD>
                <TD>
                  <Badge tone={category.isActive ? 'positive' : 'neutral'}>
                    {category.isActive ? 'Aktivna' : 'Neaktivna'}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-0.5">
                    {category.level < 3 && (
                      <IconButton
                        size="sm"
                        variant="ghost"
                        label="Dodaj podkategoriju"
                        icon={<Plus className="size-3.5" />}
                        onClick={() => openAdd(category.id)}
                      />
                    )}
                    <IconButton
                      size="sm"
                      variant="ghost"
                      label="Izmijeni kategoriju"
                      icon={<Pencil className="size-3.5" />}
                      onClick={() => openEdit(category)}
                    />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {categories.length === 0 && (
          <EmptyState
            icon={<Layers className="size-4" />}
            title="Nema kategorija"
            description="Kategorije grupiraju artikle i određuju izbornik na blagajni."
            action={
              <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={() => openAdd()}>
                Nova kategorija
              </Button>
            }
          />
        )}
      </Card>

      <p className="mt-2 px-1 text-2xs text-ink-4">
        Ciljana marža se koristi kao zadana vrijednost pri kalkulaciji maloprodajne cijene na primci.
        Ukupan broj artikala uključuje i podkategorije.
      </p>

      <Modal
        open={open}
        onClose={close}
        title={editing ? `Kategorija ${editing.code}` : 'Nova kategorija'}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={close}>Odustani</Button>
            <Button
              size="sm"
              variant="primary"
              loading={saving}
              disabled={!form.code.trim() || form.name.trim().length < 2}
              onClick={submit}
            >
              {editing ? 'Spremi' : 'Dodaj'}
            </Button>
          </>
        }
      >
        <div className="space-y-2.5">
          {error && <p className="rounded-md bg-negative-soft px-2 py-1.5 text-sm text-negative">{error}</p>}
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Šifra"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              help="Kratka oznaka, npr. PICE"
            />
            <Input
              label="Naziv"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <Select
            label="Nadređena kategorija"
            value={form.parentId}
            disabled={editing !== null}
            onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
            placeholder="Glavna kategorija"
            options={parentOptions}
            help={
              editing
                ? 'Premještanje u stablu nije podržano — deaktivirajte kategoriju i otvorite novu.'
                : undefined
            }
          />
          <Input
            label="Ciljana marža"
            value={form.targetMarginPct}
            onChange={(e) => setForm((f) => ({ ...f, targetMarginPct: e.target.value.replace(/[^\d,.]/g, '') }))}
            suffix="%"
            inputMode="decimal"
            className="max-w-[140px]"
            help="Predložak za kalkulaciju cijene na primci"
          />
          <Textarea
            label="Opis"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          {editing && (
            <Switch
              label="Aktivna"
              description="Neaktivna kategorija se ne nudi pri unosu artikla ni na blagajni."
              checked={form.isActive}
              onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
