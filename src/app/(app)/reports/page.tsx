import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { REPORT_LINKS } from '@/components/layout/nav-config';
import { Card, PageHeader } from '@/components/ui/primitives';

export const metadata = { title: 'Izvještaji' };

const DESCRIPTIONS: Record<string, string> = {
  '/reports/sales': 'Dnevni promet, broj računa, prosječna košarica i marža kroz vrijeme.',
  '/reports/products': 'Prodaja po artiklima s količinama, prometom i ostvarenom maržom.',
  '/reports/stores': 'Usporedba poslovnica po prometu, marži i prosječnoj košarici.',
  '/reports/margin': 'Marža i razlika u cijeni po kategorijama i artiklima.',
  '/reports/stock': 'Vrijednost zalihe po nabavnoj i maloprodajnoj cijeni, po lokacijama.',
  '/reports/abc': 'ABC klasifikacija asortimana prema udjelu u prometu.',
  '/reports/cashiers': 'Učinak prodavača: promet, broj računa, popusti i prosječna košarica.',
  '/reports/tax': 'Rekapitulacija PDV-a po stopama za odabrano razdoblje.',
  '/reports/payments': 'Struktura naplate po načinima plaćanja.',
  '/reports/hourly': 'Raspodjela prometa po satima — osnova za raspored smjena.',
  '/reports/slow-movers': 'Artikli bez obrtaja i vrijednost zaliha koja stoji.',
  '/reports/kepu': 'Knjiga popisa robe u maloprodaji — promet po danima.',
};

export default async function ReportsPage() {
  const user = await requirePermission('report.sales');
  const available = REPORT_LINKS.filter((r) => hasPermission(user.permissions, r.permission));

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Izvještaji"
        subtitle="Analitika prodaje, marže, zaliha i financija za cijeli lanac"
      />

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {available.map((report) => {
          const Icon = report.icon;
          return (
            <Link key={report.href} href={report.href} className="group">
              <Card className="h-full transition-shadow hover:shadow-[var(--shadow-raised)]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Icon className="size-4" />
                  </span>
                  <ArrowRight className="size-3.5 text-ink-4 transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-md font-semibold leading-tight">{report.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-3">{DESCRIPTIONS[report.href]}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
