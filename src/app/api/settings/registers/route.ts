import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  storeId: z.string().min(1),
  code: z.string().min(1, 'Oznaka je obavezna.').max(10),
  name: z.string().min(2, 'Naziv je prekratak.').max(80),
  deviceId: z.string().max(80).optional(),
  ipAddress: z.string().max(45).optional(),
});

/** Dodavanje blagajne u poslovnicu. */
export async function POST(request: Request) {
  try {
    const user = await requirePermission('store.manage');
    const body = await readJson(request, schema);

    // Blagajna se veže uz poslovnicu, pa provjeravamo da je ona iz iste organizacije.
    const store = await db.store.findFirst({
      where: { id: body.storeId, tenantId: user.tenantId },
      select: { id: true, code: true },
    });
    if (!store) return NextResponse.json({ error: 'Poslovnica ne postoji.' }, { status: 404 });

    const register = await db.register.create({
      data: {
        storeId: store.id,
        code: body.code.trim(),
        name: body.name.trim(),
        deviceId: body.deviceId?.trim() || null,
        ipAddress: body.ipAddress?.trim() || null,
      },
    });

    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'register',
      entityId: register.id,
      summary: `Dodana blagajna ${register.code} · ${register.name} (${store.code})`,
    });

    return NextResponse.json({ id: register.id, code: register.code, name: register.name });
  } catch (error) {
    return apiError(error);
  }
}
