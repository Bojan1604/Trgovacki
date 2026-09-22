import Link from 'next/link';
import { accessibleStoreIds, requirePermission } from '@/lib/auth';
import { resolveRange, previousRange, deltaPct } from '@/lib/ranges';
import { salesByStore } from '@/lib/services/analytics';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { BarList } from '@/components/charts/bar-list';
import { ReportShell } from '@/components/reports/report-shell';

export const metadata = { title: 'Usporedba poslovnica' };
export const dynamic = 'force-dynamic';

export default async function StoresReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('report.sales');
  const preset = params.range ?? '30d';
  const range = resolveRange(preset);
  const storeIds = await accessibleStoreIds(user);
  const scope = { tenantId: user.tenantId, storeIds };

  const [current, previous] = await Promise.all([
    salesByStore(scope, range),
    salesByStore(scope, previousRange(range)),
  ]);

  const prevMap = new Map(previous.map((s) => [s.storeId, s]));
  const totals = current.reduce(
    (acc, s) => ({ gross: acc.gross + s.gross, margin: acc.margin + s.margin, count: acc.count + s.count }),
    { gross: 0, margin: 0, count: 0 },
  );

  return (
    <ReportShell
      title="Usporedba poslovnica"
      subtitle={`${formatDate(range.from)} – ${formatDate(range.to)} · ${current.length} lokacija`}
      range={preset}
      showScope={false}
    >
      <Card className="mb-3">
        <CardHeader title="Promet po poslovnicama" subtitle="Iznosi s PDV-om" />
        <BarList
          items={current.map((s) => ({ label: s.name, value: s.gross, meta: `${s.count}` }))}
        />
      </Card>

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={50}>Šifra</TH>
              <TH>Poslovnica</TH>
              <TH numeric width={90}>Računa</TH>
              <TH numeric width={130}>Promet</TH>
              <TH numeric width={110}>Promjena</TH>
              <TH numeric width={130}>Marža</TH>
              <TH numeric width={90}>Marža %</TH>
              <TH numeric width={130}>Prosječna košarica</TH>
              <TH numeric width={90}>Udio</TH>
            </TR>
          </THead>
          <TBody>
            {current.map((store) => {
              const prev = prevMap.get(store.storeId);
              const change = deltaPct(store.gross, prev?.gross ?? 0);
              const net = store.gross / 1.25;
              return (
                <TR key={store.storeId}>
                  <TD className="font-mono text-sm text-ink-3">{store.code}</TD>
                  <TD>
                    <Link href={`/sales/receipts?store=${store.storeId}`} className="font-medium hover:text-accent hover:underline">
                      {store.name}
                    </Link>
                  </TD>
                  <TD numeric>{store.count.toLocaleString('hr-HR')}</TD>
                  <TD numeric className="font-medium">{formatAmount(store.gross)}</TD>
                  <TD numeric className={change === null ? 'text-ink-4' : change >= 0 ? 'text-positive' : 'text-negative'}>
                    {change === null ? '—' : `${change > 0 ? '+' : ''}${formatPercent(change)}`}
                  </TD>
                  <TD numeric className="text-positive">{formatAmount(store.margin)}</TD>
                  <TD numeric>{formatPercent(net > 0 ? (store.margin / net) * 100 : 0)}</TD>
                  <TD numeric>{formatAmount(store.count > 0 ? store.gross / store.count : 0)}</TD>
                  <TD numeric className="text-ink-3">
                    {formatPercent(totals.gross > 0 ? (store.gross / totals.gross) * 100 : 0)}
                  </TD>
                </TR>
              );
            })}
          </TBody>
          <TFootRow>
            <TD colSpan={2}>Ukupno lanac</TD>
            <TD numeric>{totals.count.toLocaleString('hr-HR')}</TD>
            <TD numeric>{formatAmount(totals.gross)}</TD>
            <TD />
            <TD numeric>{formatAmount(totals.margin)}</TD>
            <TD colSpan={3} />
          </TFootRow>
        </Table>
      </Card>
    </ReportShell>
  );
}
