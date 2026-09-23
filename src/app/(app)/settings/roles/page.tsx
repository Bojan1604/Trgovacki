import { Fragment } from 'react';
import { ShieldCheck } from 'lucide-react';

import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { PERMISSION_GROUPS, hasPermission } from '@/lib/permissions';
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export const metadata = { title: 'Role i prava' };
export const dynamic = 'force-dynamic';

export default async function RolesSettingsPage() {
  const user = await requirePageAccess('role.manage');

  const roles = await db.role.findMany({
    where: { tenantId: user.tenantId },
    include: { _count: { select: { users: true } } },
    orderBy: { code: 'asc' },
  });

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Role i prava"
        subtitle="Matrica ovlasti — svaka rola nosi popis prava, korisnik može imati više rola"
      />

      <div className="mb-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => (
          <Card key={role.id} inset>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{role.name}</p>
                <p className="mt-0.5 font-mono text-2xs text-ink-4">{role.code}</p>
              </div>
              {role.isSystem && <Badge tone="neutral">sistemska</Badge>}
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm text-ink-3">{role.description}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-ink-3">{role._count.users} korisnika</span>
              <span className="font-medium">
                {role.permissions.includes('*') ? 'sva prava' : `${role.permissions.length} prava`}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card padded={false}>
        <div className="p-3.5 pb-2">
          <CardHeader
            compact
            title="Matrica prava"
            subtitle="Pregled dodijeljenih ovlasti po roli"
            actions={<ShieldCheck className="size-3.5 text-ink-4" />}
          />
        </div>
        <Table>
          <THead sticky>
            <TR>
              <TH width={260}>Pravo</TH>
              {roles.map((role) => (
                <TH key={role.id} align="center" width={110}>
                  {role.name}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {PERMISSION_GROUPS.map((group) => (
              // Skupina daje dva retka — naslovni i po jedno pravo — pa ključ
              // nosi Fragment. Kratki zapis <> ne prima ključ.
              <Fragment key={group.module}>
                <TR className="bg-surface-2">
                  <TD colSpan={roles.length + 1} className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                    {group.label}
                  </TD>
                </TR>
                {group.permissions.map((permission) => (
                  <TR key={permission.key}>
                    <TD>
                      <span className="text-base">{permission.label}</span>
                      <span className="ml-1.5 font-mono text-2xs text-ink-4">{permission.key}</span>
                    </TD>
                    {roles.map((role) => {
                      const granted = hasPermission(role.permissions as string[], permission.key);
                      return (
                        <TD key={role.id} align="center">
                          {granted ? (
                            <span className="inline-grid size-[16px] place-items-center rounded-[4px] bg-positive-soft text-positive">
                              <svg viewBox="0 0 12 12" className="size-[9px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 6.2 4.6 8.8 10 3.4" />
                              </svg>
                            </span>
                          ) : (
                            <span className="text-ink-4">·</span>
                          )}
                        </TD>
                      );
                    })}
                  </TR>
                ))}
              </Fragment>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
