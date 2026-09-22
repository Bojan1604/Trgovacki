import Link from 'next/link';
import { Plus, Truck } from 'lucide-react';
import { accessibleStoreIds, requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { DOC_STATUS } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { FilterBar } from '@/components/filters/filter-bar';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Primke i kalkulacije' };
export const dynamic = 'force-dynamic';

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('receipt.view');
  const storeIds = await accessibleStoreIds(user);

  const [receipts, suppliers] = await Promise.all([
    db.goodsReceipt.findMany({
      where: {
        tenantId: user.tenantId,
        storeId: { in: storeIds },
        ...(params.status ? { status: params.status as never } : {}),
        ...(params.supplier ? { supplierId: params.supplier } : {}),
        ...(params.q
          ? { OR: [{ number: { contains: params.q, mode: 'insensitive' } }, { supplierDocNo: { contains: params.q, mode: 'insensitive' } }] }
          : {}),
      },
      include: {
        supplier: { select: { name: true } },
        store: { select: { name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.supplier.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  const posted = receipts.filter((r) => r.status === 'POSTED');
  const goodsValue = posted.reduce((acc, r) => acc + toNumber(r.goodsValue), 0);
  const marginValue = posted.reduce((acc, r) => acc + toNumber(r.marginTotal), 0);
  const retailValue = posted.reduce((acc, r) => acc + toNumber(r.retailValue), 0);

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Primke i kalkulacije"
        subtitle="Ulaz robe s izračunom nabavne cijene, zavisnih troškova i maloprodajne marže"
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Nova primka</Button>}
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Proknjižene primke" value={String(posted.length)} />
        <StatTile label="Nabavna vrijednost" value={formatAmount(goodsValue, 0)} unit="€" />
        <StatTile label="Maloprodajna vrijednost" value={formatAmount(retailValue, 0)} unit="€" />
        <StatTile
          label="Planirana marža"
          value={formatAmount(marginValue, 0)}
          unit="€"
          hint={retailValue > 0 ? `${formatPercent((marginValue / (retailValue / 1.25)) * 100)} na neto` : undefined}
        />
      </div>

      <FilterBar
        searchPlaceholder="Broj primke ili dokument dobavljača…"
        searchValue={params.q}
        activeCount={['q', 'status', 'supplier'].filter((k) => params[k]).length}
        selects={[
          { param: 'status', placeholder: 'Svi statusi', value: params.status, width: 180, options: Object.entries(DOC_STATUS).map(([value, v]) => ({ value, label: v.label })) },
          { param: 'supplier', placeholder: 'Svi dobavljači', value: params.supplier, width: 200, options: suppliers.map((s) => ({ value: s.id, label: s.name })) },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={140}>Broj</TH>
              <TH>Dobavljač</TH>
              <TH width={140}>Poslovnica</TH>
              <TH width={110}>Dok. dobavljača</TH>
              <TH numeric width={60}>Stavki</TH>
              <TH numeric width={110}>Nabavna vr.</TH>
              <TH numeric width={100}>Zav. troškovi</TH>
              <TH numeric width={110}>MP vrijednost</TH>
              <TH numeric width={100}>Marža</TH>
              <TH width={110}>Datum</TH>
              <TH width={130}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {receipts.map((receipt) => {
              const shipping = toNumber(receipt.shippingCost) + toNumber(receipt.customsCost) + toNumber(receipt.otherCost);
              return (
                <TR key={receipt.id}>
                  <TD>
                    <Link href={`/purchasing/receipts/${receipt.id}`} className="font-mono text-sm text-accent hover:underline">
                      {receipt.number}
                    </Link>
                  </TD>
                  <TD className="truncate font-medium">{receipt.supplier.name}</TD>
                  <TD className="truncate text-ink-2">{receipt.store.name}</TD>
                  <TD className="font-mono text-xs text-ink-4">{receipt.supplierDocNo ?? '—'}</TD>
                  <TD numeric>{receipt._count.lines}</TD>
                  <TD numeric>{formatAmount(toNumber(receipt.goodsValue))}</TD>
                  <TD numeric className="text-ink-3">{shipping > 0 ? formatAmount(shipping) : '—'}</TD>
                  <TD numeric>{formatAmount(toNumber(receipt.retailValue))}</TD>
                  <TD numeric className="text-positive">{formatAmount(toNumber(receipt.marginTotal))}</TD>
                  <TD className="text-sm text-ink-3">{formatDate(receipt.supplierDocDate ?? receipt.createdAt)}</TD>
                  <TD><Badge tone={DOC_STATUS[receipt.status].tone} dot>{DOC_STATUS[receipt.status].label}</Badge></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {receipts.length === 0 && <EmptyState icon={<Truck className="size-4" />} title="Nema primki" />}
      </Card>
    </div>
  );
}
