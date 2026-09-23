import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  companyId: z.string().min(1, 'Odaberite tvrtku.'),
  code: z.string().min(1, 'Oznaka je obavezna.').max(20),
  name: z.string().min(2, 'Naziv je prekratak.').max(120),
  type: z.enum(['RETAIL', 'WHOLESALE', 'WAREHOUSE', 'ONLINE', 'FRANCHISE', 'POPUP']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'IN_PREPARATION', 'CLOSED']),
  addressLine: z.string().max(160).optional(),
  city: z.string().max(80).optional(),
  postalCode: z.string().max(20).optional(),
  region: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email('Neispravna e-pošta.').max(120).optional().or(z.literal('')),
  managerName: z.string().max(120).optional(),
  squareMeters: z.number().positive().optional(),
  priceListId: z.string().optional(),
  allowNegativeStock: z.boolean().optional(),
  fiscalEnabled: z.boolean().optional(),
  registerCount: z.number().int().min(1).max(20).default(1),
});

/**
 * Otvaranje poslovnice.
 *
 * Poslovnica bez skladišta i blagajne ne može ništa — ne prima robu ni ne
 * naplaćuje. Zato oboje nastaje u istoj transakciji, da nema poluotvorene
 * lokacije koju netko mora ručno dovršavati.
 */
export async function POST(request: Request) {
  try {
    const user = await requirePermission('store.manage');
    const body = await readJson(request, schema);

    const company = await db.company.findFirst({
      where: { id: body.companyId, tenantId: user.tenantId },
      select: { id: true },
    });
    if (!company) return NextResponse.json({ error: 'Tvrtka ne postoji.' }, { status: 404 });

    if (body.priceListId) {
      const priceList = await db.priceList.findFirst({
        where: { id: body.priceListId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!priceList) return NextResponse.json({ error: 'Cjenik ne postoji.' }, { status: 404 });
    }

    const store = await db.$transaction(async (tx) => {
      const created = await tx.store.create({
        data: {
          tenantId: user.tenantId,
          companyId: body.companyId,
          code: body.code.trim(),
          name: body.name.trim(),
          type: body.type,
          status: body.status,
          addressLine: body.addressLine?.trim() || null,
          city: body.city?.trim() || null,
          postalCode: body.postalCode?.trim() || null,
          region: body.region?.trim() || null,
          phone: body.phone?.trim() || null,
          email: body.email?.trim() || null,
          managerName: body.managerName?.trim() || null,
          squareMeters: body.squareMeters ?? null,
          priceListId: body.priceListId || null,
          allowNegativeStock: body.allowNegativeStock ?? false,
          fiscalEnabled: body.fiscalEnabled ?? true,
          openedAt: body.status === 'IN_PREPARATION' ? null : new Date(),
        },
      });

      await tx.warehouse.create({
        data: {
          storeId: created.id,
          code: 'PP',
          name: 'Prodajni prostor',
          type: 'SALES_FLOOR',
          isDefault: true,
          isSellable: true,
        },
      });

      await tx.register.createMany({
        data: Array.from({ length: body.registerCount }, (_, i) => ({
          storeId: created.id,
          code: String(i + 1),
          name: `Blagajna ${i + 1}`,
        })),
      });

      return created;
    });

    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'store',
      entityId: store.id,
      summary: `Otvorena poslovnica ${store.code} · ${store.name}`,
    });

    return NextResponse.json({ id: store.id, code: store.code, name: store.name });
  } catch (error) {
    return apiError(error);
  }
}
