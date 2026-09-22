import Link from 'next/link';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate } from '@/lib/format';
import { TRANSFER_STATUS } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { FilterBar } from '@/components/filters/filter-bar';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Međuskladišnice' };
export const dynamic = 'force-dynamic';

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePageAccess('transfer.view');
  const storeIds = await accessibleStoreIds(user);

  const transfers = await db.stockTransfer.findMany({
    where: {
      tenantId: user.tenantId,
      OR: [{ fromStoreId: { in: storeIds } }, { toStoreId: { in: storeIds } }],
      ...(params.status ? { status: params.status as never } : {}),
      ...(params.q ? { number: { contains: params.q, mode: 'insensitive' } } : {}),
    },
    include: {
      fromStore: { select: { name: true } },
      toStore: { select: { name: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const inTransit = transfers.filter((t) => t.status === 'DISPATCHED');
  const pending = transfers.filter((t) => ['REQUESTED', 'APPROVED'].includes(t.status));
  const transitValue = inTransit.reduce((acc, t) => acc + toNumber(t.totalCost), 0);

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Međuskladišnice"
        subtitle="Prijenos robe između poslovnica i centralnog skladišta"
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Nova međuskladišnica</Button>}
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="U tranzitu" value={String(inTransit.length)} hint="otpremljeno, nije zaprimljeno" />
        <StatTile label="Vrijednost u tranzitu" value={formatAmount(transitValue, 0)} unit="€" />
        <StatTile label="Čeka obradu" value={String(pending.length)} hint="zatraženo ili odobreno" />
        <StatTile label="Ukupno dokumenata" value={String(transfers.length)} />
      </div>

      <FilterBar
        searchPlaceholder="Broj dokumenta…"
        searchValue={params.q}
        activeCount={['q', 'status'].filter((k) => params[k]).length}
        selects={[
          {
            param: 'status',
            placeholder: 'Svi statusi',
            value: params.status,
            width: 190,
            options: Object.entries(TRANSFER_STATUS).map(([value, v]) => ({ value, label: v.label })),
          },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={140}>Broj</TH>
              <TH>Iz</TH>
              <TH>U</TH>
              <TH numeric width={80}>Stavki</TH>
              <TH numeric width={110}>Vrijednost</TH>
              <TH width={110}>Otpremljeno</TH>
              <TH width={110}>Zaprimljeno</TH>
              <TH width={110}>Kreirano</TH>
              <TH width={190}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {transfers.map((transfer) => (
              <TR key={transfer.id}>
                <TD>
                  <Link href={`/inventory/transfers/${transfer.id}`} className="font-mono text-sm text-accent hover:underline">
                    {transfer.number}
                  </Link>
                </TD>
                <TD className="text-ink-2">{transfer.fromStore.name}</TD>
                <TD className="font-medium">{transfer.toStore.name}</TD>
                <TD numeric>{transfer._count.lines}</TD>
                <TD numeric>{formatAmount(toNumber(transfer.totalCost))}</TD>
                <TD className="text-sm text-ink-3">{transfer.dispatchedAt ? formatDate(transfer.dispatchedAt) : '—'}</TD>
                <TD className="text-sm text-ink-3">{transfer.receivedAt ? formatDate(transfer.receivedAt) : '—'}</TD>
                <TD className="text-sm text-ink-3">{formatDate(transfer.createdAt)}</TD>
                <TD><Badge tone={TRANSFER_STATUS[transfer.status].tone} dot>{TRANSFER_STATUS[transfer.status].label}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {transfers.length === 0 && <EmptyState icon={<ArrowLeftRight className="size-4" />} title="Nema međuskladišnica" />}
      </Card>
    </div>
  );
}
