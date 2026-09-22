import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds } from '@/lib/auth';
import { resolveRange } from '@/lib/ranges';
import { cashierPerformance } from '@/lib/services/analytics';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { BarList } from '@/components/charts/bar-list';
import { ReportShell } from '@/components/reports/report-shell';

export const metadata = { title: 'Učinak prodavača' };
export const dynamic = 'force-dynamic';

export default async function CashiersReportPage({
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

  const rows = await cashierPerformance({ tenantId: user.tenantId, storeIds }, range, 40);
  const totals = rows.reduce(
    (acc, r) => ({ total: acc.total + r.total, count: acc.count + r.count, discount: acc.discount + r.discount }),
    { total: 0, count: 0, discount: 0 },
  );

  return (
    <ReportShell
      title="Učinak prodavača"
      subtitle={`${formatDate(range.from)} – ${formatDate(range.to)} · ${rows.length} prodavača s prometom`}
      range={preset}
      scope={scopeAll ? 'all' : 'store'}
    >
      <Card className="mb-3">
        <CardHeader title="Promet po prodavaču" subtitle="Ukupan naplaćeni iznos" />
        <BarList items={rows.slice(0, 12).map((r) => ({ label: r.name, value: r.total, meta: `${r.count}` }))} />
      </Card>

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={36}>#</TH>
              <TH>Prodavač</TH>
              <TH numeric width={100}>Računa</TH>
              <TH numeric width={130}>Promet</TH>
              <TH numeric width={130}>Prosječna košarica</TH>
              <TH numeric width={120}>Odobreni popusti</TH>
              <TH numeric width={100}>Popust %</TH>
              <TH numeric width={90}>Udio</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row, index) => (
              <TR key={row.userId}>
                <TD className="text-ink-4">{index + 1}</TD>
                <TD className="font-medium">{row.name}</TD>
                <TD numeric>{row.count.toLocaleString('hr-HR')}</TD>
                <TD numeric className="font-medium">{formatAmount(row.total)}</TD>
                <TD numeric>{formatAmount(row.avg)}</TD>
                <TD numeric className="text-warning">{formatAmount(row.discount)}</TD>
                <TD numeric className="text-ink-2">
                  {formatPercent(row.total > 0 ? (row.discount / row.total) * 100 : 0)}
                </TD>
                <TD numeric className="text-ink-3">
                  {formatPercent(totals.total > 0 ? (row.total / totals.total) * 100 : 0)}
                </TD>
              </TR>
            ))}
          </TBody>
          <TFootRow>
            <TD colSpan={2}>Ukupno</TD>
            <TD numeric>{totals.count.toLocaleString('hr-HR')}</TD>
            <TD numeric>{formatAmount(totals.total)}</TD>
            <TD numeric>{formatAmount(totals.count > 0 ? totals.total / totals.count : 0)}</TD>
            <TD numeric>{formatAmount(totals.discount)}</TD>
            <TD colSpan={2} />
          </TFootRow>
        </Table>
      </Card>
      <p className="mt-2 px-1 text-2xs text-ink-4">
        Visok udio popusta uz nisku prosječnu košaricu može upućivati na potrebu dodatne kontrole
        ovlasti za odobravanje popusta.
      </p>
    </ReportShell>
  );
}
