import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(2).max(120).optional(),
  type: z.enum(['RETAIL', 'WHOLESALE', 'WAREHOUSE', 'ONLINE', 'FRANCHISE', 'POPUP']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'IN_PREPARATION', 'CLOSED']).optional(),
  addressLine: z.string().max(160).optional(),
  city: z.string().max(80).optional(),
  postalCode: z.string().max(20).optional(),
  region: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email('Neispravna e-pošta.').max(120).optional().or(z.literal('')),
  managerName: z.string().max(120).optional(),
  squareMeters: z.number().positive().nullable().optional(),
  priceListId: z.string().optional(),
  allowNegativeStock: z.boolean().optional(),
  fiscalEnabled: z.boolean().optional(),
});

/** Izmjena podataka poslovnice. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('store.manage');
    const { id } = await context.params;
    const body = await readJson(request, schema);

    const store = await db.store.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, code: true, name: true, status: true, openedAt: true },
    });
    if (!store) return NextResponse.json({ error: 'Poslovnica ne postoji.' }, { status: 404 });

    if (body.priceListId) {
      const priceList = await db.priceList.findFirst({
        where: { id: body.priceListId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!priceList) return NextResponse.json({ error: 'Cjenik ne postoji.' }, { status: 404 });
    }

    const text = (value: string | undefined) => (value === undefined ? undefined : value.trim() || null);

    const updated = await db.store.update({
      where: { id: store.id },
      data: {
        code: body.code?.trim(),
        name: body.name?.trim(),
        type: body.type,
        status: body.status,
        addressLine: text(body.addressLine),
        city: text(body.city),
        postalCode: text(body.postalCode),
        region: text(body.region),
        phone: text(body.phone),
        email: text(body.email),
        managerName: text(body.managerName),
        squareMeters: body.squareMeters,
        priceListId: body.priceListId === undefined ? undefined : body.priceListId || null,
        allowNegativeStock: body.allowNegativeStock,
        fiscalEnabled: body.fiscalEnabled,
        // Datum otvaranja se upisuje kad lokacija prvi put prestane biti u pripremi.
        openedAt:
          store.openedAt === null && body.status !== undefined && body.status !== 'IN_PREPARATION'
            ? new Date()
            : undefined,
        closedAt: body.status === 'CLOSED' ? new Date() : body.status ? null : undefined,
      },
    });

    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'store',
      entityId: updated.id,
      summary: `Izmijenjena poslovnica ${updated.code} · ${updated.name}`,
    });

    return NextResponse.json({ id: updated.id, code: updated.code, name: updated.name });
  } catch (error) {
    return apiError(error);
  }
}
