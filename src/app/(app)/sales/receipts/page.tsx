import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { Prisma } from '@prisma/client';
import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds, resolveStoreScope } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDateTime } from '@/lib/format';
import { FISCAL_STATUS, SALE_STATUS } from '@/lib/labels';
import { resolveRange } from '@/lib/ranges';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ExportButton } from '@/components/ui/export-button';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/navigation';
import { FilterBar } from '@/components/filters/filter-bar';
import { RangePicker } from '@/components/filters/range-picker';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Računi' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

export default async function SalesReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePageAccess('sale.view');
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const preset = params.range ?? '30d';
  const range = resolveRange(preset);
  const allStores = await accessibleStoreIds(user);
  const { storeIds, storeId: selectedStoreId } = await resolveStoreScope(user, params.store);

  const where: Prisma.SaleWhereInput = {
    tenantId: user.tenantId,
    storeId: { in: storeIds },
    issuedAt: { gte: range.from, lte: range.to },
    ...(params.q ? { number: { contains: params.q, mode: 'insensitive' } } : {}),
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.fiscal ? { fiscalStatus: params.fiscal as never } : {}),
    ...(params.user ? { userId: params.user } : {}),
  };

  const [total, sales, aggregate, stores, cashiers] = await Promise.all([
    db.sale.count({ where }),
    db.sale.findMany({
      where,
      include: {
        store: { select: { name: true } },
        register: { select: { code: true } },
        user: { select: { firstName: true, lastName: true } },
        customer: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        _count: { select: { lines: true } },
        payments: { include: { paymentMethod: { select: { name: true, type: true } } } },
      },
      orderBy: { issuedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.sale.aggregate({ where, _sum: { total: true, discountTotal: true, taxTotal: true, marginTotal: true } }),
    db.store.findMany({ where: { id: { in: allStores } }, select: { id: true, name: true }, orderBy: { code: 'asc' } }),
    db.user.findMany({
      where: { tenantId: user.tenantId, status: 'ACTIVE' },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
  ]);

  const pageTotal = sales.reduce((acc, s) => acc + toNumber(s.total), 0);

  return (
    <div className="mx-auto max-w-[1540px]">
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold leading-tight">Računi</h1>
          <p className="mt-0.5 text-sm text-ink-3">{total.toLocaleString('hr-HR')} dokumenata u razdoblju</p>
        </div>
        <div className="flex items-center gap-2">
          <RangePicker current={preset} showScope={false} />
          <ExportButton filename="racuni" />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Ukupan promet" value={formatAmount(toNumber(aggregate._sum.total), 0)} unit="€" />
        <StatTile label="PDV" value={formatAmount(toNumber(aggregate._sum.taxTotal), 0)} unit="€" />
        <StatTile label="Popusti" value={formatAmount(toNumber(aggregate._sum.discountTotal), 0)} unit="€" />
        <StatTile label="Marža" value={formatAmount(toNumber(aggregate._sum.marginTotal), 0)} unit="€" />
      </div>

      <FilterBar
        searchPlaceholder="Broj računa…"
        searchValue={params.q}
        activeCount={['q', 'store', 'status', 'fiscal', 'user'].filter((k) => params[k]).length}
        selects={[
          { param: 'store', placeholder: 'Sve poslovnice', value: selectedStoreId ?? '', width: 170, options: stores.map((s) => ({ value: s.id, label: s.name })) },
          { param: 'status', placeholder: 'Svi statusi', value: params.status, width: 170, options: Object.entries(SALE_STATUS).map(([value, v]) => ({ value, label: v.label })) },
          { param: 'fiscal', placeholder: 'Fiskalizacija', value: params.fiscal, width: 160, options: Object.entries(FISCAL_STATUS).map(([value, v]) => ({ value, label: v.label })) },
          { param: 'user', placeholder: 'Svi prodavači', value: params.user, width: 170, options: cashiers.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` })) },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={110}>Broj</TH>
              <TH width={140}>Datum i vrijeme</TH>
              <TH width={140}>Poslovnica</TH>
              <TH width={130}>Prodavač</TH>
              <TH>Kupac</TH>
              <TH width={110}>Plaćanje</TH>
              <TH numeric width={56}>Stavki</TH>
              <TH numeric width={90}>Popust</TH>
              <TH numeric width={90}>PDV</TH>
              <TH numeric width={100}>Ukupno</TH>
              <TH width={120}>Fiskalizacija</TH>
              <TH width={110}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {sales.map((sale) => {
              const customerName =
                sale.customer?.companyName ||
                `${sale.customer?.firstName ?? ''} ${sale.customer?.lastName ?? ''}`.trim();
              const payment = sale.payments[0]?.paymentMethod.name ?? '—';
              return (
                <TR key={sale.id}>
                  <TD>
                    <Link href={`/sales/receipts/${sale.id}`} className="font-mono text-sm text-accent hover:underline">
                      {sale.number}
                    </Link>
                  </TD>
                  <TD className="text-sm text-ink-3">{formatDateTime(sale.issuedAt)}</TD>
                  <TD className="truncate text-ink-2">{sale.store.name}</TD>
                  <TD className="truncate text-ink-2">
                    {sale.user ? `${sale.user.firstName} ${sale.user.lastName}` : '—'}
                  </TD>
                  <TD className="truncate">
                    {sale.customer ? (
                      <Link href={`/customers/${sale.customer.id}`} className="hover:text-accent">{customerName}</Link>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </TD>
                  <TD className="text-sm text-ink-2">{payment}{sale.payments.length > 1 ? ` +${sale.payments.length - 1}` : ''}</TD>
                  <TD numeric className="text-ink-3">{sale._count.lines}</TD>
                  <TD numeric className="text-ink-3">
                    {toNumber(sale.discountTotal) > 0 ? formatAmount(toNumber(sale.discountTotal)) : '—'}
                  </TD>
                  <TD numeric className="text-ink-3">{formatAmount(toNumber(sale.taxTotal))}</TD>
                  <TD numeric className="font-medium">{formatAmount(toNumber(sale.total))}</TD>
                  <TD><Badge tone={FISCAL_STATUS[sale.fiscalStatus].tone} dot>{FISCAL_STATUS[sale.fiscalStatus].label}</Badge></TD>
                  <TD><Badge tone={SALE_STATUS[sale.status].tone}>{SALE_STATUS[sale.status].label}</Badge></TD>
                </TR>
              );
            })}
          </TBody>
          <TFootRow>
            <TD colSpan={9}>Zbroj prikazane stranice</TD>
            <TD numeric>{formatAmount(pageTotal)}</TD>
            <TD colSpan={2} />
          </TFootRow>
        </Table>
        {sales.length === 0 && <EmptyState icon={<Receipt className="size-4" />} title="Nema računa u razdoblju" />}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
      </Card>
    </div>
  );
}
