/**
 * Motor akcija — čista funkcija bez pristupa bazi.
 *
 * Ulaz su učitana pravila i stavke košarice, izlaz je popust po stavci.
 * Odvojeno od dohvaćanja pravila kako bi se ponašanje moglo testirati
 * bez baze i kako bi se isti izračun mogao izvesti i na blagajni.
 */

import type { Promotion, PromotionType } from '@prisma/client';
import { roundAmount, toNumber } from './money';

export interface LoadedPromotion extends Promotion {
  targets: {
    variantId: string | null;
    categoryId: string | null;
    brandId: string | null;
    isExclusion: boolean;
    isRewardSide: boolean;
  }[];
}

export interface BasketLine {
  key: string;
  variantId: string;
  categoryId?: string | null;
  brandId?: string | null;
  quantity: number;
  unitPrice: number;
  /** Ručni popust koji je već primijenjen na stavku (%). */
  manualDiscountPct?: number;
}

export interface AppliedDiscount {
  lineKey: string | null;
  promotionId: string;
  promotionCode: string;
  description: string;
  type: PromotionType;
  percent: number | null;
  amount: number;
}

export interface PromotionResult {
  discounts: AppliedDiscount[];
  totalDiscount: number;
  /** Popust po stavci, ključ = BasketLine.key */
  byLine: Map<string, number>;
}

export function matchesTimeWindow(promotion: Promotion, at: Date): boolean {
  if (promotion.dayOfWeekMask !== null && promotion.dayOfWeekMask !== undefined) {
    // 1 = ponedjeljak … 64 = nedjelja
    const jsDay = at.getDay(); // 0 = nedjelja
    const bit = 1 << (jsDay === 0 ? 6 : jsDay - 1);
    if ((promotion.dayOfWeekMask & bit) === 0) return false;
  }
  if (promotion.startTime && promotion.endTime) {
    const minutes = at.getHours() * 60 + at.getMinutes();
    const [sh, sm] = promotion.startTime.split(':').map(Number);
    const [eh, em] = promotion.endTime.split(':').map(Number);
    const start = sh * 60 + (sm || 0);
    const end = eh * 60 + (em || 0);
    if (start <= end ? minutes < start || minutes > end : minutes < start && minutes > end) return false;
  }
  return true;
}

export function lineMatches(promotion: LoadedPromotion, line: BasketLine, rewardSide = false): boolean {
  const targets = promotion.targets.filter((t) => t.isRewardSide === rewardSide);
  const exclusions = targets.filter((t) => t.isExclusion);
  const inclusions = targets.filter((t) => !t.isExclusion);

  const matchesAny = (list: typeof targets) =>
    list.some(
      (t) =>
        (t.variantId && t.variantId === line.variantId) ||
        (t.categoryId && t.categoryId === line.categoryId) ||
        (t.brandId && t.brandId === line.brandId),
    );

  if (exclusions.length > 0 && matchesAny(exclusions)) return false;
  // Bez inclusion targeta akcija vrijedi za cijeli asortiman.
  if (inclusions.length === 0) return true;
  return matchesAny(inclusions);
}

/**
 * Primjenjuje akcije na košaricu.
 *
 * Pravila:
 *  - akcije se obrađuju po `priority` (viši prvi);
 *  - `exclusive` akcija zaustavlja daljnju obradu za pogođene stavke;
 *  - popusti se zbrajaju na ostatak iznosa, nikad ispod nule;
 *  - stavke s ručnim popustom i dalje mogu dobiti akcijski popust osim ako
 *    akcija nije označena kao ekskluzivna.
 */
export function applyPromotions(
  promotions: LoadedPromotion[],
  lines: BasketLine[],
  options: { loyaltyTierDiscountPct?: number; couponCodes?: string[] } = {},
): PromotionResult {
  const discounts: AppliedDiscount[] = [];
  const byLine = new Map<string, number>();
  const lockedLines = new Set<string>();

  const lineGross = (l: BasketLine) => roundAmount(l.quantity * l.unitPrice);
  const remaining = new Map(lines.map((l) => [l.key, lineGross(l) - (byLine.get(l.key) ?? 0)]));

  const basketTotal = lines.reduce((acc, l) => acc + lineGross(l), 0);

  const addDiscount = (line: BasketLine | null, promotion: LoadedPromotion, amount: number, description: string, percent: number | null) => {
    const capped = promotion.maxDiscountAmount
      ? Math.min(amount, toNumber(promotion.maxDiscountAmount))
      : amount;
    const value = roundAmount(Math.max(capped, 0));
    if (value <= 0) return;
    if (line) {
      const left = remaining.get(line.key) ?? 0;
      const applied = roundAmount(Math.min(value, left));
      if (applied <= 0) return;
      remaining.set(line.key, roundAmount(left - applied));
      byLine.set(line.key, roundAmount((byLine.get(line.key) ?? 0) + applied));
      discounts.push({
        lineKey: line.key,
        promotionId: promotion.id,
        promotionCode: promotion.code,
        description,
        type: promotion.type,
        percent,
        amount: applied,
      });
      if (promotion.exclusive) lockedLines.add(line.key);
    } else {
      discounts.push({
        lineKey: null,
        promotionId: promotion.id,
        promotionCode: promotion.code,
        description,
        type: promotion.type,
        percent,
        amount: value,
      });
    }
  };

  for (const promotion of promotions) {
    if (promotion.requiresCoupon) {
      const codes = options.couponCodes ?? [];
      if (!codes.some((c) => c.toUpperCase() === promotion.code.toUpperCase())) continue;
    }

    const eligible = lines.filter((l) => !lockedLines.has(l.key) && lineMatches(promotion, l));
    if (eligible.length === 0 && promotion.type !== 'BASKET_THRESHOLD') continue;

    const eligibleQty = eligible.reduce((acc, l) => acc + l.quantity, 0);
    const eligibleValue = eligible.reduce((acc, l) => acc + lineGross(l), 0);

    if (promotion.minQty && eligibleQty < toNumber(promotion.minQty)) continue;
    if (promotion.minBasketAmount && basketTotal < toNumber(promotion.minBasketAmount)) continue;

    switch (promotion.type) {
      case 'PERCENT_OFF': {
        const pct = toNumber(promotion.value);
        for (const line of eligible) {
          addDiscount(line, promotion, (lineGross(line) * pct) / 100, `${promotion.name} −${pct}%`, pct);
        }
        break;
      }
      case 'AMOUNT_OFF': {
        const amount = toNumber(promotion.value);
        for (const line of eligible) {
          addDiscount(line, promotion, amount * line.quantity, `${promotion.name}`, null);
        }
        break;
      }
      case 'FIXED_PRICE': {
        const fixed = toNumber(promotion.value);
        for (const line of eligible) {
          if (line.unitPrice <= fixed) continue;
          addDiscount(line, promotion, (line.unitPrice - fixed) * line.quantity, `${promotion.name} — fiksna cijena`, null);
        }
        break;
      }
      case 'NTH_ITEM_DISCOUNT': {
        // Svaki n-ti komad s popustom (value = % popusta, buyQty = n).
        const n = Math.max(1, Math.trunc(toNumber(promotion.buyQty) || 2));
        const pct = toNumber(promotion.value);
        const sorted = [...eligible].sort((a, b) => a.unitPrice - b.unitPrice);
        let counter = 0;
        for (const line of sorted) {
          for (let i = 0; i < line.quantity; i++) {
            counter += 1;
            if (counter % n === 0) {
              addDiscount(line, promotion, (line.unitPrice * pct) / 100, `${promotion.name} — svaki ${n}. komad`, pct);
            }
          }
        }
        break;
      }
      case 'BUY_X_GET_Y': {
        const buy = Math.max(1, toNumber(promotion.buyQty) || 1);
        const get = Math.max(1, toNumber(promotion.getQty) || 1);
        const rewardLines = lines.filter(
          (l) => !lockedLines.has(l.key) && lineMatches(promotion, l, true),
        );
        const pool = rewardLines.length > 0 ? rewardLines : eligible;
        const sets = Math.floor(eligibleQty / (buy + get));
        let freeLeft = sets * get;
        // Gratis se dodjeljuje najjeftinijim artiklima.
        for (const line of [...pool].sort((a, b) => a.unitPrice - b.unitPrice)) {
          if (freeLeft <= 0) break;
          const take = Math.min(freeLeft, line.quantity);
          addDiscount(line, promotion, take * line.unitPrice, `${promotion.name} — ${buy}+${get} gratis`, null);
          freeLeft -= take;
        }
        break;
      }
      case 'BUNDLE_PRICE': {
        const bundlePrice = toNumber(promotion.value);
        const sets = Math.floor(eligibleQty / Math.max(1, toNumber(promotion.buyQty) || eligible.length));
        if (sets < 1) break;
        const target = bundlePrice * sets;
        const discountTotal = Math.max(eligibleValue - target, 0);
        const weights = eligible.map((l) => lineGross(l));
        const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
        eligible.forEach((line, idx) => {
          addDiscount(line, promotion, (discountTotal * weights[idx]) / totalWeight, `${promotion.name} — paket`, null);
        });
        break;
      }
      case 'BASKET_THRESHOLD': {
        const threshold = toNumber(promotion.minBasketAmount);
        if (basketTotal < threshold) break;
        const pct = toNumber(promotion.value);
        const totalRemaining = lines.reduce((acc, l) => acc + (remaining.get(l.key) ?? 0), 0);
        const discountTotal = roundAmount((totalRemaining * pct) / 100);
        const weights = lines.map((l) => remaining.get(l.key) ?? 0);
        const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
        lines.forEach((line, idx) => {
          addDiscount(line, promotion, (discountTotal * weights[idx]) / totalWeight, `${promotion.name} — popust na košaricu`, pct);
        });
        break;
      }
      case 'LOYALTY_MULTIPLIER':
      case 'FREE_SHIPPING':
        // Ne utječu na iznos računa na POS-u.
        break;
    }
  }

  // Popust razine vjernosti primjenjuje se zadnji, na preostali iznos.
  const tierPct = options.loyaltyTierDiscountPct ?? 0;
  if (tierPct > 0) {
    for (const line of lines) {
      const left = remaining.get(line.key) ?? 0;
      const amount = roundAmount((left * tierPct) / 100);
      if (amount <= 0) continue;
      remaining.set(line.key, roundAmount(left - amount));
      byLine.set(line.key, roundAmount((byLine.get(line.key) ?? 0) + amount));
      discounts.push({
        lineKey: line.key,
        promotionId: 'loyalty-tier',
        promotionCode: 'LOYALTY',
        description: `Popust razine vjernosti −${tierPct}%`,
        type: 'PERCENT_OFF',
        percent: tierPct,
        amount,
      });
    }
  }

  const totalDiscount = roundAmount(
    Array.from(byLine.values()).reduce((a, b) => a + b, 0) +
      discounts.filter((d) => d.lineKey === null).reduce((a, b) => a + b.amount, 0),
  );

  return { discounts, totalDiscount, byLine };
}

