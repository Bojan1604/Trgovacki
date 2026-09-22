import Link from 'next/link';
import { ScrollText } from 'lucide-react';
import { Prisma } from '@prisma/client';
import { accessibleStoreIds, requirePermission, resolveStoreScope } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDateTime, formatQty } from '@/lib/format';
import { MOVEMENT_TYPE } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/navigation';
import { FilterBar } from '@/components/filters/filter-bar';

export const metadata = { title: 'Kartica artikla' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 60;

export default async function MovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('stock.view');
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const { storeIds, storeId: selectedStoreId } = await resolveStoreScope(user, params.store);

  const where: Prisma.StockMovementWhereInput = {
    warehouse: { storeId: { in: storeIds } },
    ...(params.variant ? { variantId: params.variant } : {}),
    ...(params.type ? { type: params.type as never } : {}),
    ...(params.q
      ? {
          variant: {
            OR: [
              { sku: { contains: params.q, mode: 'insensitive' } },
              { product: { name: { contains: params.q, mode: 'insensitive' } } },
            ],
          },
        }
      : {}),
  };

  const [total, movements, stores] = await Promise.all([
    db.stockMovement.count({ where }),
    db.stockMovement.findMany({
      where,
      include: {
        variant: { include: { product: { select: { id: true, name: true } } } },
        warehouse: { include: { store: { select: { name: true } } } },
        reasonCode: { select: { name: true } },
      },
      orderBy: { occurredAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true }, orderBy: { code: 'asc' } }),
  ]);

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Kartica artikla"
        subtitle={`Knjiga svih skladišnih kretanja · ${total.toLocaleString('hr-HR')} zapisa`}
      />

      <FilterBar
        searchPlaceholder="Naziv ili šifra artikla…"
        searchValue={params.q}
        activeCount={['q', 'store', 'type', 'variant'].filter((k) => params[k]).length}
        selects={[
          { param: 'store', placeholder: 'Sve poslovnice', value: selectedStoreId ?? '', width: 170, options: stores.map((s) => ({ value: s.id, label: s.name })) },
          { param: 'type', placeholder: 'Sve vrste', value: params.type, width: 180, options: Object.entries(MOVEMENT_TYPE).map(([value, label]) => ({ value, label })) },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={130}>Datum i vrijeme</TH>
              <TH width={150}>Vrsta</TH>
              <TH width={80}>Šifra</TH>
              <TH>Artikl</TH>
              <TH width={180}>Lokacija</TH>
              <TH width={120}>Dokument</TH>
              <TH numeric width={90}>Količina</TH>
              <TH numeric width={90}>Stanje</TH>
              <TH numeric width={80}>Cijena</TH>
              <TH numeric width={100}>Vrijednost</TH>
            </TR>
          </THead>
          <TBody>
            {movements.map((m) => {
              const qty = toNumber(m.quantity);
              return (
                <TR key={m.id}>
                  <TD className="text-sm text-ink-3">{formatDateTime(m.occurredAt)}</TD>
                  <TD>
                    <Badge tone={qty > 0 ? 'positive' : m.type === 'WRITE_OFF' ? 'negative' : 'neutral'}>
                      {MOVEMENT_TYPE[m.type] ?? m.type}
                    </Badge>
                  </TD>
                  <TD className="font-mono text-sm text-ink-3">{m.variant.sku}</TD>
                  <TD className="truncate">
                    <Link href={`/catalog/products/${m.variant.product.id}`} className="hover:text-accent">
                      {m.variant.product.name}
                    </Link>
                  </TD>
                  <TD className="truncate text-ink-2">{m.warehouse.store.name} · {m.warehouse.name}</TD>
                  <TD className="font-mono text-xs text-ink-4">{m.refNumber ?? '—'}</TD>
                  <TD numeric className={qty > 0 ? 'text-positive' : 'text-negative'}>
                    {qty > 0 ? '+' : ''}{formatQty(qty, 2)}
                  </TD>
                  <TD numeric>{formatQty(toNumber(m.balanceAfter), 1)}</TD>
                  <TD numeric className="text-ink-3">{formatAmount(toNumber(m.unitCost))}</TD>
                  <TD numeric>{formatAmount(toNumber(m.totalCost))}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {movements.length === 0 && <EmptyState icon={<ScrollText className="size-4" />} title="Nema kretanja" />}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
      </Card>
    </div>
  );
}
