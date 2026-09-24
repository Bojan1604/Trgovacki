import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(2).max(120).optional(),
  legalName: z.string().max(160).optional(),
  vatId: z.string().max(20).optional(),
  contactPerson: z.string().max(120).optional(),
  email: z.string().email('Neispravna e-pošta.').max(120).optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  addressLine: z.string().max(160).optional(),
  city: z.string().max(80).optional(),
  postalCode: z.string().max(20).optional(),
  iban: z.string().max(34).optional(),
  paymentTerms: z.number().int().min(0).max(365).optional(),
  leadTimeDays: z.number().int().min(0).max(365).optional(),
  minOrderValue: z.number().min(0).optional(),
  discountPct: z.number().min(0).max(99.99).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('supplier.manage');
    const { id } = await context.params;
    const body = await readJson(request, schema);

    const existing = await db.supplier.findFirst({ where: { id, tenantId: user.tenantId }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: 'Dobavljač ne postoji.' }, { status: 404 });

    const text = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);

    const supplier = await db.supplier.update({
      where: { id: existing.id },
      data: {
        code: body.code?.trim().toUpperCase(),
        name: body.name?.trim(),
        legalName: text(body.legalName),
        vatId: text(body.vatId),
        contactPerson: text(body.contactPerson),
        email: text(body.email),
        phone: text(body.phone),
        addressLine: text(body.addressLine),
        city: text(body.city),
        postalCode: text(body.postalCode),
        iban: text(body.iban),
        paymentTerms: body.paymentTerms,
        leadTimeDays: body.leadTimeDays,
        minOrderValue: body.minOrderValue === undefined ? undefined : new Prisma.Decimal(body.minOrderValue),
        discountPct: body.discountPct === undefined ? undefined : new Prisma.Decimal(body.discountPct),
        isActive: body.isActive,
      },
    });

    await audit({
      tenantId: user.tenantId, userId: user.id, action: 'UPDATE',
      entityType: 'supplier', entityId: supplier.id,
      summary: `Izmijenjen dobavljač ${supplier.code} · ${supplier.name}`,
    });

    return NextResponse.json({ id: supplier.id, code: supplier.code, name: supplier.name });
  } catch (error) {
    return apiError(error);
  }
}
