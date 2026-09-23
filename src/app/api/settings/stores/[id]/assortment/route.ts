import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';

const schema = z.object({
  /** Način ponude poslovnice; bez njega se mijenjaju samo pojedini artikli. */
  mode: z.enum(['ALL', 'LISTED_ONLY']).optional(),
  /** Artikli koji se prebacuju u ponudu ili iz nje. */
  items: z
    .array(z.object({ variantId: z.string().min(1), inAssortment: z.boolean() }))
    .max(500)
    .optional(),
});

/** Artikli s oznakom jesu li u ponudi ove poslovnice. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('store.manage');
    const { id } = await context.params;
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    const categoryId = url.searchParams.get('category') ?? '';
    const only = url.searchParams.get('only') ?? '';

    const store = await db.store.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, assortmentMode: true },
    });
    if (!store) return NextResponse.json({ error: 'Poslovnica ne postoji.' }, { status: 404 });

    const deviations = await db.storeAssortment.findMany({
      where: { storeId: store.id },
      select: { variantId: true, isListed: true },
    });
    const byVariant = new Map(deviations.map((d) => [d.variantId, d.isListed]));
    const listed = (variantId: string) => {
      const row = byVariant.get(variantId);
      return store.assortmentMode === 'LISTED_ONLY' ? row === true : row !== false;
    };

    const variants = await db.productVariant.findMany({
      where: {
        isActive: true,
        product: {
          tenantId: user.tenantId,
          status: 'ACTIVE',
          ...(categoryId ? { categoryId } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { sku: { startsWith: q } },
                ],
              }
            : {}),
        },
      },
      select: {
        id: true,
        sku: true,
        product: { select: { name: true, category: { select: { name: true } } } },
      },
      orderBy: { product: { name: 'asc' } },
      take: 300,
    });

    const items = variants
      .map((v) => ({
        variantId: v.id,
        sku: v.sku,
        name: v.product.name,
        category: v.product.category?.name ?? null,
        inAssortment: listed(v.id),
      }))
      .filter((item) =>
        only === 'in' ? item.inAssortment : only === 'out' ? !item.inAssortment : true,
      );

    return NextResponse.json({ mode: store.assortmentMode, deviations: deviations.length, items });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Ponuda poslovnice.
 *
 * U bazi se drže samo odstupanja od zadanog ponašanja načina, pa se redak
 * briše čim artikl prestane odstupati — inače bi promjena načina ostavila
 * zapise koji znače suprotno od onoga što je netko postavio.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('store.manage');
    const { id } = await context.params;
    const body = await readJson(request, schema);

    const store = await db.store.findFirst({
      where: { id, tenantId: user.tenantId },
      select: { id: true, code: true, name: true, assortmentMode: true },
    });
    if (!store) return NextResponse.json({ error: 'Poslovnica ne postoji.' }, { status: 404 });

    const mode = body.mode ?? store.assortmentMode;

    if (body.items && body.items.length > 0) {
      const ids = body.items.map((i) => i.variantId);
      const valid = await db.productVariant.count({
        where: { id: { in: ids }, product: { tenantId: user.tenantId } },
      });
      if (valid !== new Set(ids).size) {
        return NextResponse.json({ error: 'Neki artikl ne postoji.' }, { status: 404 });
      }
    }

    await db.$transaction(async (tx) => {
      if (body.mode && body.mode !== store.assortmentMode) {
        await tx.store.update({ where: { id: store.id }, data: { assortmentMode: body.mode } });
        // Zapisi su vezani uz prethodni način i u novome bi značili obrnuto.
        await tx.storeAssortment.deleteMany({ where: { storeId: store.id } });
      }

      for (const item of body.items ?? []) {
        // Odstupa li artikl od zadanog ponašanja, pamtimo ga; inače brišemo redak.
        const deviates = mode === 'LISTED_ONLY' ? item.inAssortment : !item.inAssortment;
        if (deviates) {
          await tx.storeAssortment.upsert({
            where: { storeId_variantId: { storeId: store.id, variantId: item.variantId } },
            create: { storeId: store.id, variantId: item.variantId, isListed: item.inAssortment },
            update: { isListed: item.inAssortment },
          });
        } else {
          await tx.storeAssortment.deleteMany({
            where: { storeId: store.id, variantId: item.variantId },
          });
        }
      }
    });

    const deviations = await db.storeAssortment.count({ where: { storeId: store.id } });

    await audit({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'UPDATE',
      entityType: 'store',
      entityId: store.id,
      summary:
        `Ponuda poslovnice ${store.code}: ` +
        `${mode === 'ALL' ? 'cijeli katalog' : 'samo uvršteni artikli'}, ${deviations} odstupanja`,
    });

    return NextResponse.json({ mode, deviations });
  } catch (error) {
    return apiError(error);
  }
}
