import Link from 'next/link';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { requirePermission, accessibleStoreIds } from '@/lib/auth';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { toNumber } from '@/lib/money';
import { formatAmount, formatDateTime } from '@/lib/format';
import { FISCAL_STATUS } from '@/lib/labels';
import { Badge, Card, CardHeader, DetailRow, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StatTile } from '@/components/charts/stat-tile';

export const metadata = { title: 'Fiskalizacija' };
export const dynamic = 'force-dynamic';

const ADAPTER_LABEL: Record<string, string> = {
  none: 'Isključena',
  'hr-demo': 'Demo (bez certifikata)',
  'hr-production': 'Produkcijska — Porezna uprava RH',
};

export default async function FiscalPage() {
  const user = await requirePermission('sale.view');
  const storeIds = await accessibleStoreIds(user);
  const config = env();

  const [counts, failed, recentLogs, integration] = await Promise.all([
    db.sale.groupBy({
      by: ['fiscalStatus'],
      where: { tenantId: user.tenantId, storeId: { in: storeIds } },
      _count: true,
    }),
    db.sale.findMany({
      where: { tenantId: user.tenantId, storeId: { in: storeIds }, fiscalStatus: { in: ['FAILED', 'PENDING', 'QUEUED'] } },
      include: { store: { select: { name: true } } },
      orderBy: { issuedAt: 'desc' },
      take: 50,
    }),
    db.fiscalLog.findMany({
      where: { sale: { tenantId: user.tenantId, storeId: { in: storeIds } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { sale: { select: { id: true, number: true } } },
    }),
    db.integrationConfig.findFirst({ where: { tenantId: user.tenantId, type: 'FISCALIZATION' } }),
  ]);

  const countMap = new Map(counts.map((c) => [c.fiscalStatus, c._count]));
  const confirmed = countMap.get('CONFIRMED') ?? 0;
  const failedCount = countMap.get('FAILED') ?? 0;
  const pending = (countMap.get('PENDING') ?? 0) + (countMap.get('QUEUED') ?? 0);
  const notRequired = countMap.get('NOT_REQUIRED') ?? 0;

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Fiskalizacija"
        subtitle="Status dostave računa poreznoj upravi i red čekanja za ponovno slanje"
        actions={
          <Button size="sm" variant="primary" icon={<RefreshCw className="size-3.5" />} disabled={failedCount + pending === 0}>
            Ponovi slanje ({failedCount + pending})
          </Button>
        }
      />

      {config.FISCAL_ADAPTER === 'none' && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="text-base">
            <p className="font-medium">Fiskalizacija nije aktivirana</p>
            <p className="mt-0.5 text-sm opacity-85">
              Sustav izdaje račune bez slanja poreznoj upravi. Za aktivaciju je potreban FINA aplikativni
              certifikat i postavka <code className="font-mono">FISCAL_ADAPTER=hr-production</code>.
              Ostatak sustava se ne mijenja — mijenja se samo adapter.
            </p>
          </div>
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatTile label="Fiskalizirani računi" value={confirmed.toLocaleString('hr-HR')} icon={<ShieldCheck className="size-3.5" />} />
        <StatTile label="Greške" value={String(failedCount)} hint="zahtijevaju intervenciju" invertDelta />
        <StatTile label="U redu čekanja" value={String(pending)} />
        <StatTile label="Bez obveze fiskalizacije" value={notRequired.toLocaleString('hr-HR')} hint="npr. skladišni dokumenti" />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2.5">
          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Računi koji čekaju obradu" subtitle="Greške i neposlani dokumenti" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={110}>Broj</TH>
                  <TH width={140}>Poslovnica</TH>
                  <TH width={140}>Izdan</TH>
                  <TH numeric width={90}>Iznos</TH>
                  <TH numeric width={70}>Pokušaja</TH>
                  <TH>Greška</TH>
                  <TH width={120}>Status</TH>
                </TR>
              </THead>
              <TBody>
                {failed.map((sale) => (
                  <TR key={sale.id}>
                    <TD>
                      <Link href={`/sales/receipts/${sale.id}`} className="font-mono text-sm text-accent hover:underline">
                        {sale.number}
                      </Link>
                    </TD>
                    <TD className="truncate text-ink-2">{sale.store.name}</TD>
                    <TD className="text-sm text-ink-3">{formatDateTime(sale.issuedAt)}</TD>
                    <TD numeric>{formatAmount(toNumber(sale.total))}</TD>
                    <TD numeric>{sale.fiscalRetries}</TD>
                    <TD className="truncate text-sm text-negative">{sale.fiscalError ?? '—'}</TD>
                    <TD><Badge tone={FISCAL_STATUS[sale.fiscalStatus].tone} dot>{FISCAL_STATUS[sale.fiscalStatus].label}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {failed.length === 0 && (
              <EmptyState compact icon={<ShieldCheck className="size-4" />} title="Nema neriješenih računa" description="Svi računi su uspješno obrađeni." />
            )}
          </Card>

          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Zapisnik komunikacije" subtitle="Posljednjih 20 poziva servisu" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={140}>Vrijeme</TH>
                  <TH width={110}>Račun</TH>
                  <TH numeric width={70}>Pokušaj</TH>
                  <TH width={240}>JIR</TH>
                  <TH numeric width={80}>Trajanje</TH>
                  <TH width={120}>Status</TH>
                </TR>
              </THead>
              <TBody>
                {recentLogs.map((log) => (
                  <TR key={log.id}>
                    <TD className="text-sm text-ink-3">{formatDateTime(log.createdAt)}</TD>
                    <TD>
                      <Link href={`/sales/receipts/${log.sale.id}`} className="font-mono text-sm text-accent hover:underline">
                        {log.sale.number}
                      </Link>
                    </TD>
                    <TD numeric>{log.attempt}</TD>
                    <TD className="truncate font-mono text-xs text-ink-4">{log.jir ?? '—'}</TD>
                    <TD numeric className="text-ink-3">{log.durationMs ? `${log.durationMs} ms` : '—'}</TD>
                    <TD><Badge tone={FISCAL_STATUS[log.status].tone}>{FISCAL_STATUS[log.status].label}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            {recentLogs.length === 0 && <EmptyState compact title="Nema zapisa" description="Fiskalizacija još nije korištena." />}
          </Card>
        </div>

        <div className="space-y-2.5">
          <Card>
            <CardHeader compact title="Konfiguracija" />
            <div className="divide-y divide-hairline">
              <DetailRow label="Adapter">{ADAPTER_LABEL[config.FISCAL_ADAPTER]}</DetailRow>
              <DetailRow label="Servis" mono>{config.FISCAL_ENDPOINT || '—'}</DetailRow>
              <DetailRow label="Certifikat">{config.FISCAL_CERT_PATH ? 'Učitan' : 'Nije postavljen'}</DetailRow>
              <DetailRow label="Integracija">{integration?.isEnabled ? 'Uključena' : 'Isključena'}</DetailRow>
              <DetailRow label="Zadnja sinkronizacija">
                {integration?.lastSyncAt ? formatDateTime(integration.lastSyncAt) : '—'}
              </DetailRow>
            </div>
          </Card>

          <Card className="bg-surface-2">
            <CardHeader compact title="Kako radi" />
            <ul className="space-y-1.5 text-sm leading-relaxed text-ink-3">
              <li>· Račun se prvo zaključi i proknjiži u bazi, pa tek onda šalje servisu.</li>
              <li>· Neuspjeh slanja ne ruši naplatu — račun ostaje u redu za ponovni pokušaj.</li>
              <li>· ZKI se računa lokalno prije slanja; JIR stiže iz odgovora servisa.</li>
              <li>· Svaki pokušaj se bilježi sa zahtjevom, odgovorom i trajanjem.</li>
              <li>· Zamjena zemlje/servisa znači samo novi adapter — poslovna logika ostaje ista.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
