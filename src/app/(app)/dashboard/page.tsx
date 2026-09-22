import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, Boxes, Percent, Receipt, ShoppingBag, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  deltaPct, lowStockCount, previousRange, resolveRange, salesByCategory, salesByDay,
  salesByPaymentMethod, salesByStore, salesTotals, stockValue, topProducts,
} from '@/lib/services/analytics';
import { formatAmount, formatDateTime, formatMoney, formatPercent, formatQty } from '@/lib/format';
import { toNumber } from '@/lib/money';
import { Card, CardHeader, Badge, EmptyState, StatusDot } from '@/components/ui/primitives';
import { StatTile } from '@/components/charts/stat-tile';
import { TrendArea } from '@/components/charts/trend-area';
import { BarList } from '@/components/charts/bar-list';
import { ShareBar } from '@/components/charts/share-bar';
import { RangePicker } from '@/components/filters/range-picker';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export const metadata = { title: 'Nadzorna ploča' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; scope?: string }>;
}) {
  const params = await searchParams;
  const user = await requirePageAccess('dashboard.view');
  const preset = params.range ?? '30d';
  const range = resolveRange(preset);
  const previous = previousRange(range);

  const allStoreIds = await accessibleStoreIds(user);
  const scopeAll = params.scope === 'all' || !user.activeStoreId;
  const storeIds = scopeAll ? allStoreIds : [user.activeStoreId!];
  const scope = { tenantId: user.tenantId, storeIds };

  const [
    totals, prevTotals, byDay, byStore, byCategory, byPayment, products,
    stock, lowStock, openShifts, pendingFiscal, recentSales,
  ] = await Promise.all([
    salesTotals(scope, range),
    salesTotals(scope, previous),
    salesByDay(scope, range),
    salesByStore({ tenantId: user.tenantId, storeIds: allStoreIds }, range),
    salesByCategory(scope, range),
    salesByPaymentMethod(scope, range),
    topProducts(scope, range, 8),
    stockValue(storeIds),
    lowStockCount(storeIds),
    db.shift.count({ where: { tenantId: user.tenantId, storeId: { in: storeIds }, status: 'OPEN' } }),
    db.sale.count({ where: { tenantId: user.tenantId, fiscalStatus: 'FAILED' } }),
    db.sale.findMany({
      where: { tenantId: user.tenantId, storeId: { in: storeIds }, kind: 'RECEIPT' },
      orderBy: { issuedAt: 'desc' },
      take: 8,
      select: {
        id: true, number: true, total: true, issuedAt: true, fiscalStatus: true,
        store: { select: { name: true } },
        user: { select: { firstName: true, lastName: true } },
        _count: { select: { lines: true } },
      },
    }),
  ]);

  const stockMargin = stock.retail > 0 ? ((stock.retail / 1.25 - stock.cost) / (stock.retail / 1.25)) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1440px]">
      {/* Zaglavlje s filtrom razdoblja */}
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold leading-tight">Nadzorna ploča</h1>
          <p className="mt-0.5 text-sm text-ink-3">
            {scopeAll ? `Svih ${allStoreIds.length} lokacija` : 'Odabrana poslovnica'} ·{' '}
            {totals.salesCount.toLocaleString('hr-HR')} računa u razdoblju
          </p>
        </div>
        <RangePicker current={preset} scope={scopeAll ? 'all' : 'store'} />
      </div>

      {/* Upozorenja */}
      {(lowStock > 0 || pendingFiscal > 0) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {lowStock > 0 && (
            <Link
              href="/inventory/replenishment"
              className="flex items-center gap-2 rounded-lg bg-warning-soft px-2.5 py-1.5 text-base text-warning transition-opacity hover:opacity-85"
            >
              <AlertTriangle className="size-3.5" />
              <span className="font-medium">{lowStock}</span> artikala ispod minimalne zalihe
              <ArrowRight className="size-3" />
            </Link>
          )}
          {pendingFiscal > 0 && (
            <Link
              href="/sales/fiscal"
              className="flex items-center gap-2 rounded-lg bg-negative-soft px-2.5 py-1.5 text-base text-negative transition-opacity hover:opacity-85"
            >
              <AlertTriangle className="size-3.5" />
              <span className="font-medium">{pendingFiscal}</span> računa nije fiskalizirano
              <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
      )}

      {/* Ključni pokazatelji */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Promet (s PDV-om)"
          value={formatAmount(totals.gross, 0)}
          unit="€"
          deltaPct={deltaPct(totals.gross, prevTotals.gross)}
          deltaLabel="vs prethodno razdoblje"
          icon={<ShoppingBag className="size-3.5" />}
        />
        <StatTile
          label="Marža"
          value={formatAmount(totals.margin, 0)}
          unit="€"
          deltaPct={deltaPct(totals.margin, prevTotals.margin)}
          deltaLabel={`${formatPercent(totals.marginPct)} od neto`}
          icon={<TrendingUp className="size-3.5" />}
        />
        <StatTile
          label="Broj računa"
          value={totals.salesCount.toLocaleString('hr-HR')}
          deltaPct={deltaPct(totals.salesCount, prevTotals.salesCount)}
          deltaLabel="izdanih računa"
          icon={<Receipt className="size-3.5" />}
        />
        <StatTile
          label="Prosječna košarica"
          value={formatAmount(totals.avgBasket)}
          unit="€"
          deltaPct={deltaPct(totals.avgBasket, prevTotals.avgBasket)}
          deltaLabel={`${formatQty(totals.avgItems, 1)} art./računu`}
          icon={<Wallet className="size-3.5" />}
        />
        <StatTile
          label="Odobreni popusti"
          value={formatAmount(totals.discount, 0)}
          unit="€"
          deltaPct={deltaPct(totals.discount, prevTotals.discount)}
          deltaLabel="ukupno u razdoblju"
          invertDelta
          icon={<Percent className="size-3.5" />}
        />
        <StatTile
          label="Vrijednost zalihe"
          value={formatAmount(stock.cost, 0)}
          unit="€"
          deltaLabel={`${stock.skuCount} artikala · MPC ${formatAmount(stock.retail, 0)} €`}
          icon={<Boxes className="size-3.5" />}
        />
      </div>

      {/* Kretanje prometa */}
      <Card className="mb-3">
        <CardHeader
          title="Kretanje prometa"
          subtitle={`Dnevni promet s PDV-om · ukupno ${formatMoney(totals.gross)}`}
          actions={
            <div className="flex items-center gap-3 text-sm text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="h-[3px] w-4 rounded-full" style={{ background: 'var(--viz-1)' }} />
                Promet
              </span>
            </div>
          }
        />
        <TrendArea data={byDay} height={180} />
      </Card>

      {/* Tri stupca analitike */}
      <div className="mb-3 grid gap-2.5 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Poslovnice"
            subtitle="Cijeli lanac — promet u razdoblju"
            actions={
              <Link href="/reports/stores" className="text-sm text-accent hover:underline">
                Detaljnije
              </Link>
            }
          />
          <BarList
            items={byStore.slice(0, 9).map((s) => ({
              label: s.name,
              value: s.gross,
              meta: `${s.count}`,
              href: `/reports/stores?store=${s.storeId}`,
            }))}
          />
        </Card>

        <Card>
          <CardHeader title="Kategorije" subtitle="Najveći udio u prometu" />
          <BarList items={byCategory.map((c) => ({ label: c.name, value: c.total }))} />
        </Card>

        <Card>
          <CardHeader title="Načini plaćanja" subtitle="Raspodjela naplate" />
          <ShareBar segments={byPayment} />
          <div className="mt-3 space-y-1.5 border-t border-hairline pt-2.5">
            <div className="flex items-center justify-between text-base">
              <span className="text-ink-3">Otvorenih smjena</span>
              <span className="font-medium tnum">{openShifts}</span>
            </div>
            <div className="flex items-center justify-between text-base">
              <span className="text-ink-3">Kupaca s karticom vjernosti</span>
              <span className="font-medium tnum">{totals.customers}</span>
            </div>
            <div className="flex items-center justify-between text-base">
              <span className="text-ink-3">Ostvarena marža na zalihi</span>
              <span className="font-medium tnum">{formatPercent(stockMargin)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Najprodavaniji artikli i zadnji računi */}
      <div className="grid gap-2.5 lg:grid-cols-[1.15fr_1fr]">
        <Card padded={false}>
          <div className="p-3.5 pb-2">
            <CardHeader
              compact
              title="Najprodavaniji artikli"
              subtitle="Po vrijednosti prometa"
              actions={
                <Link href="/reports/products" className="text-sm text-accent hover:underline">
                  Svi artikli
                </Link>
              }
            />
          </div>
          <Table>
            <THead>
              <TR>
                <TH width={76}>Šifra</TH>
                <TH>Naziv</TH>
                <TH numeric width={70}>Kol.</TH>
                <TH numeric width={90}>Promet</TH>
                <TH numeric width={90}>Marža</TH>
              </TR>
            </THead>
            <TBody>
              {products.map((p) => (
                <TR key={p.variantId}>
                  <TD className="font-mono text-sm text-ink-3">{p.sku}</TD>
                  <TD className="truncate">{p.name}</TD>
                  <TD numeric>{formatQty(p.qty, 1)}</TD>
                  <TD numeric>{formatAmount(p.total)}</TD>
                  <TD numeric className="text-positive">{formatAmount(p.margin)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {products.length === 0 && (
            <EmptyState compact title="Nema prodaje u razdoblju" icon={<ShoppingBag className="size-4" />} />
          )}
        </Card>

        <Card padded={false}>
          <div className="p-3.5 pb-2">
            <CardHeader
              compact
              title="Posljednji računi"
              subtitle="Uživo s blagajni"
              actions={
                <Link href="/sales/receipts" className="text-sm text-accent hover:underline">
                  Svi računi
                </Link>
              }
            />
          </div>
          <Table>
            <THead>
              <TR>
                <TH width={100}>Broj</TH>
                <TH>Poslovnica</TH>
                <TH width={120}>Vrijeme</TH>
                <TH numeric width={80}>Iznos</TH>
                <TH width={28} />
              </TR>
            </THead>
            <TBody>
              {recentSales.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/sales/receipts/${s.id}`} className="font-mono text-sm text-accent hover:underline">
                      {s.number}
                    </Link>
                  </TD>
                  <TD className="truncate text-ink-2">{s.store.name}</TD>
                  <TD className="text-sm text-ink-3">{formatDateTime(s.issuedAt)}</TD>
                  <TD numeric className="font-medium">{formatAmount(toNumber(s.total))}</TD>
                  <TD>
                    <StatusDot
                      tone={
                        s.fiscalStatus === 'CONFIRMED' ? 'positive'
                          : s.fiscalStatus === 'FAILED' ? 'negative'
                          : s.fiscalStatus === 'NOT_REQUIRED' ? 'neutral' : 'warning'
                      }
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </div>

      <p className="mt-3 text-center text-2xs text-ink-4">
        Podaci osvježeni {formatDateTime(new Date())} · Prikaz uključuje samo dovršene račune
      </p>
      <span className="hidden">
        <Badge tone="info">{formatMoney(totals.net)}</Badge>
        <Users className="size-3" />
      </span>
    </div>
  );
}
