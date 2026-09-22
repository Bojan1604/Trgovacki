import { accessibleStoreIds, requirePermission } from '@/lib/auth';
import { resolveRange } from '@/lib/ranges';
import { taxRecap } from '@/lib/services/analytics';
import { db } from '@/lib/db';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { ReportShell } from '@/components/reports/report-shell';

export const metadata = { title: 'Rekapitulacija PDV-a' };
export const dynamic = 'force-dynamic';

export default async function TaxReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('report.finance');
  const preset = params.range ?? 'month';
  const range = resolveRange(preset);
  const allStores = await accessibleStoreIds(user);
  const scopeAll = params.scope === 'all' || !user.activeStoreId;
  const storeIds = scopeAll ? allStores : [user.activeStoreId!];
  const scope = { tenantId: user.tenantId, storeIds };

  const [recap, byStore, company] = await Promise.all([
    taxRecap(scope, range),
    db.$queryRaw<{ name: string; rate: string; base: string; amount: string }[]>`
      SELECT st."name", stl."taxRate"::text AS rate,
             SUM(stl."baseAmount")::text AS base,
             SUM(stl."taxAmount")::text AS amount
      FROM sale_tax_lines stl
      JOIN sales s ON s."id" = stl."saleId"
      JOIN stores st ON st."id" = s."storeId"
      WHERE s."tenantId" = ${user.tenantId}
        AND s."storeId" = ANY(${storeIds}::text[])
        AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
        AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
      GROUP BY st."name", stl."taxRate"
      ORDER BY st."name", stl."taxRate" DESC
    `,
    db.company.findFirst({ where: { tenantId: user.tenantId, isDefault: true } }),
  ]);

  const totalBase = recap.reduce((acc, r) => acc + r.base, 0);
  const totalTax = recap.reduce((acc, r) => acc + r.amount, 0);

  return (
    <ReportShell
      title="Rekapitulacija PDV-a"
      subtitle={`${formatDate(range.from)} – ${formatDate(range.to)}${company ? ` · ${company.legalName}, OIB ${company.vatId}` : ''}`}
      range={preset}
      scope={scopeAll ? 'all' : 'store'}
    >
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <StatTile label="Osnovica" value={formatAmount(totalBase, 0)} unit="€" />
        <StatTile label="Obračunati PDV" value={formatAmount(totalTax, 0)} unit="€" />
        <StatTile label="Ukupno s PDV-om" value={formatAmount(totalBase + totalTax, 0)} unit="€" />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1fr_1.2fr]">
        <Card padded={false}>
          <div className="p-3.5 pb-2">
            <CardHeader compact title="Po poreznim stopama" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH width={90}>Stopa</TH>
                <TH numeric>Osnovica</TH>
                <TH numeric width={130}>PDV</TH>
                <TH numeric width={130}>Ukupno</TH>
              </TR>
            </THead>
            <TBody>
              {recap.map((row) => (
                <TR key={row.rate}>
                  <TD className="font-medium">{formatPercent(row.rate, 0)}</TD>
                  <TD numeric>{formatAmount(row.base)}</TD>
                  <TD numeric>{formatAmount(row.amount)}</TD>
                  <TD numeric className="font-medium">{formatAmount(row.base + row.amount)}</TD>
                </TR>
              ))}
            </TBody>
            <TFootRow>
              <TD>Ukupno</TD>
              <TD numeric>{formatAmount(totalBase)}</TD>
              <TD numeric>{formatAmount(totalTax)}</TD>
              <TD numeric>{formatAmount(totalBase + totalTax)}</TD>
            </TFootRow>
          </Table>
        </Card>

        <Card padded={false}>
          <div className="p-3.5 pb-2">
            <CardHeader compact title="Po poslovnicama i stopama" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Poslovnica</TH>
                <TH width={80}>Stopa</TH>
                <TH numeric width={130}>Osnovica</TH>
                <TH numeric width={120}>PDV</TH>
              </TR>
            </THead>
            <TBody>
              {byStore.map((row, index) => (
                <TR key={`${row.name}-${row.rate}-${index}`}>
                  <TD className="truncate">{row.name}</TD>
                  <TD>{formatPercent(Number(row.rate), 0)}</TD>
                  <TD numeric>{formatAmount(Number(row.base))}</TD>
                  <TD numeric>{formatAmount(Number(row.amount))}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>

      <p className="mt-3 px-1 text-2xs text-ink-4">
        Izvještaj obuhvaća dovršene račune i odobrenja u odabranom razdoblju. Iznosi su u eurima.
        Za predaju PDV obrasca koristi se izvoz podataka i knjigovodstvena kontrola.
      </p>
    </ReportShell>
  );
}
