import Link from 'next/link';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export const metadata = { title: 'Cjenici' };
export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  RETAIL: 'Maloprodaja',
  WHOLESALE: 'Veleprodaja',
  CUSTOMER_GROUP: 'Grupa kupaca',
  CONTRACT: 'Ugovorni',
  CAMPAIGN: 'Kampanja',
};

export default async function PriceListsPage() {
  const user = await requirePermission('price.view');

  const priceLists = await db.priceList.findMany({
    where: { tenantId: user.tenantId },
    include: {
      _count: { select: { items: true, stores: true, customerGroups: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { priority: 'desc' }],
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Cjenici"
        subtitle="Hijerarhija cijena: cjenik grupe kupaca → cjenik poslovnice → zadani cjenik"
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Novi cjenik</Button>}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={90}>Šifra</TH>
              <TH>Naziv</TH>
              <TH width={140}>Vrsta</TH>
              <TH width={100}>Cijene</TH>
              <TH numeric width={90}>Prioritet</TH>
              <TH numeric width={90}>Artikala</TH>
              <TH numeric width={100}>Poslovnica</TH>
              <TH width={110}>Vrijedi od</TH>
              <TH width={110}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {priceLists.map((list) => (
              <TR key={list.id}>
                <TD className="font-mono text-sm text-ink-3">{list.code}</TD>
                <TD>
                  <Link href={`/pricing/price-lists/${list.id}`} className="font-medium hover:text-accent hover:underline">
                    {list.name}
                  </Link>
                  {list.isDefault && <Badge tone="accent" className="ml-1.5">zadani</Badge>}
                </TD>
                <TD className="text-ink-2">{TYPE_LABEL[list.type] ?? list.type}</TD>
                <TD className="text-sm text-ink-3">{list.pricesIncludeTax ? 's PDV-om' : 'bez PDV-a'}</TD>
                <TD numeric>{list.priority}</TD>
                <TD numeric>{list._count.items.toLocaleString('hr-HR')}</TD>
                <TD numeric>{list._count.stores}</TD>
                <TD className="text-sm text-ink-3">{formatDate(list.validFrom)}</TD>
                <TD>
                  <Badge tone={list.isActive ? 'positive' : 'neutral'}>{list.isActive ? 'Aktivan' : 'Neaktivan'}</Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {priceLists.length === 0 && <EmptyState icon={<FileSpreadsheet className="size-4" />} title="Nema cjenika" />}
      </Card>
    </div>
  );
}
