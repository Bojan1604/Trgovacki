import 'server-only';
import { Prisma, type DocumentKind, type SaleChannel } from '@prisma/client';
import { db } from '../db';
import { audit } from '../audit';
import { allocate, roundAmount, roundCash, roundPrice, taxFromGross, toNumber } from '../money';
import { fiscalAdapter } from '../fiscal';
import { nextReceiptNumber, nextDocumentNumber } from './numbering';
import { applyPromotions, loadActivePromotions, resolvePrices, type BasketLine } from './pricing';
import { assertAvailable, postMovement } from './inventory';

export interface CheckoutLineInput {
  variantId: string;
  quantity: number;
  /** Ručno zadana cijena (zahtijeva pravo pos.price_override). */
  unitPriceOverride?: number;
  /** Ručni popust u % (zahtijeva pravo pos.discount). */
  discountPct?: number;
  serialNumber?: string;
  lotNumber?: string;
  note?: string;
}

export interface CheckoutPaymentInput {
  paymentMethodId: string;
  amount: number;
  tendered?: number;
  reference?: string;
  authCode?: string;
  cardBrand?: string;
  cardLast4?: string;
  giftCardCode?: string;
}

export interface CheckoutInput {
  tenantId: string;
  storeId: string;
  registerId?: string | null;
  shiftId?: string | null;
  userId: string;
  customerId?: string | null;
  channel?: SaleChannel;
  kind?: DocumentKind;
  lines: CheckoutLineInput[];
  payments: CheckoutPaymentInput[];
  couponCodes?: string[];
  loyaltyPointsToRedeem?: number;
  note?: string;
  receiptEmail?: string;
  /** Idempotencijski ključ s blagajne — sprječava dvostruko knjiženje. */
  clientUuid?: string;
  /** Zaokruživanje gotovinskog računa na najbližih 5 centi. */
  cashRounding?: boolean;
}

export class CheckoutError extends Error {
  constructor(message: string, readonly code = 'CHECKOUT_ERROR') {
    super(message);
  }
}

/**
 * Izračun košarice bez knjiženja — koristi POS za prikaz u stvarnom vremenu
 * i API `/api/pos/quote`. Deterministički je: isti ulaz daje isti izlaz.
 */
export async function quoteBasket(input: {
  tenantId: string;
  storeId: string;
  channel?: SaleChannel;
  customerId?: string | null;
  lines: CheckoutLineInput[];
  couponCodes?: string[];
}) {
  const variantIds = Array.from(new Set(input.lines.map((l) => l.variantId)));
  if (variantIds.length === 0) {
    return { lines: [], subtotal: 0, discountTotal: 0, taxTotal: 0, depositTotal: 0, total: 0, taxLines: [], discounts: [] };
  }

  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    include: {
      product: {
        select: {
          id: true, name: true, shortName: true, sku: true, categoryId: true, brandId: true,
          depositAmount: true, taxRate: { select: { rate: true, name: true } },
        },
      },
    },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const customer = input.customerId
    ? await db.customer.findUnique({
        where: { id: input.customerId },
        include: {
          group: { select: { id: true, discountPct: true } },
          loyaltyCards: { where: { isActive: true }, include: { tier: true }, take: 1 },
        },
      })
    : null;

  const ctx = {
    tenantId: input.tenantId,
    storeId: input.storeId,
    channel: input.channel ?? ('POS' as SaleChannel),
    customerGroupId: customer?.groupId ?? null,
    customerId: customer?.id ?? null,
  };

  const prices = await resolvePrices(ctx, variantIds);
  const promotions = await loadActivePromotions(ctx);

  const basket: BasketLine[] = input.lines.map((line, index) => {
    const variant = variantMap.get(line.variantId);
    if (!variant) throw new CheckoutError(`Artikl ${line.variantId} ne postoji.`, 'UNKNOWN_VARIANT');
    const resolved = prices.get(line.variantId);
    const base = line.unitPriceOverride ?? resolved?.basePrice ?? 0;
    return {
      key: `L${index}`,
      variantId: line.variantId,
      categoryId: variant.product.categoryId,
      brandId: variant.product.brandId,
      quantity: line.quantity,
      unitPrice: roundPrice(base * (1 - (line.discountPct ?? 0) / 100)),
      manualDiscountPct: line.discountPct,
    };
  });

  const tierDiscount = toNumber(customer?.loyaltyCards?.[0]?.tier?.discountPct ?? 0);
  const customerDiscount = toNumber(customer?.discountPct ?? 0);

  const promoResult = applyPromotions(promotions, basket, {
    loyaltyTierDiscountPct: Math.max(tierDiscount, customerDiscount),
    couponCodes: input.couponCodes,
  });

  const taxBuckets = new Map<number, { name: string; base: number; amount: number }>();
  let subtotal = 0;
  let discountTotal = 0;
  let depositTotal = 0;
  let taxTotal = 0;

  const lines = basket.map((bl, index) => {
    const src = input.lines[index];
    const variant = variantMap.get(bl.variantId)!;
    const resolved = prices.get(bl.variantId)!;
    const taxRate = toNumber(variant.product.taxRate?.rate ?? 0);
    const taxName = variant.product.taxRate?.name ?? 'PDV';
    const deposit = toNumber(variant.product.depositAmount) * bl.quantity;

    const gross = roundAmount(bl.quantity * bl.unitPrice);
    const promoDiscount = promoResult.byLine.get(bl.key) ?? 0;
    const manualDiscount = roundAmount(
      bl.quantity * ((resolved.basePrice ?? 0) - bl.unitPrice),
    );
    const lineTotal = roundAmount(gross - promoDiscount);
    const lineTax = taxFromGross(lineTotal, taxRate);

    subtotal = roundAmount(subtotal + roundAmount(bl.quantity * resolved.basePrice));
    discountTotal = roundAmount(discountTotal + promoDiscount + Math.max(manualDiscount, 0));
    depositTotal = roundAmount(depositTotal + deposit);
    taxTotal = roundAmount(taxTotal + lineTax);

    const bucket = taxBuckets.get(taxRate) ?? { name: taxName, base: 0, amount: 0 };
    bucket.base = roundAmount(bucket.base + (lineTotal - lineTax));
    bucket.amount = roundAmount(bucket.amount + lineTax);
    taxBuckets.set(taxRate, bucket);

    return {
      key: bl.key,
      variantId: bl.variantId,
      sku: variant.sku,
      name: variant.product.shortName || variant.name || variant.product.name,
      fullName: variant.product.name,
      quantity: bl.quantity,
      originalPrice: resolved.listPrice,
      basePrice: resolved.basePrice,
      unitPrice: bl.unitPrice,
      manualDiscountPct: src.discountPct ?? 0,
      promoDiscount,
      discountAmount: roundAmount(promoDiscount + Math.max(manualDiscount, 0)),
      taxRate,
      taxAmount: lineTax,
      depositAmount: roundAmount(deposit),
      lineTotal,
      serialNumber: src.serialNumber,
      lotNumber: src.lotNumber,
      note: src.note,
    };
  });

  const total = roundAmount(lines.reduce((acc, l) => acc + l.lineTotal + l.depositAmount, 0));

  return {
    lines,
    subtotal,
    discountTotal,
    taxTotal,
    depositTotal,
    total,
    taxLines: Array.from(taxBuckets.entries()).map(([rate, b]) => ({ rate, name: b.name, base: b.base, amount: b.amount })),
    discounts: promoResult.discounts,
    customer: customer
      ? {
          id: customer.id,
          name: customer.companyName || `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim(),
          points: customer.loyaltyCards[0]?.points ?? 0,
          tier: customer.loyaltyCards[0]?.tier?.name ?? null,
        }
      : null,
  };
}

/**
 * Naplata računa.
 *
 * Sve se odvija u jednoj bazi podataka transakciji:
 *   broj računa → stavke → PDV rekapitulacija → plaćanja → knjiženje zalihe
 *   → bodovi vjernosti → poklon kartice → agregati smjene → outbox događaj.
 * Fiskalizacija se izvodi NAKON commita kako neuspjeh mrežnog poziva ne bi
 * srušio već naplaćeni račun; neuspjeli pokušaji ostaju u redu za ponavljanje.
 */
export async function checkout(input: CheckoutInput) {
  if (input.lines.length === 0) throw new CheckoutError('Račun nema stavki.', 'EMPTY_BASKET');

  if (input.clientUuid) {
    const existing = await db.sale.findUnique({
      where: { clientUuid: input.clientUuid },
      include: { lines: true, payments: true },
    });
    if (existing) return { sale: existing, duplicate: true as const };
  }

  const [store, register] = await Promise.all([
    db.store.findUnique({
      where: { id: input.storeId },
      include: {
        company: true,
        warehouses: { where: { isSellable: true }, orderBy: { isDefault: 'desc' }, take: 1 },
      },
    }),
    input.registerId ? db.register.findUnique({ where: { id: input.registerId } }) : Promise.resolve(null),
  ]);

  if (!store) throw new CheckoutError('Poslovnica ne postoji.', 'UNKNOWN_STORE');
  const warehouse = store.warehouses[0];
  if (!warehouse) throw new CheckoutError('Poslovnica nema prodajno skladište.', 'NO_WAREHOUSE');

  const quote = await quoteBasket({
    tenantId: input.tenantId,
    storeId: input.storeId,
    channel: input.channel,
    customerId: input.customerId,
    lines: input.lines,
    couponCodes: input.couponCodes,
  });

  const isCashOnly = await isCashPaymentOnly(input.payments);
  const total = input.cashRounding && isCashOnly ? roundCash(quote.total) : quote.total;
  const roundingAmount = roundAmount(total - quote.total);

  const paidTotal = roundAmount(input.payments.reduce((acc, p) => acc + p.amount, 0));
  if (paidTotal + 0.001 < total) {
    throw new CheckoutError(
      `Plaćeni iznos (${paidTotal.toFixed(2)}) manji je od iznosa računa (${total.toFixed(2)}).`,
      'UNDERPAID',
    );
  }
  const changeAmount = roundAmount(paidTotal - total);

  const variantCosts = await currentCosts(warehouse.id, quote.lines.map((l) => l.variantId));

  const sale = await db.$transaction(async (tx) => {
    await assertAvailable(
      tx,
      warehouse.id,
      quote.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, name: l.name })),
      store.allowNegativeStock,
    );

    const kind = input.kind ?? 'RECEIPT';
    const numbering =
      kind === 'RECEIPT'
        ? await nextReceiptNumber(input.tenantId, {
            storeId: store.id,
            storeCode: store.code,
            registerCode: register?.code ?? '1',
            tx,
          })
        : await nextDocumentNumber(input.tenantId, kind === 'INVOICE' ? 'invoice' : 'proforma', { tx });

    const costTotal = roundAmount(
      quote.lines.reduce((acc, l) => acc + (variantCosts.get(l.variantId) ?? 0) * l.quantity, 0),
    );

    const created = await tx.sale.create({
      data: {
        tenantId: input.tenantId,
        storeId: store.id,
        registerId: register?.id ?? null,
        shiftId: input.shiftId ?? null,
        userId: input.userId,
        customerId: input.customerId ?? null,
        number: numbering.number,
        sequenceNo: numbering.sequenceNo,
        kind,
        status: 'COMPLETED',
        channel: input.channel ?? 'POS',
        currency: store.company.vatRegistered ? 'EUR' : 'EUR',
        subtotal: new Prisma.Decimal(quote.subtotal),
        discountTotal: new Prisma.Decimal(quote.discountTotal),
        taxTotal: new Prisma.Decimal(quote.taxTotal),
        depositTotal: new Prisma.Decimal(quote.depositTotal),
        roundingAmount: new Prisma.Decimal(roundingAmount),
        total: new Prisma.Decimal(total),
        paidTotal: new Prisma.Decimal(paidTotal),
        changeAmount: new Prisma.Decimal(changeAmount),
        costTotal: new Prisma.Decimal(costTotal),
        marginTotal: new Prisma.Decimal(roundAmount(total - quote.taxTotal - costTotal)),
        fiscalStatus: store.fiscalEnabled && fiscalAdapter().requiresFiscalization ? 'PENDING' : 'NOT_REQUIRED',
        fiscalPaymentType: fiscalPaymentType(input.payments, await paymentTypeMap(input.tenantId)),
        note: input.note ?? null,
        receiptEmail: input.receiptEmail ?? null,
        clientUuid: input.clientUuid ?? null,
        completedAt: new Date(),
        lines: {
          create: quote.lines.map((l, index) => ({
            variantId: l.variantId,
            lineNo: index + 1,
            sku: l.sku,
            name: l.name,
            quantity: new Prisma.Decimal(l.quantity),
            unitPrice: new Prisma.Decimal(l.unitPrice),
            originalPrice: new Prisma.Decimal(l.originalPrice),
            discountPct: new Prisma.Decimal(l.manualDiscountPct),
            discountAmount: new Prisma.Decimal(l.discountAmount),
            taxRate: new Prisma.Decimal(l.taxRate),
            taxAmount: new Prisma.Decimal(l.taxAmount),
            depositAmount: new Prisma.Decimal(l.depositAmount),
            lineTotal: new Prisma.Decimal(l.lineTotal),
            unitCost: new Prisma.Decimal(variantCosts.get(l.variantId) ?? 0),
            costTotal: new Prisma.Decimal(roundAmount((variantCosts.get(l.variantId) ?? 0) * l.quantity)),
            marginAmount: new Prisma.Decimal(
              roundAmount(l.lineTotal - l.taxAmount - (variantCosts.get(l.variantId) ?? 0) * l.quantity),
            ),
            serialNumber: l.serialNumber ?? null,
            lotNumber: l.lotNumber ?? null,
            note: l.note ?? null,
            soldById: input.userId,
          })),
        },
        taxLines: {
          create: quote.taxLines.map((t) => ({
            taxRate: new Prisma.Decimal(t.rate),
            taxName: t.name,
            baseAmount: new Prisma.Decimal(t.base),
            taxAmount: new Prisma.Decimal(t.amount),
          })),
        },
      },
      include: { lines: true },
    });

    // --- Popusti -----------------------------------------------------------
    const lineIdByKey = new Map(created.lines.map((l, index) => [`L${index}`, l.id]));
    if (quote.discounts.length > 0) {
      await tx.saleDiscount.createMany({
        data: quote.discounts.map((d) => ({
          saleId: created.id,
          saleLineId: d.lineKey ? (lineIdByKey.get(d.lineKey) ?? null) : null,
          promotionId: d.promotionId.startsWith('loyalty') ? null : d.promotionId,
          scope: d.lineKey ? 'LINE' : 'ORDER',
          origin: d.promotionId.startsWith('loyalty') ? 'LOYALTY' : 'PROMOTION',
          code: d.promotionCode,
          description: d.description,
          percent: d.percent !== null ? new Prisma.Decimal(d.percent) : null,
          amount: new Prisma.Decimal(d.amount),
        })),
      });
    }

    // --- Plaćanja ----------------------------------------------------------
    for (const payment of input.payments) {
      let giftCardId: string | null = null;
      if (payment.giftCardCode) {
        const card = await tx.giftCard.findFirst({
          where: { tenantId: input.tenantId, code: payment.giftCardCode, isActive: true },
        });
        if (!card) throw new CheckoutError('Poklon kartica nije pronađena ili nije aktivna.', 'GIFT_CARD');
        if (toNumber(card.balance) < payment.amount) {
          throw new CheckoutError('Nedovoljno sredstava na poklon kartici.', 'GIFT_CARD_BALANCE');
        }
        await tx.giftCard.update({
          where: { id: card.id },
          data: { balance: { decrement: new Prisma.Decimal(payment.amount) } },
        });
        giftCardId = card.id;
      }

      await tx.payment.create({
        data: {
          saleId: created.id,
          paymentMethodId: payment.paymentMethodId,
          amount: new Prisma.Decimal(payment.amount),
          tendered: payment.tendered !== undefined ? new Prisma.Decimal(payment.tendered) : null,
          changeGiven: new Prisma.Decimal(0),
          reference: payment.reference ?? null,
          authCode: payment.authCode ?? null,
          cardBrand: payment.cardBrand ?? null,
          cardLast4: payment.cardLast4 ?? null,
          giftCardId,
        },
      });
    }

    // --- Knjiženje zalihe ---------------------------------------------------
    for (const line of quote.lines) {
      await postMovement(tx, {
        warehouseId: warehouse.id,
        variantId: line.variantId,
        type: 'SALE',
        quantity: line.quantity,
        unitCost: variantCosts.get(line.variantId) ?? 0,
        refType: 'sale',
        refId: created.id,
        refNumber: created.number,
        userId: input.userId,
      });
    }

    // --- Vjernost -----------------------------------------------------------
    if (input.customerId) {
      await applyLoyalty(tx, {
        tenantId: input.tenantId,
        customerId: input.customerId,
        saleId: created.id,
        eligibleAmount: roundAmount(total - quote.depositTotal),
        redeemPoints: input.loyaltyPointsToRedeem ?? 0,
      });

      await tx.customer.update({
        where: { id: input.customerId },
        data: {
          totalSpent: { increment: new Prisma.Decimal(total) },
          orderCount: { increment: 1 },
          lastPurchaseAt: new Date(),
        },
      });
    }

    // --- Smjena -------------------------------------------------------------
    if (input.shiftId) {
      const cashAmount = await cashPortion(tx, input.tenantId, input.payments);
      const cardAmount = await cardPortion(tx, input.tenantId, input.payments);
      // Ostatak se uvijek vraća u gotovini, pa je neto gotovinski promet
      // umanjen za vraćeni iznos — i u izvještaju i u saldu ladice.
      const cashNet = roundAmount(cashAmount - changeAmount);

      await tx.shift.update({
        where: { id: input.shiftId },
        data: {
          salesCount: { increment: 1 },
          salesTotal: { increment: new Prisma.Decimal(total) },
          cashTotal: { increment: new Prisma.Decimal(cashNet) },
          cardTotal: { increment: new Prisma.Decimal(cardAmount) },
          otherTotal: { increment: new Prisma.Decimal(roundAmount(total - cashNet - cardAmount)) },
          discountTotal: { increment: new Prisma.Decimal(quote.discountTotal) },
          expectedCash: { increment: new Prisma.Decimal(cashNet) },
        },
      });

      if (cashNet !== 0) {
        await tx.cashMovement.create({
          data: {
            storeId: store.id,
            shiftId: input.shiftId,
            userId: input.userId,
            type: 'SALE_CASH',
            amount: new Prisma.Decimal(cashNet),
            reference: created.number,
          },
        });
      }
    }

    // --- Ažuriranje potrošnje akcija ---------------------------------------
    const promoIds = Array.from(
      new Set(quote.discounts.map((d) => d.promotionId).filter((id) => !id.startsWith('loyalty'))),
    );
    if (promoIds.length > 0) {
      await tx.promotion.updateMany({ where: { id: { in: promoIds } }, data: { usageCount: { increment: 1 } } });
    }

    // --- Dnevni KPI ---------------------------------------------------------
    await upsertDailyKpi(tx, {
      tenantId: input.tenantId,
      storeId: store.id,
      total,
      taxTotal: quote.taxTotal,
      discountTotal: quote.discountTotal,
      costTotal,
      items: quote.lines.reduce((acc, l) => acc + l.quantity, 0),
    });

    // --- Outbox -------------------------------------------------------------
    await tx.outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'sale.completed',
        aggregateType: 'sale',
        aggregateId: created.id,
        payload: { saleId: created.id, number: created.number, total, storeId: store.id },
      },
    });

    return created;
  }, { timeout: 20_000 });

  await audit({
    tenantId: input.tenantId,
    userId: input.userId,
    storeId: input.storeId,
    action: 'CREATE',
    entityType: 'sale',
    entityId: sale.id,
    summary: `Račun ${sale.number} · ${total.toFixed(2)} EUR`,
  });

  // --- Fiskalizacija (izvan transakcije) -----------------------------------
  if (sale.fiscalStatus === 'PENDING') {
    await fiscalizeSale(sale.id).catch((error) => {
      console.error('[fiscal] neuspjela fiskalizacija', sale.number, error);
    });
  }

  const full = await db.sale.findUnique({
    where: { id: sale.id },
    include: { lines: true, payments: { include: { paymentMethod: true } }, taxLines: true, discounts: true },
  });

  return { sale: full!, duplicate: false as const, change: changeAmount };
}

/** Šalje račun fiskalnom servisu i bilježi ishod. */
export async function fiscalizeSale(saleId: string) {
  const adapter = fiscalAdapter();
  if (!adapter.requiresFiscalization) return null;

  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      store: { include: { company: true } },
      register: true,
      taxLines: true,
      user: true,
    },
  });
  if (!sale || !sale.store.fiscalEnabled) return null;

  const payload = {
    saleId: sale.id,
    number: sale.number,
    sequenceNo: sale.sequenceNo,
    issuedAt: sale.issuedAt,
    issuerVatId: sale.store.company.vatId,
    operatorVatId: sale.store.company.fiscalOperator ?? sale.store.company.vatId,
    inVatSystem: sale.store.company.vatRegistered,
    storeCode: sale.store.code,
    registerCode: sale.register?.code ?? '1',
    sequenceMark: sale.fiscalSeqMark as 'N' | 'P',
    total: toNumber(sale.total),
    taxes: sale.taxLines.map((t) => ({
      rate: toNumber(t.taxRate),
      base: toNumber(t.baseAmount),
      amount: toNumber(t.taxAmount),
    })),
    paymentType: (sale.fiscalPaymentType ?? 'G') as 'G' | 'K' | 'C' | 'T' | 'O',
  };

  const attempt = sale.fiscalRetries + 1;
  try {
    const result = await adapter.fiscalize(payload);
    await db.$transaction([
      db.sale.update({
        where: { id: sale.id },
        data: {
          fiscalStatus: result.ok ? 'CONFIRMED' : 'FAILED',
          fiscalJir: result.jir ?? null,
          fiscalZki: result.zki ?? null,
          fiscalQrUrl: result.qrUrl ?? null,
          fiscalSentAt: new Date(),
          fiscalError: result.ok ? null : (result.errorMessage ?? 'Nepoznata greška'),
          fiscalRetries: attempt,
        },
      }),
      db.fiscalLog.create({
        data: {
          saleId: sale.id,
          attempt,
          status: result.ok ? 'CONFIRMED' : 'FAILED',
          requestXml: result.requestXml ?? null,
          responseXml: result.responseXml ?? null,
          jir: result.jir ?? null,
          zki: result.zki ?? null,
          errorCode: result.errorCode ?? null,
          errorMessage: result.errorMessage ?? null,
          durationMs: result.durationMs,
        },
      }),
    ]);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.$transaction([
      db.sale.update({
        where: { id: sale.id },
        data: { fiscalStatus: 'FAILED', fiscalError: message, fiscalRetries: attempt },
      }),
      db.fiscalLog.create({
        data: { saleId: sale.id, attempt, status: 'FAILED', errorMessage: message },
      }),
    ]);
    throw error;
  }
}

// ---------------------------------------------------------------------------
//  Pomoćne funkcije
// ---------------------------------------------------------------------------

async function currentCosts(warehouseId: string, variantIds: string[]) {
  const items = await db.stockItem.findMany({
    where: { warehouseId, variantId: { in: variantIds } },
    select: { variantId: true, avgCost: true },
  });
  return new Map(items.map((i) => [i.variantId, toNumber(i.avgCost)]));
}

async function paymentTypeMap(tenantId: string) {
  const methods = await db.paymentMethod.findMany({ where: { tenantId } });
  return new Map(methods.map((m) => [m.id, m]));
}

async function isCashPaymentOnly(payments: CheckoutPaymentInput[]) {
  if (payments.length !== 1) return false;
  const method = await db.paymentMethod.findUnique({ where: { id: payments[0].paymentMethodId } });
  return method?.type === 'CASH';
}

function fiscalPaymentType(
  payments: CheckoutPaymentInput[],
  methods: Map<string, { type: string; fiscalCode: string | null }>,
): 'G' | 'K' | 'C' | 'T' | 'O' {
  if (payments.length === 0) return 'O';
  const primary = [...payments].sort((a, b) => b.amount - a.amount)[0];
  const method = methods.get(primary.paymentMethodId);
  if (method?.fiscalCode) return method.fiscalCode as 'G' | 'K' | 'C' | 'T' | 'O';
  switch (method?.type) {
    case 'CASH': return 'G';
    case 'CARD': return 'K';
    case 'CHECK': return 'C';
    case 'BANK_TRANSFER': return 'T';
    default: return 'O';
  }
}

async function cashPortion(tx: Prisma.TransactionClient, tenantId: string, payments: CheckoutPaymentInput[]) {
  const methods = await tx.paymentMethod.findMany({ where: { tenantId, type: 'CASH' } });
  const ids = new Set(methods.map((m) => m.id));
  return roundAmount(payments.filter((p) => ids.has(p.paymentMethodId)).reduce((a, p) => a + p.amount, 0));
}

async function cardPortion(tx: Prisma.TransactionClient, tenantId: string, payments: CheckoutPaymentInput[]) {
  const methods = await tx.paymentMethod.findMany({ where: { tenantId, type: 'CARD' } });
  const ids = new Set(methods.map((m) => m.id));
  return roundAmount(payments.filter((p) => ids.has(p.paymentMethodId)).reduce((a, p) => a + p.amount, 0));
}

async function applyLoyalty(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; customerId: string; saleId: string; eligibleAmount: number; redeemPoints: number },
) {
  const card = await tx.loyaltyCard.findFirst({
    where: { customerId: args.customerId, isActive: true },
    include: { program: true, tier: true },
  });
  if (!card || !card.program.isActive) return;

  if (args.redeemPoints > 0) {
    if (args.redeemPoints > card.points) throw new CheckoutError('Nedovoljno bodova vjernosti.', 'LOYALTY_BALANCE');
    if (args.redeemPoints < card.program.minRedeemPoints) {
      throw new CheckoutError(`Minimalno ${card.program.minRedeemPoints} bodova za iskorištavanje.`, 'LOYALTY_MIN');
    }
    const balance = card.points - args.redeemPoints;
    await tx.loyaltyCard.update({ where: { id: card.id }, data: { points: balance } });
    await tx.loyaltyTransaction.create({
      data: {
        cardId: card.id,
        customerId: args.customerId,
        saleId: args.saleId,
        type: 'REDEEM',
        points: -args.redeemPoints,
        balanceAfter: balance,
        description: 'Iskorišteni bodovi na računu',
      },
    });
  }

  const multiplier = toNumber(card.tier?.pointsMultiplier ?? 1) || 1;
  const earned = Math.floor(args.eligibleAmount * toNumber(card.program.pointsPerUnit) * multiplier);
  if (earned <= 0) return;

  const current = await tx.loyaltyCard.findUnique({ where: { id: card.id } });
  const balance = (current?.points ?? 0) + earned;
  await tx.loyaltyCard.update({
    where: { id: card.id },
    data: { points: balance, lifetimePoints: { increment: earned } },
  });
  await tx.loyaltyTransaction.create({
    data: {
      cardId: card.id,
      customerId: args.customerId,
      saleId: args.saleId,
      type: 'EARN',
      points: earned,
      balanceAfter: balance,
      description: 'Bodovi za kupnju',
      expiresAt: card.program.expiryMonths
        ? new Date(Date.now() + card.program.expiryMonths * 30 * 86_400_000)
        : null,
    },
  });
  await tx.sale.update({
    where: { id: args.saleId },
    data: { loyaltyPointsEarned: earned, loyaltyPointsSpent: args.redeemPoints },
  });
}

async function upsertDailyKpi(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; storeId: string; total: number; taxTotal: number; discountTotal: number; costTotal: number; items: number },
) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const net = roundAmount(args.total - args.taxTotal);

  await tx.dailyKpi.upsert({
    where: { storeId_date: { storeId: args.storeId, date } },
    create: {
      tenantId: args.tenantId,
      storeId: args.storeId,
      date,
      salesCount: 1,
      itemsSold: new Prisma.Decimal(args.items),
      grossSales: new Prisma.Decimal(args.total),
      netSales: new Prisma.Decimal(net),
      taxTotal: new Prisma.Decimal(args.taxTotal),
      discountTotal: new Prisma.Decimal(args.discountTotal),
      costTotal: new Prisma.Decimal(args.costTotal),
      marginTotal: new Prisma.Decimal(roundAmount(net - args.costTotal)),
      avgBasket: new Prisma.Decimal(args.total),
    },
    update: {
      salesCount: { increment: 1 },
      itemsSold: { increment: new Prisma.Decimal(args.items) },
      grossSales: { increment: new Prisma.Decimal(args.total) },
      netSales: { increment: new Prisma.Decimal(net) },
      taxTotal: { increment: new Prisma.Decimal(args.taxTotal) },
      discountTotal: { increment: new Prisma.Decimal(args.discountTotal) },
      costTotal: { increment: new Prisma.Decimal(args.costTotal) },
      marginTotal: { increment: new Prisma.Decimal(roundAmount(net - args.costTotal)) },
    },
  });
}

/** Ravnomjerni razrez popusta na košaricu — izloženo za testove i izvještaje. */
export { allocate };
