'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Monitor, Pencil, Plus } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Modal } from '@/components/ui/overlay';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';

export interface RegisterRow {
  id: string;
  code: string;
  name: string;
  deviceId: string | null;
  ipAddress: string | null;
  isActive: boolean;
  openShifts: number;
}

/** Popis blagajni poslovnice s dodavanjem i izmjenom. */
export function RegistersPanel({ storeId, registers }: { storeId: string; registers: RegisterRow[] }) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<RegisterRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', deviceId: '', ipAddress: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Sljedeća slobodna oznaka — blagajne su obično numerirane redom. */
  function nextCode() {
    const numbers = registers.map((r) => Number(r.code)).filter((n) => Number.isFinite(n));
    return String(numbers.length > 0 ? Math.max(...numbers) + 1 : 1);
  }

  function openAdd() {
    const code = nextCode();
    setForm({ code, name: `Blagajna ${code}`, deviceId: '', ipAddress: '' });
    setError(null);
    setAdding(true);
  }

  function openEdit(register: RegisterRow) {
    setForm({
      code: register.code,
      name: register.name,
      deviceId: register.deviceId ?? '',
      ipAddress: register.ipAddress ?? '',
    });
    setError(null);
    setEditing(register);
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        editing ? `/api/settings/registers/${editing.id}` : '/api/settings/registers',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(editing ? form : { ...form, storeId }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.fields?.[0]?.message ?? data.error ?? 'Spremanje nije uspjelo.');
        return;
      }
      toast.success(editing ? 'Blagajna je spremljena.' : `Dodana blagajna ${data.code} · ${data.name}`);
      setAdding(false);
      setEditing(null);
      router.refresh();
    } catch {
      setError('Poslužitelj nije dostupan. Pokušajte ponovno.');
    } finally {
      setSaving(false);
    }
  }

  async function setActive(register: RegisterRow, isActive: boolean) {
    const res = await fetch(`/api/settings/registers/${register.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Izmjena nije uspjela.');
      return;
    }
    toast.success(isActive ? `Blagajna ${register.code} je u pogonu.` : `Blagajna ${register.code} je izvan pogona.`);
    router.refresh();
  }

  const dialogOpen = adding || editing !== null;

  return (
    <Card padded={false}>
      <CardHeader
        title="Blagajne"
        subtitle={`${registers.length} uređaja · oznaka se ispisuje u broju računa`}
        actions={
          <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={openAdd}>
            Nova blagajna
          </Button>
        }
      />

      {registers.length === 0 ? (
        <EmptyState
          icon={<Monitor className="size-4" />}
          title="Nema blagajni"
          description="Bez blagajne se u ovoj poslovnici ne može otvoriti smjena ni naplatiti račun."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH width={70}>Oznaka</TH>
              <TH>Naziv</TH>
              <TH width={150}>Uređaj</TH>
              <TH width={120}>IP adresa</TH>
              <TH width={110}>Status</TH>
              <TH width={130} />
            </TR>
          </THead>
          <TBody>
            {registers.map((register) => (
              <TR key={register.id}>
                <TD className="font-mono text-sm font-medium">{register.code}</TD>
                <TD>
                  {register.name}
                  {register.openShifts > 0 && (
                    <Badge tone="warning" className="ml-1.5">Smjena otvorena</Badge>
                  )}
                </TD>
                <TD className="truncate text-ink-2">{register.deviceId ?? '—'}</TD>
                <TD className="font-mono text-sm text-ink-2">{register.ipAddress ?? '—'}</TD>
                <TD>
                  <Badge tone={register.isActive ? 'positive' : 'neutral'} dot>
                    {register.isActive ? 'U pogonu' : 'Izvan pogona'}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setActive(register, !register.isActive)}>
                      {register.isActive ? 'Isključi' : 'Uključi'}
                    </Button>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      label="Izmijeni blagajnu"
                      icon={<Pencil className="size-3.5" />}
                      onClick={() => openEdit(register)}
                    />
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={dialogOpen}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        title={editing ? `Blagajna ${editing.code}` : 'Nova blagajna'}
        footer={
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setEditing(null);
              }}
            >
              Odustani
            </Button>
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
              label="Oznaka"
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              help="Broj naplatnog uređaja u računu"
            />
            <Input
              label="Naziv"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Serijski broj uređaja"
              value={form.deviceId}
              onChange={(e) => setForm((f) => ({ ...f, deviceId: e.target.value }))}
              help="Neobavezno"
            />
            <Input
              label="IP adresa"
              value={form.ipAddress}
              onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))}
              placeholder="192.168.1.20"
            />
          </div>
        </div>
      </Modal>
    </Card>
  );
}
