import 'server-only';
import { db } from '../db';
import { round, roundAmount } from '../money';
import type { PeriodRange } from '../ranges';

export { RANGE_PRESETS, previousRange, resolveRange, deltaPct } from '../ranges';
export type { PeriodRange } from '../ranges';


interface Scope {
  tenantId: string;
  storeIds: string[];
}

/** Zbirni pokazatelji prodaje za razdoblje. */
export async function salesTotals(scope: Scope, range: PeriodRange) {
  const rows = await db.$queryRaw<
    {
      sales: string; gross: string; net: string; tax: string;
      discount: string; cost: string; margin: string; items: string; customers: string;
    }[]
  >`
    SELECT COUNT(*)::text AS sales,
           COALESCE(SUM(s."total"), 0)::text AS gross,
           COALESCE(SUM(s."total" - s."taxTotal"), 0)::text AS net,
           COALESCE(SUM(s."taxTotal"), 0)::text AS tax,
           COALESCE(SUM(s."discountTotal"), 0)::text AS discount,
           COALESCE(SUM(s."costTotal"), 0)::text AS cost,
           COALESCE(SUM(s."marginTotal"), 0)::text AS margin,
           COALESCE((SELECT SUM(sl."quantity") FROM sale_lines sl
                     JOIN sales s2 ON s2."id" = sl."saleId"
                     WHERE s2."storeId" = ANY(${scope.storeIds}::text[])
                       AND s2."issuedAt" BETWEEN ${range.from} AND ${range.to}
                       AND s2."status" IN ('COMPLETED','PARTIALLY_REFUNDED')), 0)::text AS items,
           COUNT(DISTINCT s."customerId")::text AS customers
    FROM sales s
    WHERE s."tenantId" = ${scope.tenantId}
      AND s."storeId" = ANY(${scope.storeIds}::text[])
      AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
      AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
      AND s."kind" = 'RECEIPT'
  `;

  const r = rows[0];
  const salesCount = Number(r?.sales ?? 0);
  const gross = Number(r?.gross ?? 0);

  return {
    salesCount,
    gross: roundAmount(gross),
    net: roundAmount(Number(r?.net ?? 0)),
    tax: roundAmount(Number(r?.tax ?? 0)),
    discount: roundAmount(Number(r?.discount ?? 0)),
    cost: roundAmount(Number(r?.cost ?? 0)),
    margin: roundAmount(Number(r?.margin ?? 0)),
    items: round(Number(r?.items ?? 0), 2),
    customers: Number(r?.customers ?? 0),
    avgBasket: salesCount > 0 ? roundAmount(gross / salesCount) : 0,
    avgItems: salesCount > 0 ? round(Number(r?.items ?? 0) / salesCount, 2) : 0,
    marginPct: gross > 0 ? round((Number(r?.margin ?? 0) / Number(r?.net ?? 1)) * 100, 1) : 0,
  };
}

/** Promet po danima — za grafikon kretanja. */
export async function salesByDay(scope: Scope, range: PeriodRange) {
  const rows = await db.$queryRaw<{ day: Date; gross: string; margin: string; count: string }[]>`
    SELECT DATE_TRUNC('day', s."issuedAt") AS day,
           COALESCE(SUM(s."total"), 0)::text AS gross,
           COALESCE(SUM(s."marginTotal"), 0)::text AS margin,
           COUNT(*)::text AS count
    FROM sales s
    WHERE s."tenantId" = ${scope.tenantId}
      AND s."storeId" = ANY(${scope.storeIds}::text[])
      AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
      AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((r) => ({
    date: r.day.toISOString(),
    value: roundAmount(Number(r.gross)),
    secondaryValue: roundAmount(Number(r.margin)),
    secondaryLabel: 'Marža',
    count: Number(r.count),
  }));
}

/** Promet po satu u danu — raspored smjena i gužvi. */
export async function salesByHour(scope: Scope, range: PeriodRange) {
  const rows = await db.$queryRaw<{ hour: number; gross: string; count: string }[]>`
    SELECT EXTRACT(HOUR FROM s."issuedAt")::int AS hour,
           COALESCE(SUM(s."total"), 0)::text AS gross,
           COUNT(*)::text AS count
    FROM sales s
    WHERE s."tenantId" = ${scope.tenantId}
      AND s."storeId" = ANY(${scope.storeIds}::text[])
      AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
      AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
    GROUP BY 1 ORDER BY 1
  `;
  return rows.map((r) => ({ hour: r.hour, gross: roundAmount(Number(r.gross)), count: Number(r.count) }));
}

/** Usporedba poslovnica. */
export async function salesByStore(scope: Scope, range: PeriodRange) {
  const rows = await db.$queryRaw<
    { storeId: string; name: string; code: string; gross: string; count: string; margin: string }[]
  >`
    SELECT st."id" AS "storeId", st."name", st."code",
           COALESCE(SUM(s."total"), 0)::text AS gross,
           COUNT(s."id")::text AS count,
           COALESCE(SUM(s."marginTotal"), 0)::text AS margin
    FROM stores st
    LEFT JOIN sales s ON s."storeId" = st."id"
      AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
      AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
    WHERE st."id" = ANY(${scope.storeIds}::text[])
    GROUP BY st."id", st."name", st."code"
    ORDER BY SUM(s."total") DESC NULLS LAST
  `;
  return rows.map((r) => ({
    storeId: r.storeId,
    name: r.name,
    code: r.code,
    gross: roundAmount(Number(r.gross)),
    margin: roundAmount(Number(r.margin)),
    count: Number(r.count),
  }));
}

/** Najprodavaniji artikli. */
export async function topProducts(scope: Scope, range: PeriodRange, limit = 10) {
  return (
    await db.$queryRaw<
      { variantId: string; sku: string; name: string; qty: string; total: string; margin: string }[]
    >`
      SELECT sl."variantId", sl."sku", sl."name",
             COALESCE(SUM(sl."quantity"), 0)::text AS qty,
             COALESCE(SUM(sl."lineTotal"), 0)::text AS total,
             COALESCE(SUM(sl."marginAmount"), 0)::text AS margin
      FROM sale_lines sl
      JOIN sales s ON s."id" = sl."saleId"
      WHERE s."tenantId" = ${scope.tenantId}
        AND s."storeId" = ANY(${scope.storeIds}::text[])
        AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
        AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
      GROUP BY sl."variantId", sl."sku", sl."name"
      ORDER BY SUM(sl."lineTotal") DESC
      LIMIT ${limit}
    `
  ).map((r) => ({
    variantId: r.variantId,
    sku: r.sku,
    name: r.name,
    qty: round(Number(r.qty), 2),
    total: roundAmount(Number(r.total)),
    margin: roundAmount(Number(r.margin)),
  }));
}

/** Promet po kategorijama. */
export async function salesByCategory(scope: Scope, range: PeriodRange, limit = 8) {
  return (
    await db.$queryRaw<{ name: string; total: string; qty: string }[]>`
      SELECT COALESCE(c."name", 'Bez kategorije') AS name,
             COALESCE(SUM(sl."lineTotal"), 0)::text AS total,
             COALESCE(SUM(sl."quantity"), 0)::text AS qty
      FROM sale_lines sl
      JOIN sales s ON s."id" = sl."saleId"
      JOIN product_variants pv ON pv."id" = sl."variantId"
      JOIN products p ON p."id" = pv."productId"
      LEFT JOIN categories c ON c."id" = p."categoryId"
      WHERE s."tenantId" = ${scope.tenantId}
        AND s."storeId" = ANY(${scope.storeIds}::text[])
        AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
        AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
      GROUP BY c."name"
      ORDER BY SUM(sl."lineTotal") DESC
      LIMIT ${limit}
    `
  ).map((r) => ({ name: r.name, total: roundAmount(Number(r.total)), qty: round(Number(r.qty), 2) }));
}

/** Raspodjela po načinima plaćanja. */
export async function salesByPaymentMethod(scope: Scope, range: PeriodRange) {
  return (
    await db.$queryRaw<{ name: string; type: string; total: string; count: string }[]>`
      SELECT pm."name", pm."type",
             COALESCE(SUM(p."amount"), 0)::text AS total,
             COUNT(*)::text AS count
      FROM payments p
      JOIN payment_methods pm ON pm."id" = p."paymentMethodId"
      JOIN sales s ON s."id" = p."saleId"
      WHERE s."tenantId" = ${scope.tenantId}
        AND s."storeId" = ANY(${scope.storeIds}::text[])
        AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
        AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
      GROUP BY pm."name", pm."type"
      ORDER BY SUM(p."amount") DESC
    `
  ).map((r) => ({ label: r.name, type: r.type, value: roundAmount(Number(r.total)), count: Number(r.count) }));
}

/** Rekapitulacija PDV-a po stopama. */
export async function taxRecap(scope: Scope, range: PeriodRange) {
  return (
    await db.$queryRaw<{ rate: string; base: string; amount: string }[]>`
      SELECT stl."taxRate"::text AS rate,
             COALESCE(SUM(stl."baseAmount"), 0)::text AS base,
             COALESCE(SUM(stl."taxAmount"), 0)::text AS amount
      FROM sale_tax_lines stl
      JOIN sales s ON s."id" = stl."saleId"
      WHERE s."tenantId" = ${scope.tenantId}
        AND s."storeId" = ANY(${scope.storeIds}::text[])
        AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
        AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
      GROUP BY stl."taxRate"
      ORDER BY stl."taxRate" DESC
    `
  ).map((r) => ({
    rate: Number(r.rate),
    base: roundAmount(Number(r.base)),
    amount: roundAmount(Number(r.amount)),
  }));
}

/** Učinak prodavača. */
export async function cashierPerformance(scope: Scope, range: PeriodRange, limit = 20) {
  return (
    await db.$queryRaw<
      { userId: string; name: string; count: string; total: string; avg: string; discount: string }[]
    >`
      SELECT u."id" AS "userId",
             CONCAT(u."firstName", ' ', u."lastName") AS name,
             COUNT(s."id")::text AS count,
             COALESCE(SUM(s."total"), 0)::text AS total,
             COALESCE(AVG(s."total"), 0)::text AS avg,
             COALESCE(SUM(s."discountTotal"), 0)::text AS discount
      FROM sales s
      JOIN users u ON u."id" = s."userId"
      WHERE s."tenantId" = ${scope.tenantId}
        AND s."storeId" = ANY(${scope.storeIds}::text[])
        AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
        AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
      GROUP BY u."id", u."firstName", u."lastName"
      ORDER BY SUM(s."total") DESC
      LIMIT ${limit}
    `
  ).map((r) => ({
    userId: r.userId,
    name: r.name,
    count: Number(r.count),
    total: roundAmount(Number(r.total)),
    avg: roundAmount(Number(r.avg)),
    discount: roundAmount(Number(r.discount)),
  }));
}

/** Artikli ispod minimalne zalihe. */
export async function lowStockCount(storeIds: string[]) {
  const rows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM reorder_rules rr
    JOIN warehouses w ON w."storeId" = rr."storeId" AND w."isSellable" = true
    LEFT JOIN stock_items si ON si."variantId" = rr."variantId" AND si."warehouseId" = w."id"
    WHERE rr."storeId" = ANY(${storeIds}::text[])
      AND rr."isActive" = true
      AND COALESCE(si."quantity", 0) <= rr."minQty"
  `;
  return Number(rows[0]?.count ?? 0);
}

/** Vrijednost zalihe po nabavnoj i maloprodajnoj cijeni. */
export async function stockValue(storeIds: string[]) {
  const rows = await db.$queryRaw<{ cost: string; retail: string; qty: string; skus: bigint }[]>`
    SELECT COALESCE(SUM(si."quantity" * si."avgCost"), 0)::text AS cost,
           COALESCE(SUM(si."quantity" * COALESCE(pli."price", 0)), 0)::text AS retail,
           COALESCE(SUM(si."quantity"), 0)::text AS qty,
           COUNT(DISTINCT si."variantId")::bigint AS skus
    FROM stock_items si
    JOIN warehouses w ON w."id" = si."warehouseId"
    LEFT JOIN price_list_items pli ON pli."variantId" = si."variantId"
      AND pli."priceListId" = (SELECT "id" FROM price_lists WHERE "isDefault" = true LIMIT 1)
    WHERE w."storeId" = ANY(${storeIds}::text[]) AND si."quantity" > 0
  `;
  const r = rows[0];
  return {
    cost: roundAmount(Number(r?.cost ?? 0)),
    retail: roundAmount(Number(r?.retail ?? 0)),
    quantity: round(Number(r?.qty ?? 0), 2),
    skuCount: Number(r?.skus ?? 0),
  };
}

/** Artikli bez prometa u zadanom broju dana (mrtva zaliha). */
export async function slowMovers(scope: Scope, days = 60, limit = 50) {
  const since = new Date(Date.now() - days * 86_400_000);
  return (
    await db.$queryRaw<
      { variantId: string; sku: string; name: string; qty: string; value: string; lastSold: Date | null }[]
    >`
      SELECT pv."id" AS "variantId", pv."sku", p."name",
             COALESCE(SUM(si."quantity"), 0)::text AS qty,
             COALESCE(SUM(si."quantity" * si."avgCost"), 0)::text AS value,
             MAX(last_sale."issuedAt") AS "lastSold"
      FROM product_variants pv
      JOIN products p ON p."id" = pv."productId"
      JOIN stock_items si ON si."variantId" = pv."id"
      JOIN warehouses w ON w."id" = si."warehouseId"
      LEFT JOIN (
        SELECT sl."variantId", MAX(s."issuedAt") AS "issuedAt"
        FROM sale_lines sl JOIN sales s ON s."id" = sl."saleId"
        GROUP BY sl."variantId"
      ) last_sale ON last_sale."variantId" = pv."id"
      WHERE p."tenantId" = ${scope.tenantId}
        AND w."storeId" = ANY(${scope.storeIds}::text[])
        AND si."quantity" > 0
      GROUP BY pv."id", pv."sku", p."name"
      HAVING MAX(last_sale."issuedAt") IS NULL OR MAX(last_sale."issuedAt") < ${since}
      ORDER BY SUM(si."quantity" * si."avgCost") DESC
      LIMIT ${limit}
    `
  ).map((r) => ({
    variantId: r.variantId,
    sku: r.sku,
    name: r.name,
    qty: round(Number(r.qty), 2),
    value: roundAmount(Number(r.value)),
    lastSold: r.lastSold,
  }));
}

/** ABC analiza — udio artikala u kumulativnom prometu. */
export async function abcAnalysis(scope: Scope, range: PeriodRange) {
  const rows = await db.$queryRaw<{ variantId: string; sku: string; name: string; total: string; qty: string }[]>`
    SELECT sl."variantId", sl."sku", sl."name",
           COALESCE(SUM(sl."lineTotal"), 0)::text AS total,
           COALESCE(SUM(sl."quantity"), 0)::text AS qty
    FROM sale_lines sl
    JOIN sales s ON s."id" = sl."saleId"
    WHERE s."tenantId" = ${scope.tenantId}
      AND s."storeId" = ANY(${scope.storeIds}::text[])
      AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
      AND s."status" IN ('COMPLETED','PARTIALLY_REFUNDED')
    GROUP BY sl."variantId", sl."sku", sl."name"
    ORDER BY SUM(sl."lineTotal") DESC
  `;

  const total = rows.reduce((acc, r) => acc + Number(r.total), 0);
  let cumulative = 0;
  return rows.map((r) => {
    const value = Number(r.total);
    cumulative += value;
    const share = total > 0 ? (cumulative / total) * 100 : 0;
    return {
      variantId: r.variantId,
      sku: r.sku,
      name: r.name,
      total: roundAmount(value),
      qty: round(Number(r.qty), 2),
      cumulativePct: round(share, 1),
      class: share <= 80 ? 'A' : share <= 95 ? 'B' : 'C',
    };
  });
}
