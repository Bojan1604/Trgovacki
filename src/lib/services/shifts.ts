import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '../db';
import { audit } from '../audit';
import { roundAmount, toNumber } from '../money';
import { nextDocumentNumber } from './numbering';

export class ShiftError extends Error {
  constructor(message: string, readonly code = 'SHIFT_ERROR') {
    super(message);
  }
}

/** Otvara smjenu na blagajni i bilježi početni saldo ladice. */
export async function openShift(args: {
  tenantId: string;
  storeId: string;
  registerId: string;
  userId: string;
  openingFloat: number;
  note?: string;
}) {
  const existing = await db.shift.findFirst({
    where: { registerId: args.registerId, status: 'OPEN' },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (existing) {
    throw new ShiftError(
      `Na ovoj blagajni već je otvorena smjena (${existing.user.firstName} ${existing.user.lastName}).`,
      'ALREADY_OPEN',
    );
  }

  // Broj smjene je jedinstven na razini organizacije, a ne poslovnice.
  const numbering = await nextDocumentNumber(args.tenantId, 'shift');

  const shift = await db.$transaction(async (tx) => {
    const created = await tx.shift.create({
      data: {
        tenantId: args.tenantId,
        storeId: args.storeId,
        registerId: args.registerId,
        userId: args.userId,
        number: numbering.number,
        openingFloat: new Prisma.Decimal(args.openingFloat),
        expectedCash: new Prisma.Decimal(args.openingFloat),
        note: args.note ?? null,
      },
    });

    if (args.openingFloat !== 0) {
      await tx.cashMovement.create({
        data: {
          storeId: args.storeId,
          shiftId: created.id,
          userId: args.userId,
          type: 'OPENING_FLOAT',
          amount: new Prisma.Decimal(args.openingFloat),
          balanceAfter: new Prisma.Decimal(args.openingFloat),
          note: 'Početni saldo blagajne',
        },
      });
    }

    await tx.register.update({ where: { id: args.registerId }, data: { lastSeenAt: new Date() } });
    return created;
  });

  await audit({
    tenantId: args.tenantId,
    userId: args.userId,
    storeId: args.storeId,
    action: 'CREATE',
    entityType: 'shift',
    entityId: shift.id,
    summary: `Otvorena smjena ${shift.number}`,
  });

  return shift;
}

/** Zatvara smjenu, računa manjak/višak i generira Z-izvještaj. */
export async function closeShift(args: {
  tenantId: string;
  shiftId: string;
  userId: string;
  countedCash: number;
  note?: string;
}) {
  const shift = await db.shift.findFirst({
    where: { id: args.shiftId, tenantId: args.tenantId },
    include: { cashMovements: true },
  });
  if (!shift) throw new ShiftError('Smjena ne postoji.', 'NOT_FOUND');
  if (shift.status !== 'OPEN') throw new ShiftError('Smjena je već zatvorena.', 'NOT_OPEN');

  const expected = toNumber(shift.expectedCash);
  const difference = roundAmount(args.countedCash - expected);

  const closed = await db.$transaction(async (tx) => {
    const updated = await tx.shift.update({
      where: { id: args.shiftId },
      data: {
        status: 'CLOSED',
        countedCash: new Prisma.Decimal(args.countedCash),
        cashDifference: new Prisma.Decimal(difference),
        closedAt: new Date(),
        note: args.note ?? shift.note,
      },
    });

    await tx.cashMovement.create({
      data: {
        storeId: shift.storeId,
        shiftId: shift.id,
        userId: args.userId,
        type: 'CLOSING',
        amount: new Prisma.Decimal(args.countedCash),
        balanceAfter: new Prisma.Decimal(args.countedCash),
        note: `Zatvaranje smjene · razlika ${difference.toFixed(2)} EUR`,
      },
    });

    if (Math.abs(difference) >= 5) {
      await tx.notification.create({
        data: {
          tenantId: args.tenantId,
          level: Math.abs(difference) >= 20 ? 'critical' : 'warning',
          category: 'shift',
          title: `Razlika u blagajni: ${difference.toFixed(2)} EUR`,
          body: `Smjena ${shift.number} zatvorena s odstupanjem od očekivane gotovine.`,
          link: `/sales/shifts/${shift.id}`,
        },
      });
    }

    return updated;
  });

  await audit({
    tenantId: args.tenantId,
    userId: args.userId,
    storeId: shift.storeId,
    action: 'UPDATE',
    entityType: 'shift',
    entityId: shift.id,
    summary: `Zatvorena smjena ${shift.number} · razlika ${difference.toFixed(2)} EUR`,
  });

  return closed;
}

/** Polog ili podizanje gotovine iz ladice. */
export async function recordCashMovement(args: {
  tenantId: string;
  storeId: string;
  shiftId: string;
  userId: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'EXPENSE' | 'CORRECTION';
  amount: number;
  note?: string;
}) {
  const shift = await db.shift.findFirst({
    where: { id: args.shiftId, tenantId: args.tenantId, storeId: args.storeId },
  });
  if (!shift || shift.status !== 'OPEN') throw new ShiftError('Smjena nije otvorena.', 'NOT_OPEN');

  const signed = args.type === 'DEPOSIT' ? Math.abs(args.amount) : -Math.abs(args.amount);
  const balanceAfter = roundAmount(toNumber(shift.expectedCash) + signed);

  const [movement] = await db.$transaction([
    db.cashMovement.create({
      data: {
        storeId: args.storeId,
        shiftId: args.shiftId,
        userId: args.userId,
        type: args.type,
        amount: new Prisma.Decimal(signed),
        balanceAfter: new Prisma.Decimal(balanceAfter),
        note: args.note ?? null,
      },
    }),
    db.shift.update({
      where: { id: args.shiftId },
      data: { expectedCash: new Prisma.Decimal(balanceAfter) },
    }),
  ]);

  return movement;
}

/**
 * Z-izvještaj smjene: promet po načinu plaćanja, PDV-u i artiklima.
 * `tenantId` je obavezan — smjena druge organizacije se ne smije prikazati.
 */
export async function shiftReport(shiftId: string, tenantId: string) {
  const shift = await db.shift.findFirst({
    where: { id: shiftId, tenantId },
    include: {
      store: true,
      register: true,
      user: { select: { firstName: true, lastName: true } },
      cashMovements: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!shift) throw new ShiftError('Smjena ne postoji.', 'NOT_FOUND');

  const [byPayment, byTax, topItems, counts] = await Promise.all([
    db.$queryRaw<{ name: string; type: string; count: bigint; total: string }[]>`
      SELECT pm."name", pm."type", COUNT(*)::bigint AS count, COALESCE(SUM(p."amount"), 0)::text AS total
      FROM payments p
      JOIN payment_methods pm ON pm."id" = p."paymentMethodId"
      JOIN sales s ON s."id" = p."saleId"
      WHERE s."shiftId" = ${shiftId}
      GROUP BY pm."name", pm."type"
      ORDER BY total DESC
    `,
    db.$queryRaw<{ rate: string; base: string; amount: string }[]>`
      SELECT stl."taxRate"::text AS rate,
             COALESCE(SUM(stl."baseAmount"), 0)::text AS base,
             COALESCE(SUM(stl."taxAmount"), 0)::text AS amount
      FROM sale_tax_lines stl
      JOIN sales s ON s."id" = stl."saleId"
      WHERE s."shiftId" = ${shiftId}
      GROUP BY stl."taxRate"
      ORDER BY stl."taxRate" DESC
    `,
    db.$queryRaw<{ sku: string; name: string; qty: string; total: string }[]>`
      SELECT sl."sku", sl."name",
             COALESCE(SUM(sl."quantity"), 0)::text AS qty,
             COALESCE(SUM(sl."lineTotal"), 0)::text AS total
      FROM sale_lines sl
      JOIN sales s ON s."id" = sl."saleId"
      WHERE s."shiftId" = ${shiftId}
      GROUP BY sl."sku", sl."name"
      ORDER BY SUM(sl."lineTotal") DESC
      LIMIT 15
    `,
    db.sale.aggregate({
      where: { shiftId },
      _count: true,
      _sum: { total: true, discountTotal: true, taxTotal: true, costTotal: true },
    }),
  ]);

  return {
    shift,
    byPayment: byPayment.map((r) => ({ name: r.name, type: r.type, count: Number(r.count), total: Number(r.total) })),
    byTax: byTax.map((r) => ({ rate: Number(r.rate), base: Number(r.base), amount: Number(r.amount) })),
    topItems: topItems.map((r) => ({ sku: r.sku, name: r.name, qty: Number(r.qty), total: Number(r.total) })),
    totals: {
      count: counts._count,
      total: toNumber(counts._sum.total),
      discount: toNumber(counts._sum.discountTotal),
      tax: toNumber(counts._sum.taxTotal),
      cost: toNumber(counts._sum.costTotal),
    },
  };
}
