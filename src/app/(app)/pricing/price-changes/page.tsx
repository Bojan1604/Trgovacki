import Link from 'next/link';
import { Percent, Plus } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDate } from '@/lib/format';
import { PRICE_CHANGE_STATUS } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export const metadata = { title: 'Nivelacije' };
export const dynamic = 'force-dynamic';

export default async function PriceChangesPage() {
  const user = await requirePermission('price.view');

  const documents = await db.priceChangeDocument.findMany({
    where: { tenantId: user.tenantId },
    include: { store: { select: { name: true } }, _count: { select: { lines: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Nivelacije"
        subtitle="Dokument promjene maloprodajne cijene — zakonski trag i razlika u vrijednosti zalihe"
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Nova nivelacija</Button>}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={130}>Broj</TH>
              <TH width={150}>Poslovnica</TH>
              <TH>Razlog</TH>
              <TH numeric width={90}>Stavki</TH>
              <TH numeric width={130}>Razlika vrijednosti</TH>
              <TH width={110}>Primjena</TH>
              <TH width={110}>Kreirano</TH>
              <TH width={120}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {documents.map((doc) => {
              const delta = toNumber(doc.stockValueDelta);
              return (
                <TR key={doc.id}>
                  <TD>
                    <Link href={`/pricing/price-changes/${doc.id}`} className="font-mono text-sm text-accent hover:underline">
                      {doc.number}
                    </Link>
                  </TD>
                  <TD className="text-ink-2">{doc.store?.name ?? 'Svi objekti'}</TD>
                  <TD className="truncate text-ink-2">{doc.reason ?? '—'}</TD>
                  <TD numeric>{doc._count.lines}</TD>
                  <TD numeric className={delta >= 0 ? 'text-positive' : 'text-negative'}>
                    {delta > 0 ? '+' : ''}{formatAmount(delta)} €
                  </TD>
                  <TD className="text-sm text-ink-3">{formatDate(doc.effectiveAt)}</TD>
                  <TD className="text-sm text-ink-3">{formatDate(doc.createdAt)}</TD>
                  <TD><Badge tone={PRICE_CHANGE_STATUS[doc.status].tone}>{PRICE_CHANGE_STATUS[doc.status].label}</Badge></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {documents.length === 0 && (
          <EmptyState icon={<Percent className="size-4" />} title="Nema nivelacija" description="Promjene cijena bilježe se dokumentom nivelacije." />
        )}
      </Card>
    </div>
  );
}
