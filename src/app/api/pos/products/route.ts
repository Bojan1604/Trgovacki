import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { toNumber } from '@/lib/money';
import { parseWeightBarcode } from '@/lib/utils';

/**
 * Pretraga artikala za blagajnu.
 * Podržava barkod (uključujući interni barkod s ugrađenom težinom), šifru i naziv.
 */
export async function GET(request: Request) {
  try {
    const user = await requirePermission('pos.operate');
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';
    const categoryId = url.searchParams.get('category');
    const storeId = url.searchParams.get('storeId') ?? user.activeStoreId;
    const limit = Math.min(60, Number(url.searchParams.get('limit') ?? 40));

    if (!storeId) return NextResponse.json({ error: 'Nije odabrana poslovnica.' }, { status: 400 });

    // Interni barkod s težinom/cijenom (prefiks 2x)
    const weighted = q ? parseWeightBarcode(q) : null;
    const searchTerm = weighted ? weighted.itemCode : q;

    const store = await db.store.findUnique({
      where: { id: storeId },
      select: { priceListId: true, warehouses: { where: { isSellable: true }, select: { id: true }, take: 1 } },
    });
    const warehouseId = store?.warehouses[0]?.id;

    const defaultList = await db.priceList.findFirst({
      where: { tenantId: user.tenantId, isDefault: true },
      select: { id: true },
    });
    const priceListId = store?.priceListId ?? defaultList?.id ?? '';

    const variants = await db.productVariant.findMany({
      where: {
        isActive: true,
        product: {
          tenantId: user.tenantId,
          status: 'ACTIVE',
          ...(categoryId ? { categoryId } : {}),
        },
        ...(searchTerm
          ? {
              OR: [
                { barcodes: { some: { code: searchTerm } } },
                { sku: { startsWith: searchTerm } },
                { product: { name: { contains: searchTerm, mode: 'insensitive' } } },
                { product: { sku: { startsWith: searchTerm } } },
              ],
            }
          : {}),
      },
      include: {
        product: {
          select: {
            id: true, name: true, shortName: true, categoryId: true, isSoldByWeight: true,
            ageRestriction: true, allowDiscount: true, depositAmount: true,
            taxRate: { select: { rate: true } },
            unit: { select: { code: true } },
          },
        },
        barcodes: { where: { isPrimary: true }, select: { code: true }, take: 1 },
        priceItems: { where: { priceListId }, select: { price: true }, take: 1 },
        stockItems: warehouseId ? { where: { warehouseId }, select: { quantity: true }, take: 1 } : false,
      },
      orderBy: { product: { name: 'asc' } },
      take: limit,
    });

    const items = variants.map((v) => ({
      variantId: v.id,
      productId: v.product.id,
      sku: v.sku,
      name: v.product.shortName || v.product.name,
      fullName: v.product.name,
      barcode: v.barcodes[0]?.code ?? null,
      price: toNumber(v.priceItems[0]?.price ?? v.msrp ?? 0),
      taxRate: toNumber(v.product.taxRate?.rate ?? 0),
      unit: v.product.unit?.code ?? 'kom',
      isWeighted: v.product.isSoldByWeight,
      ageRestriction: v.product.ageRestriction,
      allowDiscount: v.product.allowDiscount,
      deposit: toNumber(v.product.depositAmount),
      stock: v.stockItems ? toNumber(v.stockItems[0]?.quantity ?? 0) : null,
    }));

    return NextResponse.json({
      items,
      /** Kod barkoda s ugrađenom težinom blagajna odmah zna koliko dodati. */
      embedded: weighted ? { quantity: weighted.weightKg ?? null, price: weighted.price ?? null } : null,
      exactMatch: Boolean(q) && items.length === 1,
    });
  } catch (error) {
    return apiError(error);
  }
}
