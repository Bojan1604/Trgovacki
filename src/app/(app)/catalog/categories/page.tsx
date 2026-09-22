import Link from 'next/link';
import { Layers, Plus } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatPercent } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

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
  const deepCount = (categoryId: string) => {
    const self = categories.find((c) => c.id === categoryId);
    if (!self) return 0;
    return categories
      .filter((c) => c.path === self.path || c.path.startsWith(`${self.path}/`))
      .reduce((acc, c) => acc + (countMap.get(c.id) ?? 0), 0);
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Kategorije"
        subtitle={`${categories.length} kategorija u stablu`}
        actions={
          <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>
            Nova kategorija
          </Button>
        }
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={100}>Šifra</TH>
              <TH>Naziv</TH>
              <TH numeric width={90}>Artikala</TH>
              <TH numeric width={110}>Ciljana marža</TH>
              <TH width={90}>Razina</TH>
              <TH width={90}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {categories.map((category) => (
              <TR key={category.id}>
                <TD className="font-mono text-sm text-ink-3">{category.code}</TD>
                <TD>
                  <span style={{ paddingLeft: category.level * 16 }} className="inline-flex items-center gap-1.5">
                    {category.level > 0 && <span className="text-ink-4">└</span>}
                    <Link
                      href={`/catalog/products?category=${category.id}`}
                      className={category.level === 0 ? 'font-semibold hover:text-accent' : 'hover:text-accent'}
                    >
                      {category.name}
                    </Link>
                  </span>
                </TD>
                <TD numeric>{deepCount(category.id) || '—'}</TD>
                <TD numeric className="text-ink-2">
                  {category.targetMarginPct ? formatPercent(toNumber(category.targetMarginPct), 0) : '—'}
                </TD>
                <TD className="text-ink-3">{category.level === 0 ? 'Glavna' : 'Podkategorija'}</TD>
                <TD>
                  <Badge tone={category.isActive ? 'positive' : 'neutral'}>
                    {category.isActive ? 'Aktivna' : 'Neaktivna'}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {categories.length === 0 && <EmptyState icon={<Layers className="size-4" />} title="Nema kategorija" />}
      </Card>
      <p className="mt-2 px-1 text-2xs text-ink-4">
        Ciljana marža se koristi kao zadana vrijednost pri kalkulaciji maloprodajne cijene na primci.
        Ukupan broj artikala uključuje i podkategorije. {formatAmount(0, 0) && ''}
      </p>
    </div>
  );
}
