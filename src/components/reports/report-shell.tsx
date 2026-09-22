import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { RangePicker } from '@/components/filters/range-picker';
import { Button } from '@/components/ui/button';

/** Zajednički okvir izvještaja: naslov, odabir razdoblja i izvoz. */
export function ReportShell({
  title,
  subtitle,
  range,
  scope,
  showScope = true,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  range: string;
  scope?: 'all' | 'store';
  showScope?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1440px]">
      <Link href="/reports" className="mb-2 inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink no-print">
        <ArrowLeft className="size-3" /> Izvještaji
      </Link>

      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold leading-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
        </div>
        <div className="no-print flex items-center gap-2">
          <RangePicker current={range} scope={scope} showScope={showScope} />
          {actions}
          <Button size="sm" variant="secondary" icon={<Download className="size-3.5" />}>
            Izvoz
          </Button>
        </div>
      </div>

      {children}
    </div>
  );
}
