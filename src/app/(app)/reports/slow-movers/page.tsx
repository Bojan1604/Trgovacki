import Link from 'next/link';
import { Archive } from 'lucide-react';
import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds } from '@/lib/auth';
import { slowMovers } from '@/lib/services/analytics';
import { formatAmount, formatDate, formatQty } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Artikli bez obrtaja' };
export const dynamic = 'force-dynamic';

export default async function SlowMoversPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePageAccess('report.stock');
  const days = Number(params.days ?? 60) || 60;
  const storeIds = await accessibleStoreIds(user);

  const rows = await slowMovers({ tenantId: user.tenantId, storeIds }, days, 200);
  const totalValue = rows.reduce((acc, r) => acc + r.value, 0);
  const neverSold = rows.filter((r) => !r.lastSold).length;

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Artikli bez obrtaja"
        subtitle={`Artikli sa zalihom koji nisu prodani u posljednjih ${days} dana`}
        actions={
          <div className="flex gap-1">
            {[30, 60, 90, 180].map((d) => (
              <Link key={d} href={`/reports/slow-movers?days=${d}`}>
                <Badge tone={d === days ? 'accent' : 'neutral'} className="cursor-pointer px-2 py-1">
                  {d} dana
                </Badge>
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        <StatTile label="Artikala bez prodaje" value={String(rows.length)} />
        <StatTile label="Nikada prodano" value={String(neverSold)} />
        <StatTile label="Vezana vrijednost" value={formatAmount(totalValue, 0)} unit="€" invertDelta />
      </div>

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={80}>Šifra</TH>
              <TH>Naziv</TH>
              <TH numeric width={110}>Zaliha</TH>
              <TH numeric width={130}>Vrijednost po NC</TH>
              <TH width={140}>Zadnja prodaja</TH>
              <TH width={100}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.variantId}>
                <TD className="font-mono text-sm text-ink-3">{row.sku}</TD>
                <TD className="truncate">
                  <Link href={`/inventory/movements?variant=${row.variantId}`} className="hover:text-accent">
                    {row.name}
                  </Link>
                </TD>
                <TD numeric>{formatQty(row.qty, 1)}</TD>
                <TD numeric className="font-medium">{formatAmount(row.value)}</TD>
                <TD className="text-sm text-ink-3">{row.lastSold ? formatDate(row.lastSold) : 'nikada'}</TD>
                <TD>
                  <Badge tone={row.lastSold ? 'warning' : 'negative'}>
                    {row.lastSold ? 'Spor obrtaj' : 'Mrtva zaliha'}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
          <TFootRow>
            <TD colSpan={3}>Ukupno {rows.length} artikala</TD>
            <TD numeric>{formatAmount(totalValue)}</TD>
            <TD colSpan={2} />
          </TFootRow>
        </Table>
        {rows.length === 0 && (
          <EmptyState icon={<Archive className="size-4" />} title="Nema artikala bez obrtaja" description="Cijeli asortiman se prodaje u zadanom razdoblju." />
        )}
      </Card>
    </div>
  );
}
