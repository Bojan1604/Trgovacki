import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { closeShift, openShift, recordCashMovement } from '@/lib/services/shifts';
import { toNumber } from '@/lib/money';

const openSchema = z.object({
  action: z.literal('open'),
  storeId: z.string().min(1),
  registerId: z.string().min(1),
  openingFloat: z.number().nonnegative(),
  note: z.string().max(300).optional(),
});

const closeSchema = z.object({
  action: z.literal('close'),
  shiftId: z.string().min(1),
  countedCash: z.number().nonnegative(),
  note: z.string().max(300).optional(),
});

const cashSchema = z.object({
  action: z.literal('cash'),
  storeId: z.string().min(1),
  shiftId: z.string().min(1),
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'EXPENSE', 'CORRECTION']),
  amount: z.number().positive(),
  note: z.string().max(300).optional(),
});

const schema = z.discriminatedUnion('action', [openSchema, closeSchema, cashSchema]);

/** Otvaranje i zatvaranje smjene te polog/podizanje gotovine. */
export async function POST(request: Request) {
  try {
    const user = await requirePermission('shift.manage');
    const body = await readJson(request, schema);

    if (body.action === 'open') {
      const shift = await openShift({
        tenantId: user.tenantId,
        storeId: body.storeId,
        registerId: body.registerId,
        userId: user.id,
        openingFloat: body.openingFloat,
        note: body.note,
      });
      return NextResponse.json({ shiftId: shift.id, number: shift.number });
    }

    if (body.action === 'close') {
      const shift = await closeShift({
        tenantId: user.tenantId,
        shiftId: body.shiftId,
        userId: user.id,
        countedCash: body.countedCash,
        note: body.note,
      });
      return NextResponse.json({
        shiftId: shift.id,
        number: shift.number,
        expectedCash: toNumber(shift.expectedCash),
        countedCash: toNumber(shift.countedCash),
        difference: toNumber(shift.cashDifference),
        salesTotal: toNumber(shift.salesTotal),
        salesCount: shift.salesCount,
      });
    }

    const movement = await recordCashMovement({
      tenantId: user.tenantId,
      storeId: body.storeId,
      shiftId: body.shiftId,
      userId: user.id,
      type: body.type,
      amount: body.amount,
      note: body.note,
    });
    return NextResponse.json({ id: movement.id, balanceAfter: toNumber(movement.balanceAfter) });
  } catch (error) {
    return apiError(error);
  }
}
