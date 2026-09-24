'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Input, Switch } from '@/components/ui/field';
import { Modal } from '@/components/ui/overlay';
import { useToast } from '@/components/ui/toast';

export interface BrandValues {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

/**
 * Unos i izmjena brenda.
 *
 * Stranica ostaje poslužiteljska; na klijentu je samo gumb s obrascem, pa
 * popis i dalje dolazi gotov iz baze.
 */
export function BrandDialog({ brand }: { brand?: BrandValues }) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(brand);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: brand?.code ?? '',
    name: brand?.name ?? '',
    isActive: brand?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    setForm({ code: brand?.code ?? '', name: brand?.name ?? '', isActive: brand?.isActive ?? true });
    setError(null);
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/catalog/brands/${brand!.id}` : '/api/catalog/brands', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.fields?.[0]?.message ?? data.error ?? 'Spremanje nije uspjelo.');
        return;
      }
      toast.success(editing ? 'Brend je spremljen.' : `Kreiran brend ${data.code} · ${data.name}`);
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
        <IconButton
          size="sm"
          variant="ghost"
          label="Izmijeni brend"
          icon={<Pencil className="size-3.5" />}
          onClick={start}
        />
      ) : (
        <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={start}>
          Novi brend
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Brend ${brand!.code}` : 'Novi brend'}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Odustani</Button>
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
            />
            <Input
              label="Naziv"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <Switch
            label="Aktivan"
            description="Neaktivan brend se ne nudi pri unosu artikla."
            checked={form.isActive}
            onChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
          />
        </div>
      </Modal>
    </>
  );
}
