import Link from 'next/link';
import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds } from '@/lib/auth';
import { resolveRange } from '@/lib/ranges';
import { abcAnalysis } from '@/lib/services/analytics';
import { formatAmount, formatDate, formatPercent, formatQty } from '@/lib/format';
import { Badge, Card, CardHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { ReportShell } from '@/components/reports/report-shell';

export const metadata = { title: 'ABC analiza' };
export const dynamic = 'force-dynamic';

const CLASS_TONE = { A: 'positive', B: 'warning', C: 'neutral' } as const;

export default async function AbcReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePageAccess('report.stock');
  const preset = params.range ?? '90d';
  const range = resolveRange(preset);
  const allStores = await accessibleStoreIds(user);
  const scopeAll = params.scope === 'all' || !user.activeStoreId;
  const storeIds = scopeAll ? allStores : [user.activeStoreId!];

  const rows = await abcAnalysis({ tenantId: user.tenantId, storeIds }, range);
  const total = rows.reduce((acc, r) => acc + r.total, 0);
  const groups = { A: rows.filter((r) => r.class === 'A'), B: rows.filter((r) => r.class === 'B'), C: rows.filter((r) => r.class === 'C') };
  const groupValue = (list: typeof rows) => list.reduce((acc, r) => acc + r.total, 0);

  return (
    <ReportShell
      title="ABC analiza asortimana"
      subtitle={`${formatDate(range.from)} – ${formatDate(range.to)} · A do 80 %, B do 95 %, C ostatak kumulativnog prometa`}
      range={preset}
      scope={scopeAll ? 'all' : 'store'}
    >
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Artikala s prometom" value={rows.length.toLocaleString('hr-HR')} />
        <StatTile
          label="Klasa A"
          value={String(groups.A.length)}
          hint={`${formatPercent(total > 0 ? (groupValue(groups.A) / total) * 100 : 0)} prometa`}
        />
        <StatTile
          label="Klasa B"
          value={String(groups.B.length)}
          hint={`${formatPercent(total > 0 ? (groupValue(groups.B) / total) * 100 : 0)} prometa`}
        />
        <StatTile
          label="Klasa C"
          value={String(groups.C.length)}
          hint={`${formatPercent(total > 0 ? (groupValue(groups.C) / total) * 100 : 0)} prometa`}
        />
      </div>

      <Card padded={false}>
        <div className="p-3.5 pb-2">
          <CardHeader
            compact
            title="Rang artikala"
            subtitle="Sortirano po prometu, s kumulativnim udjelom"
          />
        </div>
        <Table>
          <THead sticky>
            <TR>
              <TH width={36}>#</TH>
              <TH width={70}>Klasa</TH>
              <TH width={80}>Šifra</TH>
              <TH>Naziv</TH>
              <TH numeric width={100}>Količina</TH>
              <TH numeric width={130}>Promet</TH>
              <TH numeric width={90}>Udio</TH>
              <TH numeric width={110}>Kumulativno</TH>
            </TR>
          </THead>
          <TBody>
            {rows.slice(0, 300).map((row, index) => (
              <TR key={row.variantId}>
                <TD className="text-ink-4">{index + 1}</TD>
                <TD>
                  <Badge tone={CLASS_TONE[row.class as keyof typeof CLASS_TONE]}>{row.class}</Badge>
                </TD>
                <TD className="font-mono text-sm text-ink-3">{row.sku}</TD>
                <TD className="truncate">
                  <Link href={`/inventory/movements?variant=${row.variantId}`} className="hover:text-accent">
                    {row.name}
                  </Link>
                </TD>
                <TD numeric>{formatQty(row.qty, 1)}</TD>
                <TD numeric className="font-medium">{formatAmount(row.total)}</TD>
                <TD numeric className="text-ink-3">
                  {formatPercent(total > 0 ? (row.total / total) * 100 : 0, 2)}
                </TD>
                <TD numeric>{formatPercent(row.cumulativePct)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
      <p className="mt-2 px-1 text-2xs text-ink-4">
        Klasa A zaslužuje najviše pažnje u nabavi i raspoloživosti. Klasa C je kandidat za
        smanjenje asortimana ili prostora na polici.
      </p>
    </ReportShell>
  );
}
