import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, Printer, X } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber, round } from '@/lib/money';
import { formatAmount, formatDate, formatPercent, formatQty } from '@/lib/format';
import { PRICE_CHANGE_STATUS } from '@/lib/labels';
import { Badge, Card, CardHeader, DetailRow, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default async function PriceChangeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission('price.view');

  const doc = await db.priceChangeDocument.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      store: true,
      lines: {
        include: { variant: { include: { product: { select: { id: true, name: true, taxRate: { select: { rate: true } } } } } } },
      },
    },
  });
  if (!doc) notFound();

  const totalOld = doc.lines.reduce((acc, l) => acc + toNumber(l.oldPrice) * toNumber(l.stockQty), 0);
  const totalNew = doc.lines.reduce((acc, l) => acc + toNumber(l.newPrice) * toNumber(l.stockQty), 0);

  return (
    <div className="mx-auto max-w-[1280px]">
      <Link href="/pricing/price-changes" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3" /> Nivelacije
      </Link>

      <PageHeader
        title={`Nivelacija ${doc.number}`}
        subtitle={
          <span className="flex items-center gap-2">
            {doc.store?.name ?? 'Svi objekti'} · primjena {formatDate(doc.effectiveAt)}
            <Badge tone={PRICE_CHANGE_STATUS[doc.status].tone}>{PRICE_CHANGE_STATUS[doc.status].label}</Badge>
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" icon={<Printer className="size-3.5" />}>Ispis</Button>
            {doc.status === 'DRAFT' && (
              <>
                <Button size="sm" variant="secondary" icon={<X className="size-3.5" />}>Odbaci</Button>
                <Button size="sm" variant="primary" icon={<Check className="size-3.5" />}>Odobri i primijeni</Button>
              </>
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
                <TH>Naziv</TH>
                <TH numeric width={100}>Stara MPC</TH>
                <TH numeric width={100}>Nova MPC</TH>
                <TH numeric width={80}>Promjena</TH>
                <TH numeric width={90}>Zaliha</TH>
                <TH numeric width={110}>Razlika</TH>
              </TR>
            </THead>
            <TBody>
              {doc.lines.map((line) => {
                const oldPrice = toNumber(line.oldPrice);
                const newPrice = toNumber(line.newPrice);
                const changePct = oldPrice > 0 ? round(((newPrice - oldPrice) / oldPrice) * 100, 1) : 0;
                const delta = toNumber(line.valueDelta);
                return (
                  <TR key={line.id}>
                    <TD className="font-mono text-sm text-ink-3">{line.variant.sku}</TD>
                    <TD>
                      <Link href={`/catalog/products/${line.variant.product.id}`} className="hover:text-accent">
                        {line.variant.product.name}
                      </Link>
                    </TD>
                    <TD numeric className="text-ink-3">{formatAmount(oldPrice)}</TD>
                    <TD numeric className="font-medium">{formatAmount(newPrice)}</TD>
                    <TD numeric className={changePct >= 0 ? 'text-warning' : 'text-positive'}>
                      {changePct > 0 ? '+' : ''}{formatPercent(changePct, 1)}
                    </TD>
                    <TD numeric>{formatQty(toNumber(line.stockQty), 0)}</TD>
                    <TD numeric className={delta >= 0 ? 'text-positive' : 'text-negative'}>
                      {delta > 0 ? '+' : ''}{formatAmount(delta)}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
            <TFootRow>
              <TD colSpan={2}>Ukupno {doc.lines.length} stavki</TD>
              <TD numeric>{formatAmount(totalOld, 0)}</TD>
              <TD numeric>{formatAmount(totalNew, 0)}</TD>
              <TD />
              <TD />
              <TD numeric className={toNumber(doc.stockValueDelta) >= 0 ? 'text-positive' : 'text-negative'}>
                {formatAmount(toNumber(doc.stockValueDelta))}
              </TD>
            </TFootRow>
          </Table>
        </Card>

        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Podaci dokumenta" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Broj">{doc.number}</DetailRow>
              <DetailRow label="Status">{PRICE_CHANGE_STATUS[doc.status].label}</DetailRow>
              <DetailRow label="Poslovnica">{doc.store?.name ?? 'Svi objekti'}</DetailRow>
              <DetailRow label="Datum primjene">{formatDate(doc.effectiveAt)}</DetailRow>
              <DetailRow label="Kreirano">{formatDate(doc.createdAt)}</DetailRow>
              <DetailRow label="Odobreno">{doc.approvedAt ? formatDate(doc.approvedAt) : '—'}</DetailRow>
              <DetailRow label="Primijenjeno">{doc.appliedAt ? formatDate(doc.appliedAt) : '—'}</DetailRow>
              <DetailRow label="Broj stavki">{doc.lines.length}</DetailRow>
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Razlog promjene" />
            <p className="text-base text-ink-2">{doc.reason ?? 'Nije naveden.'}</p>
          </Card>

          <Card className="bg-surface-2">
            <p className="text-sm leading-relaxed text-ink-3">
              Nivelacija se knjiži na dan primjene. Razlika u vrijednosti zalihe evidentira se kao
              povećanje ili smanjenje vrijednosti robe u maloprodaji i ulazi u knjigu popisa.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
