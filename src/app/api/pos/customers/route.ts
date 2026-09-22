import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { toNumber } from '@/lib/money';
import { nextDocumentNumber } from '@/lib/services/numbering';

/** Brza pretraga kupaca na blagajni — po imenu, telefonu, e-pošti ili kartici. */
export async function GET(request: Request) {
  try {
    const user = await requirePermission('pos.operate');
    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) return NextResponse.json({ items: [] });

    const customers = await db.customer.findMany({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { vatId: { startsWith: q } },
          { code: { startsWith: q } },
          { loyaltyCards: { some: { cardNumber: { startsWith: q } } } },
        ],
      },
      include: {
        group: { select: { name: true, discountPct: true } },
        loyaltyCards: { where: { isActive: true }, include: { tier: { select: { name: true, discountPct: true } } }, take: 1 },
      },
      take: 12,
    });

    return NextResponse.json({
      items: customers.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.companyName || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim(),
        type: c.type,
        vatId: c.vatId,
        phone: c.phone,
        email: c.email,
        group: c.group?.name ?? null,
        discountPct: Math.max(toNumber(c.discountPct), toNumber(c.loyaltyCards[0]?.tier?.discountPct ?? 0)),
        points: c.loyaltyCards[0]?.points ?? 0,
        tier: c.loyaltyCards[0]?.tier?.name ?? null,
        cardNumber: c.loyaltyCards[0]?.cardNumber ?? null,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

const createSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  marketingOptIn: z.boolean().optional(),
});

/** Kreiranje kupca izravno s blagajne (npr. pri izdavanju kartice vjernosti). */
export async function POST(request: Request) {
  try {
    const user = await requirePermission('customer.manage');
    const body = await readJson(request, createSchema);
    const numbering = await nextDocumentNumber(user.tenantId, 'customer');

    const customer = await db.customer.create({
      data: {
        tenantId: user.tenantId,
        code: numbering.number.split('/')[0],
        type: 'RETAIL',
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone || null,
        email: body.email || null,
        marketingOptIn: body.marketingOptIn ?? false,
        gdprConsentAt: body.marketingOptIn ? new Date() : null,
      },
    });

    return NextResponse.json({
      id: customer.id,
      code: customer.code,
      name: `${customer.firstName} ${customer.lastName}`,
      discountPct: 0,
      points: 0,
      tier: null,
    });
  } catch (error) {
    return apiError(error);
  }
}
