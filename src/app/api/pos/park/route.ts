import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { toNumber } from '@/lib/money';
import { quoteBasket } from '@/lib/services/sales';
import { nextDocumentNumber } from '@/lib/services/numbering';

const parkSchema = z.object({
  storeId: z.string().min(1),
  registerId: z.string().nullish(),
  customerId: z.string().nullish(),
  note: z.string().max(200).optional(),
  lines: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().positive(),
        discountPct: z.number().min(0).max(100).optional(),
        unitPriceOverride: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
});

/**
 * Parkiranje računa — kupac se vraća kasnije, blagajna je slobodna.
 * Dokument se sprema sa statusom SUSPENDED i ne knjiži zalihu ni promet.
 */
export async function POST(request: Request) {
  try {
    const user = await requirePermission('pos.operate');
    const body = await readJson(request, parkSchema);

    const quote = await quoteBasket({
      tenantId: user.tenantId,
      storeId: body.storeId,
      channel: 'POS',
      customerId: body.customerId ?? null,
      lines: body.lines,
    });

    const numbering = await nextDocumentNumber(user.tenantId, 'proforma');

    const sale = await db.sale.create({
      data: {
        tenantId: user.tenantId,
        storeId: body.storeId,
        registerId: body.registerId ?? null,
        userId: user.id,
        customerId: body.customerId ?? null,
        number: numbering.number,
        sequenceNo: numbering.sequenceNo,
        kind: 'PROFORMA',
        status: 'SUSPENDED',
        channel: 'POS',
        subtotal: new Prisma.Decimal(quote.subtotal),
        discountTotal: new Prisma.Decimal(quote.discountTotal),
        taxTotal: new Prisma.Decimal(quote.taxTotal),
        total: new Prisma.Decimal(quote.total),
        note: body.note ?? null,
        fiscalStatus: 'NOT_REQUIRED',
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
            lineTotal: new Prisma.Decimal(l.lineTotal),
          })),
        },
      },
    });

    return NextResponse.json({ id: sale.id, number: sale.number, total: toNumber(sale.total) });
  } catch (error) {
    return apiError(error);
  }
}

/** Vraćanje parkiranog računa u košaricu i brisanje privremenog dokumenta. */
export async function PUT(request: Request) {
  try {
    const user = await requirePermission('pos.operate');
    const { id } = await readJson(request, z.object({ id: z.string().min(1) }));

    const sale = await db.sale.findFirst({
      where: { id, tenantId: user.tenantId, status: 'SUSPENDED' },
      include: { lines: true, customer: { select: { id: true, firstName: true, lastName: true, companyName: true } } },
    });
    if (!sale) return NextResponse.json({ error: 'Parkirani račun nije pronađen.' }, { status: 404 });

    const lines = sale.lines.map((l) => ({
      variantId: l.variantId,
      quantity: toNumber(l.quantity),
      discountPct: toNumber(l.discountPct),
      sku: l.sku,
      name: l.name,
    }));

    await db.sale.delete({ where: { id: sale.id } });

    return NextResponse.json({
      lines,
      customerId: sale.customerId,
      customerName: sale.customer
        ? sale.customer.companyName || `${sale.customer.firstName ?? ''} ${sale.customer.lastName ?? ''}`.trim()
        : null,
      note: sale.note,
    });
  } catch (error) {
    return apiError(error);
  }
}
