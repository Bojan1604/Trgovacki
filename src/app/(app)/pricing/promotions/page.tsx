import { BadgePercent, Plus } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { PROMOTION_STATUS, PROMOTION_TYPE } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { FilterBar } from '@/components/filters/filter-bar';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Akcije' };
export const dynamic = 'force-dynamic';

const DAY_NAMES = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];

function describeValue(promotion: { type: string; value: unknown; buyQty: unknown; getQty: unknown; minBasketAmount: unknown }) {
  const value = toNumber(promotion.value as never);
  switch (promotion.type) {
    case 'PERCENT_OFF':
      return `−${formatPercent(value, 0)}`;
    case 'AMOUNT_OFF':
      return `−${formatAmount(value)} €`;
    case 'FIXED_PRICE':
      return `${formatAmount(value)} €`;
    case 'BUY_X_GET_Y':
      return `${toNumber(promotion.buyQty as never)}+${toNumber(promotion.getQty as never)}`;
    case 'BUNDLE_PRICE':
      return `${toNumber(promotion.buyQty as never)} kom · ${formatAmount(value)} €`;
    case 'NTH_ITEM_DISCOUNT':
      return `svaki ${toNumber(promotion.buyQty as never)}. −${formatPercent(value, 0)}`;
    case 'BASKET_THRESHOLD':
      return `−${formatPercent(value, 0)} iznad ${formatAmount(toNumber(promotion.minBasketAmount as never), 0)} €`;
    default:
      return '—';
  }
}

function describeWindow(mask: number | null, start: string | null, end: string | null) {
  const parts: string[] = [];
  if (mask) {
    const days = DAY_NAMES.filter((_, i) => (mask & (1 << i)) !== 0);
    if (days.length > 0 && days.length < 7) parts.push(days.join(', '));
  }
  if (start && end) parts.push(`${start}–${end}`);
  return parts.join(' · ') || 'Cijelo vrijeme';
}

export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('promotion.view');

  const promotions = await db.promotion.findMany({
    where: {
      tenantId: user.tenantId,
      ...(params.q ? { OR: [{ name: { contains: params.q, mode: 'insensitive' } }, { code: { contains: params.q, mode: 'insensitive' } }] } : {}),
      ...(params.status ? { status: params.status as never } : {}),
      ...(params.type ? { type: params.type as never } : {}),
    },
    include: { _count: { select: { targets: true, coupons: true, discounts: true } } },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }],
  });

  const active = promotions.filter((p) => p.status === 'ACTIVE').length;
  const scheduled = promotions.filter((p) => p.status === 'SCHEDULED').length;
  const usedTotal = promotions.reduce((acc, p) => acc + p._count.discounts, 0);

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Akcije"
        subtitle="Motor akcija primjenjuje pravila redom prioriteta na svaku košaricu"
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Nova akcija</Button>}
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Aktivne akcije" value={String(active)} hint="trenutno se primjenjuju" />
        <StatTile label="Zakazane" value={String(scheduled)} hint="čekaju datum početka" />
        <StatTile label="Ukupno pravila" value={String(promotions.length)} />
        <StatTile label="Iskorišteno na računima" value={usedTotal.toLocaleString('hr-HR')} hint="broj primjena" />
      </div>

      <FilterBar
        searchPlaceholder="Naziv ili šifra akcije…"
        searchValue={params.q}
        activeCount={['q', 'status', 'type'].filter((k) => params[k]).length}
        selects={[
          {
            param: 'status',
            placeholder: 'Svi statusi',
            value: params.status,
            width: 150,
            options: Object.entries(PROMOTION_STATUS).map(([value, v]) => ({ value, label: v.label })),
          },
          {
            param: 'type',
            placeholder: 'Sve vrste',
            value: params.type,
            width: 180,
            options: Object.entries(PROMOTION_TYPE).map(([value, label]) => ({ value, label })),
          },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={110}>Šifra</TH>
              <TH>Naziv</TH>
              <TH width={150}>Vrsta</TH>
              <TH width={150}>Uvjet</TH>
              <TH width={150}>Vremenski prozor</TH>
              <TH numeric width={70}>Prior.</TH>
              <TH width={95}>Od</TH>
              <TH width={95}>Do</TH>
              <TH numeric width={80}>Primjena</TH>
              <TH width={130}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {promotions.map((promotion) => (
              <TR key={promotion.id}>
                <TD className="font-mono text-sm text-ink-3">{promotion.code}</TD>
                <TD>
                  <span className="font-medium">{promotion.name}</span>
                  {promotion.exclusive && <Badge tone="warning" className="ml-1.5">ekskluzivna</Badge>}
                  {promotion.requiresCoupon && <Badge tone="info" className="ml-1.5">kupon</Badge>}
                </TD>
                <TD className="text-ink-2">{PROMOTION_TYPE[promotion.type]}</TD>
                <TD className="font-medium text-accent">{describeValue(promotion)}</TD>
                <TD className="text-sm text-ink-3">
                  {describeWindow(promotion.dayOfWeekMask, promotion.startTime, promotion.endTime)}
                </TD>
                <TD numeric>{promotion.priority}</TD>
                <TD className="text-sm text-ink-3">{formatDate(promotion.startsAt)}</TD>
                <TD className="text-sm text-ink-3">{promotion.endsAt ? formatDate(promotion.endsAt) : '—'}</TD>
                <TD numeric>{promotion._count.discounts}</TD>
                <TD>
                  <Badge tone={PROMOTION_STATUS[promotion.status].tone} dot>
                    {PROMOTION_STATUS[promotion.status].label}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {promotions.length === 0 && (
          <EmptyState icon={<BadgePercent className="size-4" />} title="Nema akcija" description="Kreirajte prvu akciju ili promijenite filtre." />
        )}
      </Card>
    </div>
  );
}
