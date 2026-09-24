import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Truck } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDateTime, formatQty } from '@/lib/format';
import { TRANSFER_STATUS } from '@/lib/labels';
import { Badge, Card, CardHeader, DetailRow, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { PrintButton } from '@/components/ui/print-button';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageAccess('transfer.view');

  const transfer = await db.stockTransfer.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      fromStore: true,
      toStore: true,
      fromWarehouse: true,
      toWarehouse: true,
      lines: { include: { variant: { include: { product: { select: { id: true, name: true } } } } } },
    },
  });
  if (!transfer) notFound();

  const totals = transfer.lines.reduce(
    (acc, l) => ({
      requested: acc.requested + toNumber(l.requestedQty),
      dispatched: acc.dispatched + toNumber(l.dispatchedQty),
      received: acc.received + toNumber(l.receivedQty),
      value: acc.value + toNumber(l.dispatchedQty) * toNumber(l.unitCost),
    }),
    { requested: 0, dispatched: 0, received: 0, value: 0 },
  );

  const hasDiscrepancy = transfer.lines.some(
    (l) => transfer.status === 'RECEIVED' && toNumber(l.receivedQty) !== toNumber(l.dispatchedQty),
  );

  return (
    <div className="mx-auto max-w-[1280px]">
      <Link href="/inventory/transfers" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3" /> Međuskladišnice
      </Link>

      <PageHeader
        title={`Međuskladišnica ${transfer.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {transfer.fromStore.name} <ArrowRight className="size-3" /> {transfer.toStore.name}
            <Badge tone={TRANSFER_STATUS[transfer.status].tone} dot>{TRANSFER_STATUS[transfer.status].label}</Badge>
            {hasDiscrepancy && <Badge tone="warning">odstupanje u zaprimanju</Badge>}
          </span>
        }
        actions={
          <>
            <PrintButton>Otpremnica</PrintButton>
            {transfer.status === 'APPROVED' && (
              <Button size="sm" variant="primary" icon={<Truck className="size-3.5" />}>Otpremi</Button>
            )}
            {transfer.status === 'DISPATCHED' && (
              <Button size="sm" variant="success" icon={<Check className="size-3.5" />}>Zaprimi</Button>
            )}
          </>
        }
      />

      <div className="grid gap-2.5 lg:grid-cols-[1fr_300px]">
        <Card padded={false}>
          <Table>
            <THead sticky>
              <TR>
                <TH width={80}>Šifra</TH>
                <TH>Artikl</TH>
                <TH numeric width={100}>Zatraženo</TH>
                <TH numeric width={100}>Otpremljeno</TH>
                <TH numeric width={100}>Zaprimljeno</TH>
                <TH numeric width={90}>Razlika</TH>
                <TH numeric width={90}>NC</TH>
                <TH numeric width={100}>Vrijednost</TH>
              </TR>
            </THead>
            <TBody>
              {transfer.lines.map((line) => {
                const dispatched = toNumber(line.dispatchedQty);
                const received = toNumber(line.receivedQty);
                const diff = received - dispatched;
                return (
                  <TR key={line.id}>
                    <TD className="font-mono text-sm text-ink-3">{line.variant.sku}</TD>
                    <TD>
                      <Link href={`/catalog/products/${line.variant.product.id}`} className="hover:text-accent">
                        {line.variant.product.name}
                      </Link>
                    </TD>
                    <TD numeric className="text-ink-3">{formatQty(toNumber(line.requestedQty), 0)}</TD>
                    <TD numeric>{formatQty(dispatched, 0)}</TD>
                    <TD numeric className="font-medium">{formatQty(received, 0)}</TD>
                    <TD numeric className={diff === 0 ? 'text-ink-4' : diff < 0 ? 'text-negative' : 'text-warning'}>
                      {diff !== 0 && transfer.status === 'RECEIVED' ? `${diff > 0 ? '+' : ''}${formatQty(diff, 0)}` : '—'}
                    </TD>
                    <TD numeric className="text-ink-3">{formatAmount(toNumber(line.unitCost))}</TD>
                    <TD numeric>{formatAmount(dispatched * toNumber(line.unitCost))}</TD>
                  </TR>
                );
              })}
            </TBody>
            <TFootRow>
              <TD colSpan={2}>Ukupno {transfer.lines.length} stavki</TD>
              <TD numeric>{formatQty(totals.requested, 0)}</TD>
              <TD numeric>{formatQty(totals.dispatched, 0)}</TD>
              <TD numeric>{formatQty(totals.received, 0)}</TD>
              <TD colSpan={2} />
              <TD numeric>{formatAmount(totals.value)}</TD>
            </TFootRow>
          </Table>
        </Card>

        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Podaci dokumenta" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Broj">{transfer.number}</DetailRow>
              <DetailRow label="Status">{TRANSFER_STATUS[transfer.status].label}</DetailRow>
              <DetailRow label="Izvorno skladište">{transfer.fromWarehouse.name}</DetailRow>
              <DetailRow label="Odredišno skladište">{transfer.toWarehouse.name}</DetailRow>
              <DetailRow label="Kreirano">{formatDateTime(transfer.createdAt)}</DetailRow>
              <DetailRow label="Očekivano">{transfer.expectedAt ? formatDateTime(transfer.expectedAt) : '—'}</DetailRow>
              <DetailRow label="Otpremljeno">{transfer.dispatchedAt ? formatDateTime(transfer.dispatchedAt) : '—'}</DetailRow>
              <DetailRow label="Zaprimljeno">{transfer.receivedAt ? formatDateTime(transfer.receivedAt) : '—'}</DetailRow>
            </div>
          </Card>

          <Card className="bg-surface-2">
            <p className="text-sm leading-relaxed text-ink-3">
              Otpremom se roba skida s izvornog skladišta i knjiži na tranzitno stanje.
              Zaprimanjem se knjiži ulaz na odredište po nabavnoj cijeni izvorne poslovnice.
            </p>
          </Card>

          {transfer.note && (
            <Card>
              <CardHeader compact title="Napomena" />
              <p className="text-base text-ink-2">{transfer.note}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
