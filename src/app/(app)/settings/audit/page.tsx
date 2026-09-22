import { ClipboardList } from 'lucide-react';
import { Prisma } from '@prisma/client';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { AUDIT_ACTION } from '@/lib/labels';
import { Avatar, Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Pagination } from '@/components/ui/navigation';
import { FilterBar } from '@/components/filters/filter-bar';

export const metadata = { title: 'Revizijski trag' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 60;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePageAccess('audit.view');
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where: Prisma.AuditLogWhereInput = {
    tenantId: user.tenantId,
    ...(params.action ? { action: params.action as never } : {}),
    ...(params.user ? { userId: params.user } : {}),
    ...(params.entity ? { entityType: params.entity } : {}),
    ...(params.q ? { summary: { contains: params.q, mode: 'insensitive' } } : {}),
  };

  const [total, logs, users, entityTypes] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.user.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: 'asc' },
    }),
    db.auditLog.groupBy({ by: ['entityType'], where: { tenantId: user.tenantId }, _count: true }),
  ]);

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Revizijski trag"
        subtitle={`${total.toLocaleString('hr-HR')} zabilježenih radnji · svaka izmjena podataka ostavlja trag`}
      />

      <FilterBar
        searchPlaceholder="Opis radnje…"
        searchValue={params.q}
        activeCount={['q', 'action', 'user', 'entity'].filter((k) => params[k]).length}
        selects={[
          { param: 'action', placeholder: 'Sve radnje', value: params.action, width: 170, options: Object.entries(AUDIT_ACTION).map(([value, v]) => ({ value, label: v.label })) },
          { param: 'user', placeholder: 'Svi korisnici', value: params.user, width: 180, options: users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })) },
          { param: 'entity', placeholder: 'Svi objekti', value: params.entity, width: 160, options: entityTypes.map((e) => ({ value: e.entityType, label: `${e.entityType} (${e._count})` })) },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={150}>Vrijeme</TH>
              <TH width={34} />
              <TH width={170}>Korisnik</TH>
              <TH width={160}>Radnja</TH>
              <TH width={150}>Objekt</TH>
              <TH>Opis</TH>
              <TH width={130}>IP adresa</TH>
            </TR>
          </THead>
          <TBody>
            {logs.map((log) => {
              const action = AUDIT_ACTION[log.action] ?? { label: log.action, tone: 'neutral' as const };
              const name = log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Sustav';
              return (
                <TR key={log.id}>
                  <TD className="text-sm text-ink-3">{formatDateTime(log.createdAt)}</TD>
                  <TD><Avatar name={name} size={20} /></TD>
                  <TD className="truncate">{name}</TD>
                  <TD><Badge tone={action.tone}>{action.label}</Badge></TD>
                  <TD className="font-mono text-xs text-ink-3">{log.entityType}</TD>
                  <TD className="truncate text-ink-2">{log.summary ?? '—'}</TD>
                  <TD className="font-mono text-xs text-ink-4">{log.ipAddress ?? '—'}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
        {logs.length === 0 && <EmptyState icon={<ClipboardList className="size-4" />} title="Nema zapisa" />}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
      </Card>
    </div>
  );
}
