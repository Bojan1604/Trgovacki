import Link from 'next/link';
import { PackageSearch, ShoppingCart } from 'lucide-react';
import { requirePermission, accessibleStoreIds } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatAmount, formatQty } from '@/lib/format';
import { replenishmentSuggestions } from '@/lib/services/inventory';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { FilterBar } from '@/components/filters/filter-bar';

export const metadata = { title: 'Prijedlog nabave' };
export const dynamic = 'force-dynamic';

export default async function ReplenishmentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('stock.view');
  const storeIds = await accessibleStoreIds(user);

  const stores = await db.store.findMany({
    where: { id: { in: storeIds }, type: 'RETAIL' },
    select: { id: true, name: true },
    orderBy: { code: 'asc' },
  });

  const storeId = params.store ?? user.activeStoreId ?? stores[0]?.id;
  const suggestions = storeId ? await replenishmentSuggestions(storeId, 300) : [];

  const filtered = params.supplier
    ? suggestions.filter((s) => s.supplierId === params.supplier)
    : suggestions;

  const totalValue = filtered.reduce((acc, s) => acc + Number(s.suggestedQty) * Number(s.purchasePrice), 0);
  const suppliers = Array.from(
    new Map(suggestions.filter((s) => s.supplierId).map((s) => [s.supplierId!, s.supplierName ?? '—'])).entries(),
  );
  const criticalCount = filtered.filter((s) => Number(s.onHand) <= 0).length;

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Prijedlog nabave"
        subtitle="Artikli koji su pali na ili ispod minimalne zalihe prema pravilima nadopune"
        actions={
          <Button size="sm" variant="primary" icon={<ShoppingCart className="size-3.5" />} disabled={filtered.length === 0}>
            Kreiraj narudžbenice
          </Button>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Artikala za nadopunu" value={String(filtered.length)} />
        <StatTile label="Bez zalihe" value={String(criticalCount)} hint="rizik gubitka prodaje" invertDelta />
        <StatTile label="Procijenjena vrijednost" value={formatAmount(totalValue, 0)} unit="€" />
        <StatTile label="Dobavljača" value={String(suppliers.length)} />
      </div>

      <FilterBar
        searchParam="none"
        searchPlaceholder="Pretraga nije dostupna"
        activeCount={['store', 'supplier'].filter((k) => params[k]).length}
        selects={[
          { param: 'store', placeholder: 'Odaberi poslovnicu', value: storeId, width: 190, options: stores.map((s) => ({ value: s.id, label: s.name })) },
          { param: 'supplier', placeholder: 'Svi dobavljači', value: params.supplier, width: 200, options: suppliers.map(([id, name]) => ({ value: id, label: name })) },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={80}>Šifra</TH>
              <TH>Artikl</TH>
              <TH width={200}>Dobavljač</TH>
              <TH numeric width={90}>Stanje</TH>
              <TH numeric width={90}>Min.</TH>
              <TH numeric width={90}>Max.</TH>
              <TH numeric width={110}>Prijedlog</TH>
              <TH numeric width={90}>NC</TH>
              <TH numeric width={110}>Vrijednost</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((row) => {
              const onHand = Number(row.onHand);
              const suggested = Number(row.suggestedQty);
              return (
                <TR key={row.variantId}>
                  <TD className="font-mono text-sm text-ink-3">{row.sku}</TD>
                  <TD className="truncate">{row.name}</TD>
                  <TD className="truncate text-ink-2">{row.supplierName ?? '—'}</TD>
                  <TD numeric>
                    {onHand <= 0 ? (
                      <Badge tone="negative">{formatQty(onHand, 0)}</Badge>
                    ) : (
                      <span className="text-warning">{formatQty(onHand, 0)}</span>
                    )}
                  </TD>
                  <TD numeric className="text-ink-3">{formatQty(Number(row.minQty), 0)}</TD>
                  <TD numeric className="text-ink-3">{formatQty(Number(row.maxQty), 0)}</TD>
                  <TD numeric className="font-medium text-accent">{formatQty(suggested, 0)}</TD>
                  <TD numeric className="text-ink-3">{formatAmount(Number(row.purchasePrice))}</TD>
                  <TD numeric>{formatAmount(suggested * Number(row.purchasePrice))}</TD>
                </TR>
              );
            })}
          </TBody>
          <TFootRow>
            <TD colSpan={8}>Ukupno {filtered.length} artikala</TD>
            <TD numeric>{formatAmount(totalValue)}</TD>
          </TFootRow>
        </Table>
        {filtered.length === 0 && (
          <EmptyState
            icon={<PackageSearch className="size-4" />}
            title="Nema artikala za nadopunu"
            description="Sve zalihe su iznad definirane minimalne razine."
            action={
              <Link href="/inventory/stock">
                <Button size="sm" variant="secondary">Pogledaj stanje zaliha</Button>
              </Link>
            }
          />
        )}
      </Card>
    </div>
  );
}
