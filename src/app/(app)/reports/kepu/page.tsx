import { accessibleStoreIds, requirePermission } from '@/lib/auth';
import { resolveRange } from '@/lib/ranges';
import { db } from '@/lib/db';
import { formatAmount, formatDate } from '@/lib/format';
import { Card, CardHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { ReportShell } from '@/components/reports/report-shell';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Knjiga popisa (KEPU)' };
export const dynamic = 'force-dynamic';

export default async function KepuReportPage({
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

  const [receipts, sales, writeOffs, company] = await Promise.all([
    db.$queryRaw<{ day: Date; retail: string; count: string }[]>`
      SELECT DATE_TRUNC('day', gr."postedAt") AS day,
             COALESCE(SUM(gr."retailValue"), 0)::text AS retail,
             COUNT(*)::text AS count
      FROM goods_receipts gr
      WHERE gr."tenantId" = ${user.tenantId}
        AND gr."storeId" = ANY(${storeIds}::text[])
        AND gr."status" = 'POSTED'
        AND gr."postedAt" BETWEEN ${range.from} AND ${range.to}
      GROUP BY 1 ORDER BY 1
    `,
    db.$queryRaw<{ day: Date; total: string; count: string }[]>`
      SELECT DATE_TRUNC('day', s."issuedAt") AS day,
             COALESCE(SUM(s."total"), 0)::text AS total,
             COUNT(*)::text AS count
      FROM sales s
      WHERE s."tenantId" = ${user.tenantId}
        AND s."storeId" = ANY(${storeIds}::text[])
        AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
        AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
      GROUP BY 1 ORDER BY 1
    `,
    db.$queryRaw<{ day: Date; total: string }[]>`
      SELECT DATE_TRUNC('day', wo."postedAt") AS day, COALESCE(SUM(wo."totalCost"), 0)::text AS total
      FROM write_offs wo
      WHERE wo."tenantId" = ${user.tenantId}
        AND wo."storeId" = ANY(${storeIds}::text[])
        AND wo."status" = 'POSTED'
        AND wo."postedAt" BETWEEN ${range.from} AND ${range.to}
      GROUP BY 1 ORDER BY 1
    `,
    db.company.findFirst({ where: { tenantId: user.tenantId, isDefault: true } }),
  ]);

  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const days = Array.from(
    new Set([...receipts.map((r) => dayKey(r.day)), ...sales.map((s) => dayKey(s.day)), ...writeOffs.map((w) => dayKey(w.day))]),
  ).sort();

  const receiptMap = new Map(receipts.map((r) => [dayKey(r.day), Number(r.retail)]));
  const salesMap = new Map(sales.map((s) => [dayKey(s.day), Number(s.total)]));
  const writeOffMap = new Map(writeOffs.map((w) => [dayKey(w.day), Number(w.total)]));

  let balance = 0;
  const lines = days.map((day) => {
    const inbound = receiptMap.get(day) ?? 0;
    const outbound = salesMap.get(day) ?? 0;
    const written = writeOffMap.get(day) ?? 0;
    const opening = balance;
    balance = opening + inbound - outbound - written;
    return { day, opening, inbound, outbound, written, closing: balance };
  });

  const totals = lines.reduce(
    (acc, l) => ({ inbound: acc.inbound + l.inbound, outbound: acc.outbound + l.outbound, written: acc.written + l.written }),
    { inbound: 0, outbound: 0, written: 0 },
  );

  return (
    <ReportShell
      title="Knjiga popisa robe u maloprodaji"
      subtitle={`${formatDate(range.from)} – ${formatDate(range.to)}${company ? ` · ${company.legalName}` : ''} · vrijednosti po maloprodajnoj cijeni`}
      range={preset}
      scope={scopeAll ? 'all' : 'store'}
    >
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Zaduženje (primke)" value={formatAmount(totals.inbound, 0)} unit="€" />
        <StatTile label="Razduženje (prodaja)" value={formatAmount(totals.outbound, 0)} unit="€" />
        <StatTile label="Otpisi" value={formatAmount(totals.written, 0)} unit="€" invertDelta />
        <StatTile label="Promjena stanja" value={formatAmount(totals.inbound - totals.outbound - totals.written, 0)} unit="€" />
      </div>

      <Card padded={false}>
        <div className="p-3.5 pb-2">
          <CardHeader
            compact
            title="Dnevni promet robe"
            subtitle="Početno stanje + zaduženje − razduženje − otpis = završno stanje"
          />
        </div>
        <Table>
          <THead sticky>
            <TR>
              <TH width={130}>Datum</TH>
              <TH numeric width={140}>Početno stanje</TH>
              <TH numeric width={140}>Zaduženje</TH>
              <TH numeric width={140}>Razduženje</TH>
              <TH numeric width={120}>Otpis</TH>
              <TH numeric width={140}>Završno stanje</TH>
            </TR>
          </THead>
          <TBody>
            {lines.map((line) => (
              <TR key={line.day}>
                <TD>{formatDate(line.day)}</TD>
                <TD numeric className="text-ink-3">{formatAmount(line.opening)}</TD>
                <TD numeric className="text-positive">{line.inbound > 0 ? formatAmount(line.inbound) : '—'}</TD>
                <TD numeric className="text-negative">{line.outbound > 0 ? formatAmount(line.outbound) : '—'}</TD>
                <TD numeric className="text-warning">{line.written > 0 ? formatAmount(line.written) : '—'}</TD>
                <TD numeric className="font-medium">{formatAmount(line.closing)}</TD>
              </TR>
            ))}
          </TBody>
          <TFootRow>
            <TD>Ukupno</TD>
            <TD />
            <TD numeric>{formatAmount(totals.inbound)}</TD>
            <TD numeric>{formatAmount(totals.outbound)}</TD>
            <TD numeric>{formatAmount(totals.written)}</TD>
            <TD numeric>{formatAmount(lines[lines.length - 1]?.closing ?? 0)}</TD>
          </TFootRow>
        </Table>
      </Card>

      <p className="mt-2 px-1 text-2xs text-ink-4">
        Prikaz prati logiku knjige popisa: zaduženje po maloprodajnoj vrijednosti primki,
        razduženje po ostvarenom prometu. Početno stanje razdoblja postavljeno je na nulu —
        za službenu knjigu potrebno je unijeti stanje prethodnog razdoblja.
      </p>
    </ReportShell>
  );
}
