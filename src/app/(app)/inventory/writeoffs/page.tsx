import { Plus, Trash2 } from 'lucide-react';
import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate } from '@/lib/format';
import { DOC_STATUS } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { BarList } from '@/components/charts/bar-list';

export const metadata = { title: 'Otpisi' };
export const dynamic = 'force-dynamic';

export default async function WriteOffsPage() {
  const user = await requirePageAccess('writeoff.manage');
  const storeIds = await accessibleStoreIds(user);

  const [writeOffs, byReason] = await Promise.all([
    db.writeOff.findMany({
      where: { tenantId: user.tenantId, storeId: { in: storeIds } },
      include: {
        store: { select: { name: true } },
        reasonCode: { select: { name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    db.$queryRaw<{ name: string; total: string; count: string }[]>`
      SELECT COALESCE(rc."name", 'Bez razloga') AS name,
             COALESCE(SUM(wo."totalCost"), 0)::text AS total,
             COUNT(*)::text AS count
      FROM write_offs wo
      LEFT JOIN reason_codes rc ON rc."id" = wo."reasonCodeId"
      WHERE wo."tenantId" = ${user.tenantId} AND wo."storeId" = ANY(${storeIds}::text[])
      GROUP BY rc."name" ORDER BY SUM(wo."totalCost") DESC
    `,
  ]);

  const posted = writeOffs.filter((w) => w.status === 'POSTED');
  const pending = writeOffs.filter((w) => w.status === 'PENDING_APPROVAL');
  const totalCost = posted.reduce((acc, w) => acc + toNumber(w.totalCost), 0);

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Otpisi"
        subtitle="Evidencija rashoda robe s razlogom i vrijednošću po nabavnoj cijeni"
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Novi otpis</Button>}
      />

      <div className="mb-3 grid gap-2.5 lg:grid-cols-[1fr_1fr_1fr_320px]">
        <StatTile label="Proknjiženi otpisi" value={String(posted.length)} />
        <StatTile label="Čeka odobrenje" value={String(pending.length)} />
        <StatTile label="Vrijednost otpisa" value={formatAmount(totalCost, 0)} unit="€" invertDelta />
        <Card inset>
          <p className="mb-1.5 text-sm font-medium text-ink-2">Po razlogu otpisa</p>
          <BarList
            items={byReason.slice(0, 5).map((r) => ({ label: r.name, value: Number(r.total), meta: r.count }))}
            tone="neutral"
          />
        </Card>
      </div>

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={130}>Broj</TH>
              <TH width={150}>Poslovnica</TH>
              <TH>Razlog</TH>
              <TH numeric width={80}>Stavki</TH>
              <TH numeric width={120}>Vrijednost</TH>
              <TH width={110}>Kreirano</TH>
              <TH width={110}>Proknjiženo</TH>
              <TH width={140}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {writeOffs.map((writeOff) => (
              <TR key={writeOff.id}>
                <TD className="font-mono text-sm">{writeOff.number}</TD>
                <TD className="text-ink-2">{writeOff.store.name}</TD>
                <TD>{writeOff.reasonCode?.name ?? '—'}</TD>
                <TD numeric>{writeOff._count.lines}</TD>
                <TD numeric className="font-medium text-negative">{formatAmount(toNumber(writeOff.totalCost))}</TD>
                <TD className="text-sm text-ink-3">{formatDate(writeOff.createdAt)}</TD>
                <TD className="text-sm text-ink-3">{writeOff.postedAt ? formatDate(writeOff.postedAt) : '—'}</TD>
                <TD><Badge tone={DOC_STATUS[writeOff.status].tone}>{DOC_STATUS[writeOff.status].label}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {writeOffs.length === 0 && <EmptyState icon={<Trash2 className="size-4" />} title="Nema otpisa" />}
      </Card>
    </div>
  );
}
