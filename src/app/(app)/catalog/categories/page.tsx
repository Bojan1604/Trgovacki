import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { CategoriesPanel } from '@/components/catalog/categories-panel';

export const metadata = { title: 'Kategorije' };
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const user = await requirePageAccess('product.view');

  const [categories, counts] = await Promise.all([
    db.category.findMany({ where: { tenantId: user.tenantId }, orderBy: { path: 'asc' } }),
    db.product.groupBy({ by: ['categoryId'], where: { tenantId: user.tenantId }, _count: true }),
  ]);

  const countMap = new Map(counts.map((c) => [c.categoryId, c._count]));
  // Zbroj artikala uključuje i podkategorije.
  const deepCount = (path: string) =>
    categories
      .filter((c) => c.path === path || c.path.startsWith(`${path}/`))
      .reduce((acc, c) => acc + (countMap.get(c.id) ?? 0), 0);

  return (
    <CategoriesPanel
      categories={categories.map((category) => ({
        id: category.id,
        parentId: category.parentId,
        code: category.code,
        name: category.name,
        description: category.description,
        level: category.level,
        targetMarginPct: category.targetMarginPct !== null ? toNumber(category.targetMarginPct) : null,
        isActive: category.isActive,
        productCount: deepCount(category.path),
      }))}
    />
  );
}
