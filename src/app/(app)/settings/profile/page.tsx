import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDateTime, formatPercent } from '@/lib/format';
import { Avatar, Badge, Card, CardHeader, DetailRow, PageHeader } from '@/components/ui/primitives';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';

export const metadata = { title: 'Moj profil' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await requireUser();

  const [user, sessions, recentActivity] = await Promise.all([
    db.user.findUnique({
      where: { id: session.id },
      include: {
        roles: { include: { role: true } },
        storeAccess: { include: { store: { select: { name: true, code: true } } } },
      },
    }),
    db.session.findMany({
      where: { userId: session.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.auditLog.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
  ]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader title="Moj profil" subtitle="Podaci o korisničkom računu, ovlastima i aktivnim prijavama" />

      <div className="grid gap-2.5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2.5">
          <Card>
            <div className="flex items-center gap-2.5">
              <Avatar name={session.fullName} size={40} />
              <div className="min-w-0">
                <p className="truncate text-md font-semibold">{session.fullName}</p>
                <p className="truncate text-sm text-ink-3">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 divide-y divide-hairline">
              <DetailRow label="Organizacija">{session.tenantName}</DetailRow>
              <DetailRow label="Šifra djelatnika">{user.employeeCode ?? '—'}</DetailRow>
              <DetailRow label="Telefon">{user.phone ?? '—'}</DetailRow>
              <DetailRow label="Limit popusta">{formatPercent(session.maxDiscountPct, 0)}</DetailRow>
              <DetailRow label="POS PIN">{user.posPinHash ? 'Postavljen' : 'Nije postavljen'}</DetailRow>
              <DetailRow label="Zadnja prijava">{formatDateTime(user.lastLoginAt)}</DetailRow>
              <DetailRow label="Račun kreiran">{formatDateTime(user.createdAt)}</DetailRow>
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Role" />
            <div className="flex flex-wrap gap-1">
              {user.roles.map((r) => (
                <Badge key={r.roleId} tone="accent">{r.role.name}</Badge>
              ))}
              {session.isSuperAdmin && <Badge tone="warning">super-admin</Badge>}
            </div>
          </Card>

          <Card>
            <CardHeader compact title="Pristup poslovnicama" />
            <div className="space-y-1">
              {user.storeAccess.map((access) => (
                <div key={access.storeId} className="flex items-center justify-between gap-2 rounded-sm bg-surface-2 px-2 py-1 text-base">
                  <span>
                    <span className="font-mono text-sm text-ink-3">{access.store.code}</span>{' '}
                    {access.store.name}
                  </span>
                  {access.canManage && <Badge tone="neutral">upravljanje</Badge>}
                </div>
              ))}
              {user.storeAccess.length === 0 && <p className="text-sm text-ink-4">Bez dodijeljenih poslovnica.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-2.5">
          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Aktivne prijave" subtitle="Uređaji s otvorenom sesijom" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={150}>Prijavljeno</TH>
                  <TH width={130}>IP adresa</TH>
                  <TH>Uređaj</TH>
                  <TH width={150}>Ističe</TH>
                </TR>
              </THead>
              <TBody>
                {sessions.map((s) => (
                  <TR key={s.id}>
                    <TD className="text-sm text-ink-3">{formatDateTime(s.createdAt)}</TD>
                    <TD className="font-mono text-xs">{s.ipAddress ?? '—'}</TD>
                    <TD className="truncate text-sm text-ink-2">{s.userAgent ?? '—'}</TD>
                    <TD className="text-sm text-ink-3">{formatDateTime(s.expiresAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>

          <Card padded={false}>
            <div className="p-3.5 pb-2">
              <CardHeader compact title="Moja aktivnost" subtitle="Posljednjih 12 radnji" />
            </div>
            <Table>
              <THead>
                <TR>
                  <TH width={150}>Vrijeme</TH>
                  <TH width={140}>Radnja</TH>
                  <TH>Opis</TH>
                </TR>
              </THead>
              <TBody>
                {recentActivity.map((log) => (
                  <TR key={log.id}>
                    <TD className="text-sm text-ink-3">{formatDateTime(log.createdAt)}</TD>
                    <TD className="text-ink-2">{log.action}</TD>
                    <TD className="truncate">{log.summary ?? log.entityType}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
