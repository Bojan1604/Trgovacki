import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { nextDocumentNumber } from '@/lib/services/numbering';

const schema = z.object({
  type: z.enum(['RETAIL', 'BUSINESS', 'EMPLOYEE']).default('RETAIL'),
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
});

/** Pravna osoba se vodi pod nazivom tvrtke, fizička pod imenom i prezimenom. */
function validateName(body: z.infer<typeof schema>) {
  if (body.type !== 'BUSINESS') {
    return body.firstName?.trim() && body.lastName?.trim()
      ? null
      : 'Za fizičku osobu su ime i prezime obavezni.';
  }
  return body.companyName?.trim() ? null : 'Za pravnu osobu je naziv tvrtke obavezan.';
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission('customer.manage');
    const body = await readJson(request, schema);

    const nameError = validateName(body);
    if (nameError) return NextResponse.json({ error: nameError }, { status: 422 });

    if (body.groupId) {
      const group = await db.customerGroup.findFirst({
        where: { id: body.groupId, tenantId: user.tenantId },
        select: { id: true },
      });
      if (!group) return NextResponse.json({ error: 'Skupina kupaca ne postoji.' }, { status: 404 });
    }

    const numbering = await nextDocumentNumber(user.tenantId, 'customer');
    const text = (v?: string) => (v?.trim() ? v.trim() : null);

    const customer = await db.customer.create({
      data: {
        tenantId: user.tenantId,
        code: numbering.number.split('/')[0],
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
        groupId: body.groupId || null,
        discountPct: new Prisma.Decimal(body.discountPct ?? 0),
        creditLimit: new Prisma.Decimal(body.creditLimit ?? 0),
        paymentTerms: body.paymentTerms ?? 0,
        marketingOptIn: body.marketingOptIn ?? false,
        gdprConsentAt: body.marketingOptIn ? new Date() : null,
        notes: text(body.notes),
      },
    });

    const label = customer.companyName ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim();
    await audit({
      tenantId: user.tenantId, userId: user.id, action: 'CREATE',
      entityType: 'customer', entityId: customer.id,
      summary: `Kreiran kupac ${customer.code} · ${label}`,
    });

    return NextResponse.json({ id: customer.id, code: customer.code, name: label });
  } catch (error) {
    return apiError(error);
  }
}
