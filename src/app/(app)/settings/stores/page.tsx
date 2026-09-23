import Link from 'next/link';
import { Plus, Store as StoreIcon } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { STORE_TYPE } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export const metadata = { title: 'Poslovnice' };
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

export default async function StoresSettingsPage() {
  const user = await requirePageAccess('store.manage');

  const stores = await db.store.findMany({
    where: { tenantId: user.tenantId },
    include: {
      company: { select: { name: true } },
      priceList: { select: { name: true } },
      _count: { select: { registers: true, warehouses: true, userAccess: true } },
    },
    orderBy: { code: 'asc' },
  });

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Poslovnice"
        subtitle={`${stores.length} lokacija · oznaka poslovnog prostora koristi se u fiskalizaciji`}
        actions={
          <Link href="/settings/stores/new">
            <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Nova poslovnica</Button>
          </Link>
        }
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={60}>Oznaka</TH>
              <TH>Naziv</TH>
              <TH width={120}>Vrsta</TH>
              <TH width={150}>Adresa</TH>
              <TH width={110}>Grad</TH>
              <TH width={110}>Regija</TH>
              <TH width={140}>Cjenik</TH>
              <TH numeric width={70}>Blagajni</TH>
              <TH numeric width={80}>Skladišta</TH>
              <TH numeric width={80}>Djelatnika</TH>
              <TH width={90}>Fiskal.</TH>
              <TH width={110}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {stores.map((store) => (
              <TR key={store.id}>
                <TD className="font-mono text-sm font-medium">
                  <Link href={`/settings/stores/${store.id}`} className="text-accent hover:underline">
                    {store.code}
                  </Link>
                </TD>
                <TD>
                  <Link href={`/settings/stores/${store.id}`} className="font-medium hover:underline">
                    {store.name}
                  </Link>
                  <span className="ml-1.5 text-2xs text-ink-4">{store.company.name}</span>
                </TD>
                <TD className="text-ink-2">{STORE_TYPE[store.type]}</TD>
                <TD className="truncate text-ink-2">{store.addressLine ?? '—'}</TD>
                <TD className="text-ink-2">{store.city ?? '—'}</TD>
                <TD className="text-ink-2">{store.region ?? '—'}</TD>
                <TD className="truncate text-ink-2">{store.priceList?.name ?? '—'}</TD>
                <TD numeric>{store._count.registers}</TD>
                <TD numeric>{store._count.warehouses}</TD>
                <TD numeric>{store._count.userAccess}</TD>
                <TD>
                  <Badge tone={store.fiscalEnabled ? 'positive' : 'neutral'}>
                    {store.fiscalEnabled ? 'Da' : 'Ne'}
                  </Badge>
                </TD>
                <TD>
                  <Badge tone={STATUS_TONE[store.status]} dot>{STATUS_LABEL[store.status]}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {stores.length === 0 && <EmptyState icon={<StoreIcon className="size-4" />} title="Nema poslovnica" />}
      </Card>

      <p className="mt-2 px-1 text-2xs text-ink-4">
        Otvaranje nove poslovnice odmah kreira prodajno skladište i zadane blagajne.
        Klikom na poslovnicu otvarate njezine blagajne i skladišta.
        Prva poslovnica otvorena je {formatDate(stores[0]?.openedAt)}.
        <Link href="/settings/integrations" className="ml-1 text-accent hover:underline">
          Postavke fiskalizacije
        </Link>
      </p>
    </div>
  );
}
