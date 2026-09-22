import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { requirePageAccess } from '@/lib/page-auth';
import { accessibleStoreIds, resolveStoreScope } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDateTime } from '@/lib/format';
import { SHIFT_STATUS } from '@/lib/labels';
import { resolveRange } from '@/lib/ranges';
import { Badge, Card, EmptyState } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { FilterBar } from '@/components/filters/filter-bar';
import { RangePicker } from '@/components/filters/range-picker';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Smjene i blagajna' };
export const dynamic = 'force-dynamic';

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePageAccess('sale.view');
  const preset = params.range ?? '30d';
  const range = resolveRange(preset);
  const allStores = await accessibleStoreIds(user);
  const { storeIds, storeId: selectedStoreId } = await resolveStoreScope(user, params.store);

  const [shifts, stores] = await Promise.all([
    db.shift.findMany({
      where: {
        tenantId: user.tenantId,
        storeId: { in: storeIds },
        openedAt: { gte: range.from, lte: range.to },
        ...(params.status ? { status: params.status as never } : {}),
      },
      include: {
        store: { select: { name: true } },
        register: { select: { code: true, name: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 120,
    }),
    db.store.findMany({ where: { id: { in: allStores } }, select: { id: true, name: true }, orderBy: { code: 'asc' } }),
  ]);

  const openShifts = shifts.filter((s) => s.status === 'OPEN');
  const totalSales = shifts.reduce((acc, s) => acc + toNumber(s.salesTotal), 0);
  const discrepancies = shifts.filter((s) => Math.abs(toNumber(s.cashDifference)) >= 1);
  const netDifference = shifts.reduce((acc, s) => acc + toNumber(s.cashDifference), 0);

  return (
    <div className="mx-auto max-w-[1440px]">
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold leading-tight">Smjene i blagajna</h1>
          <p className="mt-0.5 text-sm text-ink-3">Otvaranje, zatvaranje i usklađivanje gotovine po blagajni</p>
        </div>
        <RangePicker current={preset} showScope={false} />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Otvorenih smjena" value={String(openShifts.length)} hint="trenutno u radu" />
        <StatTile label="Promet u razdoblju" value={formatAmount(totalSales, 0)} unit="€" />
        <StatTile label="Smjena s razlikom" value={String(discrepancies.length)} hint="odstupanje ≥ 1 €" invertDelta />
        <StatTile label="Neto razlika blagajne" value={formatAmount(netDifference)} unit="€" invertDelta />
      </div>

      <FilterBar
        searchParam="none"
        searchPlaceholder="—"
        activeCount={['store', 'status'].filter((k) => params[k]).length}
        selects={[
          { param: 'store', placeholder: 'Sve poslovnice', value: selectedStoreId ?? '', width: 180, options: stores.map((s) => ({ value: s.id, label: s.name })) },
          { param: 'status', placeholder: 'Svi statusi', value: params.status, width: 160, options: Object.entries(SHIFT_STATUS).map(([value, v]) => ({ value, label: v.label })) },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={130}>Broj smjene</TH>
              <TH width={140}>Poslovnica</TH>
              <TH width={110}>Blagajna</TH>
              <TH>Prodavač</TH>
              <TH width={130}>Otvoreno</TH>
              <TH width={130}>Zatvoreno</TH>
              <TH numeric width={60}>Računa</TH>
              <TH numeric width={100}>Promet</TH>
              <TH numeric width={100}>Gotovina</TH>
              <TH numeric width={100}>Kartice</TH>
              <TH numeric width={100}>Razlika</TH>
              <TH width={110}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {shifts.map((shift) => {
              const difference = toNumber(shift.cashDifference);
              return (
                <TR key={shift.id}>
                  <TD>
                    <Link href={`/sales/shifts/${shift.id}`} className="font-mono text-sm text-accent hover:underline">
                      {shift.number}
                    </Link>
                  </TD>
                  <TD className="truncate text-ink-2">{shift.store.name}</TD>
                  <TD className="text-ink-2">{shift.register.name}</TD>
                  <TD className="truncate">{shift.user.firstName} {shift.user.lastName}</TD>
                  <TD className="text-sm text-ink-3">{formatDateTime(shift.openedAt)}</TD>
                  <TD className="text-sm text-ink-3">{shift.closedAt ? formatDateTime(shift.closedAt) : '—'}</TD>
                  <TD numeric>{shift.salesCount}</TD>
                  <TD numeric className="font-medium">{formatAmount(toNumber(shift.salesTotal))}</TD>
                  <TD numeric className="text-ink-2">{formatAmount(toNumber(shift.cashTotal))}</TD>
                  <TD numeric className="text-ink-2">{formatAmount(toNumber(shift.cardTotal))}</TD>
                  <TD numeric className={Math.abs(difference) < 0.01 ? 'text-ink-4' : difference < 0 ? 'text-negative' : 'text-warning'}>
                    {shift.status === 'OPEN' ? '—' : `${difference > 0 ? '+' : ''}${formatAmount(difference)}`}
                  </TD>
                  <TD><Badge tone={SHIFT_STATUS[shift.status].tone} dot>{SHIFT_STATUS[shift.status].label}</Badge></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {shifts.length === 0 && <EmptyState icon={<Wallet className="size-4" />} title="Nema smjena u razdoblju" />}
      </Card>
    </div>
  );
}
