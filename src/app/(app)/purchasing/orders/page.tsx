import Link from 'next/link';
import { Plus, ShoppingCart } from 'lucide-react';
import { accessibleStoreIds, requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate } from '@/lib/format';
import { PO_STATUS } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { FilterBar } from '@/components/filters/filter-bar';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Narudžbenice' };
export const dynamic = 'force-dynamic';

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('po.view');
  const storeIds = await accessibleStoreIds(user);

  const [orders, suppliers] = await Promise.all([
    db.purchaseOrder.findMany({
      where: {
        tenantId: user.tenantId,
        storeId: { in: storeIds },
        ...(params.status ? { status: params.status as never } : {}),
        ...(params.supplier ? { supplierId: params.supplier } : {}),
        ...(params.q ? { number: { contains: params.q, mode: 'insensitive' } } : {}),
      },
      include: {
        supplier: { select: { name: true } },
        store: { select: { name: true } },
        _count: { select: { lines: true, receipts: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.supplier.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const openOrders = orders.filter((o) => ['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(o.status));
  const openValue = openOrders.reduce((acc, o) => acc + toNumber(o.total), 0);
  const drafts = orders.filter((o) => o.status === 'DRAFT').length;

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Narudžbenice"
        subtitle="Narudžbe prema dobavljačima i praćenje zaprimanja"
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Nova narudžbenica</Button>}
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Otvorene narudžbe" value={String(openOrders.length)} hint="poslano ili djelomično zaprimljeno" />
        <StatTile label="Vrijednost otvorenih" value={formatAmount(openValue, 0)} unit="€" />
        <StatTile label="U pripremi" value={String(drafts)} />
        <StatTile label="Ukupno dokumenata" value={String(orders.length)} />
      </div>

      <FilterBar
        searchPlaceholder="Broj narudžbenice…"
        searchValue={params.q}
        activeCount={['q', 'status', 'supplier'].filter((k) => params[k]).length}
        selects={[
          { param: 'status', placeholder: 'Svi statusi', value: params.status, width: 200, options: Object.entries(PO_STATUS).map(([value, v]) => ({ value, label: v.label })) },
          { param: 'supplier', placeholder: 'Svi dobavljači', value: params.supplier, width: 200, options: suppliers.map((s) => ({ value: s.id, label: s.name })) },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={150}>Broj</TH>
              <TH>Dobavljač</TH>
              <TH width={150}>Poslovnica</TH>
              <TH numeric width={70}>Stavki</TH>
              <TH numeric width={110}>Iznos</TH>
              <TH width={110}>Naručeno</TH>
              <TH width={110}>Očekivano</TH>
              <TH numeric width={70}>Primki</TH>
              <TH width={200}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {orders.map((order) => (
              <TR key={order.id}>
                <TD>
                  <Link href={`/purchasing/orders/${order.id}`} className="font-mono text-sm text-accent hover:underline">
                    {order.number}
                  </Link>
                </TD>
                <TD className="truncate font-medium">{order.supplier.name}</TD>
                <TD className="truncate text-ink-2">{order.store.name}</TD>
                <TD numeric>{order._count.lines}</TD>
                <TD numeric className="font-medium">{formatAmount(toNumber(order.total))}</TD>
                <TD className="text-sm text-ink-3">{order.orderedAt ? formatDate(order.orderedAt) : '—'}</TD>
                <TD className="text-sm text-ink-3">{order.expectedAt ? formatDate(order.expectedAt) : '—'}</TD>
                <TD numeric>{order._count.receipts}</TD>
                <TD><Badge tone={PO_STATUS[order.status].tone} dot>{PO_STATUS[order.status].label}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {orders.length === 0 && <EmptyState icon={<ShoppingCart className="size-4" />} title="Nema narudžbenica" />}
      </Card>
    </div>
  );
}
