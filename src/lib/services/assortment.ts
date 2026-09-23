import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from '../db';

/**
 * Ponuda poslovnice.
 *
 * Lanac rijetko prodaje isto u svakoj poslovnici — mali format ne drži bijelu
 * tehniku, kiosk ne drži svježe meso. Zapisi postoje samo za odstupanja, pa
 * poslovnica s cijelim katalogom nema nijedan redak.
 */

export type StoreAssortmentRule = {
  mode: 'ALL' | 'LISTED_ONLY';
  /** Varijante koje odstupaju od zadanog ponašanja načina. */
  variantIds: string[];
};

/** Čita pravilo ponude za poslovnicu. */
export async function loadAssortmentRule(storeId: string): Promise<StoreAssortmentRule> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { assortmentMode: true },
  });
  const mode = store?.assortmentMode ?? 'ALL';

  const rows = await db.storeAssortment.findMany({
    where: { storeId, isListed: mode === 'LISTED_ONLY' },
    select: { variantId: true },
  });

  return { mode, variantIds: rows.map((r) => r.variantId) };
}

/**
 * Uvjet za `where` nad `productVariant`, prema pravilu ponude.
 *
 * Pri ALL bez isključenja i pri LISTED_ONLY bez uvrštenih artikala vraća se
 * prazan odnosno nemoguć uvjet — bez dodatnog spajanja tablica.
 */
export function assortmentWhere(rule: StoreAssortmentRule): Prisma.ProductVariantWhereInput {
  if (rule.mode === 'LISTED_ONLY') {
    return { id: { in: rule.variantIds } };
  }
  return rule.variantIds.length > 0 ? { id: { notIn: rule.variantIds } } : {};
}

/** Je li varijanta u ponudi poslovnice. */
export function isListed(rule: StoreAssortmentRule, variantId: string): boolean {
  return rule.mode === 'LISTED_ONLY'
    ? rule.variantIds.includes(variantId)
    : !rule.variantIds.includes(variantId);
}

/**
 * Provjera pri naplati.
 *
 * Bez nje bi se isključeni artikl i dalje mogao prodati skeniranjem barkoda —
 * filtriranje u pretrazi skriva artikl, ali ga ne zabranjuje.
 */
export async function assertInAssortment(
  tx: PrismaClient | Prisma.TransactionClient,
  storeId: string,
  variantIds: string[],
): Promise<string[]> {
  if (variantIds.length === 0) return [];

  const store = await tx.store.findUnique({
    where: { id: storeId },
    select: { assortmentMode: true },
  });
  const mode = store?.assortmentMode ?? 'ALL';

  const unique = [...new Set(variantIds)];
  const rows = await tx.storeAssortment.findMany({
    where: { storeId, variantId: { in: unique } },
    select: { variantId: true, isListed: true },
  });
  const byVariant = new Map(rows.map((r) => [r.variantId, r.isListed]));

  return unique.filter((id) => {
    const listed = byVariant.get(id);
    return mode === 'LISTED_ONLY' ? listed !== true : listed === false;
  });
}
