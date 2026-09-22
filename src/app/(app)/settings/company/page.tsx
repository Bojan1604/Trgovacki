import { Building2, Plus } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatDate, formatPercent } from '@/lib/format';
import { Badge, Card, CardHeader, DetailRow, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export const metadata = { title: 'Tvrtka i porezi' };
export const dynamic = 'force-dynamic';

export default async function CompanySettingsPage() {
  const user = await requirePageAccess('settings.manage');

  const [tenant, companies, taxRates, units, reasonCodes] = await Promise.all([
    db.tenant.findUnique({ where: { id: user.tenantId } }),
    db.company.findMany({
      where: { tenantId: user.tenantId },
      include: { _count: { select: { stores: true } } },
      orderBy: { code: 'asc' },
    }),
    db.taxRate.findMany({ where: { tenantId: user.tenantId }, orderBy: { rate: 'desc' } }),
    db.unitOfMeasure.findMany({ where: { tenantId: user.tenantId }, orderBy: { code: 'asc' } }),
    db.reasonCode.findMany({ where: { tenantId: user.tenantId }, orderBy: [{ scope: 'asc' }, { code: 'asc' }] }),
  ]);

  const SCOPE_LABEL: Record<string, string> = {
    write_off: 'Otpis',
    adjustment: 'Korekcija',
    return: 'Povrat',
    discount: 'Popust',
    void: 'Storno',
    drawer: 'Ladica',
  };

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Tvrtka i porezi"
        subtitle="Pravne osobe, porezne stope, jedinice mjere i šifrarnik razloga"
      />

      <div className="grid gap-2.5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2.5">
          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader
                compact
                title="Pravne osobe"
                subtitle="Izdavatelji računa"
                actions={<Button size="xs" variant="secondary" icon={<Plus className="size-3" />}>Dodaj</Button>}
              />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={60}>Šifra</TH>
                  <TH>Naziv</TH>
                  <TH width={110}>OIB</TH>
                  <TH width={170}>IBAN</TH>
                  <TH numeric width={90}>Poslovnica</TH>
                  <TH width={100}>PDV</TH>
                </TR>
              </THead>
              <TBody>
                {companies.map((company) => (
                  <TR key={company.id}>
                    <TD className="font-mono text-sm">{company.code}</TD>
                    <TD>
                      <span className="font-medium">{company.legalName}</span>
                      {company.isDefault && <Badge tone="accent" className="ml-1.5">zadana</Badge>}
                    </TD>
                    <TD className="font-mono text-xs">{company.vatId}</TD>
                    <TD className="font-mono text-xs text-ink-3">{company.iban ?? '—'}</TD>
                    <TD numeric>{company._count.stores}</TD>
                    <TD>
                      <Badge tone={company.vatRegistered ? 'positive' : 'neutral'}>
                        {company.vatRegistered ? 'Obveznik' : 'Nije obveznik'}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Porezne stope" subtitle="Stope PDV-a i oznake za fiskalizaciju" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={100}>Šifra</TH>
                  <TH>Naziv</TH>
                  <TH numeric width={90}>Stopa</TH>
                  <TH width={110}>Fiskalna oznaka</TH>
                  <TH width={110}>Vrijedi od</TH>
                  <TH width={90}>Zadana</TH>
                </TR>
              </THead>
              <TBody>
                {taxRates.map((tax) => (
                  <TR key={tax.id}>
                    <TD className="font-mono text-sm">{tax.code}</TD>
                    <TD>{tax.name}</TD>
                    <TD numeric className="font-medium">{formatPercent(toNumber(tax.rate), 0)}</TD>
                    <TD className="font-mono text-xs text-ink-3">{tax.fiscalCode ?? '—'}</TD>
                    <TD className="text-sm text-ink-3">{formatDate(tax.validFrom)}</TD>
                    <TD>{tax.isDefault && <Badge tone="accent">zadana</Badge>}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Šifrarnik razloga" subtitle="Razlozi otpisa, korekcija, povrata i popusta" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={110}>Šifra</TH>
                  <TH>Naziv</TH>
                  <TH width={120}>Područje</TH>
                  <TH width={120}>Obavezna nap.</TH>
                  <TH width={110}>Utječe na trošak</TH>
                </TR>
              </THead>
              <TBody>
                {reasonCodes.map((reason) => (
                  <TR key={reason.id}>
                    <TD className="font-mono text-sm">{reason.code}</TD>
                    <TD>{reason.name}</TD>
                    <TD className="text-ink-2">{SCOPE_LABEL[reason.scope] ?? reason.scope}</TD>
                    <TD className="text-ink-2">{reason.requiresNote ? 'Da' : 'Ne'}</TD>
                    <TD className="text-ink-2">{reason.affectsCost ? 'Da' : 'Ne'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>

        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Organizacija" actions={<Building2 className="size-3.5 text-ink-4" />} />
            <div className="divide-y divide-hairline">
              <DetailRow label="Naziv">{tenant?.name}</DetailRow>
              <DetailRow label="Pravni naziv">{tenant?.legalName ?? '—'}</DetailRow>
              <DetailRow label="Oznaka" mono>{tenant?.slug}</DetailRow>
              <DetailRow label="Paket">{tenant?.plan}</DetailRow>
              <DetailRow label="Valuta">{tenant?.baseCurrency}</DetailRow>
              <DetailRow label="Vremenska zona">{tenant?.timezone}</DetailRow>
              <DetailRow label="Jezik">{tenant?.locale}</DetailRow>
              <DetailRow label="Limit poslovnica">{tenant?.maxStores}</DetailRow>
              <DetailRow label="Limit korisnika">{tenant?.maxUsers}</DetailRow>
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Jedinice mjere" />
            <div className="space-y-1">
              {units.map((unit) => (
                <div key={unit.id} className="flex items-center justify-between gap-2 rounded-sm bg-surface-2 px-2 py-1 text-base">
                  <span>
                    <span className="font-mono text-sm font-medium">{unit.code}</span>
                    <span className="ml-1.5 text-ink-3">{unit.name}</span>
                  </span>
                  <span className="text-2xs text-ink-4">
                    {unit.precision} dec.{unit.isWeight ? ' · težinska' : ''}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
