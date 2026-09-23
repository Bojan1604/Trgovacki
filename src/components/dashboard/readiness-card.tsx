import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/primitives';
import type { ReadinessItem } from '@/lib/services/readiness';

/**
 * Što nije postavljeno, a treba za rad.
 *
 * Zapreke doslovno zaustavljaju blagajnu, upozorenja je puštaju da radi, ali s
 * posljedicama — zato su odvojeni i zapreke idu prve.
 */
export function ReadinessCard({ items }: { items: ReadinessItem[] }) {
  const blockers = items.filter((i) => i.level === 'blocker');

  if (items.length === 0) {
    return (
      <Card className="mb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-positive-soft text-positive">
            <CheckCircle2 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-medium">Sustav je spreman za rad</p>
            <p className="text-sm text-ink-3">
              Poslovnice, blagajne, načini plaćanja i cjenik su postavljeni.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card padded={false} className="mb-2.5">
      <CardHeader
        title="Postavljanje sustava"
        subtitle={
          blockers.length > 0
            ? `${blockers.length} ${blockers.length === 1 ? 'stvar zaustavlja' : 'stvari zaustavljaju'} rad · ${items.length - blockers.length} upozorenja`
            : `${items.length} ${items.length === 1 ? 'upozorenje' : 'upozorenja'}`
        }
        actions={
          blockers.length > 0 ? (
            <span className="grid size-7 place-items-center rounded-lg bg-negative-soft text-negative">
              <CircleAlert className="size-4" />
            </span>
          ) : (
            <span className="grid size-7 place-items-center rounded-lg bg-warning-soft text-warning">
              <AlertTriangle className="size-4" />
            </span>
          )
        }
      />

      <ul className="divide-y divide-hairline">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2"
            >
              <span
                className={
                  item.level === 'blocker'
                    ? 'mt-[5px] size-[6px] shrink-0 self-start rounded-full bg-negative'
                    : 'mt-[5px] size-[6px] shrink-0 self-start rounded-full bg-warning'
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium">{item.title}</span>
                <span className="block text-sm text-ink-3">{item.detail}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-sm text-accent">
                {item.action}
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
