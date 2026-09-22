import Link from 'next/link';
import { Star, TrendingUp } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Progress } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { BarList } from '@/components/charts/bar-list';

export const metadata = { title: 'Program vjernosti' };
export const dynamic = 'force-dynamic';

export default async function LoyaltyPage() {
  const user = await requirePageAccess('customer.view');

  const [programs, cardStats, tierBreakdown, topCards, recentTxns] = await Promise.all([
    db.loyaltyProgram.findMany({
      where: { tenantId: user.tenantId },
      include: { tiers: { orderBy: { sortOrder: 'asc' } }, _count: { select: { cards: true } } },
    }),
    db.loyaltyCard.aggregate({
      where: { program: { tenantId: user.tenantId } },
      _sum: { points: true, lifetimePoints: true },
      _count: true,
    }),
    db.$queryRaw<{ name: string; color: string | null; count: string; points: string }[]>`
      SELECT COALESCE(lt."name", 'Bez razine') AS name, lt."color",
             COUNT(lc."id")::text AS count,
             COALESCE(SUM(lc."points"), 0)::text AS points
      FROM loyalty_cards lc
      JOIN loyalty_programs lp ON lp."id" = lc."programId"
      LEFT JOIN loyalty_tiers lt ON lt."id" = lc."tierId"
      WHERE lp."tenantId" = ${user.tenantId}
      GROUP BY lt."name", lt."color", lt."sortOrder"
      ORDER BY lt."sortOrder" NULLS FIRST
    `,
    db.loyaltyCard.findMany({
      where: { program: { tenantId: user.tenantId } },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, companyName: true, totalSpent: true } },
        tier: { select: { name: true } },
      },
      orderBy: { points: 'desc' },
      take: 20,
    }),
    db.loyaltyTransaction.findMany({
      where: { customer: { tenantId: user.tenantId } },
      include: { customer: { select: { id: true, firstName: true, lastName: true, companyName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ]);

  const program = programs[0];
  const totalPoints = cardStats._sum.points ?? 0;
  const liability = program ? totalPoints * toNumber(program.redeemValue) : 0;

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Program vjernosti"
        subtitle={program ? `${program.name} · ${program._count.cards} izdanih kartica` : 'Program nije konfiguriran'}
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Aktivne kartice" value={cardStats._count.toLocaleString('hr-HR')} icon={<Star className="size-3.5" />} />
        <StatTile label="Bodovi u optjecaju" value={totalPoints.toLocaleString('hr-HR')} />
        <StatTile label="Obveza po bodovima" value={formatAmount(liability, 0)} unit="€" hint="vrijednost neiskorištenih bodova" />
        <StatTile label="Ukupno prikupljeno" value={(cardStats._sum.lifetimePoints ?? 0).toLocaleString('hr-HR')} icon={<TrendingUp className="size-3.5" />} />
      </div>

      <div className="mb-3 grid gap-2.5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Raspodjela po razinama" subtitle="Broj kartica" />
          <BarList items={tierBreakdown.map((t) => ({ label: t.name, value: Number(t.count), meta: `${Number(t.points).toLocaleString('hr-HR')} b.` }))} unit="" />
        </Card>

        {program && (
          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader
                compact
                title="Pravila programa"
                subtitle={`1 € = ${toNumber(program.pointsPerUnit)} bod · 1 bod = ${formatAmount(toNumber(program.redeemValue), 4)} €`}
              />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Razina</TH>
                  <TH numeric width={120}>Prag potrošnje</TH>
                  <TH numeric width={90}>Popust</TH>
                  <TH numeric width={110}>Množitelj bodova</TH>
                  <TH numeric width={90}>Kartica</TH>
                </TR>
              </THead>
              <TBody>
                {program.tiers.map((tier) => {
                  const stat = tierBreakdown.find((t) => t.name === tier.name);
                  return (
                    <TR key={tier.id}>
                      <TD>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-[8px] rounded-full" style={{ backgroundColor: tier.color ?? 'var(--color-ink-4)' }} />
                          <span className="font-medium">{tier.name}</span>
                        </span>
                      </TD>
                      <TD numeric>{formatAmount(toNumber(tier.minSpend), 0)} €</TD>
                      <TD numeric>{formatPercent(toNumber(tier.discountPct), 0)}</TD>
                      <TD numeric>{toNumber(tier.pointsMultiplier)}×</TD>
                      <TD numeric>{stat ? Number(stat.count) : 0}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            <div className="p-3.5 pt-2">
              <p className="text-2xs text-ink-4">
                Minimalno {program.minRedeemPoints} bodova za iskorištavanje
                {program.expiryMonths ? ` · bodovi istječu nakon ${program.expiryMonths} mjeseci` : ' · bodovi ne istječu'}.
              </p>
            </div>
          </Card>
        )}
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1.3fr_1fr]">
        <Card padded={false}>
          <div className="p-3.5 pb-2">
            <CardHeader compact title="Kupci s najviše bodova" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Kupac</TH>
                <TH width={130}>Broj kartice</TH>
                <TH width={100}>Razina</TH>
                <TH numeric width={90}>Bodovi</TH>
                <TH numeric width={110}>Vrijednost</TH>
                <TH numeric width={110}>Potrošeno</TH>
              </TR>
            </THead>
            <TBody>
              {topCards.map((card) => {
                const name = card.customer.companyName || `${card.customer.firstName ?? ''} ${card.customer.lastName ?? ''}`.trim();
                return (
                  <TR key={card.id}>
                    <TD>
                      <Link href={`/customers/${card.customer.id}`} className="hover:text-accent hover:underline">
                        {name}
                      </Link>
                    </TD>
                    <TD className="font-mono text-xs text-ink-4">{card.cardNumber}</TD>
                    <TD>{card.tier ? <Badge tone="accent">{card.tier.name}</Badge> : '—'}</TD>
                    <TD numeric className="font-medium">{card.points.toLocaleString('hr-HR')}</TD>
                    <TD numeric className="text-ink-2">
                      {program ? `${formatAmount(card.points * toNumber(program.redeemValue))} €` : '—'}
                    </TD>
                    <TD numeric>{formatAmount(toNumber(card.customer.totalSpent), 0)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {topCards.length === 0 && <EmptyState compact icon={<Star className="size-4" />} title="Nema izdanih kartica" />}
        </Card>

        <Card padded={false}>
          <div className="p-3.5 pb-2">
            <CardHeader compact title="Posljednji promet bodova" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Kupac</TH>
                <TH width={120}>Vrsta</TH>
                <TH width={110}>Datum</TH>
                <TH numeric width={80}>Bodovi</TH>
              </TR>
            </THead>
            <TBody>
              {recentTxns.map((txn) => {
                const name = txn.customer.companyName || `${txn.customer.firstName ?? ''} ${txn.customer.lastName ?? ''}`.trim();
                return (
                  <TR key={txn.id}>
                    <TD className="truncate">{name}</TD>
                    <TD className="text-ink-2">{txn.type}</TD>
                    <TD className="text-sm text-ink-3">{formatDate(txn.createdAt)}</TD>
                    <TD numeric className={txn.points >= 0 ? 'text-positive' : 'text-negative'}>
                      {txn.points > 0 ? '+' : ''}{txn.points}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          {recentTxns.length === 0 && <EmptyState compact title="Nema prometa bodova" />}
          <div className="p-3.5 pt-2">
            <Progress value={cardStats._count > 0 ? 100 : 0} tone="accent" />
          </div>
        </Card>
      </div>
    </div>
  );
}
