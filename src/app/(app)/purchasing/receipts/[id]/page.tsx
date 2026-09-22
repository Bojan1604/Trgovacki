import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, Printer } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate, formatPercent, formatQty } from '@/lib/format';
import { DOC_STATUS } from '@/lib/labels';
import { Badge, Card, CardHeader, DetailRow, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

const ALLOCATION_LABEL: Record<string, string> = {
  value: 'po vrijednosti',
  quantity: 'po količini',
  weight: 'po težini',
};

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageAccess('receipt.view');

  const receipt = await db.goodsReceipt.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      supplier: true,
      store: true,
      warehouse: true,
      purchaseOrder: { select: { id: true, number: true } },
      lines: { include: { variant: { include: { product: { select: { id: true, name: true } } } } } },
    },
  });
  if (!receipt) notFound();

  const ancillary = toNumber(receipt.shippingCost) + toNumber(receipt.customsCost) + toNumber(receipt.otherCost);
  const netRetail = toNumber(receipt.retailValue) - toNumber(receipt.retailValue) / 1.25;
  const totals = receipt.lines.reduce(
    (acc, l) => ({
      qty: acc.qty + toNumber(l.quantity),
      landed: acc.landed + toNumber(l.quantity) * toNumber(l.landedCost),
      retail: acc.retail + toNumber(l.quantity) * toNumber(l.retailPrice),
      margin: acc.margin + toNumber(l.quantity) * toNumber(l.marginAmount),
    }),
    { qty: 0, landed: 0, retail: 0, margin: 0 },
  );

  return (
    <div className="mx-auto max-w-[1440px]">
      <Link href="/purchasing/receipts" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3" /> Primke
      </Link>

      <PageHeader
        title={`Primka ${receipt.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {receipt.supplier.name} · {receipt.store.name} · {receipt.warehouse.name}
            <Badge tone={DOC_STATUS[receipt.status].tone} dot>{DOC_STATUS[receipt.status].label}</Badge>
            {receipt.purchaseOrder && (
              <Link href={`/purchasing/orders/${receipt.purchaseOrder.id}`} className="text-accent hover:underline">
                ← {receipt.purchaseOrder.number}
              </Link>
            )}
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" icon={<Printer className="size-3.5" />}>Ispis kalkulacije</Button>
            {receipt.status !== 'POSTED' && (
              <Button size="sm" variant="primary" icon={<Check className="size-3.5" />}>Proknjiži</Button>
            )}
          </>
        }
      />

      <div className="grid gap-2.5 xl:grid-cols-[1fr_320px]">
        <Card padded={false}>
          <div className="px-3.5 pt-3 pb-1.5">
            <CardHeader
              compact
              title="Kalkulacija"
              subtitle={`Zavisni troškovi razrezani ${ALLOCATION_LABEL[receipt.costAllocation] ?? receipt.costAllocation}`}
            />
          </div>
          <Table>
            <THead sticky>
              <TR>
                <TH width={76}>Šifra</TH>
                <TH>Artikl</TH>
                <TH numeric width={70}>Kol.</TH>
                <TH numeric width={86}>Fakt. cij.</TH>
                <TH numeric width={62}>Rabat</TH>
                <TH numeric width={86}>Neto NC</TH>
                <TH numeric width={80}>Zav. tr.</TH>
                <TH numeric width={86}>NC konačna</TH>
                <TH numeric width={86}>MPC</TH>
                <TH numeric width={66}>Marža</TH>
                <TH numeric width={96}>Vrijednost</TH>
              </TR>
            </THead>
            <TBody>
              {receipt.lines.map((line) => (
                <TR key={line.id}>
                  <TD className="font-mono text-sm text-ink-3">{line.variant.sku}</TD>
                  <TD className="truncate">
                    <Link href={`/catalog/products/${line.variant.product.id}`} className="hover:text-accent">
                      {line.variant.product.name}
                    </Link>
                  </TD>
                  <TD numeric>{formatQty(toNumber(line.quantity), 0)}</TD>
                  <TD numeric className="text-ink-3">{formatAmount(toNumber(line.invoicePrice))}</TD>
                  <TD numeric className="text-ink-3">{formatPercent(toNumber(line.discountPct), 0)}</TD>
                  <TD numeric>{formatAmount(toNumber(line.netPrice))}</TD>
                  <TD numeric className="text-ink-3">{formatAmount(toNumber(line.allocatedCost))}</TD>
                  <TD numeric className="font-medium">{formatAmount(toNumber(line.landedCost))}</TD>
                  <TD numeric className="font-medium">{formatAmount(toNumber(line.retailPrice))}</TD>
                  <TD numeric className={toNumber(line.marginPct) >= 15 ? 'text-positive' : 'text-warning'}>
                    {formatPercent(toNumber(line.marginPct), 0)}
                  </TD>
                  <TD numeric>{formatAmount(toNumber(line.lineTotal))}</TD>
                </TR>
              ))}
            </TBody>
            <TFootRow>
              <TD colSpan={2}>Ukupno {receipt.lines.length} stavki</TD>
              <TD numeric>{formatQty(totals.qty, 0)}</TD>
              <TD colSpan={4} />
              <TD numeric>{formatAmount(totals.landed, 0)}</TD>
              <TD numeric>{formatAmount(totals.retail, 0)}</TD>
              <TD />
              <TD numeric>{formatAmount(toNumber(receipt.goodsValue))}</TD>
            </TFootRow>
          </Table>
        </Card>

        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Dokument dobavljača" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Dobavljač">{receipt.supplier.name}</DetailRow>
              <DetailRow label="OIB" mono>{receipt.supplier.vatId ?? '—'}</DetailRow>
              <DetailRow label="Broj dokumenta" mono>{receipt.supplierDocNo ?? '—'}</DetailRow>
              <DetailRow label="Datum dokumenta">{formatDate(receipt.supplierDocDate)}</DetailRow>
              <DetailRow label="Valuta">{receipt.currency}</DetailRow>
              <DetailRow label="Tečaj">{formatAmount(toNumber(receipt.exchangeRate), 4)}</DetailRow>
              <DetailRow label="Proknjiženo">{receipt.postedAt ? formatDate(receipt.postedAt) : '—'}</DetailRow>
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Zavisni troškovi" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Prijevoz">{formatAmount(toNumber(receipt.shippingCost))} €</DetailRow>
              <DetailRow label="Carina">{formatAmount(toNumber(receipt.customsCost))} €</DetailRow>
              <DetailRow label="Ostalo">{formatAmount(toNumber(receipt.otherCost))} €</DetailRow>
              <DetailRow label="Metoda razreza">{ALLOCATION_LABEL[receipt.costAllocation]}</DetailRow>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-hairline-strong/60 pt-2">
              <span className="text-base font-medium">Ukupno zavisni</span>
              <span className="font-semibold tnum">{formatAmount(ancillary)} €</span>
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Rekapitulacija" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Nabavna vrijednost">{formatAmount(toNumber(receipt.goodsValue))} €</DetailRow>
              <DetailRow label="Rabat">{formatAmount(toNumber(receipt.discountTotal))} €</DetailRow>
              <DetailRow label="Zavisni troškovi">{formatAmount(ancillary)} €</DetailRow>
              <DetailRow label="PDV">{formatAmount(toNumber(receipt.taxTotal))} €</DetailRow>
              <DetailRow label="MP vrijednost">{formatAmount(toNumber(receipt.retailValue))} €</DetailRow>
              <DetailRow label="Planirana marža">{formatAmount(toNumber(receipt.marginTotal))} €</DetailRow>
              <DetailRow label="Marža na neto MPC">
                {netRetail > 0 ? formatPercent((toNumber(receipt.marginTotal) / (toNumber(receipt.retailValue) / 1.25)) * 100) : '—'}
              </DetailRow>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-hairline-strong/60 pt-2">
              <span className="text-md font-semibold">Za plaćanje</span>
              <span className="text-lg font-semibold tnum">{formatAmount(toNumber(receipt.total))} €</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
