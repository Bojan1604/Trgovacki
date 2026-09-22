import { AlertTriangle, Plug } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import { Badge, Card, CardHeader, DetailRow, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Integracije' };
export const dynamic = 'force-dynamic';

const TYPE_LABEL: Record<string, string> = {
  FISCALIZATION: 'Fiskalizacija',
  E_INVOICE: 'e-Račun',
  PAYMENT_TERMINAL: 'POS terminal',
  ACCOUNTING: 'Knjigovodstvo',
  ECOMMERCE: 'Web shop',
  ERP: 'ERP sustav',
  SCALE: 'Vage',
  LABEL_PRINTER: 'Pisač naljepnica',
  LOYALTY_EXTERNAL: 'Vanjski program vjernosti',
  BI_EXPORT: 'Izvoz u BI',
};

const TYPE_DESCRIPTION: Record<string, string> = {
  FISCALIZATION: 'Slanje računa poreznoj upravi. Zahtijeva aplikativni certifikat.',
  PAYMENT_TERMINAL: 'Izravna komunikacija s EFT terminalom preko ECR protokola.',
  ACCOUNTING: 'Automatski prijenos prometa i primki u knjigovodstveni sustav.',
  ECOMMERCE: 'Dvosmjerna sinkronizacija artikala, cijena i zaliha s web shopom.',
  SCALE: 'Slanje asortimana na vage i čitanje internih barkodova s težinom.',
};

export default async function IntegrationsPage() {
  const user = await requirePageAccess('integration.manage');
  const config = env();

  const integrations = await db.integrationConfig.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { type: 'asc' },
  });

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Integracije"
        subtitle="Povezivanje s vanjskim sustavima — fiskalizacija, terminali, knjigovodstvo i web shop"
      />

      {config.FISCAL_ADAPTER === 'none' && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="text-base">
            <p className="font-medium">Fiskalizacija je isključena</p>
            <p className="mt-0.5 text-sm opacity-85">
              Sustav radi u razvojnom načinu. Za aktivaciju postavite{' '}
              <code className="font-mono">FISCAL_ADAPTER</code> i učitajte certifikat —
              poslovna logika ostaje nepromijenjena.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.id}>
            <CardHeader
              compact
              title={integration.name}
              subtitle={TYPE_LABEL[integration.type] ?? integration.type}
              actions={
                <Badge tone={integration.isEnabled ? 'positive' : 'neutral'} dot>
                  {integration.isEnabled ? 'Uključena' : 'Isključena'}
                </Badge>
              }
            />
            <p className="mb-2 text-sm leading-relaxed text-ink-3">
              {TYPE_DESCRIPTION[integration.type] ?? 'Prilagođena integracija.'}
            </p>
            <div className="divide-y divide-hairline">
              <DetailRow label="Pružatelj" mono>{integration.provider}</DetailRow>
              <DetailRow label="Zadnja sinkronizacija">
                {integration.lastSyncAt ? formatDateTime(integration.lastSyncAt) : '—'}
              </DetailRow>
              {integration.lastError && (
                <DetailRow label="Zadnja greška">
                  <span className="text-negative">{integration.lastError}</span>
                </DetailRow>
              )}
            </div>
            <div className="mt-2.5 flex gap-1.5">
              <Button size="sm" variant="secondary">Postavke</Button>
              <Button size="sm" variant={integration.isEnabled ? 'ghost' : 'primary'}>
                {integration.isEnabled ? 'Isključi' : 'Uključi'}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {integrations.length === 0 && (
        <EmptyState icon={<Plug className="size-4" />} title="Nema konfiguriranih integracija" />
      )}
    </div>
  );
}
