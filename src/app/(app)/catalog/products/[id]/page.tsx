import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Barcode, Boxes, Pencil, ShoppingCart, Tag, TrendingUp } from 'lucide-react';
import { accessibleStoreIds, requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { marginPct, markupPct, toNumber } from '@/lib/money';
import { formatAmount, formatDate, formatDateTime, formatPercent, formatQty } from '@/lib/format';
import { resolveRange } from '@/lib/ranges';
import { Badge, Card, CardHeader, DetailRow, EmptyState, PageHeader, Progress } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { BarList } from '@/components/charts/bar-list';

export const dynamic = 'force-dynamic';

const MOVEMENT_LABEL: Record<string, string> = {
  PURCHASE_RECEIPT: 'Primka', SALE: 'Prodaja', SALE_RETURN: 'Povrat kupca',
  SUPPLIER_RETURN: 'Povrat dobavljaču', TRANSFER_OUT: 'Izlaz — transfer',
  TRANSFER_IN: 'Ulaz — transfer', ADJUSTMENT_IN: 'Korekcija +', ADJUSTMENT_OUT: 'Korekcija −',
  WRITE_OFF: 'Otpis', STOCKTAKE: 'Inventura', PRODUCTION_IN: 'Sastavljanje',
  PRODUCTION_OUT: 'Rastavljanje', OWN_CONSUMPTION: 'Vlastita potrošnja', INITIAL: 'Početno stanje',
};

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission('product.view');
  const storeIds = await accessibleStoreIds(user);

  const product = await db.product.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      category: true,
      brand: true,
      unit: true,
      taxRate: true,
      variants: { include: { barcodes: true } },
      suppliers: { include: { supplier: { select: { id: true, name: true, code: true, leadTimeDays: true } } } },
    },
  });

  if (!product) notFound();

  const variantIds = product.variants.map((v) => v.id);
  const range = resolveRange('90d');

  const [priceItems, stockByStore, movements, salesStats, salesByStore] = await Promise.all([
    db.priceListItem.findMany({
      where: { variantId: { in: variantIds } },
      include: { priceList: { select: { code: true, name: true, type: true, pricesIncludeTax: true } } },
      orderBy: { priceList: { priority: 'desc' } },
    }),
    db.$queryRaw<{ storeName: string; warehouseName: string; qty: string; reserved: string; cost: string }[]>`
      SELECT st."name" AS "storeName", w."name" AS "warehouseName",
             si."quantity"::text AS qty, si."reserved"::text AS reserved, si."avgCost"::text AS cost
      FROM stock_items si
      JOIN warehouses w ON w."id" = si."warehouseId"
      JOIN stores st ON st."id" = w."storeId"
      WHERE si."variantId" = ANY(${variantIds}::text[]) AND st."id" = ANY(${storeIds}::text[])
      ORDER BY st."code"
    `,
    db.stockMovement.findMany({
      where: { variantId: { in: variantIds }, warehouse: { storeId: { in: storeIds } } },
      include: { warehouse: { include: { store: { select: { name: true } } } } },
      orderBy: { occurredAt: 'desc' },
      take: 20,
    }),
    db.$queryRaw<{ qty: string; total: string; margin: string; count: string }[]>`
      SELECT COALESCE(SUM(sl."quantity"), 0)::text AS qty,
             COALESCE(SUM(sl."lineTotal"), 0)::text AS total,
             COALESCE(SUM(sl."marginAmount"), 0)::text AS margin,
             COUNT(DISTINCT sl."saleId")::text AS count
      FROM sale_lines sl
      JOIN sales s ON s."id" = sl."saleId"
      WHERE sl."variantId" = ANY(${variantIds}::text[])
        AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
        AND s."storeId" = ANY(${storeIds}::text[])
    `,
    db.$queryRaw<{ name: string; qty: string; total: string }[]>`
      SELECT st."name", COALESCE(SUM(sl."quantity"), 0)::text AS qty,
             COALESCE(SUM(sl."lineTotal"), 0)::text AS total
      FROM sale_lines sl
      JOIN sales s ON s."id" = sl."saleId"
      JOIN stores st ON st."id" = s."storeId"
      WHERE sl."variantId" = ANY(${variantIds}::text[])
        AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
        AND st."id" = ANY(${storeIds}::text[])
      GROUP BY st."name" ORDER BY SUM(sl."lineTotal") DESC LIMIT 10
    `,
  ]);

  const totalStock = stockByStore.reduce((acc, s) => acc + Number(s.qty), 0);
  const avgCost =
    stockByStore.length > 0
      ? stockByStore.reduce((acc, s) => acc + Number(s.cost) * Number(s.qty), 0) / (totalStock || 1)
      : 0;
  const retailItem = priceItems.find((p) => p.priceList.type === 'RETAIL');
  const retailPrice = retailItem ? toNumber(retailItem.price) : 0;
  const taxRate = toNumber(product.taxRate?.rate ?? 0);
  const netPrice = retailPrice / (1 + taxRate / 100);
  const stats = salesStats[0];
  const soldQty = Number(stats?.qty ?? 0);
  const primarySupplier = product.suppliers.find((s) => s.isPrimary) ?? product.suppliers[0];

  return (
    <div className="mx-auto max-w-[1440px]">
      <Link href="/catalog/products" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3" /> Artikli
      </Link>

      <PageHeader
        title={product.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono">{product.sku}</span>
            {product.category && <>· {product.category.name}</>}
            {product.brand && <>· {product.brand.name}</>}
            <Badge tone={product.status === 'ACTIVE' ? 'positive' : 'warning'}>
              {product.status === 'ACTIVE' ? 'Aktivan' : product.status}
            </Badge>
          </span>
        }
        actions={
          <Button size="sm" variant="secondary" icon={<Pencil className="size-3.5" />}>
            Uredi artikl
          </Button>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <StatTile label="Maloprodajna cijena" value={formatAmount(retailPrice)} unit="€" hint={`PDV ${formatPercent(taxRate, 0)}`} icon={<Tag className="size-3.5" />} />
        <StatTile label="Nabavna cijena (PNC)" value={formatAmount(avgCost)} unit="€" hint="ponderirani prosjek" icon={<ShoppingCart className="size-3.5" />} />
        <StatTile label="Marža" value={formatPercent(marginPct(netPrice, avgCost), 1)} hint={`RUC ${formatPercent(markupPct(netPrice, avgCost), 1)}`} icon={<TrendingUp className="size-3.5" />} />
        <StatTile label="Ukupna zaliha" value={formatQty(totalStock, 1)} unit={product.unit?.code} hint={`${stockByStore.length} lokacija`} icon={<Boxes className="size-3.5" />} />
        <StatTile label="Prodano (90 dana)" value={formatQty(soldQty, 1)} unit={product.unit?.code} hint={`${formatAmount(Number(stats?.total ?? 0), 0)} € prometa`} />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-2.5">
          {/* Zaliha po lokacijama */}
          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Zaliha po lokacijama" subtitle="Trenutno stanje i rezervacije" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH>Poslovnica</TH>
                  <TH>Skladište</TH>
                  <TH numeric width={90}>Stanje</TH>
                  <TH numeric width={90}>Rezervirano</TH>
                  <TH numeric width={90}>PNC</TH>
                  <TH numeric width={100}>Vrijednost</TH>
                </TR>
              </THead>
              <TBody>
                {stockByStore.map((row, i) => (
                  <TR key={i}>
                    <TD className="font-medium">{row.storeName}</TD>
                    <TD className="text-ink-2">{row.warehouseName}</TD>
                    <TD numeric className={Number(row.qty) <= 0 ? 'text-negative' : ''}>{formatQty(Number(row.qty), 1)}</TD>
                    <TD numeric className="text-ink-3">{formatQty(Number(row.reserved), 1)}</TD>
                    <TD numeric className="text-ink-3">{formatAmount(Number(row.cost))}</TD>
                    <TD numeric>{formatAmount(Number(row.qty) * Number(row.cost))}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {stockByStore.length === 0 && <EmptyState compact title="Artikl nema zalihe" icon={<Boxes className="size-4" />} />}
          </Card>

          {/* Kartica artikla */}
          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader
                compact
                title="Kartica artikla"
                subtitle="Posljednjih 20 kretanja"
                actions={
                  <Link href={`/inventory/movements?variant=${variantIds[0]}`} className="text-sm text-accent hover:underline">
                    Cijela kartica
                  </Link>
                }
              />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={130}>Datum</TH>
                  <TH width={140}>Vrsta</TH>
                  <TH>Lokacija</TH>
                  <TH width={110}>Dokument</TH>
                  <TH numeric width={80}>Količina</TH>
                  <TH numeric width={80}>Stanje</TH>
                  <TH numeric width={80}>Cijena</TH>
                </TR>
              </THead>
              <TBody>
                {movements.map((m) => {
                  const qty = toNumber(m.quantity);
                  return (
                    <TR key={m.id}>
                      <TD className="text-sm text-ink-3">{formatDateTime(m.occurredAt)}</TD>
                      <TD>
                        <Badge tone={qty > 0 ? 'positive' : 'neutral'}>{MOVEMENT_LABEL[m.type] ?? m.type}</Badge>
                      </TD>
                      <TD className="truncate text-ink-2">{m.warehouse.store.name} · {m.warehouse.name}</TD>
                      <TD className="font-mono text-xs text-ink-4">{m.refNumber ?? '—'}</TD>
                      <TD numeric className={qty > 0 ? 'text-positive' : 'text-negative'}>
                        {qty > 0 ? '+' : ''}{formatQty(qty, 1)}
                      </TD>
                      <TD numeric>{formatQty(toNumber(m.balanceAfter), 1)}</TD>
                      <TD numeric className="text-ink-3">{formatAmount(toNumber(m.unitCost))}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            {movements.length === 0 && <EmptyState compact title="Nema knjiženih kretanja" />}
          </Card>

          {/* Prodaja po poslovnicama */}
          <Card>
            <CardHeader title="Prodaja po poslovnicama" subtitle="Posljednjih 90 dana" />
            <BarList items={salesByStore.map((s) => ({ label: s.name, value: Number(s.total), meta: formatQty(Number(s.qty), 0) }))} />
          </Card>
        </div>

        {/* Bočni stupac */}
        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Podaci artikla" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Šifra">{product.sku}</DetailRow>
              <DetailRow label="Vrsta">{product.type}</DetailRow>
              <DetailRow label="Jedinica mjere">{product.unit?.name ?? '—'}</DetailRow>
              <DetailRow label="Porezna stopa">{product.taxRate?.name ?? '—'}</DetailRow>
              <DetailRow label="Povratna naknada">
                {toNumber(product.depositAmount) > 0 ? `${formatAmount(toNumber(product.depositAmount))} €` : '—'}
              </DetailRow>
              <DetailRow label="Zemlja podrijetla">{product.countryOfOrigin ?? '—'}</DetailRow>
              <DetailRow label="Dobna granica">{product.ageRestriction ? `${product.ageRestriction}+` : '—'}</DetailRow>
              <DetailRow label="Popust dozvoljen">{product.allowDiscount ? 'Da' : 'Ne'}</DetailRow>
              <DetailRow label="Praćenje roka">{product.trackExpiry ? 'Da' : 'Ne'}</DetailRow>
              <DetailRow label="Objavljen na webu">{product.publishedWeb ? 'Da' : 'Ne'}</DetailRow>
              <DetailRow label="Kreiran">{formatDate(product.createdAt)}</DetailRow>
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Cijene po cjenicima" />
            <div className="divide-y divide-hairline">
              {priceItems.map((item) => (
                <DetailRow key={item.id} label={item.priceList.name}>
                  <span className="font-mono tnum">{formatAmount(toNumber(item.price))} €</span>
                  <span className="ml-1 text-2xs text-ink-4">{item.priceList.pricesIncludeTax ? 's PDV' : 'bez PDV'}</span>
                </DetailRow>
              ))}
              {priceItems.length === 0 && <p className="py-3 text-center text-sm text-ink-4">Artikl nije u cjeniku</p>}
            </div>
            {retailItem?.lowestPrice30d && (
              <p className="mt-2 rounded-md bg-surface-2 px-2 py-1.5 text-2xs text-ink-3">
                Najniža cijena u 30 dana: {formatAmount(toNumber(retailItem.lowestPrice30d))} € — prikazuje se
                uz akcijsku cijenu (EU Omnibus).
              </p>
            )}
          </Card>

          <Card>
            <CardHeader compact title="Barkodovi" actions={<Barcode className="size-3.5 text-ink-4" />} />
            <div className="space-y-1">
              {product.variants.flatMap((v) =>
                v.barcodes.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2 rounded-sm bg-surface-2 px-2 py-1">
                    <span className="font-mono text-sm">{b.code}</span>
                    <span className="flex items-center gap-1.5">
                      <Badge tone="neutral">{b.type}</Badge>
                      {b.isPrimary && <Badge tone="accent">glavni</Badge>}
                    </span>
                  </div>
                )),
              )}
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Dobavljači" />
            <div className="space-y-2">
              {product.suppliers.map((ps) => (
                <div key={ps.id} className="rounded-md bg-surface-2 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/catalog/suppliers/${ps.supplier.id}`} className="truncate text-base font-medium hover:text-accent">
                      {ps.supplier.name}
                    </Link>
                    {ps.isPrimary && <Badge tone="accent">primarni</Badge>}
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-1 text-2xs text-ink-3">
                    <span>NC: <b className="text-ink-2">{formatAmount(toNumber(ps.purchasePrice))} €</b></span>
                    <span>Rabat: {formatPercent(toNumber(ps.discountPct), 0)}</span>
                    <span>Rok: {ps.leadTimeDays ?? ps.supplier.leadTimeDays} d</span>
                  </div>
                </div>
              ))}
              {product.suppliers.length === 0 && <p className="text-sm text-ink-4">Nije povezan s dobavljačem.</p>}
            </div>
            {primarySupplier && (
              <div className="mt-2.5">
                <p className="mb-1 text-2xs text-ink-4">Udio marže u prodajnoj cijeni</p>
                <Progress value={marginPct(netPrice, avgCost)} tone="positive" />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
