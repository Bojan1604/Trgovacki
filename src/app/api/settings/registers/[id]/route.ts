import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  code: z.string().min(1).max(10).optional(),
  name: z.string().min(2).max(80).optional(),
  deviceId: z.string().max(80).optional(),
  ipAddress: z.string().max(45).optional(),
  isActive: z.boolean().optional(),
});

/** Izmjena blagajne — preimenovanje te stavljanje izvan pogona i natrag. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('store.manage');
    const { id } = await context.params;
    const body = await readJson(request, schema);

    const register = await db.register.findFirst({
      where: { id, store: { tenantId: user.tenantId } },
      select: { id: true, code: true, name: true, store: { select: { code: true } } },
    });
    if (!register) return NextResponse.json({ error: 'Blagajna ne postoji.' }, { status: 404 });

    // Otvorena smjena drži promet i stanje ladice; gašenje bi ostavilo
    // blagajnicu bez načina da je zatvori.
    if (body.isActive === false) {
      const openShift = await db.shift.count({ where: { registerId: register.id, status: 'OPEN' } });
      if (openShift > 0) {
        return NextResponse.json(
          { error: 'Blagajna ima otvorenu smjenu. Zatvorite smjenu pa je stavite izvan pogona.' },
          { status: 409 },
        );
      }
    }

    const text = (value: string | undefined) => (value === undefined ? undefined : value.trim() || null);

    const updated = await db.register.update({
      where: { id: register.id },
      data: {
        code: body.code?.trim(),
        name: body.name?.trim(),
        deviceId: text(body.deviceId),
        ipAddress: text(body.ipAddress),
        isActive: body.isActive,
      },
    });

    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'register',
      entityId: updated.id,
      summary: `Izmijenjena blagajna ${updated.code} · ${updated.name} (${register.store.code})`,
    });

    return NextResponse.json({ id: updated.id, code: updated.code, name: updated.name, isActive: updated.isActive });
  } catch (error) {
    return apiError(error);
  }
}
