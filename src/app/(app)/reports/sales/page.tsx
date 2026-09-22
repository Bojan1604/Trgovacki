import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds } from '@/lib/auth';
import { deltaPct, previousRange, resolveRange, salesByDay, salesTotals } from '@/lib/services/analytics';
import { formatAmount, formatDate, formatPercent, formatQty } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { TrendArea } from '@/components/charts/trend-area';
import { ReportShell } from '@/components/reports/report-shell';

export const metadata = { title: 'Promet po danima' };
export const dynamic = 'force-dynamic';

export default async function SalesReportPage({
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
  const scope = { tenantId: user.tenantId, storeIds };

  const [totals, prev, byDay] = await Promise.all([
    salesTotals(scope, range),
    salesTotals(scope, previousRange(range)),
    salesByDay(scope, range),
  ]);

  return (
    <ReportShell
      title="Promet po danima"
      subtitle={`${formatDate(range.from)} – ${formatDate(range.to)} · ${scopeAll ? 'cijeli lanac' : 'odabrana poslovnica'}`}
      range={preset}
      scope={scopeAll ? 'all' : 'store'}
    >
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <StatTile label="Promet" value={formatAmount(totals.gross, 0)} unit="€" deltaPct={deltaPct(totals.gross, prev.gross)} />
        <StatTile label="Neto promet" value={formatAmount(totals.net, 0)} unit="€" deltaPct={deltaPct(totals.net, prev.net)} />
        <StatTile label="Marža" value={formatAmount(totals.margin, 0)} unit="€" deltaLabel={formatPercent(totals.marginPct)} />
        <StatTile label="Računa" value={totals.salesCount.toLocaleString('hr-HR')} deltaPct={deltaPct(totals.salesCount, prev.salesCount)} />
        <StatTile label="Prosječna košarica" value={formatAmount(totals.avgBasket)} unit="€" deltaPct={deltaPct(totals.avgBasket, prev.avgBasket)} />
      </div>

      <Card className="mb-3">
        <CardHeader title="Kretanje dnevnog prometa" subtitle="Iznosi s PDV-om" />
        <TrendArea data={byDay} height={200} />
      </Card>

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={130}>Datum</TH>
              <TH numeric width={100}>Računa</TH>
              <TH numeric width={130}>Promet</TH>
              <TH numeric width={130}>Marža</TH>
              <TH numeric width={130}>Prosječna košarica</TH>
              <TH numeric>Udio u razdoblju</TH>
            </TR>
          </THead>
          <TBody>
            {byDay.map((day) => (
              <TR key={day.date}>
                <TD>{formatDate(day.date)}</TD>
                <TD numeric>{day.count}</TD>
                <TD numeric className="font-medium">{formatAmount(day.value)}</TD>
                <TD numeric className="text-positive">{formatAmount(day.secondaryValue)}</TD>
                <TD numeric>{formatAmount(day.count > 0 ? day.value / day.count : 0)}</TD>
                <TD numeric className="text-ink-3">
                  {formatPercent(totals.gross > 0 ? (day.value / totals.gross) * 100 : 0)}
                </TD>
              </TR>
            ))}
          </TBody>
          <TFootRow>
            <TD>Ukupno · {byDay.length} dana</TD>
            <TD numeric>{totals.salesCount}</TD>
            <TD numeric>{formatAmount(totals.gross)}</TD>
            <TD numeric>{formatAmount(totals.margin)}</TD>
            <TD numeric>{formatAmount(totals.avgBasket)}</TD>
            <TD numeric>{formatQty(100, 0)} %</TD>
          </TFootRow>
        </Table>
      </Card>
    </ReportShell>
  );
}
