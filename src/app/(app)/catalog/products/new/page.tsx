import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { ProductForm } from '@/components/catalog/product-form';

export const metadata = { title: 'Novi artikl' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const user = await requirePermission('product.create');

  const [categories, brands, units, taxRates, suppliers] = await Promise.all([
    db.category.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true, level: true, targetMarginPct: true },
      orderBy: { path: 'asc' },
    }),
    db.brand.findMany({ where: { tenantId: user.tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.unitOfMeasure.findMany({ where: { tenantId: user.tenantId }, select: { id: true, code: true, name: true } }),
    db.taxRate.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true, rate: true, isDefault: true }, orderBy: { rate: 'desc' } }),
    db.supplier.findMany({ where: { tenantId: user.tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <ProductForm
      categories={categories.map((c) => ({ ...c, targetMarginPct: c.targetMarginPct ? Number(c.targetMarginPct) : null }))}
      brands={brands}
      units={units}
      taxRates={taxRates.map((t) => ({ ...t, rate: Number(t.rate) }))}
      suppliers={suppliers}
    />
  );
}
