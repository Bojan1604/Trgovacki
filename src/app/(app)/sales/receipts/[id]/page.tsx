import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Printer, RotateCcw, ShieldCheck } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDateTime, formatPercent, formatQty } from '@/lib/format';
import { FISCAL_STATUS, SALE_STATUS } from '@/lib/labels';
import { Badge, Card, CardHeader, DetailRow, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageAccess('sale.view');

  const sale = await db.sale.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      store: { include: { company: true } },
      register: true,
      user: { select: { firstName: true, lastName: true } },
      customer: true,
      shift: { select: { id: true, number: true } },
      lines: { include: { variant: { include: { product: { select: { id: true } } } } }, orderBy: { lineNo: 'asc' } },
      payments: { include: { paymentMethod: true } },
      taxLines: { orderBy: { taxRate: 'desc' } },
      discounts: true,
      refunds: { select: { id: true, number: true, total: true, issuedAt: true } },
      originalSale: { select: { id: true, number: true } },
      fiscalLogs: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });
  if (!sale) notFound();

  const isRefund = sale.kind === 'CREDIT_NOTE';
  const customerName =
    sale.customer?.companyName || `${sale.customer?.firstName ?? ''} ${sale.customer?.lastName ?? ''}`.trim();

  return (
    <div className="mx-auto max-w-[1340px]">
      <Link href="/sales/receipts" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink no-print">
        <ArrowLeft className="size-3" /> Računi
      </Link>

      <PageHeader
        title={`${isRefund ? 'Odobrenje' : 'Račun'} ${sale.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {formatDateTime(sale.issuedAt)} · {sale.store.name}
            {sale.register && <>· blagajna {sale.register.code}</>}
            <Badge tone={SALE_STATUS[sale.status].tone}>{SALE_STATUS[sale.status].label}</Badge>
            <Badge tone={FISCAL_STATUS[sale.fiscalStatus].tone} dot>{FISCAL_STATUS[sale.fiscalStatus].label}</Badge>
          </span>
        }
        actions={
          <div className="no-print flex items-center gap-1.5">
            <Button size="sm" variant="secondary" icon={<Printer className="size-3.5" />}>Ispiši</Button>
            <Button size="sm" variant="secondary" icon={<Mail className="size-3.5" />}>Pošalji e-poštom</Button>
            {!isRefund && sale.status === 'COMPLETED' && (
              <Button size="sm" variant="danger" icon={<RotateCcw className="size-3.5" />}>Povrat</Button>
            )}
          </div>
        }
      />

      <div className="grid gap-2.5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2.5">
          <Card padded={false}>
            <Table>
              <THead sticky>
                <TR>
                  <TH width={40}>#</TH>
                  <TH width={80}>Šifra</TH>
                  <TH>Naziv</TH>
                  <TH numeric width={80}>Količina</TH>
                  <TH numeric width={90}>Cijena</TH>
                  <TH numeric width={80}>Popust</TH>
                  <TH numeric width={60}>PDV</TH>
                  <TH numeric width={100}>Iznos</TH>
                </TR>
              </THead>
              <TBody>
                {sale.lines.map((line) => (
                  <TR key={line.id} muted={line.isVoided}>
                    <TD className="text-ink-4">{line.lineNo}</TD>
                    <TD className="font-mono text-sm text-ink-3">{line.sku}</TD>
                    <TD>
                      <Link href={`/catalog/products/${line.variant.product.id}`} className="hover:text-accent">
                        {line.name}
                      </Link>
                      {toNumber(line.refundedQty) > 0 && (
                        <Badge tone="warning" className="ml-1.5">vraćeno {formatQty(toNumber(line.refundedQty), 0)}</Badge>
                      )}
                    </TD>
                    <TD numeric>{formatQty(toNumber(line.quantity), 2)}</TD>
                    <TD numeric>{formatAmount(toNumber(line.unitPrice))}</TD>
                    <TD numeric className="text-ink-3">
                      {toNumber(line.discountAmount) > 0 ? `−${formatAmount(toNumber(line.discountAmount))}` : '—'}
                    </TD>
                    <TD numeric className="text-ink-3">{formatPercent(toNumber(line.taxRate), 0)}</TD>
                    <TD numeric className="font-medium">{formatAmount(toNumber(line.lineTotal))}</TD>
                  </TR>
                ))}
              </TBody>
              <TFootRow>
                <TD colSpan={7}>Ukupno</TD>
                <TD numeric>{formatAmount(toNumber(sale.total))}</TD>
              </TFootRow>
            </Table>
          </Card>

          {sale.discounts.length > 0 && (
            <Card>
              <CardHeader compact title="Primijenjeni popusti" />
              <div className="space-y-1">
                {sale.discounts.map((discount) => (
                  <div key={discount.id} className="flex items-center justify-between gap-2 rounded-sm bg-surface-2 px-2 py-1">
                    <span className="flex items-center gap-1.5 text-base">
                      <Badge tone={discount.origin === 'MANUAL' ? 'warning' : 'accent'}>
                        {discount.origin === 'MANUAL' ? 'ručni' : discount.origin === 'LOYALTY' ? 'vjernost' : 'akcija'}
                      </Badge>
                      {discount.description}
                    </span>
                    <span className="font-mono text-sm text-negative tnum">−{formatAmount(toNumber(discount.amount))} €</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {sale.refunds.length > 0 && (
            <Card>
              <CardHeader compact title="Povrati na ovaj račun" />
              <div className="space-y-1">
                {sale.refunds.map((refund) => (
                  <Link
                    key={refund.id}
                    href={`/sales/receipts/${refund.id}`}
                    className="flex items-center justify-between gap-2 rounded-sm bg-surface-2 px-2 py-1 hover:bg-surface-3"
                  >
                    <span className="font-mono text-sm text-accent">{refund.number}</span>
                    <span className="text-sm text-ink-3">{formatDateTime(refund.issuedAt)}</span>
                    <span className="font-mono text-sm tnum">{formatAmount(toNumber(refund.total))} €</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Rekapitulacija" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Osnovica">{formatAmount(toNumber(sale.subtotal))} €</DetailRow>
              <DetailRow label="Popust">−{formatAmount(toNumber(sale.discountTotal))} €</DetailRow>
              {toNumber(sale.depositTotal) !== 0 && (
                <DetailRow label="Povratna naknada">{formatAmount(toNumber(sale.depositTotal))} €</DetailRow>
              )}
              {sale.taxLines.map((tax) => (
                <DetailRow key={tax.id} label={`${tax.taxName} (osnovica ${formatAmount(toNumber(tax.baseAmount))})`}>
                  {formatAmount(toNumber(tax.taxAmount))} €
                </DetailRow>
              ))}
              {toNumber(sale.roundingAmount) !== 0 && (
                <DetailRow label="Zaokruživanje">{formatAmount(toNumber(sale.roundingAmount))} €</DetailRow>
              )}
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-hairline-strong/60 pt-2">
              <span className="text-md font-semibold">Za naplatu</span>
              <span className="text-xl font-semibold tnum">{formatAmount(toNumber(sale.total))} €</span>
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Plaćanje" />
            <div className="divide-y divide-hairline">
              {sale.payments.map((payment) => (
                <DetailRow key={payment.id} label={payment.paymentMethod.name}>
                  {formatAmount(toNumber(payment.amount))} €
                  {payment.cardLast4 && <span className="ml-1 text-2xs text-ink-4">•••• {payment.cardLast4}</span>}
                </DetailRow>
              ))}
              {toNumber(sale.changeAmount) > 0 && (
                <DetailRow label="Povrat (ostatak)">{formatAmount(toNumber(sale.changeAmount))} €</DetailRow>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Fiskalizacija" actions={<ShieldCheck className="size-3.5 text-ink-4" />} />
            <div className="divide-y divide-hairline">
              <DetailRow label="Status">{FISCAL_STATUS[sale.fiscalStatus].label}</DetailRow>
              <DetailRow label="JIR" mono>{sale.fiscalJir ?? '—'}</DetailRow>
              <DetailRow label="ZKI" mono>{sale.fiscalZki ?? '—'}</DetailRow>
              <DetailRow label="Poslano">{sale.fiscalSentAt ? formatDateTime(sale.fiscalSentAt) : '—'}</DetailRow>
              <DetailRow label="Oznaka slijednosti">{sale.fiscalSeqMark}</DetailRow>
              <DetailRow label="Način plaćanja">{sale.fiscalPaymentType ?? '—'}</DetailRow>
            </div>
            {sale.fiscalError && (
              <p className="mt-2 rounded-md bg-negative-soft px-2 py-1.5 text-sm text-negative">{sale.fiscalError}</p>
            )}
            {sale.fiscalLogs.length > 0 && (
              <p className="mt-2 text-2xs text-ink-4">
                Posljednji pokušaj: {formatDateTime(sale.fiscalLogs[0].createdAt)} ·{' '}
                {sale.fiscalLogs[0].durationMs ?? 0} ms
              </p>
            )}
          </Card>

          <Card>
            <CardHeader compact title="Podaci dokumenta" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Izdavatelj">{sale.store.company.legalName}</DetailRow>
              <DetailRow label="OIB izdavatelja" mono>{sale.store.company.vatId}</DetailRow>
              <DetailRow label="Poslovni prostor">{sale.store.code} — {sale.store.name}</DetailRow>
              <DetailRow label="Naplatni uređaj">{sale.register?.code ?? '—'}</DetailRow>
              <DetailRow label="Prodavač">{sale.user ? `${sale.user.firstName} ${sale.user.lastName}` : '—'}</DetailRow>
              <DetailRow label="Kupac">{customerName || 'Fizička osoba'}</DetailRow>
              {sale.customer?.vatId && <DetailRow label="OIB kupca" mono>{sale.customer.vatId}</DetailRow>}
              <DetailRow label="Kanal prodaje">{sale.channel}</DetailRow>
              {sale.shift && (
                <DetailRow label="Smjena">
                  <Link href={`/sales/shifts/${sale.shift.id}`} className="text-accent hover:underline">
                    {sale.shift.number}
                  </Link>
                </DetailRow>
              )}
              {sale.loyaltyPointsEarned > 0 && <DetailRow label="Bodovi vjernosti">+{sale.loyaltyPointsEarned}</DetailRow>}
              {sale.originalSale && (
                <DetailRow label="Izvorni račun">
                  <Link href={`/sales/receipts/${sale.originalSale.id}`} className="text-accent hover:underline">
                    {sale.originalSale.number}
                  </Link>
                </DetailRow>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
