import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { shiftReport } from '@/lib/services/shifts';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDateTime, formatPercent, formatQty } from '@/lib/format';
import { SHIFT_STATUS } from '@/lib/labels';
import { Badge, Card, CardHeader, DetailRow, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TFootRow, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';
import { ShareBar } from '@/components/charts/share-bar';

export const dynamic = 'force-dynamic';

const CASH_MOVEMENT_LABEL: Record<string, string> = {
  OPENING_FLOAT: 'Početni saldo',
  DEPOSIT: 'Polog',
  WITHDRAWAL: 'Podizanje',
  SALE_CASH: 'Gotovinska prodaja',
  REFUND_CASH: 'Povrat u gotovini',
  EXPENSE: 'Sitni trošak',
  CORRECTION: 'Korekcija',
  CLOSING: 'Zatvaranje',
};

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission('sale.view');

  const report = await shiftReport(id).catch(() => null);
  if (!report) notFound();

  const { shift, byPayment, byTax, topItems, totals } = report;
  const difference = toNumber(shift.cashDifference);
  const expected = toNumber(shift.expectedCash);
  const counted = shift.countedCash === null ? null : toNumber(shift.countedCash);
  const marginPct = totals.total > 0 ? ((totals.total - totals.tax - totals.cost) / (totals.total - totals.tax)) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1280px]">
      <Link href="/sales/shifts" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink no-print">
        <ArrowLeft className="size-3" /> Smjene
      </Link>

      <PageHeader
        title={`Z-izvještaj · smjena ${shift.number}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {shift.store.name} · {shift.register.name} · {shift.user.firstName} {shift.user.lastName}
            <Badge tone={SHIFT_STATUS[shift.status].tone} dot>{SHIFT_STATUS[shift.status].label}</Badge>
          </span>
        }
        actions={<Button size="sm" variant="secondary" icon={<Printer className="size-3.5" />} className="no-print">Ispiši Z-izvještaj</Button>}
      />

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <StatTile label="Promet smjene" value={formatAmount(totals.total, 0)} unit="€" hint={`${totals.count} računa`} />
        <StatTile label="Prosječna košarica" value={formatAmount(totals.count > 0 ? totals.total / totals.count : 0)} unit="€" />
        <StatTile label="Odobreni popusti" value={formatAmount(totals.discount)} unit="€" invertDelta />
        <StatTile label="Marža" value={formatAmount(totals.total - totals.tax - totals.cost, 0)} unit="€" hint={formatPercent(marginPct)} />
        <StatTile
          label="Razlika u blagajni"
          value={formatAmount(difference)}
          unit="€"
          hint={counted === null ? 'smjena je otvorena' : Math.abs(difference) < 0.01 ? 'uredno' : difference < 0 ? 'manjak' : 'višak'}
          invertDelta
        />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1fr_330px]">
        <div className="space-y-2.5">
          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Najprodavaniji artikli u smjeni" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={80}>Šifra</TH>
                  <TH>Naziv</TH>
                  <TH numeric width={90}>Količina</TH>
                  <TH numeric width={110}>Promet</TH>
                </TR>
              </THead>
              <TBody>
                {topItems.map((item) => (
                  <TR key={item.sku}>
                    <TD className="font-mono text-sm text-ink-3">{item.sku}</TD>
                    <TD className="truncate">{item.name}</TD>
                    <TD numeric>{formatQty(item.qty, 2)}</TD>
                    <TD numeric className="font-medium">{formatAmount(item.total)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Promet blagajne" subtitle="Kronologija gotovinskih kretanja" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={140}>Vrijeme</TH>
                  <TH width={170}>Vrsta</TH>
                  <TH>Referenca / napomena</TH>
                  <TH numeric width={110}>Iznos</TH>
                </TR>
              </THead>
              <TBody>
                {shift.cashMovements.slice(0, 40).map((movement) => (
                  <TR key={movement.id}>
                    <TD className="text-sm text-ink-3">{formatDateTime(movement.createdAt)}</TD>
                    <TD>{CASH_MOVEMENT_LABEL[movement.type] ?? movement.type}</TD>
                    <TD className="truncate text-ink-2">{movement.reference ?? movement.note ?? '—'}</TD>
                    <TD numeric className={toNumber(movement.amount) < 0 ? 'text-negative' : ''}>
                      {formatAmount(toNumber(movement.amount))}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {shift.cashMovements.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-4">Nema evidentiranih gotovinskih kretanja</p>
            )}
          </Card>
        </div>

        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Obračun gotovine" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Početni saldo">{formatAmount(toNumber(shift.openingFloat))} €</DetailRow>
              <DetailRow label="Gotovinska prodaja">{formatAmount(toNumber(shift.cashTotal))} €</DetailRow>
              <DetailRow label="Povrati">−{formatAmount(toNumber(shift.refundsTotal))} €</DetailRow>
              <DetailRow label="Očekivano u ladici">{formatAmount(expected)} €</DetailRow>
              <DetailRow label="Prebrojano">{counted === null ? '—' : `${formatAmount(counted)} €`}</DetailRow>
            </div>
            <div className="mt-2 flex items-baseline justify-between border-t border-hairline-strong/60 pt-2">
              <span className="text-md font-semibold">Razlika</span>
              <span className={`text-lg font-semibold tnum ${Math.abs(difference) < 0.01 ? '' : difference < 0 ? 'text-negative' : 'text-warning'}`}>
                {difference > 0 ? '+' : ''}{formatAmount(difference)} €
              </span>
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Po načinu plaćanja" />
            <ShareBar segments={byPayment.map((p) => ({ label: p.name, value: p.total }))} />
          </Card>

          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Rekapitulacija PDV-a" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={70}>Stopa</TH>
                  <TH numeric>Osnovica</TH>
                  <TH numeric width={90}>PDV</TH>
                </TR>
              </THead>
              <TBody>
                {byTax.map((tax) => (
                  <TR key={tax.rate}>
                    <TD>{formatPercent(tax.rate, 0)}</TD>
                    <TD numeric>{formatAmount(tax.base)}</TD>
                    <TD numeric>{formatAmount(tax.amount)}</TD>
                  </TR>
                ))}
              </TBody>
              <TFootRow>
                <TD>Ukupno</TD>
                <TD numeric>{formatAmount(byTax.reduce((a, t) => a + t.base, 0))}</TD>
                <TD numeric>{formatAmount(byTax.reduce((a, t) => a + t.amount, 0))}</TD>
              </TFootRow>
            </Table>
          </Card>

          <Card>
            <CardHeader compact title="Podaci smjene" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Otvorena">{formatDateTime(shift.openedAt)}</DetailRow>
              <DetailRow label="Zatvorena">{shift.closedAt ? formatDateTime(shift.closedAt) : '—'}</DetailRow>
              <DetailRow label="Blagajna">{shift.register.name}</DetailRow>
              <DetailRow label="Prodavač">{shift.user.firstName} {shift.user.lastName}</DetailRow>
              <DetailRow label="Stornirano stavki">{shift.voidCount}</DetailRow>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
