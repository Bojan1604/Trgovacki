import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertStoreAccess, requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { quoteBasket } from '@/lib/services/sales';

const schema = z.object({
  storeId: z.string().min(1),
  customerId: z.string().nullish(),
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
    .max(300),
});

/** Izračun košarice u stvarnom vremenu — cijene, akcije, PDV. */
export async function POST(request: Request) {
  try {
    const user = await requirePermission('pos.operate');
    const body = await readJson(request, schema);
    await assertStoreAccess(user, body.storeId);

    const quote = await quoteBasket({
      tenantId: user.tenantId,
      storeId: body.storeId,
      channel: 'POS',
      customerId: body.customerId ?? null,
      lines: body.lines,
      couponCodes: body.couponCodes,
    });

    return NextResponse.json(quote);
  } catch (error) {
    return apiError(error);
  }
}
