import Link from 'next/link';
import { Package, Plus, Upload } from 'lucide-react';
import { Prisma } from '@prisma/client';
import { accessibleStoreIds, requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber, marginPct } from '@/lib/money';
import { formatAmount, formatPercent, formatQty } from '@/lib/format';
import { hasPermission } from '@/lib/permissions';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/navigation';
import { FilterBar } from '@/components/filters/filter-bar';

export const metadata = { title: 'Artikli' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 40;

const STATUS_TONE = {
  ACTIVE: 'positive',
  DISCONTINUED: 'warning',
  ARCHIVED: 'neutral',
  DRAFT: 'info',
} as const;

const STATUS_LABEL = {
  ACTIVE: 'Aktivan',
  DISCONTINUED: 'U rasprodaji',
  ARCHIVED: 'Arhiviran',
  DRAFT: 'Nacrt',
} as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('product.view');
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.ProductWhereInput = {
    tenantId: user.tenantId,
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: 'insensitive' } },
            { sku: { contains: params.q, mode: 'insensitive' } },
            { variants: { some: { barcodes: { some: { code: { startsWith: params.q } } } } } },
          ],
        }
      : {}),
    ...(params.category ? { categoryId: params.category } : {}),
    ...(params.brand ? { brandId: params.brand } : {}),
    ...(params.status ? { status: params.status as Prisma.EnumProductStatusFilter['equals'] } : {}),
    ...(params.supplier ? { suppliers: { some: { supplierId: params.supplier } } } : {}),
  };

  const storeIds = await accessibleStoreIds(user);

  const [total, products, categories, brands, suppliers, defaultList] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        unit: { select: { code: true } },
        taxRate: { select: { rate: true } },
        variants: {
          select: { id: true, sku: true, barcodes: { where: { isPrimary: true }, select: { code: true }, take: 1 } },
        },
      },
      orderBy: [{ name: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.category.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true, level: true }, orderBy: { path: 'asc' } }),
    db.brand.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.supplier.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.priceList.findFirst({ where: { tenantId: user.tenantId, isDefault: true }, select: { id: true } }),
  ]);

  const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));

  const [prices, stockRows] = await Promise.all([
    defaultList
      ? db.priceListItem.findMany({
          where: { priceListId: defaultList.id, variantId: { in: variantIds } },
          select: { variantId: true, price: true },
        })
      : Promise.resolve([]),
    variantIds.length > 0
      ? db.$queryRaw<{ variantId: string; qty: string; cost: string }[]>`
          SELECT si."variantId",
                 COALESCE(SUM(si."quantity"), 0)::text AS qty,
                 COALESCE(AVG(NULLIF(si."avgCost", 0)), 0)::text AS cost
          FROM stock_items si
          JOIN warehouses w ON w."id" = si."warehouseId"
          WHERE si."variantId" = ANY(${variantIds}::text[])
            AND w."storeId" = ANY(${storeIds}::text[])
          GROUP BY si."variantId"
        `
      : Promise.resolve([]),
  ]);

  const priceMap = new Map(prices.map((p) => [p.variantId, toNumber(p.price)]));
  const stockMap = new Map(stockRows.map((r) => [r.variantId, { qty: Number(r.qty), cost: Number(r.cost) }]));
  const canEdit = hasPermission(user.permissions, 'product.create');

  const activeFilters = ['q', 'category', 'brand', 'status', 'supplier'].filter((k) => params[k]).length;

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Artikli"
        subtitle={`${total.toLocaleString('hr-HR')} artikala u katalogu`}
        actions={
          canEdit ? (
            <>
              <Button size="sm" variant="secondary" icon={<Upload className="size-3.5" />}>
                Uvoz
              </Button>
              <Link href="/catalog/products/new">
                <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>
                  Novi artikl
                </Button>
              </Link>
            </>
          ) : null
        }
      />

      <FilterBar
        searchPlaceholder="Naziv, šifra ili barkod…"
        searchValue={params.q}
        activeCount={activeFilters}
        selects={[
          {
            param: 'category',
            placeholder: 'Sve kategorije',
            value: params.category,
            width: 180,
            options: categories.map((c) => ({ value: c.id, label: `${'  '.repeat(c.level)}${c.name}` })),
          },
          {
            param: 'brand',
            placeholder: 'Svi brendovi',
            value: params.brand,
            width: 150,
            options: brands.map((b) => ({ value: b.id, label: b.name })),
          },
          {
            param: 'supplier',
            placeholder: 'Svi dobavljači',
            value: params.supplier,
            width: 180,
            options: suppliers.map((s) => ({ value: s.id, label: s.name })),
          },
          {
            param: 'status',
            placeholder: 'Svi statusi',
            value: params.status,
            width: 140,
            options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
          },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={70}>Šifra</TH>
              <TH width={118}>Barkod</TH>
              <TH>Naziv</TH>
              <TH width={130}>Kategorija</TH>
              <TH width={100}>Brend</TH>
              <TH numeric width={80}>Zaliha</TH>
              <TH numeric width={80}>Nab. cij.</TH>
              <TH numeric width={80}>MPC</TH>
              <TH numeric width={64}>Marža</TH>
              <TH width={92}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {products.map((product) => {
              const variant = product.variants[0];
              const price = variant ? (priceMap.get(variant.id) ?? 0) : 0;
              const stock = variant ? stockMap.get(variant.id) : undefined;
              const taxRate = toNumber(product.taxRate?.rate ?? 0);
              const net = price / (1 + taxRate / 100);
              const margin = stock?.cost ? marginPct(net, stock.cost) : 0;

              return (
                <TR key={product.id}>
                  <TD className="font-mono text-sm text-ink-3">{product.sku}</TD>
                  <TD className="font-mono text-xs text-ink-4">{variant?.barcodes[0]?.code ?? '—'}</TD>
                  <TD>
                    <Link href={`/catalog/products/${product.id}`} className="font-medium hover:text-accent hover:underline">
                      {product.name}
                    </Link>
                    {product.type === 'WEIGHTED' && (
                      <Badge tone="info" className="ml-1.5">vaga</Badge>
                    )}
                    {product.ageRestriction && (
                      <Badge tone="warning" className="ml-1.5">{product.ageRestriction}+</Badge>
                    )}
                  </TD>
                  <TD className="truncate text-ink-2">{product.category?.name ?? '—'}</TD>
                  <TD className="truncate text-ink-2">{product.brand?.name ?? '—'}</TD>
                  <TD numeric className={stock && stock.qty <= 0 ? 'text-negative' : ''}>
                    {stock ? formatQty(stock.qty, 1) : '0'}
                    <span className="ml-0.5 text-2xs text-ink-4">{product.unit?.code}</span>
                  </TD>
                  <TD numeric className="text-ink-3">{stock?.cost ? formatAmount(stock.cost) : '—'}</TD>
                  <TD numeric className="font-medium">{formatAmount(price)}</TD>
                  <TD numeric className={margin >= 20 ? 'text-positive' : margin > 0 ? 'text-warning' : 'text-ink-4'}>
                    {margin ? formatPercent(margin, 0) : '—'}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[product.status]}>{STATUS_LABEL[product.status]}</Badge>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>

        {products.length === 0 && (
          <EmptyState
            icon={<Package className="size-4" />}
            title="Nema artikala"
            description="Promijenite filtre ili dodajte prvi artikl u katalog."
          />
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
      </Card>
    </div>
  );
}
