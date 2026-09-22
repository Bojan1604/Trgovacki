import { accessibleStoreIds, requirePermission } from '@/lib/auth';
import { resolveRange } from '@/lib/ranges';
import { salesByHour } from '@/lib/services/analytics';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { BarList } from '@/components/charts/bar-list';
import { ReportShell } from '@/components/reports/report-shell';

export const metadata = { title: 'Promet po satima' };
export const dynamic = 'force-dynamic';

export default async function HourlyReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('report.sales');
  const preset = params.range ?? '30d';
  const range = resolveRange(preset);
  const allStores = await accessibleStoreIds(user);
  const scopeAll = params.scope === 'all' || !user.activeStoreId;
  const storeIds = scopeAll ? allStores : [user.activeStoreId!];

  const rows = await salesByHour({ tenantId: user.tenantId, storeIds }, range);
  const total = rows.reduce((acc, r) => acc + r.gross, 0);
  const totalCount = rows.reduce((acc, r) => acc + r.count, 0);
  const peak = rows.reduce((best, r) => (r.gross > best.gross ? r : best), rows[0] ?? { hour: 0, gross: 0, count: 0 });

  return (
    <ReportShell
      title="Promet po satima"
      subtitle={`${formatDate(range.from)} – ${formatDate(range.to)} · najprometniji sat: ${String(peak.hour).padStart(2, '0')}:00`}
      range={preset}
      scope={scopeAll ? 'all' : 'store'}
    >
      <Card className="mb-3">
        <CardHeader title="Raspodjela prometa kroz dan" subtitle="Zbroj za cijelo razdoblje" />
        <BarList
          items={rows.map((r) => ({
            label: `${String(r.hour).padStart(2, '0')}:00`,
            value: r.gross,
            meta: `${r.count}`,
          }))}
        />
      </Card>

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={100}>Sat</TH>
              <TH numeric width={120}>Računa</TH>
              <TH numeric width={140}>Promet</TH>
              <TH numeric width={140}>Prosječna košarica</TH>
              <TH numeric>Udio u danu</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.hour}>
                <TD className="font-medium">
                  {String(row.hour).padStart(2, '0')}:00 – {String(row.hour + 1).padStart(2, '0')}:00
                </TD>
                <TD numeric>{row.count.toLocaleString('hr-HR')}</TD>
                <TD numeric className="font-medium">{formatAmount(row.gross)}</TD>
                <TD numeric>{formatAmount(row.count > 0 ? row.gross / row.count : 0)}</TD>
                <TD numeric className="text-ink-3">
                  {formatPercent(total > 0 ? (row.gross / total) * 100 : 0)}
                </TD>
              </TR>
            ))}
          </TBody>
          <TFootRow>
            <TD>Ukupno</TD>
            <TD numeric>{totalCount.toLocaleString('hr-HR')}</TD>
            <TD numeric>{formatAmount(total)}</TD>
            <TD numeric>{formatAmount(totalCount > 0 ? total / totalCount : 0)}</TD>
            <TD />
          </TFootRow>
        </Table>
      </Card>
    </ReportShell>
  );
}
