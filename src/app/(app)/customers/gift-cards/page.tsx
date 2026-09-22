import Link from 'next/link';
import { Gift, Plus } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { FilterBar } from '@/components/filters/filter-bar';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Poklon kartice' };
export const dynamic = 'force-dynamic';

export default async function GiftCardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('customer.view');

  const cards = await db.giftCard.findMany({
    where: {
      tenantId: user.tenantId,
      ...(params.q ? { code: { contains: params.q, mode: 'insensitive' } } : {}),
      ...(params.status === 'used' ? { balance: { lte: 0 } } : {}),
      ...(params.status === 'active' ? { isActive: true, balance: { gt: 0 } } : {}),
    },
    include: { customer: { select: { id: true, firstName: true, lastName: true, companyName: true } } },
    orderBy: { issuedAt: 'desc' },
    take: 200,
  });

  const issued = cards.reduce((acc, c) => acc + toNumber(c.initialAmount), 0);
  const outstanding = cards.reduce((acc, c) => acc + toNumber(c.balance), 0);
  const activeCount = cards.filter((c) => c.isActive && toNumber(c.balance) > 0).length;

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Poklon kartice"
        subtitle="Izdane kartice, preostala sredstva i obveza prema kupcima"
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Izdaj karticu</Button>}
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Izdanih kartica" value={String(cards.length)} icon={<Gift className="size-3.5" />} />
        <StatTile label="Aktivnih" value={String(activeCount)} />
        <StatTile label="Ukupno izdano" value={formatAmount(issued, 0)} unit="€" />
        <StatTile label="Neiskorišteno (obveza)" value={formatAmount(outstanding, 0)} unit="€" />
      </div>

      <FilterBar
        searchPlaceholder="Broj kartice…"
        searchValue={params.q}
        activeCount={['q', 'status'].filter((k) => params[k]).length}
        selects={[
          {
            param: 'status',
            placeholder: 'Sve kartice',
            value: params.status,
            width: 160,
            options: [
              { value: 'active', label: 'Aktivne' },
              { value: 'used', label: 'Potrošene' },
            ],
          },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={130}>Broj kartice</TH>
              <TH>Kupac</TH>
              <TH numeric width={110}>Izdani iznos</TH>
              <TH numeric width={110}>Stanje</TH>
              <TH numeric width={110}>Iskorišteno</TH>
              <TH width={110}>Izdana</TH>
              <TH width={110}>Vrijedi do</TH>
              <TH width={100}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {cards.map((card) => {
              const balance = toNumber(card.balance);
              const initial = toNumber(card.initialAmount);
              const name = card.customer
                ? card.customer.companyName || `${card.customer.firstName ?? ''} ${card.customer.lastName ?? ''}`.trim()
                : null;
              const expired = card.expiresAt ? card.expiresAt < new Date() : false;
              return (
                <TR key={card.id}>
                  <TD className="font-mono text-sm">{card.code}</TD>
                  <TD>
                    {card.customer ? (
                      <Link href={`/customers/${card.customer.id}`} className="hover:text-accent">{name}</Link>
                    ) : (
                      <span className="text-ink-4">Na donositelja</span>
                    )}
                  </TD>
                  <TD numeric>{formatAmount(initial)}</TD>
                  <TD numeric className={balance > 0 ? 'font-medium' : 'text-ink-4'}>{formatAmount(balance)}</TD>
                  <TD numeric className="text-ink-3">{formatAmount(initial - balance)}</TD>
                  <TD className="text-sm text-ink-3">{formatDate(card.issuedAt)}</TD>
                  <TD className="text-sm text-ink-3">{formatDate(card.expiresAt)}</TD>
                  <TD>
                    <Badge tone={!card.isActive ? 'neutral' : expired ? 'negative' : balance > 0 ? 'positive' : 'neutral'}>
                      {!card.isActive ? 'Poništena' : expired ? 'Istekla' : balance > 0 ? 'Aktivna' : 'Potrošena'}
                    </Badge>
                  </TD>
                </TR>
              );
            })}
          </TBody>
          <TFootRow>
            <TD colSpan={2}>Ukupno {cards.length} kartica</TD>
            <TD numeric>{formatAmount(issued)}</TD>
            <TD numeric>{formatAmount(outstanding)}</TD>
            <TD numeric>{formatAmount(issued - outstanding)}</TD>
            <TD colSpan={3} />
          </TFootRow>
        </Table>
        {cards.length === 0 && <EmptyState icon={<Gift className="size-4" />} title="Nema poklon kartica" />}
      </Card>
    </div>
  );
}
