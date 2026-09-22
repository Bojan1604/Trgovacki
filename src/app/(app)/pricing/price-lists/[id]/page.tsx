import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, Plus } from 'lucide-react';
import { Prisma } from '@prisma/client';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/navigation';
import { FilterBar } from '@/components/filters/filter-bar';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 50;

export default async function PriceListDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requirePageAccess('price.view');
  const page = Math.max(1, Number(query.page ?? 1) || 1);

  const priceList = await db.priceList.findFirst({
    where: { id, tenantId: user.tenantId },
    include: { stores: { select: { name: true } }, customerGroups: { select: { name: true } } },
  });
  if (!priceList) notFound();

  const where: Prisma.PriceListItemWhereInput = {
    priceListId: priceList.id,
    ...(query.q
      ? {
          variant: {
            OR: [
              { sku: { contains: query.q, mode: 'insensitive' } },
              { product: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          },
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    db.priceListItem.count({ where }),
    db.priceListItem.findMany({
      where,
      include: {
        variant: {
          include: {
            product: { select: { id: true, name: true, taxRate: { select: { rate: true, name: true } }, category: { select: { name: true } } } },
          },
        },
      },
      orderBy: { variant: { product: { name: 'asc' } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1280px]">
      <Link href="/pricing/price-lists" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3" /> Cjenici
      </Link>

      <PageHeader
        title={priceList.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{priceList.code}</span>
            · {priceList.pricesIncludeTax ? 'cijene s PDV-om' : 'cijene bez PDV-a'}
            · vrijedi od {formatDate(priceList.validFrom)}
            {priceList.stores.length > 0 && <>· {priceList.stores.length} poslovnica</>}
            {priceList.isDefault && <Badge tone="accent">zadani</Badge>}
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" icon={<Download className="size-3.5" />}>Izvoz</Button>
            <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Dodaj artikl</Button>
          </>
        }
      />

      <FilterBar searchPlaceholder="Naziv ili šifra artikla…" searchValue={query.q} activeCount={query.q ? 1 : 0} />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={80}>Šifra</TH>
              <TH>Naziv</TH>
              <TH width={140}>Kategorija</TH>
              <TH width={80}>PDV</TH>
              <TH numeric width={100}>Cijena</TH>
              <TH numeric width={100}>Bez PDV-a</TH>
              <TH numeric width={110}>Najniža 30 d</TH>
              <TH width={110}>Vrijedi od</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((item) => {
              const price = toNumber(item.price);
              const rate = toNumber(item.variant.product.taxRate?.rate ?? 0);
              const net = priceList.pricesIncludeTax ? price / (1 + rate / 100) : price;
              return (
                <TR key={item.id}>
                  <TD className="font-mono text-sm text-ink-3">{item.variant.sku}</TD>
                  <TD>
                    <Link href={`/catalog/products/${item.variant.product.id}`} className="hover:text-accent">
                      {item.variant.product.name}
                    </Link>
                  </TD>
                  <TD className="truncate text-ink-2">{item.variant.product.category?.name ?? '—'}</TD>
                  <TD className="text-sm text-ink-3">{item.variant.product.taxRate?.name ?? '—'}</TD>
                  <TD numeric className="font-medium">{formatAmount(price)}</TD>
                  <TD numeric className="text-ink-3">{formatAmount(net)}</TD>
                  <TD numeric className="text-ink-3">
                    {item.lowestPrice30d ? formatAmount(toNumber(item.lowestPrice30d)) : '—'}
                  </TD>
                  <TD className="text-sm text-ink-3">{formatDate(item.validFrom)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {items.length === 0 && <EmptyState title="Cjenik nema artikala" />}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
      </Card>
    </div>
  );
}
