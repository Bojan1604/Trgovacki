import { Plus, UserCog } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/money';
import { formatDateTime, formatPercent } from '@/lib/format';
import { Avatar, Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { FilterBar } from '@/components/filters/filter-bar';

export const metadata = { title: 'Korisnici' };
export const dynamic = 'force-dynamic';

const STATUS = {
  ACTIVE: { label: 'Aktivan', tone: 'positive' },
  INVITED: { label: 'Pozvan', tone: 'warning' },
  SUSPENDED: { label: 'Suspendiran', tone: 'negative' },
  ARCHIVED: { label: 'Arhiviran', tone: 'neutral' },
} as const;

export default async function UsersSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission('user.view');

  const [users, roles] = await Promise.all([
    db.user.findMany({
      where: {
        tenantId: user.tenantId,
        ...(params.q
          ? {
              OR: [
                { firstName: { contains: params.q, mode: 'insensitive' } },
                { lastName: { contains: params.q, mode: 'insensitive' } },
                { email: { contains: params.q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(params.role ? { roles: { some: { roleId: params.role } } } : {}),
        ...(params.status ? { status: params.status as never } : {}),
      },
      include: {
        roles: { include: { role: { select: { name: true, code: true } } } },
        storeAccess: { include: { store: { select: { name: true } } } },
      },
      orderBy: [{ status: 'asc' }, { firstName: 'asc' }],
    }),
    db.role.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="mx-auto max-w-[1340px]">
      <PageHeader
        title="Korisnici"
        subtitle={`${users.length} korisnika · pristup poslovnicama i ovlasti za popuste`}
        actions={<Button size="sm" variant="primary" icon={<Plus className="size-3.5" />}>Pozovi korisnika</Button>}
      />

      <FilterBar
        searchPlaceholder="Ime, prezime ili e-pošta…"
        searchValue={params.q}
        activeCount={['q', 'role', 'status'].filter((k) => params[k]).length}
        selects={[
          { param: 'role', placeholder: 'Sve role', value: params.role, width: 180, options: roles.map((r) => ({ value: r.id, label: r.name })) },
          { param: 'status', placeholder: 'Svi statusi', value: params.status, width: 150, options: Object.entries(STATUS).map(([value, v]) => ({ value, label: v.label })) },
        ]}
      />

      <Card padded={false}>
        <Table>
          <THead sticky>
            <TR>
              <TH width={34} />
              <TH>Ime i prezime</TH>
              <TH width={210}>E-pošta</TH>
              <TH width={160}>Rola</TH>
              <TH width={190}>Pristup poslovnicama</TH>
              <TH numeric width={110}>Limit popusta</TH>
              <TH width={150}>Zadnja prijava</TH>
              <TH width={110}>Status</TH>
            </TR>
          </THead>
          <TBody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD><Avatar name={`${u.firstName} ${u.lastName}`} size={22} /></TD>
                <TD>
                  <span className="font-medium">{u.firstName} {u.lastName}</span>
                  {u.isSuperAdmin && <Badge tone="accent" className="ml-1.5">super-admin</Badge>}
                </TD>
                <TD className="truncate text-ink-2">{u.email}</TD>
                <TD>
                  {u.roles.map((r) => (
                    <Badge key={r.role.code} tone="neutral" className="mr-1">{r.role.name}</Badge>
                  ))}
                </TD>
                <TD className="truncate text-sm text-ink-2">
                  {u.storeAccess.length === 0
                    ? '—'
                    : u.storeAccess.length > 2
                      ? `${u.storeAccess.length} poslovnica`
                      : u.storeAccess.map((a) => a.store.name).join(', ')}
                </TD>
                <TD numeric className="text-ink-2">{formatPercent(toNumber(u.maxDiscountPct), 0)}</TD>
                <TD className="text-sm text-ink-3">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'nikada'}</TD>
                <TD><Badge tone={STATUS[u.status].tone} dot>{STATUS[u.status].label}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
        {users.length === 0 && <EmptyState icon={<UserCog className="size-4" />} title="Nema korisnika" />}
      </Card>
    </div>
  );
}
