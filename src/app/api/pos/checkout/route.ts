import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { checkout } from '@/lib/services/sales';
import { toNumber } from '@/lib/money';
import { hasPermission } from '@/lib/permissions';

const schema = z.object({
  storeId: z.string().min(1),
  registerId: z.string().min(1),
  shiftId: z.string().min(1),
  customerId: z.string().nullish(),
  clientUuid: z.string().uuid(),
  note: z.string().max(500).optional(),
  receiptEmail: z.string().email().optional(),
  cashRounding: z.boolean().optional(),
  loyaltyPointsToRedeem: z.number().int().nonnegative().optional(),
  couponCodes: z.array(z.string()).optional(),
  lines: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().positive(),
        unitPriceOverride: z.number().nonnegative().optional(),
        discountPct: z.number().min(0).max(100).optional(),
        serialNumber: z.string().optional(),
        lotNumber: z.string().optional(),
        note: z.string().optional(),
      }),
    )
    .min(1)
    .max(300),
  payments: z
    .array(
      z.object({
        paymentMethodId: z.string().min(1),
        amount: z.number(),
        tendered: z.number().optional(),
        reference: z.string().optional(),
        authCode: z.string().optional(),
        cardBrand: z.string().optional(),
        cardLast4: z.string().optional(),
        giftCardCode: z.string().optional(),
      }),
    )
    .min(1),
});

/**
 * Naplata računa.
 * `clientUuid` osigurava idempotentnost — ponovno slanje istog zahtjeva
 * (npr. nakon prekida veze) vraća već kreirani račun umjesto duplikata.
 */
export async function POST(request: Request) {
  try {
    const user = await requirePermission('pos.operate');
    const body = await readJson(request, schema);

    // Provjera ovlasti za ručne popuste i izmjenu cijene.
    const maxDiscount = user.maxDiscountPct;
    const canDiscount = hasPermission(user.permissions, 'pos.discount');
    const canOverride = hasPermission(user.permissions, 'pos.price_override');

    for (const line of body.lines) {
      if (line.discountPct && line.discountPct > 0) {
        if (!canDiscount) {
          return NextResponse.json({ error: 'Nemate pravo odobravanja popusta.' }, { status: 403 });
        }
        if (line.discountPct > maxDiscount) {
          return NextResponse.json(
            { error: `Popust iznad vašeg limita (${maxDiscount} %). Potrebno je odobrenje voditelja.` },
            { status: 403 },
          );
        }
      }
      if (line.unitPriceOverride !== undefined && !canOverride) {
        return NextResponse.json({ error: 'Nemate pravo izmjene cijene na blagajni.' }, { status: 403 });
      }
    }

    const result = await checkout({
      tenantId: user.tenantId,
      storeId: body.storeId,
      registerId: body.registerId,
      shiftId: body.shiftId,
      userId: user.id,
      customerId: body.customerId ?? null,
      channel: 'POS',
      lines: body.lines,
      payments: body.payments,
      couponCodes: body.couponCodes,
      loyaltyPointsToRedeem: body.loyaltyPointsToRedeem,
      note: body.note,
      receiptEmail: body.receiptEmail,
      clientUuid: body.clientUuid,
      cashRounding: body.cashRounding,
    });

    const sale = result.sale;
    return NextResponse.json({
      duplicate: result.duplicate,
      sale: {
        id: sale.id,
        number: sale.number,
        total: toNumber(sale.total),
        change: 'change' in result ? result.change : 0,
        issuedAt: sale.issuedAt,
        fiscalStatus: sale.fiscalStatus,
        fiscalJir: sale.fiscalJir,
        fiscalZki: sale.fiscalZki,
        fiscalQrUrl: sale.fiscalQrUrl,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
