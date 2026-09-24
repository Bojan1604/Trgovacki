import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds, resolveStoreScope } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatAmount, formatQty } from '@/lib/format';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ExportButton } from '@/components/ui/export-button';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/navigation';
import { FilterBar } from '@/components/filters/filter-bar';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Stanje zaliha' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

interface StockRow {
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  categoryName: string | null;
  unit: string | null;
  qty: string;
  reserved: string;
  avgCost: string;
  value: string;
  price: string;
  locations: number;
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePageAccess('stock.view');
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const allStores = await accessibleStoreIds(user);
  const { storeIds, storeId: selectedStoreId } = await resolveStoreScope(user, params.store);
  const search = params.q ? `%${params.q}%` : null;
  const onlyNegative = params.filter === 'negative';
  const onlyZero = params.filter === 'zero';

  const [stores, categories] = await Promise.all([
    db.store.findMany({ where: { id: { in: allStores } }, select: { id: true, name: true }, orderBy: { code: 'asc' } }),
    db.category.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true, level: true }, orderBy: { path: 'asc' } }),
  ]);

  const rows = await db.$queryRaw<StockRow[]>`
    SELECT pv."id" AS "variantId", p."id" AS "productId", pv."sku", p."name",
           c."name" AS "categoryName", u."code" AS unit,
           COALESCE(SUM(si."quantity"), 0)::text AS qty,
           COALESCE(SUM(si."reserved"), 0)::text AS reserved,
           COALESCE(AVG(NULLIF(si."avgCost", 0)), 0)::text AS "avgCost",
           COALESCE(SUM(si."quantity" * si."avgCost"), 0)::text AS value,
           COALESCE(MAX(pli."price"), 0)::text AS price,
           COUNT(DISTINCT si."warehouseId")::int AS locations
    FROM stock_items si
    JOIN warehouses w ON w."id" = si."warehouseId"
    JOIN product_variants pv ON pv."id" = si."variantId"
    JOIN products p ON p."id" = pv."productId"
    LEFT JOIN categories c ON c."id" = p."categoryId"
    LEFT JOIN units_of_measure u ON u."id" = p."unitId"
    LEFT JOIN price_list_items pli ON pli."variantId" = pv."id"
      AND pli."priceListId" = (SELECT "id" FROM price_lists WHERE "tenantId" = ${user.tenantId} AND "isDefault" = true LIMIT 1)
    WHERE w."storeId" = ANY(${storeIds}::text[])
      AND (${search}::text IS NULL OR p."name" ILIKE ${search} OR pv."sku" ILIKE ${search})
      AND (${params.category ?? null}::text IS NULL OR p."categoryId" = ${params.category ?? null})
    GROUP BY pv."id", p."id", pv."sku", p."name", c."name", u."code"
    HAVING (${onlyNegative} = false OR SUM(si."quantity") < 0)
       AND (${onlyZero} = false OR SUM(si."quantity") = 0)
    ORDER BY SUM(si."quantity" * si."avgCost") DESC
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `;

  const totals = await db.$queryRaw<{ skus: string; qty: string; value: string; retail: string }[]>`
    SELECT COUNT(DISTINCT si."variantId")::text AS skus,
           COALESCE(SUM(si."quantity"), 0)::text AS qty,
           COALESCE(SUM(si."quantity" * si."avgCost"), 0)::text AS value,
           COALESCE(SUM(si."quantity" * COALESCE(pli."price", 0)), 0)::text AS retail
    FROM stock_items si
    JOIN warehouses w ON w."id" = si."warehouseId"
    LEFT JOIN price_list_items pli ON pli."variantId" = si."variantId"
      AND pli."priceListId" = (SELECT "id" FROM price_lists WHERE "tenantId" = ${user.tenantId} AND "isDefault" = true LIMIT 1)
    WHERE w."storeId" = ANY(${storeIds}::text[])
  `;

  const summary = totals[0];
  const totalSkus = Number(summary?.skus ?? 0);
  const pageValue = rows.reduce((acc, r) => acc + Number(r.value), 0);

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Stanje zaliha"
        subtitle={selectedStoreId ? 'Odabrana poslovnica' : `Zbirno za ${allStores.length} lokacija`}
        actions={<ExportButton filename="stanje-zaliha" />}
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Artikala na zalihi" value={totalSkus.toLocaleString('hr-HR')} />
        <StatTile label="Ukupna količina" value={formatQty(Number(summary?.qty ?? 0), 0)} unit="jed." />
        <StatTile label="Vrijednost po NC" value={formatAmount(Number(summary?.value ?? 0), 0)} unit="€" />
        <StatTile label="Vrijednost po MPC" value={formatAmount(Number(summary?.retail ?? 0), 0)} unit="€" />
      </div>

      <FilterBar
        searchPlaceholder="Naziv ili šifra artikla…"
        searchValue={params.q}
        activeCount={['q', 'store', 'category', 'filter'].filter((k) => params[k]).length}
        selects={[
          { param: 'store', placeholder: 'Sve poslovnice', value: selectedStoreId ?? '', width: 170, options: stores.map((s) => ({ value: s.id, label: s.name })) },
          { param: 'category', placeholder: 'Sve kategorije', value: params.category, width: 180, options: categories.map((c) => ({ value: c.id, label: `${'  '.repeat(c.level)}${c.name}` })) },
          {
            param: 'filter',
            placeholder: 'Sve zalihe',
            value: params.filter,
            width: 160,
            options: [
              { value: 'negative', label: 'Negativna zaliha' },
              { value: 'zero', label: 'Bez zalihe' },
            ],
          },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={80}>Šifra</TH>
              <TH>Naziv</TH>
              <TH width={150}>Kategorija</TH>
              <TH numeric width={60}>Lok.</TH>
              <TH numeric width={90}>Stanje</TH>
              <TH numeric width={90}>Rezervirano</TH>
              <TH numeric width={90}>Raspoloživo</TH>
              <TH numeric width={90}>NC</TH>
              <TH numeric width={90}>MPC</TH>
              <TH numeric width={110}>Vrijednost</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => {
              const qty = Number(row.qty);
              const reserved = Number(row.reserved);
              return (
                <TR key={row.variantId}>
                  <TD className="font-mono text-sm text-ink-3">{row.sku}</TD>
                  <TD>
                    <Link href={`/catalog/products/${row.productId}`} className="hover:text-accent hover:underline">
                      {row.name}
                    </Link>
                  </TD>
                  <TD className="truncate text-ink-2">{row.categoryName ?? '—'}</TD>
                  <TD numeric className="text-ink-3">{row.locations}</TD>
                  <TD numeric className={qty < 0 ? 'text-negative font-medium' : qty === 0 ? 'text-ink-4' : ''}>
                    {formatQty(qty, 1)}
                    <span className="ml-0.5 text-2xs text-ink-4">{row.unit}</span>
                  </TD>
                  <TD numeric className="text-ink-3">{reserved > 0 ? formatQty(reserved, 1) : '—'}</TD>
                  <TD numeric>{formatQty(qty - reserved, 1)}</TD>
                  <TD numeric className="text-ink-3">{formatAmount(Number(row.avgCost))}</TD>
                  <TD numeric>{formatAmount(Number(row.price))}</TD>
                  <TD numeric className="font-medium">{formatAmount(Number(row.value))}</TD>
                </TR>
              );
            })}
          </TBody>
          <TFootRow>
            <TD colSpan={9}>Zbroj prikazane stranice</TD>
            <TD numeric>{formatAmount(pageValue)}</TD>
          </TFootRow>
        </Table>
        {rows.length === 0 && <EmptyState icon={<Boxes className="size-4" />} title="Nema zaliha za zadane filtre" />}
        <Pagination page={page} pageSize={PAGE_SIZE} total={totalSkus} />
      </Card>
    </div>
  );
}
