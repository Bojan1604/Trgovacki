import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('product.update');
    const { id } = await context.params;
    const body = await readJson(request, schema);

    const existing = await db.brand.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Brend ne postoji.' }, { status: 404 });

    const brand = await db.brand.update({
      where: { id: existing.id },
      data: {
        code: body.code?.trim().toUpperCase(),
        name: body.name?.trim(),
        isActive: body.isActive,
      },
    });

    await audit({
      tenantId: user.tenantId, userId: user.id, action: 'UPDATE',
      entityType: 'brand', entityId: brand.id,
      summary: `Izmijenjen brend ${brand.code} · ${brand.name}`,
    });

    return NextResponse.json({ id: brand.id, code: brand.code, name: brand.name });
  } catch (error) {
    return apiError(error);
  }
}
