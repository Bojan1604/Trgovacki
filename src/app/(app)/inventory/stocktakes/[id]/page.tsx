import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, Printer } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDateTime, formatQty } from '@/lib/format';
import { STOCKTAKE_STATUS } from '@/lib/labels';
import { Badge, Card, CardHeader, DetailRow, PageHeader, Progress } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';

export const dynamic = 'force-dynamic';

export default async function StockTakeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requirePageAccess('stocktake.manage');

  const take = await db.stockTake.findFirst({
    where: { id, tenantId: user.tenantId },
    include: {
      store: true,
      warehouse: true,
      lines: {
        include: { variant: { include: { product: { select: { id: true, name: true } } } } },
        orderBy: { variant: { product: { name: 'asc' } } },
      },
    },
  });
  if (!take) notFound();

  const onlyDiff = query.filter === 'diff';
  const lines = onlyDiff ? take.lines.filter((l) => toNumber(l.differenceQty) !== 0) : take.lines;
  const progress = take.totalLines > 0 ? (take.countedLines / take.totalLines) * 100 : 0;
  const netValue = toNumber(take.surplusValue) - toNumber(take.deficitValue);

  return (
    <div className="mx-auto max-w-[1340px]">
      <Link href="/inventory/stocktakes" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-3" /> Inventure
      </Link>

      <PageHeader
        title={take.name ?? `Inventura ${take.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{take.number}</span>
            · {take.store.name} · {take.warehouse.name}
            <Badge tone={STOCKTAKE_STATUS[take.status].tone} dot>{STOCKTAKE_STATUS[take.status].label}</Badge>
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" icon={<Printer className="size-3.5" />}>Ispis popisa</Button>
            {take.status === 'REVIEW' && (
              <Button size="sm" variant="primary" icon={<Check className="size-3.5" />}>Odobri i proknjiži</Button>
            )}
          </>
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Prebrojano stavki" value={`${take.countedLines} / ${take.totalLines}`} hint={`${progress.toFixed(0)} % dovršeno`} />
        <StatTile label="Manjak" value={formatAmount(toNumber(take.deficitValue), 0)} unit="€" />
        <StatTile label="Višak" value={formatAmount(toNumber(take.surplusValue), 0)} unit="€" />
        <StatTile label="Neto razlika" value={formatAmount(netValue, 0)} unit="€" hint={netValue < 0 ? 'rashod' : 'prihod'} />
      </div>

      <Card className="mb-2.5" padded>
        <div className="flex items-center gap-3">
          <Progress value={progress} tone={progress >= 100 ? 'positive' : 'accent'} className="flex-1" />
          <span className="shrink-0 text-sm text-ink-3 tnum">{progress.toFixed(0)} %</span>
          <div className="flex gap-1.5">
            <Link href={`/inventory/stocktakes/${take.id}`}>
              <Button size="xs" variant={onlyDiff ? 'ghost' : 'secondary'}>Sve stavke</Button>
            </Link>
            <Link href={`/inventory/stocktakes/${take.id}?filter=diff`}>
              <Button size="xs" variant={onlyDiff ? 'secondary' : 'ghost'}>Samo razlike</Button>
            </Link>
          </div>
        </div>
      </Card>

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={80}>Šifra</TH>
              <TH>Artikl</TH>
              <TH numeric width={110}>Knjigovodstveno</TH>
              <TH numeric width={100}>Prebrojano</TH>
              <TH numeric width={90}>Razlika</TH>
              <TH numeric width={90}>NC</TH>
              <TH numeric width={110}>Vrijednost razlike</TH>
              <TH width={140}>Prebrojao</TH>
            </TR>
          </THead>
          <TBody>
            {lines.map((line) => {
              const diff = toNumber(line.differenceQty);
              const counted = line.countedQty === null ? null : toNumber(line.countedQty);
              return (
                <TR key={line.id} muted={counted === null}>
                  <TD className="font-mono text-sm text-ink-3">{line.variant.sku}</TD>
                  <TD>
                    <Link href={`/catalog/products/${line.variant.product.id}`} className="hover:text-accent">
                      {line.variant.product.name}
                    </Link>
                  </TD>
                  <TD numeric className="text-ink-3">{formatQty(toNumber(line.expectedQty), 1)}</TD>
                  <TD numeric className="font-medium">{counted === null ? '—' : formatQty(counted, 1)}</TD>
                  <TD numeric className={diff === 0 ? 'text-ink-4' : diff < 0 ? 'text-negative' : 'text-positive'}>
                    {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatQty(diff, 1)}`}
                  </TD>
                  <TD numeric className="text-ink-3">{formatAmount(toNumber(line.unitCost))}</TD>
                  <TD numeric className={toNumber(line.valueDelta) < 0 ? 'text-negative' : 'text-positive'}>
                    {formatAmount(toNumber(line.valueDelta))}
                  </TD>
                  <TD className="text-sm text-ink-3">{line.countedAt ? formatDateTime(line.countedAt) : 'nije prebrojano'}</TD>
                </TR>
              );
            })}
          </TBody>
          <TFootRow>
            <TD colSpan={6}>Prikazano {lines.length} stavki</TD>
            <TD numeric className={netValue < 0 ? 'text-negative' : 'text-positive'}>{formatAmount(netValue)}</TD>
            <TD />
          </TFootRow>
        </Table>
      </Card>

      <Card className="mt-2.5">
        <CardHeader compact title="Podaci inventure" />
        <div className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
          <DetailRow label="Započeta">{take.startedAt ? formatDateTime(take.startedAt) : '—'}</DetailRow>
          <DetailRow label="Prebrojana">{take.countedAt ? formatDateTime(take.countedAt) : '—'}</DetailRow>
          <DetailRow label="Proknjižena">{take.postedAt ? formatDateTime(take.postedAt) : '—'}</DetailRow>
          <DetailRow label="Blokada prodaje">{take.freezeStock ? 'Da' : 'Ne'}</DetailRow>
        </div>
      </Card>
    </div>
  );
}
