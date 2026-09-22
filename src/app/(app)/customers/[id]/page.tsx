import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, MapPin, Phone, Star } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate, formatDateTime, formatPercent } from '@/lib/format';
import { CUSTOMER_TYPE } from '@/lib/labels';
import { Badge, Card, CardHeader, DetailRow, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { BarList } from '@/components/charts/bar-list';

export const dynamic = 'force-dynamic';

const LOYALTY_LABEL: Record<string, string> = {
  EARN: 'Prikupljeno',
  REDEEM: 'Iskorišteno',
  EXPIRE: 'Isteklo',
  ADJUSTMENT: 'Korekcija',
  REFUND_REVERSAL: 'Storno povrata',
  BONUS: 'Bonus',
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission('customer.view');

  const customer = await db.customer.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      group: true,
      loyaltyCards: { include: { tier: true, program: true } },
      sales: {
        where: { status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } },
        include: { store: { select: { name: true } } },
        orderBy: { issuedAt: 'desc' },
        take: 15,
      },
      loyaltyTxns: { orderBy: { createdAt: 'desc' }, take: 12 },
      giftCards: { where: { isActive: true } },
    },
  });
  if (!customer) notFound();

  const name = customer.companyName || `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim();
  const card = customer.loyaltyCards[0];

  const topProducts = await db.$queryRaw<{ name: string; qty: string; total: string }[]>`
    SELECT sl."name", SUM(sl."quantity")::text AS qty, SUM(sl."lineTotal")::text AS total
    FROM sale_lines sl
    JOIN sales s ON s."id" = sl."saleId"
    WHERE s."customerId" = ${customer.id}
    GROUP BY sl."name" ORDER BY SUM(sl."lineTotal") DESC LIMIT 8
  `;

  return (
    <div className="mx-auto max-w-[1340px]">
      <Link href="/customers" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3" /> Kupci
      </Link>

      <PageHeader
        title={name || customer.code}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{customer.code}</span>
            · {CUSTOMER_TYPE[customer.type]}
            {customer.group && <>· {customer.group.name}</>}
            {card?.tier && <Badge tone="accent">{card.tier.name}</Badge>}
            {!customer.isActive && <Badge tone="negative">Neaktivan</Badge>}
          </span>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <StatTile label="Ukupno potrošeno" value={formatAmount(toNumber(customer.totalSpent), 0)} unit="€" />
        <StatTile label="Broj kupnji" value={String(customer.orderCount)} />
        <StatTile
          label="Prosječna košarica"
          value={formatAmount(customer.orderCount > 0 ? toNumber(customer.totalSpent) / customer.orderCount : 0)}
          unit="€"
        />
        <StatTile label="Bodovi vjernosti" value={(card?.points ?? 0).toLocaleString('hr-HR')} hint={card ? `ukupno ${card.lifetimePoints}` : 'nema kartice'} icon={<Star className="size-3.5" />} />
        <StatTile label="Otvoreno potraživanje" value={formatAmount(toNumber(customer.balance), 0)} unit="€" hint={`limit ${formatAmount(toNumber(customer.creditLimit), 0)} €`} />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2.5">
          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Povijest kupnji" subtitle="Posljednjih 15 računa" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={110}>Broj</TH>
                  <TH width={140}>Datum</TH>
                  <TH>Poslovnica</TH>
                  <TH numeric width={90}>Popust</TH>
                  <TH numeric width={80}>Bodovi</TH>
                  <TH numeric width={100}>Iznos</TH>
                </TR>
              </THead>
              <TBody>
                {customer.sales.map((sale) => (
                  <TR key={sale.id}>
                    <TD>
                      <Link href={`/sales/receipts/${sale.id}`} className="font-mono text-sm text-accent hover:underline">
                        {sale.number}
                      </Link>
                    </TD>
                    <TD className="text-sm text-ink-3">{formatDateTime(sale.issuedAt)}</TD>
                    <TD className="truncate text-ink-2">{sale.store.name}</TD>
                    <TD numeric className="text-ink-3">
                      {toNumber(sale.discountTotal) > 0 ? formatAmount(toNumber(sale.discountTotal)) : '—'}
                    </TD>
                    <TD numeric className="text-positive">
                      {sale.loyaltyPointsEarned > 0 ? `+${sale.loyaltyPointsEarned}` : '—'}
                    </TD>
                    <TD numeric className="font-medium">{formatAmount(toNumber(sale.total))}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {customer.sales.length === 0 && <EmptyState compact title="Nema zabilježenih kupnji" />}
          </Card>

          <Card>
            <CardHeader title="Najčešće kupovani artikli" subtitle="Po vrijednosti" />
            <BarList items={topProducts.map((p) => ({ label: p.name, value: Number(p.total), meta: Number(p.qty).toFixed(0) }))} />
          </Card>
        </div>

        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Kontakt" />
            <div className="space-y-1.5 text-base">
              {customer.email && (
                <p className="flex items-center gap-1.5 text-ink-2">
                  <Mail className="size-3.5 text-ink-4" /> {customer.email}
                </p>
              )}
              {customer.phone && (
                <p className="flex items-center gap-1.5 text-ink-2">
                  <Phone className="size-3.5 text-ink-4" /> {customer.phone}
                </p>
              )}
              {customer.addressLine && (
                <p className="flex items-start gap-1.5 text-ink-2">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-4" />
                  <span>{customer.addressLine}<br />{customer.postalCode} {customer.city}</span>
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Podaci" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Šifra">{customer.code}</DetailRow>
              <DetailRow label="Vrsta">{CUSTOMER_TYPE[customer.type]}</DetailRow>
              {customer.vatId && <DetailRow label="OIB" mono>{customer.vatId}</DetailRow>}
              <DetailRow label="Grupa">{customer.group?.name ?? '—'}</DetailRow>
              <DetailRow label="Popust">{formatPercent(toNumber(customer.discountPct), 1)}</DetailRow>
              <DetailRow label="Rok plaćanja">{customer.paymentTerms} dana</DetailRow>
              <DetailRow label="Kreditni limit">{formatAmount(toNumber(customer.creditLimit))} €</DetailRow>
              <DetailRow label="Datum rođenja">{formatDate(customer.birthDate)}</DetailRow>
              <DetailRow label="Marketing">{customer.marketingOptIn ? 'Pristanak dan' : 'Bez pristanka'}</DetailRow>
              <DetailRow label="GDPR pristanak">{formatDate(customer.gdprConsentAt)}</DetailRow>
              <DetailRow label="Registriran">{formatDate(customer.createdAt)}</DetailRow>
            </div>
          </Card>

          {card && (
            <Card>
              <CardHeader compact title="Kartica vjernosti" subtitle={card.program.name} />
              <div className="divide-y divide-hairline">
                <DetailRow label="Broj kartice" mono>{card.cardNumber}</DetailRow>
                <DetailRow label="Razina">{card.tier?.name ?? '—'}</DetailRow>
                <DetailRow label="Stanje bodova">{card.points.toLocaleString('hr-HR')}</DetailRow>
                <DetailRow label="Ukupno prikupljeno">{card.lifetimePoints.toLocaleString('hr-HR')}</DetailRow>
                <DetailRow label="Vrijednost bodova">
                  {formatAmount(card.points * toNumber(card.program.redeemValue))} €
                </DetailRow>
                <DetailRow label="Izdana">{formatDate(card.issuedAt)}</DetailRow>
              </div>
            </Card>
          )}

          {customer.loyaltyTxns.length > 0 && (
            <Card>
              <CardHeader compact title="Promet bodova" />
              <div className="space-y-1">
                {customer.loyaltyTxns.map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-ink-2">{LOYALTY_LABEL[txn.type] ?? txn.type}</span>
                    <span className="shrink-0 text-2xs text-ink-4">{formatDate(txn.createdAt)}</span>
                    <span className={`shrink-0 font-mono tnum ${txn.points >= 0 ? 'text-positive' : 'text-negative'}`}>
                      {txn.points > 0 ? '+' : ''}{txn.points}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {customer.giftCards.length > 0 && (
            <Card>
              <CardHeader compact title="Poklon kartice" />
              <div className="space-y-1">
                {customer.giftCards.map((gift) => (
                  <div key={gift.id} className="flex items-center justify-between gap-2 rounded-sm bg-surface-2 px-2 py-1">
                    <span className="font-mono text-sm">{gift.code}</span>
                    <span className="font-mono text-sm tnum">{formatAmount(toNumber(gift.balance))} €</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
