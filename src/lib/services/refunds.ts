import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '../db';
import { audit } from '../audit';
import { roundAmount, taxFromGross, toNumber } from '../money';
import { postMovement } from './inventory';
import { nextReceiptNumber } from './numbering';
import { fiscalizeSale } from './sales';
import { fiscalAdapter } from '../fiscal';

export interface RefundLineInput {
  saleLineId: string;
  quantity: number;
  /** Vraća li se roba na zalihu (npr. neispravan artikl ide na otpis). */
  restock?: boolean;
  reasonCodeId?: string | null;
}

export interface RefundInput {
  tenantId: string;
  saleId: string;
  userId: string;
  shiftId?: string | null;
  registerId?: string | null;
  lines: RefundLineInput[];
  /** Način povrata novca — mora biti jedna od metoda plaćanja. */
  paymentMethodId: string;
  reason: string;
  note?: string;
}

export class RefundError extends Error {
  constructor(message: string, readonly code = 'REFUND_ERROR') {
    super(message);
  }
}

/**
 * Povrat / storno računa.
 *
 * Kreira novi dokument tipa CREDIT_NOTE s negativnim iznosima, vraća robu na
 * zalihu po izvornoj nabavnoj cijeni i poništava bodove vjernosti.
 * Djelomični povrat je podržan po stavci i po količini.
 */
export async function refundSale(input: RefundInput) {
  const original = await db.sale.findUnique({
    where: { id: input.saleId },
    include: {
      lines: true,
      store: { include: { warehouses: { where: { isSellable: true }, orderBy: { isDefault: 'desc' }, take: 1 } } },
      register: true,
    },
  });

  if (!original) throw new RefundError('Izvorni račun ne postoji.', 'NOT_FOUND');
  if (original.tenantId !== input.tenantId) throw new RefundError('Račun pripada drugoj organizaciji.', 'FORBIDDEN');
  if (original.status === 'CANCELLED') throw new RefundError('Račun je već storniran.', 'ALREADY_CANCELLED');

  const warehouse = original.store.warehouses[0];
  if (!warehouse) throw new RefundError('Poslovnica nema skladište za povrat.', 'NO_WAREHOUSE');

  if (input.shiftId) {
    const shift = await db.shift.findFirst({
      where: { id: input.shiftId, tenantId: input.tenantId, storeId: original.storeId, status: 'OPEN' },
      select: { id: true },
    });
    if (!shift) throw new RefundError('Smjena nije otvorena na ovoj poslovnici.', 'SHIFT_MISMATCH');
  }

  const method = await db.paymentMethod.findFirst({
    where: { id: input.paymentMethodId, tenantId: input.tenantId },
    select: { id: true },
  });
  if (!method) throw new RefundError('Način povrata novca nije ispravan.', 'PAYMENT_METHOD');

  const lineMap = new Map(original.lines.map((l) => [l.id, l]));
  const refundLines = input.lines.map((rl) => {
    const line = lineMap.get(rl.saleLineId);
    if (!line) throw new RefundError(`Stavka ${rl.saleLineId} nije na izvornom računu.`, 'UNKNOWN_LINE');
    const available = toNumber(line.quantity) - toNumber(line.refundedQty);
    if (rl.quantity > available + 1e-6) {
      throw new RefundError(
        `Za ${line.name} je moguće vratiti najviše ${available} kom.`,
        'QTY_EXCEEDED',
      );
    }
    return { input: rl, line, available };
  });

  const refund = await db.$transaction(async (tx) => {
    const numbering = await nextReceiptNumber(input.tenantId, {
      storeId: original.storeId,
      storeCode: original.store.code,
      registerCode: original.register?.code ?? '1',
      tx,
    });

    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let depositTotal = 0;
    let costTotal = 0;
    const taxBuckets = new Map<number, { base: number; amount: number }>();

    const linesData = refundLines.map(({ input: rl, line }, index) => {
      const unitPrice = toNumber(line.unitPrice);
      const qty = rl.quantity;
      const lineTotal = roundAmount(-(unitPrice * qty));
      const taxRate = toNumber(line.taxRate);
      const taxAmount = -taxFromGross(Math.abs(lineTotal), taxRate);
      const unitCost = toNumber(line.unitCost);
      const deposit = roundAmount(-(toNumber(line.depositAmount) / Math.max(toNumber(line.quantity), 1)) * qty);

      subtotal = roundAmount(subtotal + roundAmount(-(toNumber(line.originalPrice) * qty)));
      discountTotal = roundAmount(
        discountTotal - (toNumber(line.discountAmount) / Math.max(toNumber(line.quantity), 1)) * qty,
      );
      taxTotal = roundAmount(taxTotal + taxAmount);
      depositTotal = roundAmount(depositTotal + deposit);
      costTotal = roundAmount(costTotal - unitCost * qty);

      const bucket = taxBuckets.get(taxRate) ?? { base: 0, amount: 0 };
      bucket.base = roundAmount(bucket.base + (lineTotal - taxAmount));
      bucket.amount = roundAmount(bucket.amount + taxAmount);
      taxBuckets.set(taxRate, bucket);

      return {
        variantId: line.variantId,
        lineNo: index + 1,
        sku: line.sku,
        name: line.name,
        quantity: new Prisma.Decimal(-qty),
        unitPrice: new Prisma.Decimal(unitPrice),
        originalPrice: line.originalPrice,
        discountPct: line.discountPct,
        discountAmount: new Prisma.Decimal(0),
        taxRate: line.taxRate,
        taxAmount: new Prisma.Decimal(taxAmount),
        depositAmount: new Prisma.Decimal(deposit),
        lineTotal: new Prisma.Decimal(lineTotal),
        unitCost: new Prisma.Decimal(unitCost),
        costTotal: new Prisma.Decimal(roundAmount(-unitCost * qty)),
        marginAmount: new Prisma.Decimal(roundAmount(lineTotal - taxAmount + unitCost * qty)),
        note: input.reason,
        soldById: input.userId,
      };
    });

    const total = roundAmount(linesData.reduce((acc, l) => acc + toNumber(l.lineTotal) + toNumber(l.depositAmount), 0));

    const created = await tx.sale.create({
      data: {
        tenantId: input.tenantId,
        storeId: original.storeId,
        registerId: input.registerId ?? original.registerId,
        shiftId: input.shiftId ?? null,
        userId: input.userId,
        customerId: original.customerId,
        number: numbering.number,
        sequenceNo: numbering.sequenceNo,
        kind: 'CREDIT_NOTE',
        status: 'COMPLETED',
        channel: original.channel,
        subtotal: new Prisma.Decimal(subtotal),
        discountTotal: new Prisma.Decimal(discountTotal),
        taxTotal: new Prisma.Decimal(taxTotal),
        depositTotal: new Prisma.Decimal(depositTotal),
        total: new Prisma.Decimal(total),
        paidTotal: new Prisma.Decimal(total),
        costTotal: new Prisma.Decimal(costTotal),
        marginTotal: new Prisma.Decimal(roundAmount(total - taxTotal - costTotal)),
        originalSaleId: original.id,
        refundReason: input.reason,
        note: input.note ?? null,
        fiscalStatus:
          original.store.fiscalEnabled && fiscalAdapter().requiresFiscalization ? 'PENDING' : 'NOT_REQUIRED',
        fiscalPaymentType: original.fiscalPaymentType,
        completedAt: new Date(),
        lines: { create: linesData },
        taxLines: {
          create: Array.from(taxBuckets.entries()).map(([rate, b]) => ({
            taxRate: new Prisma.Decimal(rate),
            taxName: 'PDV',
            baseAmount: new Prisma.Decimal(b.base),
            taxAmount: new Prisma.Decimal(b.amount),
          })),
        },
        payments: {
          create: [
            {
              paymentMethodId: input.paymentMethodId,
              amount: new Prisma.Decimal(total),
              status: 'REFUNDED',
            },
          ],
        },
      },
      include: { lines: true },
    });

    // Vraćanje robe na zalihu
    for (const { input: rl, line } of refundLines) {
      if (rl.restock === false) continue;
      await postMovement(tx, {
        warehouseId: warehouse.id,
        variantId: line.variantId,
        type: 'SALE_RETURN',
        quantity: rl.quantity,
        unitCost: toNumber(line.unitCost),
        refType: 'refund',
        refId: created.id,
        refNumber: created.number,
        reasonCodeId: rl.reasonCodeId ?? null,
        note: input.reason,
        userId: input.userId,
      });

      await tx.saleLine.update({
        where: { id: line.id },
        data: { refundedQty: { increment: new Prisma.Decimal(rl.quantity) } },
      });
    }

    // Status izvornog računa
    const refreshed = await tx.saleLine.findMany({ where: { saleId: original.id } });
    const fullyRefunded = refreshed.every(
      (l) => toNumber(l.refundedQty) >= toNumber(l.quantity) - 1e-6,
    );
    await tx.sale.update({
      where: { id: original.id },
      data: { status: fullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    });

    // Poništavanje bodova vjernosti
    if (original.customerId && original.loyaltyPointsEarned > 0) {
      const ratio = Math.abs(total) / Math.max(toNumber(original.total), 0.01);
      const reversal = Math.round(original.loyaltyPointsEarned * Math.min(ratio, 1));
      const card = await tx.loyaltyCard.findFirst({ where: { customerId: original.customerId, isActive: true } });
      if (card && reversal > 0) {
        const balance = Math.max(card.points - reversal, 0);
        await tx.loyaltyCard.update({ where: { id: card.id }, data: { points: balance } });
        await tx.loyaltyTransaction.create({
          data: {
            cardId: card.id,
            customerId: original.customerId,
            saleId: created.id,
            type: 'REFUND_REVERSAL',
            points: -reversal,
            balanceAfter: balance,
            description: `Storno bodova za račun ${original.number}`,
          },
        });
      }
    }

    if (input.shiftId) {
      await tx.shift.update({
        where: { id: input.shiftId },
        data: { refundsTotal: { increment: new Prisma.Decimal(Math.abs(total)) } },
      });
    }

    await tx.outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'sale.refunded',
        aggregateType: 'sale',
        aggregateId: created.id,
        payload: { refundId: created.id, originalSaleId: original.id, total },
      },
    });

    return created;
  }, { timeout: 20_000 });

  await audit({
    tenantId: input.tenantId,
    userId: input.userId,
    storeId: original.storeId,
    action: 'REFUND',
    entityType: 'sale',
    entityId: refund.id,
    summary: `Povrat ${refund.number} za račun ${original.number} · razlog: ${input.reason}`,
  });

  if (refund.fiscalStatus === 'PENDING') {
    await fiscalizeSale(refund.id).catch((error) => console.error('[fiscal] povrat', error));
  }

  return refund;
}
