import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  code: z.string().min(1, 'Šifra je obavezna.').max(20),
  name: z.string().min(2, 'Naziv je prekratak.').max(120),
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

export async function POST(request: Request) {
  try {
    const user = await requirePermission('supplier.manage');
    const body = await readJson(request, schema);
    const text = (v?: string) => (v?.trim() ? v.trim() : null);

    const supplier = await db.supplier.create({
      data: {
        tenantId: user.tenantId,
        code: body.code.trim().toUpperCase(),
        name: body.name.trim(),
        legalName: text(body.legalName),
        vatId: text(body.vatId),
        contactPerson: text(body.contactPerson),
        email: text(body.email),
        phone: text(body.phone),
        addressLine: text(body.addressLine),
        city: text(body.city),
        postalCode: text(body.postalCode),
        iban: text(body.iban),
        paymentTerms: body.paymentTerms ?? 30,
        leadTimeDays: body.leadTimeDays ?? 3,
        minOrderValue: new Prisma.Decimal(body.minOrderValue ?? 0),
        discountPct: new Prisma.Decimal(body.discountPct ?? 0),
        isActive: body.isActive ?? true,
      },
    });

    await audit({
      tenantId: user.tenantId, userId: user.id, action: 'CREATE',
      entityType: 'supplier', entityId: supplier.id,
      summary: `Kreiran dobavljač ${supplier.code} · ${supplier.name}`,
    });

    return NextResponse.json({ id: supplier.id, code: supplier.code, name: supplier.name });
  } catch (error) {
    return apiError(error);
  }
}
