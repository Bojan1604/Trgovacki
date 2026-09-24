import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const TYPES = ['CASH','CARD','BANK_TRANSFER','GIFT_CARD','VOUCHER','LOYALTY_POINTS','ON_ACCOUNT','MOBILE','CHECK','OTHER'] as const;

const schema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(2).max(80).optional(),
  type: z.enum(TYPES).optional(),
  fiscalCode: z.string().max(1).optional(),
  opensDrawer: z.boolean().optional(),
  allowsChange: z.boolean().optional(),
  requiresRef: z.boolean().optional(),
  feePct: z.number().min(0).max(99.999).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('settings.manage');
    const { id } = await context.params;
    const body = await readJson(request, schema);

    const existing = await db.paymentMethod.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, code: true },
    });
    if (!existing) return NextResponse.json({ error: 'Način plaćanja ne postoji.' }, { status: 404 });

    // Blagajna bez ijednog načina plaćanja ne može zaključiti račun.
    if (body.isActive === false) {
      const active = await db.paymentMethod.count({ where: { tenantId: user.tenantId, isActive: true } });
      if (active <= 1) {
        return NextResponse.json(
          { error: 'Ovo je jedini aktivan način plaćanja — blagajna bez njega ne može naplatiti.' },
          { status: 409 },
        );
      }
    }

    const method = await db.paymentMethod.update({
      where: { id: existing.id },
      data: {
        code: body.code?.trim().toUpperCase(),
        name: body.name?.trim(),
        type: body.type,
        fiscalCode: body.fiscalCode === undefined ? undefined : body.fiscalCode.trim().toUpperCase() || null,
        opensDrawer: body.opensDrawer,
        allowsChange: body.allowsChange,
        requiresRef: body.requiresRef,
        feePct: body.feePct === undefined ? undefined : new Prisma.Decimal(body.feePct),
        isActive: body.isActive,
      },
    });

    await audit({
      tenantId: user.tenantId, userId: user.id, action: 'UPDATE',
      entityType: 'payment_method', entityId: method.id,
      summary: `Izmijenjen način plaćanja ${method.code} · ${method.name}`,
    });

    return NextResponse.json({ id: method.id, code: method.code, name: method.name });
  } catch (error) {
    return apiError(error);
  }
}
