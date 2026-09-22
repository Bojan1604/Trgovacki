import Link from 'next/link';
import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds } from '@/lib/auth';
import { resolveRange } from '@/lib/ranges';
import { db } from '@/lib/db';
import { formatAmount, formatDate, formatPercent, formatQty } from '@/lib/format';
import { Card, EmptyState } from '@/components/ui/primitives';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { ReportShell } from '@/components/reports/report-shell';
import { FilterBar } from '@/components/filters/filter-bar';

export const metadata = { title: 'Prodaja po artiklima' };
export const dynamic = 'force-dynamic';

export default async function ProductsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePageAccess('report.sales');
  const preset = params.range ?? '30d';
  const range = resolveRange(preset);
  const allStores = await accessibleStoreIds(user);
  const scopeAll = params.scope === 'all' || !user.activeStoreId;
  const storeIds = scopeAll ? allStores : [user.activeStoreId!];

  const categories = await db.category.findMany({
    where: { tenantId: user.tenantId },
    select: { id: true, name: true, level: true },
    orderBy: { path: 'asc' },
  });

  const rows = await db.$queryRaw<
    {
      productId: string; sku: string; name: string; categoryName: string | null;
      qty: string; revenue: string; cost: string; margin: string; receipts: string;
    }[]
  >`
    SELECT p."id" AS "productId", sl."sku", sl."name", c."name" AS "categoryName",
           SUM(sl."quantity")::text AS qty,
           SUM(sl."lineTotal")::text AS revenue,
           SUM(sl."costTotal")::text AS cost,
           SUM(sl."marginAmount")::text AS margin,
           COUNT(DISTINCT sl."saleId")::text AS receipts
    FROM sale_lines sl
    JOIN sales s ON s."id" = sl."saleId"
    JOIN product_variants pv ON pv."id" = sl."variantId"
    JOIN products p ON p."id" = pv."productId"
    LEFT JOIN categories c ON c."id" = p."categoryId"
    WHERE s."tenantId" = ${user.tenantId}
      AND s."storeId" = ANY(${storeIds}::text[])
      AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
      AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
      AND (${params.category ?? null}::text IS NULL OR p."categoryId" = ${params.category ?? null})
      AND (${params.q ? `%${params.q}%` : null}::text IS NULL
           OR sl."name" ILIKE ${params.q ? `%${params.q}%` : null}
           OR sl."sku" ILIKE ${params.q ? `%${params.q}%` : null})
    GROUP BY p."id", sl."sku", sl."name", c."name"
    ORDER BY SUM(sl."lineTotal") DESC
    LIMIT 300
  `;

  const totals = rows.reduce(
    (acc, r) => ({
      qty: acc.qty + Number(r.qty),
      revenue: acc.revenue + Number(r.revenue),
      cost: acc.cost + Number(r.cost),
      margin: acc.margin + Number(r.margin),
    }),
    { qty: 0, revenue: 0, cost: 0, margin: 0 },
  );

  return (
    <ReportShell
      title="Prodaja po artiklima"
      subtitle={`${formatDate(range.from)} – ${formatDate(range.to)} · ${rows.length} artikala s prometom`}
      range={preset}
      scope={scopeAll ? 'all' : 'store'}
    >
      <FilterBar
        searchPlaceholder="Naziv ili šifra artikla…"
        searchValue={params.q}
        activeCount={['q', 'category'].filter((k) => params[k]).length}
        selects={[
          {
            param: 'category',
            placeholder: 'Sve kategorije',
            value: params.category,
            width: 190,
            options: categories.map((c) => ({ value: c.id, label: `${'  '.repeat(c.level)}${c.name}` })),
          },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={36}>#</TH>
              <TH width={80}>Šifra</TH>
              <TH>Naziv</TH>
              <TH width={150}>Kategorija</TH>
              <TH numeric width={90}>Računa</TH>
              <TH numeric width={90}>Količina</TH>
              <TH numeric width={120}>Promet</TH>
              <TH numeric width={120}>Nabavna vr.</TH>
              <TH numeric width={120}>Marža</TH>
              <TH numeric width={80}>Marža %</TH>
              <TH numeric width={80}>Udio</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row, index) => {
              const revenue = Number(row.revenue);
              const margin = Number(row.margin);
              const net = revenue - (revenue - margin - Number(row.cost));
              return (
                <TR key={row.productId}>
                  <TD className="text-ink-4">{index + 1}</TD>
                  <TD className="font-mono text-sm text-ink-3">{row.sku}</TD>
                  <TD className="truncate">
                    <Link href={`/catalog/products/${row.productId}`} className="hover:text-accent hover:underline">
                      {row.name}
                    </Link>
                  </TD>
                  <TD className="truncate text-ink-2">{row.categoryName ?? '—'}</TD>
                  <TD numeric className="text-ink-3">{row.receipts}</TD>
                  <TD numeric>{formatQty(Number(row.qty), 1)}</TD>
                  <TD numeric className="font-medium">{formatAmount(revenue)}</TD>
                  <TD numeric className="text-ink-3">{formatAmount(Number(row.cost))}</TD>
                  <TD numeric className="text-positive">{formatAmount(margin)}</TD>
                  <TD numeric>{formatPercent(net > 0 ? (margin / net) * 100 : 0, 0)}</TD>
                  <TD numeric className="text-ink-3">
                    {formatPercent(totals.revenue > 0 ? (revenue / totals.revenue) * 100 : 0)}
                  </TD>
                </TR>
              );
            })}
          </TBody>
          <TFootRow>
            <TD colSpan={5}>Ukupno {rows.length} artikala</TD>
            <TD numeric>{formatQty(totals.qty, 0)}</TD>
            <TD numeric>{formatAmount(totals.revenue)}</TD>
            <TD numeric>{formatAmount(totals.cost)}</TD>
            <TD numeric>{formatAmount(totals.margin)}</TD>
            <TD colSpan={2} />
          </TFootRow>
        </Table>
        {rows.length === 0 && <EmptyState title="Nema prodaje u razdoblju" />}
      </Card>
    </ReportShell>
  );
}
