import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const TYPES = ['CASH','CARD','BANK_TRANSFER','GIFT_CARD','VOUCHER','LOYALTY_POINTS','ON_ACCOUNT','MOBILE','CHECK','OTHER'] as const;

const schema = z.object({
  code: z.string().min(1, 'Šifra je obavezna.').max(20),
  name: z.string().min(2, 'Naziv je prekratak.').max(80),
  type: z.enum(TYPES),
  fiscalCode: z.string().max(1).optional(),
  opensDrawer: z.boolean().optional(),
  allowsChange: z.boolean().optional(),
  requiresRef: z.boolean().optional(),
  feePct: z.number().min(0).max(99.999).optional(),
  isActive: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission('settings.manage');
    const body = await readJson(request, schema);

    const last = await db.paymentMethod.findFirst({
      where: { tenantId: user.tenantId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const method = await db.paymentMethod.create({
      data: {
        tenantId: user.tenantId,
        code: body.code.trim().toUpperCase(),
        name: body.name.trim(),
        type: body.type,
        fiscalCode: body.fiscalCode?.trim().toUpperCase() || null,
        opensDrawer: body.opensDrawer ?? body.type === 'CASH',
        allowsChange: body.allowsChange ?? body.type === 'CASH',
        requiresRef: body.requiresRef ?? false,
        feePct: new Prisma.Decimal(body.feePct ?? 0),
        isActive: body.isActive ?? true,
        sortOrder: (last?.sortOrder ?? 0) + 10,
      },
    });

    await audit({
      tenantId: user.tenantId, userId: user.id, action: 'CREATE',
      entityType: 'payment_method', entityId: method.id,
      summary: `Kreiran način plaćanja ${method.code} · ${method.name}`,
    });

    return NextResponse.json({ id: method.id, code: method.code, name: method.name });
  } catch (error) {
    return apiError(error);
  }
}
