import 'server-only';
import type { SaleChannel } from '@prisma/client';
import { db } from '../db';
import { roundPrice, toNumber } from '../money';
import { matchesTimeWindow, type LoadedPromotion } from '../promotions';

export interface PriceContext {
  tenantId: string;
  storeId: string;
  channel: SaleChannel;
  customerGroupId?: string | null;
  customerId?: string | null;
  loyaltyTierDiscountPct?: number;
  at?: Date;
}

export interface ResolvedPrice {
  variantId: string;
  /** Redovna cijena iz cjenika (s PDV-om za maloprodaju). */
  listPrice: number;
  /** Cijena nakon cjenika kupčeve grupe / ugovora, prije akcija. */
  basePrice: number;
  comparePrice: number | null;
  lowestPrice30d: number | null;
  priceListId: string | null;
  taxRate: number;
}

/**
 * Razrješava cijenu artikala prema hijerarhiji:
 *   1. cjenik grupe kupaca (najviši prioritet)
 *   2. cjenik poslovnice
 *   3. zadani cjenik tenanta
 * Unutar cjenika vrijedi zapis s najvišim `priority` i važećim datumom.
 */
export async function resolvePrices(
  ctx: PriceContext,
  variantIds: string[],
): Promise<Map<string, ResolvedPrice>> {
  const at = ctx.at ?? new Date();
  const result = new Map<string, ResolvedPrice>();
  if (variantIds.length === 0) return result;

  const [store, group] = await Promise.all([
    db.store.findUnique({ where: { id: ctx.storeId }, select: { priceListId: true } }),
    ctx.customerGroupId
      ? db.customerGroup.findUnique({ where: { id: ctx.customerGroupId }, select: { priceListId: true, discountPct: true } })
      : Promise.resolve(null),
  ]);

  const defaultList = await db.priceList.findFirst({
    where: { tenantId: ctx.tenantId, isDefault: true, isActive: true },
    select: { id: true },
  });

  // Redoslijed po padajućem prioritetu.
  const candidateListIds = [group?.priceListId, store?.priceListId, defaultList?.id].filter(
    (id): id is string => Boolean(id),
  );

  const items = await db.priceListItem.findMany({
    where: {
      variantId: { in: variantIds },
      priceListId: { in: candidateListIds },
      validFrom: { lte: at },
      OR: [{ validTo: null }, { validTo: { gte: at } }],
      priceList: { isActive: true },
    },
    include: { priceList: { select: { id: true, priority: true } } },
  });

  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      msrp: true,
      product: { select: { taxRate: { select: { rate: true } } } },
    },
  });
  const taxByVariant = new Map(
    variants.map((v) => [v.id, toNumber(v.product.taxRate?.rate ?? 0)] as const),
  );
  const msrpByVariant = new Map(variants.map((v) => [v.id, toNumber(v.msrp)] as const));

  const rank = new Map(candidateListIds.map((id, index) => [id, candidateListIds.length - index]));

  for (const variantId of variantIds) {
    const candidates = items
      .filter((i) => i.variantId === variantId)
      .sort((a, b) => {
        const ra = (rank.get(a.priceListId) ?? 0) * 1000 + a.priceList.priority;
        const rb = (rank.get(b.priceListId) ?? 0) * 1000 + b.priceList.priority;
        return rb - ra;
      });

    const best = candidates[0];
    const listPrice = best ? toNumber(best.price) : msrpByVariant.get(variantId) ?? 0;
    let basePrice = listPrice;

    // Popust grupe kupaca vrijedi ako grupa nema vlastiti cjenik.
    if (group && !group.priceListId && toNumber(group.discountPct) > 0) {
      basePrice = roundPrice(basePrice * (1 - toNumber(group.discountPct) / 100));
    }

    result.set(variantId, {
      variantId,
      listPrice,
      basePrice,
      comparePrice: best?.comparePrice ? toNumber(best.comparePrice) : null,
      lowestPrice30d: best?.lowestPrice30d ? toNumber(best.lowestPrice30d) : null,
      priceListId: best?.priceListId ?? null,
      taxRate: taxByVariant.get(variantId) ?? 0,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
//  Motor akcija
// ---------------------------------------------------------------------------

/** Dohvaća aktivne akcije koje vrijede za zadani trenutak, poslovnicu i kanal. */
export async function loadActivePromotions(ctx: PriceContext): Promise<LoadedPromotion[]> {
  const at = ctx.at ?? new Date();
  const promotions = await db.promotion.findMany({
    where: {
      tenantId: ctx.tenantId,
      status: { in: ['ACTIVE', 'SCHEDULED'] },
      startsAt: { lte: at },
      OR: [{ endsAt: null }, { endsAt: { gte: at } }],
    },
    include: {
      targets: {
        select: { variantId: true, categoryId: true, brandId: true, isExclusion: true, isRewardSide: true },
      },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  return promotions.filter((p) => {
    if (p.storeIds.length > 0 && !p.storeIds.includes(ctx.storeId)) return false;
    if (p.channels.length > 0 && !p.channels.includes(ctx.channel)) return false;
    if (p.customerGroupIds.length > 0) {
      if (!ctx.customerGroupId || !p.customerGroupIds.includes(ctx.customerGroupId)) return false;
    }
    if (p.usageLimit !== null && p.usageCount >= p.usageLimit) return false;
    if (!matchesTimeWindow(p, at)) return false;
    return true;
  });
}


export * from '../promotions';

export { calculateRetailPrice } from '../pricing-math';
