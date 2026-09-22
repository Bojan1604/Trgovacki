import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { refundSale } from '@/lib/services/refunds';
import { toNumber } from '@/lib/money';

/** Dohvat računa za povrat po broju. */
export async function GET(request: Request) {
  try {
    const user = await requirePermission('pos.refund');
    const number = new URL(request.url).searchParams.get('number')?.trim();
    if (!number) return NextResponse.json({ error: 'Unesite broj računa.' }, { status: 400 });

    const sale = await db.sale.findFirst({
      where: { tenantId: user.tenantId, number, kind: 'RECEIPT' },
      include: {
        lines: true,
        payments: { include: { paymentMethod: { select: { id: true, name: true } } } },
        store: { select: { name: true } },
      },
    });
    if (!sale) return NextResponse.json({ error: 'Račun nije pronađen.' }, { status: 404 });

    return NextResponse.json({
      id: sale.id,
      number: sale.number,
      issuedAt: sale.issuedAt,
      storeName: sale.store.name,
      total: toNumber(sale.total),
      status: sale.status,
      payments: sale.payments.map((p) => ({
        id: p.paymentMethod.id,
        name: p.paymentMethod.name,
        amount: toNumber(p.amount),
      })),
      lines: sale.lines.map((l) => ({
        id: l.id,
        sku: l.sku,
        name: l.name,
        quantity: toNumber(l.quantity),
        refundedQty: toNumber(l.refundedQty),
        available: toNumber(l.quantity) - toNumber(l.refundedQty),
        unitPrice: toNumber(l.unitPrice),
        lineTotal: toNumber(l.lineTotal),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

const schema = z.object({
  saleId: z.string().min(1),
  shiftId: z.string().nullish(),
  registerId: z.string().nullish(),
  paymentMethodId: z.string().min(1),
  reason: z.string().min(2).max(200),
  note: z.string().max(400).optional(),
  lines: z
    .array(
      z.object({
        saleLineId: z.string().min(1),
        quantity: z.number().positive(),
        restock: z.boolean().optional(),
        reasonCodeId: z.string().nullish(),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission('pos.refund');
    const body = await readJson(request, schema);

    const refund = await refundSale({
      tenantId: user.tenantId,
      saleId: body.saleId,
      userId: user.id,
      shiftId: body.shiftId ?? null,
      registerId: body.registerId ?? null,
      lines: body.lines,
      paymentMethodId: body.paymentMethodId,
      reason: body.reason,
      note: body.note,
    });

    return NextResponse.json({
      id: refund.id,
      number: refund.number,
      total: toNumber(refund.total),
      fiscalStatus: refund.fiscalStatus,
    });
  } catch (error) {
    return apiError(error);
  }
}
