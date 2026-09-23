import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { STORE_TYPE } from '@/lib/labels';
import { Badge, Card, CardHeader, DetailRow, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { RegistersPanel } from '@/components/settings/registers-panel';

export const dynamic = 'force-dynamic';

const STATUS_TONE = {
  ACTIVE: 'positive',
  INACTIVE: 'neutral',
  IN_PREPARATION: 'warning',
  CLOSED: 'negative',
} as const;

const STATUS_LABEL = {
  ACTIVE: 'Aktivna',
  INACTIVE: 'Neaktivna',
  IN_PREPARATION: 'U pripremi',
  CLOSED: 'Zatvorena',
} as const;

const WAREHOUSE_TYPE: Record<string, string> = {
  SALES_FLOOR: 'Prodajni prostor',
  BACK_STORE: 'Skladište trgovine',
  CENTRAL: 'Centralno skladište',
  TRANSIT: 'Tranzit',
  QUARANTINE: 'Karantena',
  CONSIGNMENT: 'Konsignacija',
};

export default async function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageAccess('store.manage');

  const store = await db.store.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      company: { select: { name: true, legalName: true } },
      priceList: { select: { name: true } },
      warehouses: { orderBy: { code: 'asc' } },
      registers: {
        orderBy: { code: 'asc' },
        include: { _count: { select: { shifts: { where: { status: 'OPEN' } } } } },
      },
      _count: { select: { userAccess: true } },
    },
  });
  if (!store) notFound();

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title={`${store.code} · ${store.name}`}
        subtitle={`${STORE_TYPE[store.type]} · ${store.company.name}`}
        actions={
          <>
            <Link href="/settings/stores">
              <Button size="sm" variant="ghost" icon={<ArrowLeft className="size-3.5" />}>
                Sve poslovnice
              </Button>
            </Link>
            <Link href={`/settings/stores/${store.id}/edit`}>
              <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />}>
                Izmijeni
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-2.5 grid grid-cols-2 gap-2.5">
        <Card>
          <CardHeader title="Podaci lokacije" compact />
          <DetailRow label="Status">
            <Badge tone={STATUS_TONE[store.status]} dot>{STATUS_LABEL[store.status]}</Badge>
          </DetailRow>
          <DetailRow label="Adresa">{store.addressLine ?? '—'}</DetailRow>
          <DetailRow label="Grad">{[store.postalCode, store.city].filter(Boolean).join(' ') || '—'}</DetailRow>
          <DetailRow label="Regija">{store.region ?? '—'}</DetailRow>
          <DetailRow label="Voditelj">{store.managerName ?? '—'}</DetailRow>
          <DetailRow label="Telefon">{store.phone ?? '—'}</DetailRow>
          <DetailRow label="E-pošta">{store.email ?? '—'}</DetailRow>
        </Card>

        <Card>
          <CardHeader title="Rad poslovnice" compact />
          <DetailRow label="Cjenik">{store.priceList?.name ?? 'Zadani cjenik organizacije'}</DetailRow>
          <DetailRow label="Fiskalizacija">
            <Badge tone={store.fiscalEnabled ? 'positive' : 'neutral'}>
              {store.fiscalEnabled ? 'Uključena' : 'Isključena'}
            </Badge>
          </DetailRow>
          <DetailRow label="Prodaja u minus">{store.allowNegativeStock ? 'Dopuštena' : 'Nije dopuštena'}</DetailRow>
          <DetailRow label="Kvadratura">{store.squareMeters ? `${store.squareMeters} m²` : '—'}</DetailRow>
          <DetailRow label="Djelatnika">{store._count.userAccess}</DetailRow>
          <DetailRow label="Otvorena">{store.openedAt ? formatDate(store.openedAt) : '—'}</DetailRow>
          <DetailRow label="Zatvorena">{store.closedAt ? formatDate(store.closedAt) : '—'}</DetailRow>
        </Card>
      </div>

      <div className="mb-2.5">
        <RegistersPanel
          storeId={store.id}
          registers={store.registers.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            deviceId: r.deviceId,
            ipAddress: r.ipAddress,
            isActive: r.isActive,
            openShifts: r._count.shifts,
          }))}
        />
      </div>

      <Card padded={false}>
        <CardHeader title="Skladišta" subtitle={`${store.warehouses.length} lokacija zalihe`} />
        <Table>
          <THead>
            <TR>
              <TH width={80}>Oznaka</TH>
              <TH>Naziv</TH>
              <TH width={180}>Vrsta</TH>
              <TH width={100}>Zadano</TH>
              <TH width={120}>Prodajno</TH>
            </TR>
          </THead>
          <TBody>
            {store.warehouses.map((warehouse) => (
              <TR key={warehouse.id}>
                <TD className="font-mono text-sm font-medium">{warehouse.code}</TD>
                <TD>{warehouse.name}</TD>
                <TD className="text-ink-2">{WAREHOUSE_TYPE[warehouse.type] ?? warehouse.type}</TD>
                <TD>{warehouse.isDefault ? <Badge tone="accent">Da</Badge> : '—'}</TD>
                <TD>{warehouse.isSellable ? 'Da' : 'Ne'}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
