import { accessibleStoreIds, requirePermission } from '@/lib/auth';
import { resolveRange } from '@/lib/ranges';
import { db } from '@/lib/db';
import { formatAmount, formatDate, formatPercent, formatQty } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { BarList } from '@/components/charts/bar-list';
import { ReportShell } from '@/components/reports/report-shell';

export const metadata = { title: 'Marža i RUC' };
export const dynamic = 'force-dynamic';

export default async function MarginReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('report.margin');
  const preset = params.range ?? '30d';
  const range = resolveRange(preset);
  const allStores = await accessibleStoreIds(user);
  const scopeAll = params.scope === 'all' || !user.activeStoreId;
  const storeIds = scopeAll ? allStores : [user.activeStoreId!];

  const rows = await db.$queryRaw<
    { name: string; qty: string; revenue: string; tax: string; cost: string; margin: string }[]
  >`
    SELECT COALESCE(parent."name", c."name", 'Bez kategorije') AS name,
           SUM(sl."quantity")::text AS qty,
           SUM(sl."lineTotal")::text AS revenue,
           SUM(sl."taxAmount")::text AS tax,
           SUM(sl."costTotal")::text AS cost,
           SUM(sl."marginAmount")::text AS margin
    FROM sale_lines sl
    JOIN sales s ON s."id" = sl."saleId"
    JOIN product_variants pv ON pv."id" = sl."variantId"
    JOIN products p ON p."id" = pv."productId"
    LEFT JOIN categories c ON c."id" = p."categoryId"
    LEFT JOIN categories parent ON parent."id" = c."parentId"
    WHERE s."tenantId" = ${user.tenantId}
      AND s."storeId" = ANY(${storeIds}::text[])
      AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
      AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
    GROUP BY COALESCE(parent."name", c."name", 'Bez kategorije')
    ORDER BY SUM(sl."marginAmount") DESC
  `;

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + Number(r.revenue),
      tax: acc.tax + Number(r.tax),
      cost: acc.cost + Number(r.cost),
      margin: acc.margin + Number(r.margin),
      qty: acc.qty + Number(r.qty),
    }),
    { revenue: 0, tax: 0, cost: 0, margin: 0, qty: 0 },
  );

  const netTotal = totals.revenue - totals.tax;

  return (
    <ReportShell
      title="Marža i razlika u cijeni"
      subtitle={`${formatDate(range.from)} – ${formatDate(range.to)} · marža se računa na neto prodajnu cijenu`}
      range={preset}
      scope={scopeAll ? 'all' : 'store'}
    >
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Neto prodaja" value={formatAmount(netTotal, 0)} unit="€" />
        <StatTile label="Nabavna vrijednost" value={formatAmount(totals.cost, 0)} unit="€" />
        <StatTile label="Marža" value={formatAmount(totals.margin, 0)} unit="€" hint={formatPercent(netTotal > 0 ? (totals.margin / netTotal) * 100 : 0)} />
        <StatTile label="RUC na nabavnu" value={formatPercent(totals.cost > 0 ? (totals.margin / totals.cost) * 100 : 0)} />
      </div>

      <Card className="mb-3">
        <CardHeader title="Marža po glavnim kategorijama" subtitle="Doprinos ukupnoj marži" />
        <BarList items={rows.map((r) => ({ label: r.name, value: Number(r.margin) }))} />
      </Card>

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH>Kategorija</TH>
              <TH numeric width={100}>Količina</TH>
              <TH numeric width={130}>Promet</TH>
              <TH numeric width={120}>Neto prodaja</TH>
              <TH numeric width={130}>Nabavna vr.</TH>
              <TH numeric width={130}>Marža</TH>
              <TH numeric width={90}>Marža %</TH>
              <TH numeric width={90}>RUC %</TH>
              <TH numeric width={90}>Udio marže</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => {
              const revenue = Number(row.revenue);
              const net = revenue - Number(row.tax);
              const margin = Number(row.margin);
              const cost = Number(row.cost);
              return (
                <TR key={row.name}>
                  <TD className="font-medium">{row.name}</TD>
                  <TD numeric>{formatQty(Number(row.qty), 0)}</TD>
                  <TD numeric>{formatAmount(revenue)}</TD>
                  <TD numeric className="text-ink-2">{formatAmount(net)}</TD>
                  <TD numeric className="text-ink-3">{formatAmount(cost)}</TD>
                  <TD numeric className="font-medium text-positive">{formatAmount(margin)}</TD>
                  <TD numeric>{formatPercent(net > 0 ? (margin / net) * 100 : 0)}</TD>
                  <TD numeric className="text-ink-2">{formatPercent(cost > 0 ? (margin / cost) * 100 : 0)}</TD>
                  <TD numeric className="text-ink-3">
                    {formatPercent(totals.margin > 0 ? (margin / totals.margin) * 100 : 0)}
                  </TD>
                </TR>
              );
            })}
          </TBody>
          <TFootRow>
            <TD>Ukupno</TD>
            <TD numeric>{formatQty(totals.qty, 0)}</TD>
            <TD numeric>{formatAmount(totals.revenue)}</TD>
            <TD numeric>{formatAmount(netTotal)}</TD>
            <TD numeric>{formatAmount(totals.cost)}</TD>
            <TD numeric>{formatAmount(totals.margin)}</TD>
            <TD numeric>{formatPercent(netTotal > 0 ? (totals.margin / netTotal) * 100 : 0)}</TD>
            <TD colSpan={2} />
          </TFootRow>
        </Table>
      </Card>
    </ReportShell>
  );
}
