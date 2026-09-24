import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  code: z.string().min(1, 'Šifra je obavezna.').max(20),
  name: z.string().min(2, 'Naziv je prekratak.').max(120),
  isActive: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requirePermission('product.create');
    const body = await readJson(request, schema);

    const brand = await db.brand.create({
      data: {
        tenantId: user.tenantId,
        code: body.code.trim().toUpperCase(),
        name: body.name.trim(),
        isActive: body.isActive ?? true,
      },
    });

    await audit({
      tenantId: user.tenantId, userId: user.id, action: 'CREATE',
      entityType: 'brand', entityId: brand.id,
      summary: `Kreiran brend ${brand.code} · ${brand.name}`,
    });

    return NextResponse.json({ id: brand.id, code: brand.code, name: brand.name });
  } catch (error) {
    return apiError(error);
  }
}
