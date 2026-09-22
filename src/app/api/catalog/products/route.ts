import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { isValidEan13 } from '@/lib/utils';

const schema = z.object({
  sku: z.string().min(1).max(40),
  name: z.string().min(2).max(200),
  shortName: z.string().max(40).optional(),
  description: z.string().max(2000).optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  unitId: z.string().optional(),
  taxRateId: z.string().optional(),
  barcode: z.string().optional(),
  supplierId: z.string().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  retailPrice: z.number().nonnegative().optional(),
  depositAmount: z.number().nonnegative().optional(),
  ageRestriction: z.number().int().min(0).max(99).optional(),
  trackExpiry: z.boolean().optional(),
  allowDiscount: z.boolean().optional(),
  publishedWeb: z.boolean().optional(),
  isWeighted: z.boolean().optional(),
});

/**
 * Kreiranje artikla.
 * Artikl, prodajna varijanta, barkod, veza s dobavljačem i zapis u zadanom
 * cjeniku nastaju u jednoj transakciji — nema poluispravnih zapisa u katalogu.
 */
export async function POST(request: Request) {
  try {
    const user = await requirePermission('product.create');
    const body = await readJson(request, schema);

    if (body.barcode && !isValidEan13(body.barcode) && body.barcode.length === 13) {
      return NextResponse.json(
        { error: 'Kontrolna znamenka barkoda nije ispravna.' },
        { status: 422 },
      );
    }

    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          tenantId: user.tenantId,
          sku: body.sku,
          name: body.name,
          shortName: body.shortName ?? (body.name.length > 22 ? `${body.name.slice(0, 21)}…` : body.name),
          description: body.description ?? null,
          type: body.isWeighted ? 'WEIGHTED' : 'STOCK',
          categoryId: body.categoryId ?? null,
          brandId: body.brandId ?? null,
          unitId: body.unitId ?? null,
          taxRateId: body.taxRateId ?? null,
          isSoldByWeight: body.isWeighted ?? false,
          depositAmount: new Prisma.Decimal(body.depositAmount ?? 0),
          ageRestriction: body.ageRestriction ?? null,
          trackExpiry: body.trackExpiry ?? false,
          allowDiscount: body.allowDiscount ?? true,
          publishedWeb: body.publishedWeb ?? false,
          variants: {
            create: [
              {
                sku: body.sku,
                name: body.name,
                isDefault: true,
                ...(body.barcode
                  ? { barcodes: { create: [{ code: body.barcode, type: 'EAN13', isPrimary: true }] } }
                  : {}),
              },
            ],
          },
        },
        include: { variants: true },
      });

      const variant = created.variants[0];

      if (body.retailPrice !== undefined && body.retailPrice > 0) {
        const priceList = await tx.priceList.findFirst({
          where: { tenantId: user.tenantId, isDefault: true },
          select: { id: true },
        });
        if (priceList) {
          await tx.priceListItem.create({
            data: {
              priceListId: priceList.id,
              variantId: variant.id,
              price: new Prisma.Decimal(body.retailPrice),
            },
          });
        }
      }

      if (body.supplierId && body.purchasePrice !== undefined) {
        await tx.productSupplier.create({
          data: {
            productId: created.id,
            supplierId: body.supplierId,
            purchasePrice: new Prisma.Decimal(body.purchasePrice),
            isPrimary: true,
          },
        });
      }

      return created;
    });

    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'CREATE',
      entityType: 'product',
      entityId: product.id,
      summary: `Kreiran artikl ${product.sku} · ${product.name}`,
    });

    return NextResponse.json({ id: product.id, sku: product.sku, name: product.name });
  } catch (error) {
    return apiError(error);
  }
}
