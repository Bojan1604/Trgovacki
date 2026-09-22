import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer, Send, Truck } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate, formatPercent, formatQty } from '@/lib/format';
import { DOC_STATUS, PO_STATUS } from '@/lib/labels';
import { Badge, Card, CardHeader, DetailRow, PageHeader, Progress } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission('po.view');

  const order = await db.purchaseOrder.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      supplier: true,
      store: true,
      lines: { include: { variant: { include: { product: { select: { id: true, name: true } } } } } },
      receipts: { select: { id: true, number: true, status: true, total: true, postedAt: true } },
    },
  });
  if (!order) notFound();

  const totals = order.lines.reduce(
    (acc, l) => ({
      ordered: acc.ordered + toNumber(l.quantity),
      received: acc.received + toNumber(l.receivedQty),
      value: acc.value + toNumber(l.lineTotal),
    }),
    { ordered: 0, received: 0, value: 0 },
  );
  const fulfilment = totals.ordered > 0 ? (totals.received / totals.ordered) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1340px]">
      <Link href="/purchasing/orders" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3" /> Narudžbenice
      </Link>

      <PageHeader
        title={`Narudžbenica ${order.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {order.supplier.name} · {order.store.name}
            <Badge tone={PO_STATUS[order.status].tone} dot>{PO_STATUS[order.status].label}</Badge>
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" icon={<Printer className="size-3.5" />}>Ispis</Button>
            {order.status === 'DRAFT' && <Button size="sm" variant="primary" icon={<Send className="size-3.5" />}>Pošalji dobavljaču</Button>}
            {['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status) && (
              <Button size="sm" variant="primary" icon={<Truck className="size-3.5" />}>Kreiraj primku</Button>
            )}
          </>
        }
      />

      <div className="grid gap-2.5 lg:grid-cols-[1fr_310px]">
        <div className="space-y-2.5">
          <Card padded={false}>
            <Table>
              <THead sticky>
                <TR>
                  <TH width={80}>Šifra</TH>
                  <TH>Artikl</TH>
                  <TH numeric width={90}>Naručeno</TH>
                  <TH numeric width={90}>Zaprimljeno</TH>
                  <TH numeric width={90}>Preostalo</TH>
                  <TH numeric width={90}>Cijena</TH>
                  <TH numeric width={70}>Rabat</TH>
                  <TH numeric width={100}>Iznos</TH>
                </TR>
              </THead>
              <TBody>
                {order.lines.map((line) => {
                  const ordered = toNumber(line.quantity);
                  const received = toNumber(line.receivedQty);
                  return (
                    <TR key={line.id}>
                      <TD className="font-mono text-sm text-ink-3">{line.variant.sku}</TD>
                      <TD>
                        <Link href={`/catalog/products/${line.variant.product.id}`} className="hover:text-accent">
                          {line.variant.product.name}
                        </Link>
                      </TD>
                      <TD numeric>{formatQty(ordered, 0)}</TD>
                      <TD numeric className={received >= ordered ? 'text-positive' : 'text-warning'}>
                        {formatQty(received, 0)}
                      </TD>
                      <TD numeric className="text-ink-3">{formatQty(Math.max(ordered - received, 0), 0)}</TD>
                      <TD numeric>{formatAmount(toNumber(line.unitPrice))}</TD>
                      <TD numeric className="text-ink-3">{formatPercent(toNumber(line.discountPct), 1)}</TD>
                      <TD numeric className="font-medium">{formatAmount(toNumber(line.lineTotal))}</TD>
                    </TR>
                  );
                })}
              </TBody>
              <TFootRow>
                <TD colSpan={2}>Ukupno {order.lines.length} stavki</TD>
                <TD numeric>{formatQty(totals.ordered, 0)}</TD>
                <TD numeric>{formatQty(totals.received, 0)}</TD>
                <TD colSpan={3} />
                <TD numeric>{formatAmount(totals.value)}</TD>
              </TFootRow>
            </Table>
          </Card>

          {order.receipts.length > 0 && (
            <Card padded={false}>
              <div className="p-3.5 pb-2">
                <CardHeader compact title="Povezane primke" />
              </div>
              <Table>
                <THead>
                  <TR>
                    <TH width={150}>Broj</TH>
                    <TH>Proknjiženo</TH>
                    <TH numeric width={110}>Iznos</TH>
                    <TH width={140}>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {order.receipts.map((receipt) => (
                    <TR key={receipt.id}>
                      <TD>
                        <Link href={`/purchasing/receipts/${receipt.id}`} className="font-mono text-sm text-accent hover:underline">
                          {receipt.number}
                        </Link>
                      </TD>
                      <TD className="text-sm text-ink-3">{receipt.postedAt ? formatDate(receipt.postedAt) : '—'}</TD>
                      <TD numeric>{formatAmount(toNumber(receipt.total))}</TD>
                      <TD><Badge tone={DOC_STATUS[receipt.status].tone}>{DOC_STATUS[receipt.status].label}</Badge></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}
        </div>

        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Zaprimanje" />
            <Progress value={fulfilment} tone={fulfilment >= 100 ? 'positive' : 'accent'} />
            <p className="mt-1.5 text-sm text-ink-3 tnum">
              {formatQty(totals.received, 0)} od {formatQty(totals.ordered, 0)} jedinica ({fulfilment.toFixed(0)} %)
            </p>
          </Card>

          <Card>
            <CardHeader compact title="Podaci narudžbenice" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Broj">{order.number}</DetailRow>
              <DetailRow label="Dobavljač">{order.supplier.name}</DetailRow>
              <DetailRow label="OIB dobavljača" mono>{order.supplier.vatId ?? '—'}</DetailRow>
              <DetailRow label="Rok plaćanja">{order.supplier.paymentTerms} dana</DetailRow>
              <DetailRow label="Valuta">{order.currency}</DetailRow>
              <DetailRow label="Naručeno">{order.orderedAt ? formatDate(order.orderedAt) : '—'}</DetailRow>
              <DetailRow label="Očekivano">{order.expectedAt ? formatDate(order.expectedAt) : '—'}</DetailRow>
              <DetailRow label="Odobreno">{order.approvedAt ? formatDate(order.approvedAt) : '—'}</DetailRow>
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Rekapitulacija" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Osnovica">{formatAmount(toNumber(order.subtotal))} €</DetailRow>
              <DetailRow label="Rabat">{formatAmount(toNumber(order.discountTotal))} €</DetailRow>
              <DetailRow label="PDV">{formatAmount(toNumber(order.taxTotal))} €</DetailRow>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-hairline-strong/60 pt-2">
              <span className="text-md font-semibold">Ukupno</span>
              <span className="text-lg font-semibold tnum">{formatAmount(toNumber(order.total))} €</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
