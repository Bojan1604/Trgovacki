import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { CUSTOMER_TYPE } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/navigation';
import { FilterBar } from '@/components/filters/filter-bar';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Kupci' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 40;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('customer.view');
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.CustomerWhereInput = {
    tenantId: user.tenantId,
    ...(params.q
      ? {
          OR: [
            { firstName: { contains: params.q, mode: 'insensitive' } },
            { lastName: { contains: params.q, mode: 'insensitive' } },
            { companyName: { contains: params.q, mode: 'insensitive' } },
            { email: { contains: params.q, mode: 'insensitive' } },
            { phone: { contains: params.q } },
            { vatId: { startsWith: params.q } },
            { code: { startsWith: params.q } },
          ],
        }
      : {}),
    ...(params.group ? { groupId: params.group } : {}),
    ...(params.type ? { type: params.type as never } : {}),
  };

  const [total, customers, groups, aggregate] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      include: {
        group: { select: { name: true } },
        loyaltyCards: { where: { isActive: true }, include: { tier: { select: { name: true, color: true } } }, take: 1 },
      },
      orderBy: { totalSpent: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.customerGroup.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true } }),
    db.customer.aggregate({
      where: { tenantId: user.tenantId },
      _sum: { totalSpent: true, balance: true },
      _avg: { totalSpent: true },
      _count: true,
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Kupci"
        subtitle={`${total.toLocaleString('hr-HR')} kupaca u bazi`}
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Novi kupac</Button>}
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Ukupno kupaca" value={aggregate._count.toLocaleString('hr-HR')} />
        <StatTile label="Ukupna potrošnja" value={formatAmount(toNumber(aggregate._sum.totalSpent), 0)} unit="€" />
        <StatTile label="Prosječna potrošnja" value={formatAmount(toNumber(aggregate._avg.totalSpent), 0)} unit="€" />
        <StatTile label="Otvorena potraživanja" value={formatAmount(toNumber(aggregate._sum.balance), 0)} unit="€" />
      </div>

      <FilterBar
        searchPlaceholder="Ime, tvrtka, OIB, telefon ili e-pošta…"
        searchValue={params.q}
        activeCount={['q', 'group', 'type'].filter((k) => params[k]).length}
        selects={[
          { param: 'group', placeholder: 'Sve grupe', value: params.group, width: 170, options: groups.map((g) => ({ value: g.id, label: g.name })) },
          { param: 'type', placeholder: 'Sve vrste', value: params.type, width: 160, options: Object.entries(CUSTOMER_TYPE).map(([value, label]) => ({ value, label })) },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={80}>Šifra</TH>
              <TH>Naziv</TH>
              <TH width={100}>Vrsta</TH>
              <TH width={120}>Grupa</TH>
              <TH width={150}>Kontakt</TH>
              <TH width={110}>Razina</TH>
              <TH numeric width={80}>Bodovi</TH>
              <TH numeric width={70}>Popust</TH>
              <TH numeric width={70}>Kupnji</TH>
              <TH numeric width={110}>Potrošeno</TH>
              <TH width={110}>Zadnja kupnja</TH>
            </TR>
          </THead>
          <TBody>
            {customers.map((customer) => {
              const card = customer.loyaltyCards[0];
              const name = customer.companyName || `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim();
              return (
                <TR key={customer.id}>
                  <TD className="font-mono text-sm text-ink-3">{customer.code}</TD>
                  <TD>
                    <Link href={`/customers/${customer.id}`} className="font-medium hover:text-accent hover:underline">
                      {name || '—'}
                    </Link>
                    {customer.vatId && <span className="ml-1.5 font-mono text-2xs text-ink-4">{customer.vatId}</span>}
                  </TD>
                  <TD className="text-ink-2">{CUSTOMER_TYPE[customer.type]}</TD>
                  <TD className="text-ink-2">{customer.group?.name ?? '—'}</TD>
                  <TD className="truncate text-sm text-ink-3">{customer.phone ?? customer.email ?? '—'}</TD>
                  <TD>
                    {card?.tier ? (
                      <Badge tone="accent">{card.tier.name}</Badge>
                    ) : (
                      <span className="text-ink-4">—</span>
                    )}
                  </TD>
                  <TD numeric>{card ? card.points.toLocaleString('hr-HR') : '—'}</TD>
                  <TD numeric className="text-ink-2">
                    {toNumber(customer.discountPct) > 0 ? formatPercent(toNumber(customer.discountPct), 0) : '—'}
                  </TD>
                  <TD numeric>{customer.orderCount}</TD>
                  <TD numeric className="font-medium">{formatAmount(toNumber(customer.totalSpent), 0)}</TD>
                  <TD className="text-sm text-ink-3">{formatDate(customer.lastPurchaseAt)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {customers.length === 0 && <EmptyState icon={<Users className="size-4" />} title="Nema kupaca" />}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
      </Card>
    </div>
  );
}
