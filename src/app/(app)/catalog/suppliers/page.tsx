import Link from 'next/link';
import { Handshake, Plus } from 'lucide-react';
import { Prisma } from '@prisma/client';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatPercent } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { FilterBar } from '@/components/filters/filter-bar';

export const metadata = { title: 'Dobavljači' };
export const dynamic = 'force-dynamic';

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePageAccess('supplier.view');

  const where: Prisma.SupplierWhereInput = {
    tenantId: user.tenantId,
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q, mode: 'insensitive' } },
            { code: { contains: params.q, mode: 'insensitive' } },
            { vatId: { startsWith: params.q } },
            { city: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(params.status === 'inactive' ? { isActive: false } : params.status === 'active' ? { isActive: true } : {}),
  };

  const suppliers = await db.supplier.findMany({
    where,
    include: {
      _count: { select: { products: true, purchaseOrders: true } },
    },
    orderBy: { name: 'asc' },
  });

  const purchaseTotals = await db.$queryRaw<{ supplierId: string; total: string; last: Date | null }[]>`
    SELECT gr."supplierId", COALESCE(SUM(gr."total"), 0)::text AS total, MAX(gr."postedAt") AS last
    FROM goods_receipts gr
    WHERE gr."tenantId" = ${user.tenantId} AND gr."status" = 'POSTED'
    GROUP BY gr."supplierId"
  `;
  const totalMap = new Map(purchaseTotals.map((t) => [t.supplierId, t]));

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Dobavljači"
        subtitle={`${suppliers.length} dobavljača`}
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Novi dobavljač</Button>}
      />

      <FilterBar
        searchPlaceholder="Naziv, šifra, OIB ili grad…"
        searchValue={params.q}
        activeCount={['q', 'status'].filter((k) => params[k]).length}
        selects={[
          {
            param: 'status',
            placeholder: 'Svi statusi',
            value: params.status,
            width: 140,
            options: [
              { value: 'active', label: 'Aktivni' },
              { value: 'inactive', label: 'Neaktivni' },
            ],
          },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={70}>Šifra</TH>
              <TH>Naziv</TH>
              <TH width={110}>OIB</TH>
              <TH width={110}>Grad</TH>
              <TH width={150}>Kontakt</TH>
              <TH numeric width={70}>Rok pl.</TH>
              <TH numeric width={70}>Isporuka</TH>
              <TH numeric width={70}>Rabat</TH>
              <TH numeric width={80}>Artikala</TH>
              <TH numeric width={110}>Nabavljeno</TH>
              <TH width={80}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {suppliers.map((supplier) => {
              const totals = totalMap.get(supplier.id);
              return (
                <TR key={supplier.id}>
                  <TD className="font-mono text-sm text-ink-3">{supplier.code}</TD>
                  <TD>
                    <Link href={`/catalog/suppliers/${supplier.id}`} className="font-medium hover:text-accent hover:underline">
                      {supplier.name}
                    </Link>
                  </TD>
                  <TD className="font-mono text-xs text-ink-4">{supplier.vatId ?? '—'}</TD>
                  <TD className="text-ink-2">{supplier.city ?? '—'}</TD>
                  <TD className="truncate text-sm text-ink-3">{supplier.contactPerson ?? supplier.email ?? '—'}</TD>
                  <TD numeric>{supplier.paymentTerms} d</TD>
                  <TD numeric>{supplier.leadTimeDays} d</TD>
                  <TD numeric>{formatPercent(toNumber(supplier.discountPct), 1)}</TD>
                  <TD numeric>{supplier._count.products}</TD>
                  <TD numeric className="font-medium">{totals ? formatAmount(Number(totals.total), 0) : '—'}</TD>
                  <TD>
                    <Badge tone={supplier.isActive ? 'positive' : 'neutral'}>
                      {supplier.isActive ? 'Aktivan' : 'Neaktivan'}
                    </Badge>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {suppliers.length === 0 && (
          <EmptyState icon={<Handshake className="size-4" />} title="Nema dobavljača" description="Promijenite filtre ili dodajte dobavljača." />
        )}
      </Card>
    </div>
  );
}
