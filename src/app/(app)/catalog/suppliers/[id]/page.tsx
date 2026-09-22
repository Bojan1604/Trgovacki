import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, MapPin, Phone, Truck } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate, formatPercent } from '@/lib/format';
import { Badge, Card, CardHeader, DetailRow, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { DOC_STATUS, PO_STATUS } from '@/lib/labels';

export const dynamic = 'force-dynamic';

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageAccess('supplier.view');

  const supplier = await db.supplier.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      products: {
        include: { product: { select: { id: true, sku: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 25,
      },
      purchaseOrders: {
        include: { store: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      goodsReceipts: {
        include: { store: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: { select: { products: true, purchaseOrders: true, goodsReceipts: true } },
    },
  });

  if (!supplier) notFound();

  const totals = await db.goodsReceipt.aggregate({
    where: { supplierId: supplier.id, status: 'POSTED' },
    _sum: { total: true, goodsValue: true, marginTotal: true },
    _count: true,
  });

  return (
    <div className="mx-auto max-w-[1340px]">
      <Link href="/catalog/suppliers" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3" /> Dobavljači
      </Link>

      <PageHeader
        title={supplier.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{supplier.code}</span>
            {supplier.vatId && <>· OIB {supplier.vatId}</>}
            <Badge tone={supplier.isActive ? 'positive' : 'neutral'}>
              {supplier.isActive ? 'Aktivan' : 'Neaktivan'}
            </Badge>
          </span>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Ukupno nabavljeno" value={formatAmount(toNumber(totals._sum.total), 0)} unit="€" hint={`${totals._count} knjiženih primki`} />
        <StatTile label="Vrijednost robe (bez PDV-a)" value={formatAmount(toNumber(totals._sum.goodsValue), 0)} unit="€" />
        <StatTile label="Ostvarena marža" value={formatAmount(toNumber(totals._sum.marginTotal), 0)} unit="€" />
        <StatTile label="Artikala u ponudi" value={String(supplier._count.products)} hint={`${supplier._count.purchaseOrders} narudžbenica`} icon={<Truck className="size-3.5" />} />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2.5">
          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Posljednje narudžbenice" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={140}>Broj</TH>
                  <TH>Poslovnica</TH>
                  <TH width={110}>Datum</TH>
                  <TH numeric width={110}>Iznos</TH>
                  <TH width={130}>Status</TH>
                </TR>
              </THead>
              <TBody>
                {supplier.purchaseOrders.map((po) => (
                  <TR key={po.id}>
                    <TD>
                      <Link href={`/purchasing/orders/${po.id}`} className="font-mono text-sm text-accent hover:underline">
                        {po.number}
                      </Link>
                    </TD>
                    <TD className="text-ink-2">{po.store.name}</TD>
                    <TD className="text-sm text-ink-3">{formatDate(po.orderedAt ?? po.createdAt)}</TD>
                    <TD numeric>{formatAmount(toNumber(po.total))}</TD>
                    <TD><Badge tone={PO_STATUS[po.status].tone}>{PO_STATUS[po.status].label}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {supplier.purchaseOrders.length === 0 && <EmptyState compact title="Nema narudžbenica" />}
          </Card>

          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Posljednje primke" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={140}>Broj</TH>
                  <TH>Poslovnica</TH>
                  <TH width={120}>Dokument dob.</TH>
                  <TH numeric width={110}>Iznos</TH>
                  <TH width={120}>Status</TH>
                </TR>
              </THead>
              <TBody>
                {supplier.goodsReceipts.map((gr) => (
                  <TR key={gr.id}>
                    <TD>
                      <Link href={`/purchasing/receipts/${gr.id}`} className="font-mono text-sm text-accent hover:underline">
                        {gr.number}
                      </Link>
                    </TD>
                    <TD className="text-ink-2">{gr.store.name}</TD>
                    <TD className="font-mono text-xs text-ink-4">{gr.supplierDocNo ?? '—'}</TD>
                    <TD numeric>{formatAmount(toNumber(gr.total))}</TD>
                    <TD><Badge tone={DOC_STATUS[gr.status].tone}>{DOC_STATUS[gr.status].label}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {supplier.goodsReceipts.length === 0 && <EmptyState compact title="Nema primki" />}
          </Card>

          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Artikli dobavljača" subtitle="Nabavne cijene i uvjeti" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={80}>Šifra</TH>
                  <TH>Naziv</TH>
                  <TH width={120}>Šifra dob.</TH>
                  <TH numeric width={90}>Nab. cijena</TH>
                  <TH numeric width={70}>Rabat</TH>
                  <TH numeric width={80}>Min. kol.</TH>
                  <TH numeric width={80}>Pakiranje</TH>
                </TR>
              </THead>
              <TBody>
                {supplier.products.map((ps) => (
                  <TR key={ps.id}>
                    <TD className="font-mono text-sm text-ink-3">{ps.product.sku}</TD>
                    <TD>
                      <Link href={`/catalog/products/${ps.product.id}`} className="hover:text-accent">
                        {ps.product.name}
                      </Link>
                    </TD>
                    <TD className="font-mono text-xs text-ink-4">{ps.supplierSku ?? '—'}</TD>
                    <TD numeric>{formatAmount(toNumber(ps.purchasePrice))}</TD>
                    <TD numeric>{formatPercent(toNumber(ps.discountPct), 1)}</TD>
                    <TD numeric>{formatAmount(toNumber(ps.minOrderQty), 0)}</TD>
                    <TD numeric>{formatAmount(toNumber(ps.packQty), 0)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>

        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Kontakt" />
            <div className="space-y-1.5 text-base">
              {supplier.contactPerson && <p className="font-medium">{supplier.contactPerson}</p>}
              {supplier.email && (
                <p className="flex items-center gap-1.5 text-ink-2">
                  <Mail className="size-3.5 text-ink-4" /> {supplier.email}
                </p>
              )}
              {supplier.phone && (
                <p className="flex items-center gap-1.5 text-ink-2">
                  <Phone className="size-3.5 text-ink-4" /> {supplier.phone}
                </p>
              )}
              <p className="flex items-start gap-1.5 text-ink-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-ink-4" />
                <span>
                  {supplier.addressLine}
                  <br />
                  {supplier.postalCode} {supplier.city}, {supplier.country}
                </span>
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Komercijalni uvjeti" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Rok plaćanja">{supplier.paymentTerms} dana</DetailRow>
              <DetailRow label="Rok isporuke">{supplier.leadTimeDays} dana</DetailRow>
              <DetailRow label="Osnovni rabat">{formatPercent(toNumber(supplier.discountPct), 1)}</DetailRow>
              <DetailRow label="Min. vrijednost narudžbe">{formatAmount(toNumber(supplier.minOrderValue))} €</DetailRow>
              <DetailRow label="Valuta">{supplier.currency}</DetailRow>
              <DetailRow label="Dani isporuke">{supplier.deliveryDays.join(', ') || '—'}</DetailRow>
              <DetailRow label="IBAN" mono>{supplier.iban ?? '—'}</DetailRow>
            </div>
          </Card>

          {supplier.notes && (
            <Card>
              <CardHeader compact title="Napomena" />
              <p className="text-base text-ink-2">{supplier.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
