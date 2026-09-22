import Link from 'next/link';
import { ListChecks, Plus } from 'lucide-react';
import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { STOCKTAKE_STATUS } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader, Progress } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Inventure' };
export const dynamic = 'force-dynamic';

export default async function StockTakesPage() {
  const user = await requirePageAccess('stocktake.manage');
  const storeIds = await accessibleStoreIds(user);

  const stockTakes = await db.stockTake.findMany({
    where: { tenantId: user.tenantId, storeId: { in: storeIds } },
    include: { store: { select: { name: true } }, warehouse: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  const open = stockTakes.filter((s) => ['DRAFT', 'COUNTING', 'REVIEW'].includes(s.status));
  const totalDeficit = stockTakes.reduce((acc, s) => acc + toNumber(s.deficitValue), 0);
  const totalSurplus = stockTakes.reduce((acc, s) => acc + toNumber(s.surplusValue), 0);

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Inventure"
        subtitle="Popis zaliha, usporedba s knjigovodstvenim stanjem i knjiženje razlika"
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Nova inventura</Button>}
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="U tijeku" value={String(open.length)} hint="priprema, brojanje ili provjera" />
        <StatTile label="Ukupan manjak" value={formatAmount(totalDeficit, 0)} unit="€" invertDelta />
        <StatTile label="Ukupan višak" value={formatAmount(totalSurplus, 0)} unit="€" />
        <StatTile label="Neto razlika" value={formatAmount(totalSurplus - totalDeficit, 0)} unit="€" />
      </div>

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={130}>Broj</TH>
              <TH>Naziv</TH>
              <TH width={140}>Poslovnica</TH>
              <TH width={90}>Opseg</TH>
              <TH width={150}>Napredak</TH>
              <TH numeric width={110}>Manjak</TH>
              <TH numeric width={110}>Višak</TH>
              <TH width={110}>Datum</TH>
              <TH width={160}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {stockTakes.map((take) => {
              const progress = take.totalLines > 0 ? (take.countedLines / take.totalLines) * 100 : 0;
              return (
                <TR key={take.id}>
                  <TD>
                    <Link href={`/inventory/stocktakes/${take.id}`} className="font-mono text-sm text-accent hover:underline">
                      {take.number}
                    </Link>
                  </TD>
                  <TD className="truncate">{take.name ?? '—'}</TD>
                  <TD className="text-ink-2">{take.store.name}</TD>
                  <TD className="text-sm text-ink-3">{take.scope === 'full' ? 'Potpuna' : 'Djelomična'}</TD>
                  <TD>
                    <div className="flex items-center gap-1.5">
                      <Progress value={progress} tone={progress >= 100 ? 'positive' : 'accent'} className="flex-1" />
                      <span className="w-[62px] shrink-0 text-right text-2xs text-ink-3 tnum">
                        {take.countedLines}/{take.totalLines}
                      </span>
                    </div>
                  </TD>
                  <TD numeric className="text-negative">{formatAmount(toNumber(take.deficitValue), 0)}</TD>
                  <TD numeric className="text-positive">{formatAmount(toNumber(take.surplusValue), 0)}</TD>
                  <TD className="text-sm text-ink-3">{formatDate(take.createdAt)}</TD>
                  <TD><Badge tone={STOCKTAKE_STATUS[take.status].tone} dot>{STOCKTAKE_STATUS[take.status].label}</Badge></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {stockTakes.length === 0 && <EmptyState icon={<ListChecks className="size-4" />} title="Nema inventura" />}
      </Card>
      <p className="mt-2 px-1 text-2xs text-ink-4">
        Knjiženjem inventure sustav automatski kreira korekcije zalihe za sve razlike.
        Vrijednost razlike računa se po ponderiranoj prosječnoj nabavnoj cijeni. {formatPercent(0, 0) && ''}
      </p>
    </div>
  );
}
