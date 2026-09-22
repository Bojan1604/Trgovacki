import Link from 'next/link';
import { Plus, Tags } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatAmount, formatQty } from '@/lib/format';
import { resolveRange } from '@/lib/ranges';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export const metadata = { title: 'Brendovi' };
export const dynamic = 'force-dynamic';

export default async function BrandsPage() {
  const user = await requirePermission('product.view');
  const range = resolveRange('90d');

  const [brands, stats] = await Promise.all([
    db.brand.findMany({
      where: { tenantId: user.tenantId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    }),
    db.$queryRaw<{ brandId: string; qty: string; total: string; margin: string }[]>`
      SELECT p."brandId", COALESCE(SUM(sl."quantity"), 0)::text AS qty,
             COALESCE(SUM(sl."lineTotal"), 0)::text AS total,
             COALESCE(SUM(sl."marginAmount"), 0)::text AS margin
      FROM sale_lines sl
      JOIN sales s ON s."id" = sl."saleId"
      JOIN product_variants pv ON pv."id" = sl."variantId"
      JOIN products p ON p."id" = pv."productId"
      WHERE p."tenantId" = ${user.tenantId}
        AND s."issuedAt" BETWEEN ${range.from} AND ${range.to}
        AND p."brandId" IS NOT NULL
      GROUP BY p."brandId"
    `,
  ]);

  const statMap = new Map(stats.map((s) => [s.brandId, s]));
  const sorted = [...brands].sort(
    (a, b) => Number(statMap.get(b.id)?.total ?? 0) - Number(statMap.get(a.id)?.total ?? 0),
  );

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Brendovi"
        subtitle={`${brands.length} brendova · promet posljednjih 90 dana`}
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Novi brend</Button>}
      />
      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={80}>Šifra</TH>
              <TH>Naziv</TH>
              <TH numeric width={90}>Artikala</TH>
              <TH numeric width={100}>Prodano</TH>
              <TH numeric width={110}>Promet</TH>
              <TH numeric width={110}>Marža</TH>
              <TH width={90}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {sorted.map((brand) => {
              const stat = statMap.get(brand.id);
              return (
                <TR key={brand.id}>
                  <TD className="font-mono text-sm text-ink-3">{brand.code}</TD>
                  <TD>
                    <Link href={`/catalog/products?brand=${brand.id}`} className="font-medium hover:text-accent">
                      {brand.name}
                    </Link>
                  </TD>
                  <TD numeric>{brand._count.products}</TD>
                  <TD numeric className="text-ink-2">{stat ? formatQty(Number(stat.qty), 0) : '—'}</TD>
                  <TD numeric className="font-medium">{stat ? formatAmount(Number(stat.total), 0) : '—'}</TD>
                  <TD numeric className="text-positive">{stat ? formatAmount(Number(stat.margin), 0) : '—'}</TD>
                  <TD><Badge tone={brand.isActive ? 'positive' : 'neutral'}>{brand.isActive ? 'Aktivan' : 'Neaktivan'}</Badge></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {brands.length === 0 && <EmptyState icon={<Tags className="size-4" />} title="Nema brendova" />}
      </Card>
    </div>
  );
}
