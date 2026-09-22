import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatAmount, formatPercent, formatQty } from '@/lib/format';
import { Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { BarList } from '@/components/charts/bar-list';

export const metadata = { title: 'Vrijednost zaliha' };
export const dynamic = 'force-dynamic';

export default async function StockReportPage() {
  const user = await requirePageAccess('report.stock');
  const storeIds = await accessibleStoreIds(user);

  const [byStore, byCategory] = await Promise.all([
    db.$queryRaw<{ name: string; code: string; qty: string; cost: string; retail: string; skus: string }[]>`
      SELECT st."name", st."code",
             COALESCE(SUM(si."quantity"), 0)::text AS qty,
             COALESCE(SUM(si."quantity" * si."avgCost"), 0)::text AS cost,
             COALESCE(SUM(si."quantity" * COALESCE(pli."price", 0)), 0)::text AS retail,
             COUNT(DISTINCT si."variantId")::text AS skus
      FROM stores st
      JOIN warehouses w ON w."storeId" = st."id"
      LEFT JOIN stock_items si ON si."warehouseId" = w."id" AND si."quantity" > 0
      LEFT JOIN price_list_items pli ON pli."variantId" = si."variantId"
        AND pli."priceListId" = (SELECT "id" FROM price_lists WHERE "tenantId" = ${user.tenantId} AND "isDefault" = true LIMIT 1)
      WHERE st."id" = ANY(${storeIds}::text[])
      GROUP BY st."id", st."name", st."code"
      ORDER BY SUM(si."quantity" * si."avgCost") DESC NULLS LAST
    `,
    db.$queryRaw<{ name: string; qty: string; cost: string; retail: string; skus: string }[]>`
      SELECT COALESCE(parent."name", c."name", 'Bez kategorije') AS name,
             COALESCE(SUM(si."quantity"), 0)::text AS qty,
             COALESCE(SUM(si."quantity" * si."avgCost"), 0)::text AS cost,
             COALESCE(SUM(si."quantity" * COALESCE(pli."price", 0)), 0)::text AS retail,
             COUNT(DISTINCT si."variantId")::text AS skus
      FROM stock_items si
      JOIN warehouses w ON w."id" = si."warehouseId"
      JOIN product_variants pv ON pv."id" = si."variantId"
      JOIN products p ON p."id" = pv."productId"
      LEFT JOIN categories c ON c."id" = p."categoryId"
      LEFT JOIN categories parent ON parent."id" = c."parentId"
      LEFT JOIN price_list_items pli ON pli."variantId" = si."variantId"
        AND pli."priceListId" = (SELECT "id" FROM price_lists WHERE "tenantId" = ${user.tenantId} AND "isDefault" = true LIMIT 1)
      WHERE w."storeId" = ANY(${storeIds}::text[]) AND si."quantity" > 0
      GROUP BY COALESCE(parent."name", c."name", 'Bez kategorije')
      ORDER BY SUM(si."quantity" * si."avgCost") DESC
    `,
  ]);

  const totalCost = byStore.reduce((acc, s) => acc + Number(s.cost), 0);
  const totalRetail = byStore.reduce((acc, s) => acc + Number(s.retail), 0);
  const totalQty = byStore.reduce((acc, s) => acc + Number(s.qty), 0);
  const potentialMargin = totalRetail / 1.25 - totalCost;

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Vrijednost zaliha"
        subtitle="Trenutno stanje po nabavnoj i maloprodajnoj cijeni — presjek na današnji dan"
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Vrijednost po NC" value={formatAmount(totalCost, 0)} unit="€" />
        <StatTile label="Vrijednost po MPC" value={formatAmount(totalRetail, 0)} unit="€" />
        <StatTile label="Potencijalna marža" value={formatAmount(potentialMargin, 0)} unit="€" hint={formatPercent(totalRetail > 0 ? (potentialMargin / (totalRetail / 1.25)) * 100 : 0)} />
        <StatTile label="Ukupna količina" value={formatQty(totalQty, 0)} unit="jed." />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        <Card padded={false}>
          <div className="p-3.5 pb-2">
            <CardHeader compact title="Po poslovnicama" subtitle="Vrijednost po nabavnoj cijeni" />
          </div>
          <Table>
            <THead>
              <TR>
                <TH width={50}>Šifra</TH>
                <TH>Poslovnica</TH>
                <TH numeric width={80}>Artikala</TH>
                <TH numeric width={110}>NC</TH>
                <TH numeric width={110}>MPC</TH>
                <TH numeric width={80}>Udio</TH>
              </TR>
            </THead>
            <TBody>
              {byStore.map((row) => (
                <TR key={row.code}>
                  <TD className="font-mono text-sm text-ink-3">{row.code}</TD>
                  <TD className="truncate font-medium">{row.name}</TD>
                  <TD numeric>{row.skus}</TD>
                  <TD numeric className="font-medium">{formatAmount(Number(row.cost), 0)}</TD>
                  <TD numeric className="text-ink-2">{formatAmount(Number(row.retail), 0)}</TD>
                  <TD numeric className="text-ink-3">
                    {formatPercent(totalCost > 0 ? (Number(row.cost) / totalCost) * 100 : 0)}
                  </TD>
                </TR>
              ))}
            </TBody>
            <TFootRow>
              <TD colSpan={3}>Ukupno</TD>
              <TD numeric>{formatAmount(totalCost, 0)}</TD>
              <TD numeric>{formatAmount(totalRetail, 0)}</TD>
              <TD />
            </TFootRow>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Po kategorijama" subtitle="Vrijednost po nabavnoj cijeni" />
          <BarList items={byCategory.map((c) => ({ label: c.name, value: Number(c.cost), meta: c.skus }))} />
        </Card>
      </div>
    </div>
  );
}
