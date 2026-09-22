import { CreditCard, Plus } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatPercent } from '@/lib/format';
import { PAYMENT_TYPE } from '@/lib/labels';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export const metadata = { title: 'Načini plaćanja' };
export const dynamic = 'force-dynamic';

export default async function PaymentMethodsPage() {
  const user = await requirePageAccess('settings.manage');

  const methods = await db.paymentMethod.findMany({
    where: { tenantId: user.tenantId },
    include: { _count: { select: { payments: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Načini plaćanja"
        subtitle="Sredstva naplate dostupna na blagajni, s fiskalnim oznakama i naknadama"
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Novi način</Button>}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={80}>Šifra</TH>
              <TH>Naziv</TH>
              <TH width={170}>Vrsta</TH>
              <TH width={110}>Fiskalna ozn.</TH>
              <TH width={100}>Otvara ladicu</TH>
              <TH width={110}>Dozvoljen ostatak</TH>
              <TH width={100}>Referenca</TH>
              <TH numeric width={90}>Naknada</TH>
              <TH numeric width={110}>Transakcija</TH>
              <TH width={90}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {methods.map((method) => (
              <TR key={method.id}>
                <TD className="font-mono text-sm">{method.code}</TD>
                <TD className="font-medium">{method.name}</TD>
                <TD className="text-ink-2">{PAYMENT_TYPE[method.type] ?? method.type}</TD>
                <TD className="font-mono text-xs text-ink-3">{method.fiscalCode ?? '—'}</TD>
                <TD className="text-ink-2">{method.opensDrawer ? 'Da' : 'Ne'}</TD>
                <TD className="text-ink-2">{method.allowsChange ? 'Da' : 'Ne'}</TD>
                <TD className="text-ink-2">{method.requiresRef ? 'Obavezna' : '—'}</TD>
                <TD numeric className="text-ink-2">
                  {toNumber(method.feePct) > 0 ? formatPercent(toNumber(method.feePct), 2) : '—'}
                </TD>
                <TD numeric>{method._count.payments.toLocaleString('hr-HR')}</TD>
                <TD>
                  <Badge tone={method.isActive ? 'positive' : 'neutral'}>
                    {method.isActive ? 'Aktivan' : 'Neaktivan'}
                  </Badge>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {methods.length === 0 && <EmptyState icon={<CreditCard className="size-4" />} title="Nema definiranih načina plaćanja" />}
      </Card>

      <p className="mt-2 px-1 text-2xs text-ink-4">
        Fiskalna oznaka određuje način plaćanja u poruci poreznoj upravi:
        G gotovina, K kartica, C ček, T transakcijski račun, O ostalo.
      </p>
    </div>
  );
}
