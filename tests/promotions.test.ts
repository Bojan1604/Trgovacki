import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { applyPromotions, matchesTimeWindow, type BasketLine, type LoadedPromotion } from '../src/lib/promotions';

/** Minimalna akcija s razumnim zadanim vrijednostima. */
function promotion(overrides: Partial<LoadedPromotion> = {}): LoadedPromotion {
  return {
    id: overrides.id ?? 'p1',
    tenantId: 't1',
    code: overrides.code ?? 'AKCIJA',
    name: overrides.name ?? 'Akcija',
    description: null,
    type: overrides.type ?? 'PERCENT_OFF',
    status: 'ACTIVE',
    priority: overrides.priority ?? 0,
    exclusive: overrides.exclusive ?? false,
    value: new Prisma.Decimal(overrides.value ?? 0),
    buyQty: overrides.buyQty ?? null,
    getQty: overrides.getQty ?? null,
    minBasketAmount: overrides.minBasketAmount ?? null,
    minQty: overrides.minQty ?? null,
    maxDiscountAmount: overrides.maxDiscountAmount ?? null,
    usageLimit: null,
    usagePerCustomer: null,
    usageCount: 0,
    requiresCoupon: overrides.requiresCoupon ?? false,
    dayOfWeekMask: overrides.dayOfWeekMask ?? null,
    startTime: overrides.startTime ?? null,
    endTime: overrides.endTime ?? null,
    startsAt: new Date('2026-01-01'),
    endsAt: null,
    channels: ['POS'],
    storeIds: [],
    customerGroupIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    targets: overrides.targets ?? [],
  } as LoadedPromotion;
}

function line(overrides: Partial<BasketLine> = {}): BasketLine {
  return {
    key: overrides.key ?? 'L0',
    variantId: overrides.variantId ?? 'v1',
    categoryId: overrides.categoryId ?? 'c1',
    brandId: overrides.brandId ?? 'b1',
    quantity: overrides.quantity ?? 1,
    unitPrice: overrides.unitPrice ?? 10,
    manualDiscountPct: overrides.manualDiscountPct,
  };
}

describe('postotni popust', () => {
  it('umanjuje vrijednost stavke', () => {
    const result = applyPromotions([promotion({ type: 'PERCENT_OFF', value: 20 })], [line({ quantity: 2 })]);
    assert.equal(result.totalDiscount, 4);
    assert.equal(result.byLine.get('L0'), 4);
  });

  it('poštuje gornju granicu popusta', () => {
    const result = applyPromotions(
      [promotion({ type: 'PERCENT_OFF', value: 50, maxDiscountAmount: new Prisma.Decimal(3) })],
      [line({ quantity: 10 })],
    );
    assert.equal(result.totalDiscount, 3);
  });

  it('vrijedi samo za ciljanu kategoriju', () => {
    const promo = promotion({
      type: 'PERCENT_OFF',
      value: 50,
      targets: [{ variantId: null, categoryId: 'hrana', brandId: null, isExclusion: false, isRewardSide: false }],
    });
    const result = applyPromotions([promo], [line({ key: 'L0', categoryId: 'hrana' }), line({ key: 'L1', categoryId: 'pice' })]);
    assert.equal(result.byLine.get('L0'), 5);
    assert.equal(result.byLine.get('L1'), undefined);
  });

  it('isključeni artikl ne dobiva popust', () => {
    const promo = promotion({
      type: 'PERCENT_OFF',
      value: 50,
      targets: [{ variantId: 'v9', categoryId: null, brandId: null, isExclusion: true, isRewardSide: false }],
    });
    const result = applyPromotions([promo], [line({ variantId: 'v9' })]);
    assert.equal(result.totalDiscount, 0);
  });
});

describe('fiksna cijena', () => {
  it('spušta cijenu na zadanu razinu', () => {
    const result = applyPromotions([promotion({ type: 'FIXED_PRICE', value: 7 })], [line({ quantity: 3, unitPrice: 10 })]);
    assert.equal(result.totalDiscount, 9);
  });

  it('ne podiže cijenu kad je artikl već jeftiniji', () => {
    const result = applyPromotions([promotion({ type: 'FIXED_PRICE', value: 12 })], [line({ unitPrice: 10 })]);
    assert.equal(result.totalDiscount, 0);
  });
});

describe('kupi X dobij Y', () => {
  it('gratis se dodjeljuje najjeftinijem artiklu', () => {
    const promo = promotion({ type: 'BUY_X_GET_Y', buyQty: new Prisma.Decimal(2), getQty: new Prisma.Decimal(1) });
    const result = applyPromotions([promo], [
      line({ key: 'L0', unitPrice: 10, quantity: 2 }),
      line({ key: 'L1', unitPrice: 4, quantity: 1 }),
    ]);
    // Tri komada = jedan set 2+1, gratis ide na jeftiniji artikl od 4 €.
    assert.equal(result.totalDiscount, 4);
    assert.equal(result.byLine.get('L1'), 4);
  });

  it('bez dovoljne količine nema gratisa', () => {
    const promo = promotion({ type: 'BUY_X_GET_Y', buyQty: new Prisma.Decimal(2), getQty: new Prisma.Decimal(1) });
    const result = applyPromotions([promo], [line({ quantity: 2 })]);
    assert.equal(result.totalDiscount, 0);
  });
});

describe('svaki N-ti artikl', () => {
  it('popust na svaki treći komad', () => {
    const promo = promotion({ type: 'NTH_ITEM_DISCOUNT', value: 50, buyQty: new Prisma.Decimal(3) });
    const result = applyPromotions([promo], [line({ quantity: 6, unitPrice: 10 })]);
    // Šest komada → dva puta po 50 % od 10 €.
    assert.equal(result.totalDiscount, 10);
  });
});

describe('popust na košaricu', () => {
  it('vrijedi tek iznad praga', () => {
    const promo = promotion({ type: 'BASKET_THRESHOLD', value: 10, minBasketAmount: new Prisma.Decimal(50) });
    const small = applyPromotions([promo], [line({ quantity: 2, unitPrice: 10 })]);
    assert.equal(small.totalDiscount, 0);

    const large = applyPromotions([promo], [line({ quantity: 6, unitPrice: 10 })]);
    assert.equal(large.totalDiscount, 6);
  });
});

describe('kombiniranje akcija', () => {
  it('obrađuje po prioritetu i ne spušta ispod nule', () => {
    const first = promotion({ id: 'p1', code: 'A', type: 'PERCENT_OFF', value: 80, priority: 10 });
    const second = promotion({ id: 'p2', code: 'B', type: 'PERCENT_OFF', value: 80, priority: 5 });
    const result = applyPromotions([first, second], [line({ unitPrice: 10 })]);
    // Ukupan popust ne smije premašiti vrijednost stavke.
    assert.ok(result.totalDiscount <= 10);
    assert.equal(result.byLine.get('L0'), 10);
  });

  it('ekskluzivna akcija zaključava stavku', () => {
    const exclusive = promotion({ id: 'p1', code: 'EX', type: 'PERCENT_OFF', value: 10, priority: 10, exclusive: true });
    const other = promotion({ id: 'p2', code: 'OTH', type: 'PERCENT_OFF', value: 50, priority: 5 });
    const result = applyPromotions([exclusive, other], [line({ unitPrice: 10 })]);
    assert.equal(result.totalDiscount, 1);
  });

  it('akcija s kuponom traži unesen kod', () => {
    const promo = promotion({ code: 'KUPON10', type: 'PERCENT_OFF', value: 10, requiresCoupon: true });
    assert.equal(applyPromotions([promo], [line()]).totalDiscount, 0);
    assert.equal(applyPromotions([promo], [line()], { couponCodes: ['kupon10'] }).totalDiscount, 1);
  });
});

describe('popust razine vjernosti', () => {
  it('primjenjuje se na ostatak nakon akcija', () => {
    const promo = promotion({ type: 'PERCENT_OFF', value: 50 });
    const result = applyPromotions([promo], [line({ unitPrice: 10 })], { loyaltyTierDiscountPct: 10 });
    // 10 € → akcija −5 € → vjernost 10 % od preostalih 5 € = 0,50 €
    assert.equal(result.totalDiscount, 5.5);
  });
});

describe('vremenski prozor', () => {
  it('poštuje dane u tjednu', () => {
    // Bitmask 1 = ponedjeljak
    const promo = promotion({ dayOfWeekMask: 1 });
    assert.equal(matchesTimeWindow(promo, new Date('2026-09-21T10:00:00')), true); // ponedjeljak
    assert.equal(matchesTimeWindow(promo, new Date('2026-09-22T10:00:00')), false); // utorak
  });

  it('poštuje raspon sati', () => {
    const promo = promotion({ startTime: '19:00', endTime: '21:00' });
    assert.equal(matchesTimeWindow(promo, new Date('2026-09-22T19:30:00')), true);
    assert.equal(matchesTimeWindow(promo, new Date('2026-09-22T18:00:00')), false);
  });

  it('nedjelja je zadnji bit maske', () => {
    const promo = promotion({ dayOfWeekMask: 64 });
    assert.equal(matchesTimeWindow(promo, new Date('2026-09-20T10:00:00')), true); // nedjelja
    assert.equal(matchesTimeWindow(promo, new Date('2026-09-21T10:00:00')), false);
  });
});
