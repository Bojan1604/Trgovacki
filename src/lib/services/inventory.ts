import 'server-only';
import { Prisma, type StockMovementType } from '@prisma/client';
import { db, type Tx } from '../db';
import { round, toNumber } from '../money';

export interface MovementInput {
  warehouseId: string;
  variantId: string;
  type: StockMovementType;
  /** Apsolutna količina; predznak određuje `direction`. */
  quantity: number;
  /** Nabavna cijena po jedinici (obavezna za ulaze). */
  unitCost?: number;
  lotId?: string | null;
  serialNumber?: string | null;
  refType?: string;
  refId?: string;
  refNumber?: string;
  reasonCodeId?: string | null;
  note?: string;
  userId?: string | null;
  occurredAt?: Date;
}

const INBOUND: StockMovementType[] = [
  'PURCHASE_RECEIPT', 'SALE_RETURN', 'TRANSFER_IN', 'ADJUSTMENT_IN', 'PRODUCTION_IN', 'INITIAL',
];

export function isInbound(type: StockMovementType) {
  return INBOUND.includes(type);
}

/** Predznak kretanja: +1 ulaz, −1 izlaz, 0 za inventuru (određuje se iz razlike). */
export function movementSign(type: StockMovementType): 1 | -1 {
  return isInbound(type) ? 1 : -1;
}

export class StockError extends Error {
  constructor(message: string, readonly code = 'STOCK_ERROR') {
    super(message);
  }
}

/**
 * Knjiži jedno kretanje zalihe.
 *
 * - Ažurira `StockItem` (stanje + ponderirana prosječna nabavna cijena).
 * - Upisuje nepromjenjiv redak u `StockMovement` s tekućim saldom.
 * - Mora se pozivati unutar transakcije; `tx` je obavezan za konzistentnost.
 *
 * WAC formula kod ulaza:
 *   novaPNC = (staroStanje × staraPNC + ulaznaKol × ulaznaCijena) / (staroStanje + ulaznaKol)
 * Kod izlaza PNC ostaje nepromijenjena, a trošak izlaza je tekuća PNC.
 */
export async function postMovement(tx: Tx, input: MovementInput) {
  const qty = Math.abs(round(input.quantity, 4));
  if (qty === 0) throw new StockError('Količina kretanja ne smije biti nula.', 'ZERO_QTY');

  const sign = movementSign(input.type);
  const signedQty = sign * qty;

  const existing = await tx.stockItem.findUnique({
    where: { warehouseId_variantId: { warehouseId: input.warehouseId, variantId: input.variantId } },
  });

  const prevQty = existing ? toNumber(existing.quantity) : 0;
  const prevAvg = existing ? toNumber(existing.avgCost) : 0;
  const newQty = round(prevQty + signedQty, 4);

  let unitCost = input.unitCost !== undefined ? round(input.unitCost, 6) : prevAvg;
  let newAvg = prevAvg;

  if (sign > 0) {
    // Ulaz: rekalkulacija prosječne nabavne cijene.
    const base = Math.max(prevQty, 0);
    const totalValue = base * prevAvg + qty * unitCost;
    const totalQty = base + qty;
    newAvg = totalQty > 0 ? round(totalValue / totalQty, 6) : unitCost;
  } else {
    // Izlaz: trošak po tekućoj PNC; ako je PNC 0 (npr. početno stanje bez cijene)
    // koristi se zadana vrijednost iz inputa.
    unitCost = input.unitCost !== undefined ? round(input.unitCost, 6) : prevAvg;
    newAvg = prevAvg;
  }

  const stockItem = await tx.stockItem.upsert({
    where: { warehouseId_variantId: { warehouseId: input.warehouseId, variantId: input.variantId } },
    create: {
      warehouseId: input.warehouseId,
      variantId: input.variantId,
      quantity: new Prisma.Decimal(newQty),
      avgCost: new Prisma.Decimal(newAvg),
      lastCost: new Prisma.Decimal(unitCost),
      lastMovementAt: input.occurredAt ?? new Date(),
    },
    update: {
      quantity: new Prisma.Decimal(newQty),
      avgCost: new Prisma.Decimal(newAvg),
      lastCost: sign > 0 ? new Prisma.Decimal(unitCost) : undefined,
      lastMovementAt: input.occurredAt ?? new Date(),
    },
  });

  const movement = await tx.stockMovement.create({
    data: {
      warehouseId: input.warehouseId,
      variantId: input.variantId,
      type: input.type,
      quantity: new Prisma.Decimal(signedQty),
      unitCost: new Prisma.Decimal(unitCost),
      totalCost: new Prisma.Decimal(round(qty * unitCost, 4)),
      balanceAfter: new Prisma.Decimal(newQty),
      avgCostAfter: new Prisma.Decimal(newAvg),
      lotId: input.lotId ?? null,
      serialNumber: input.serialNumber ?? null,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      refNumber: input.refNumber ?? null,
      reasonCodeId: input.reasonCodeId ?? null,
      note: input.note ?? null,
      userId: input.userId ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });

  return { movement, stockItem, previousQty: prevQty, newQty, unitCost, avgCost: newAvg };
}

/** Knjiži više kretanja odjednom (jedan dokument = više stavki). */
export async function postMovements(tx: Tx, inputs: MovementInput[]) {
  const results = [];
  for (const input of inputs) results.push(await postMovement(tx, input));
  return results;
}

/** Provjera raspoloživosti prije izlaza; poštuje dozvolu negativne zalihe. */
export async function assertAvailable(
  tx: Tx,
  warehouseId: string,
  items: { variantId: string; quantity: number; name?: string }[],
  allowNegative: boolean,
) {
  if (allowNegative) return;
  const variantIds = items.map((i) => i.variantId);
  const stock = await tx.stockItem.findMany({
    where: { warehouseId, variantId: { in: variantIds } },
  });
  const map = new Map(stock.map((s) => [s.variantId, toNumber(s.quantity) - toNumber(s.reserved)]));

  const shortages = items.filter((i) => (map.get(i.variantId) ?? 0) < i.quantity);
  if (shortages.length > 0) {
    const first = shortages[0];
    throw new StockError(
      `Nedovoljna zaliha za ${first.name ?? first.variantId}: raspoloživo ${map.get(first.variantId) ?? 0}, traženo ${first.quantity}.`,
      'INSUFFICIENT_STOCK',
    );
  }
}

/** Rezervacija zalihe (web narudžbe, priprema transfera). */
export async function reserve(tx: Tx, warehouseId: string, variantId: string, quantity: number) {
  await tx.stockItem.upsert({
    where: { warehouseId_variantId: { warehouseId, variantId } },
    create: { warehouseId, variantId, reserved: new Prisma.Decimal(quantity) },
    update: { reserved: { increment: new Prisma.Decimal(quantity) } },
  });
}

export async function releaseReservation(tx: Tx, warehouseId: string, variantId: string, quantity: number) {
  await tx.stockItem.updateMany({
    where: { warehouseId, variantId },
    data: { reserved: { decrement: new Prisma.Decimal(quantity) } },
  });
}

/** Ukupna vrijednost zalihe po nabavnoj cijeni za zadana skladišta. */
export async function stockValuation(warehouseIds: string[]) {
  const rows = await db.$queryRaw<{ value: string; qty: string; skus: bigint }[]>`
    SELECT COALESCE(SUM(si."quantity" * si."avgCost"), 0)::text AS value,
           COALESCE(SUM(si."quantity"), 0)::text AS qty,
           COUNT(*)::bigint AS skus
    FROM stock_items si
    WHERE si."warehouseId" = ANY(${warehouseIds}::text[]) AND si."quantity" <> 0
  `;
  const row = rows[0];
  return {
    costValue: Number(row?.value ?? 0),
    quantity: Number(row?.qty ?? 0),
    skuCount: Number(row?.skus ?? 0),
  };
}

/** Prijedlog narudžbe: artikli ispod minimalne zalihe. */
export async function replenishmentSuggestions(storeId: string, limit = 200) {
  return db.$queryRaw<
    {
      variantId: string;
      sku: string;
      name: string;
      supplierId: string | null;
      supplierName: string | null;
      onHand: string;
      minQty: string;
      maxQty: string;
      suggestedQty: string;
      purchasePrice: string;
    }[]
  >`
    SELECT rr."variantId",
           pv."sku",
           p."name",
           rr."supplierId",
           s."name" AS "supplierName",
           COALESCE(SUM(si."quantity"), 0)::text AS "onHand",
           rr."minQty"::text,
           rr."maxQty"::text,
           GREATEST(rr."maxQty" - COALESCE(SUM(si."quantity"), 0), 0)::text AS "suggestedQty",
           COALESCE(MAX(ps."purchasePrice"), 0)::text AS "purchasePrice"
    FROM reorder_rules rr
    JOIN product_variants pv ON pv."id" = rr."variantId"
    JOIN products p ON p."id" = pv."productId"
    LEFT JOIN suppliers s ON s."id" = rr."supplierId"
    LEFT JOIN warehouses w ON w."storeId" = rr."storeId"
    LEFT JOIN stock_items si ON si."variantId" = rr."variantId" AND si."warehouseId" = w."id"
    LEFT JOIN product_suppliers ps ON ps."productId" = p."id" AND ps."supplierId" = rr."supplierId"
    WHERE rr."storeId" = ${storeId} AND rr."isActive" = true
    GROUP BY rr."variantId", pv."sku", p."name", rr."supplierId", s."name", rr."minQty", rr."maxQty"
    HAVING COALESCE(SUM(si."quantity"), 0) <= rr."minQty"
    ORDER BY (COALESCE(SUM(si."quantity"), 0) - rr."minQty") ASC
    LIMIT ${limit}
  `;
}
