import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds } from '@/lib/auth';
import { resolveRange } from '@/lib/ranges';
import { salesByPaymentMethod } from '@/lib/services/analytics';
import { db } from '@/lib/db';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { PAYMENT_TYPE } from '@/lib/labels';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { ShareBar } from '@/components/charts/share-bar';
import { ReportShell } from '@/components/reports/report-shell';
import { toNumber } from '@/lib/money';

export const metadata = { title: 'Načini plaćanja' };
export const dynamic = 'force-dynamic';

export default async function PaymentsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePageAccess('report.finance');
  const preset = params.range ?? '30d';
  const range = resolveRange(preset);
  const allStores = await accessibleStoreIds(user);
  const scopeAll = params.scope === 'all' || !user.activeStoreId;
  const storeIds = scopeAll ? allStores : [user.activeStoreId!];

  const [rows, methods] = await Promise.all([
    salesByPaymentMethod({ tenantId: user.tenantId, storeIds }, range),
    db.paymentMethod.findMany({ where: { tenantId: user.tenantId }, select: { name: true, feePct: true } }),
  ]);

  const feeMap = new Map(methods.map((m) => [m.name, toNumber(m.feePct)]));
  const total = rows.reduce((acc, r) => acc + r.value, 0);
  const totalFee = rows.reduce((acc, r) => acc + (r.value * (feeMap.get(r.label) ?? 0)) / 100, 0);

  return (
    <ReportShell
      title="Načini plaćanja"
      subtitle={`${formatDate(range.from)} – ${formatDate(range.to)} · struktura naplate i troškovi obrade`}
      range={preset}
      scope={scopeAll ? 'all' : 'store'}
    >
      <div className="grid gap-2.5 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader compact title="Struktura naplate" />
          <ShareBar segments={rows.map((r) => ({ label: r.label, value: r.value }))} />
        </Card>

        <Card padded={false}>
          <Table>
            <THead sticky>
              <TR>
                <TH>Način plaćanja</TH>
                <TH width={150}>Vrsta</TH>
                <TH numeric width={110}>Transakcija</TH>
                <TH numeric width={130}>Iznos</TH>
                <TH numeric width={110}>Prosječno</TH>
                <TH numeric width={90}>Naknada %</TH>
                <TH numeric width={110}>Trošak naknade</TH>
                <TH numeric width={90}>Udio</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => {
                const fee = feeMap.get(row.label) ?? 0;
                return (
                  <TR key={row.label}>
                    <TD className="font-medium">{row.label}</TD>
                    <TD className="text-ink-2">{PAYMENT_TYPE[row.type] ?? row.type}</TD>
                    <TD numeric>{row.count.toLocaleString('hr-HR')}</TD>
                    <TD numeric className="font-medium">{formatAmount(row.value)}</TD>
                    <TD numeric className="text-ink-2">{formatAmount(row.count > 0 ? row.value / row.count : 0)}</TD>
                    <TD numeric className="text-ink-3">{fee > 0 ? formatPercent(fee, 2) : '—'}</TD>
                    <TD numeric className={fee > 0 ? 'text-warning' : 'text-ink-4'}>
                      {fee > 0 ? formatAmount((row.value * fee) / 100) : '—'}
                    </TD>
                    <TD numeric className="text-ink-3">
                      {formatPercent(total > 0 ? (row.value / total) * 100 : 0)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
            <TFootRow>
              <TD colSpan={3}>Ukupno</TD>
              <TD numeric>{formatAmount(total)}</TD>
              <TD colSpan={2} />
              <TD numeric>{formatAmount(totalFee)}</TD>
              <TD />
            </TFootRow>
          </Table>
        </Card>
      </div>
    </ReportShell>
  );
}
