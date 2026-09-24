import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  type: z.enum(['RETAIL', 'BUSINESS', 'EMPLOYEE']).optional(),
  firstName: z.string().max(60).optional(),
  lastName: z.string().max(60).optional(),
  companyName: z.string().max(160).optional(),
  vatId: z.string().max(20).optional(),
  email: z.string().email('Neispravna e-pošta.').max(120).optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  addressLine: z.string().max(160).optional(),
  city: z.string().max(80).optional(),
  postalCode: z.string().max(20).optional(),
  groupId: z.string().optional(),
  discountPct: z.number().min(0).max(99.99).optional(),
  creditLimit: z.number().min(0).optional(),
  paymentTerms: z.number().int().min(0).max(365).optional(),
  marketingOptIn: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('customer.manage');
    const { id } = await context.params;
    const body = await readJson(request, schema);

    const existing = await db.customer.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, code: true, marketingOptIn: true, gdprConsentAt: true },
    });
    if (!existing) return NextResponse.json({ error: 'Kupac ne postoji.' }, { status: 404 });

    if (body.groupId) {
      const group = await db.customerGroup.findFirst({
        where: { id: body.groupId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!group) return NextResponse.json({ error: 'Skupina kupaca ne postoji.' }, { status: 404 });
    }

    const text = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);

    const customer = await db.customer.update({
      where: { id: existing.id },
      data: {
        type: body.type,
        firstName: text(body.firstName),
        lastName: text(body.lastName),
        companyName: text(body.companyName),
        vatId: text(body.vatId),
        email: text(body.email),
        phone: text(body.phone),
        addressLine: text(body.addressLine),
        city: text(body.city),
        postalCode: text(body.postalCode),
        groupId: body.groupId === undefined ? undefined : body.groupId || null,
        discountPct: body.discountPct === undefined ? undefined : new Prisma.Decimal(body.discountPct),
        creditLimit: body.creditLimit === undefined ? undefined : new Prisma.Decimal(body.creditLimit),
        paymentTerms: body.paymentTerms,
        marketingOptIn: body.marketingOptIn,
        // Privola se bilježi kad je dana; povlačenjem se ne briše datum davanja.
        gdprConsentAt:
          body.marketingOptIn && !existing.marketingOptIn ? new Date() : undefined,
        notes: text(body.notes),
        isActive: body.isActive,
      },
    });

    const label = customer.companyName ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim();
    await audit({
      tenantId: user.tenantId, userId: user.id, action: 'UPDATE',
      entityType: 'customer', entityId: customer.id,
      summary: `Izmijenjen kupac ${customer.code} · ${label}`,
    });

    return NextResponse.json({ id: customer.id, code: customer.code, name: label });
  } catch (error) {
    return apiError(error);
  }
}
