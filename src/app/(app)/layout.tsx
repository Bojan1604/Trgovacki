import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { accessibleStoreIds, getSessionUser } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const storeIds = await accessibleStoreIds(user);
  const [stores, notifications] = await Promise.all([
    db.store.findMany({
      where: { id: { in: storeIds }, status: { not: 'CLOSED' } },
      select: { id: true, code: true, name: true, city: true },
      orderBy: { code: 'asc' },
    }),
    db.notification.findMany({
      where: { tenantId: user.tenantId, readAt: null, OR: [{ userId: null }, { userId: user.id }] },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, title: true, body: true, level: true, link: true },
    }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar permissions={user.permissions} tenantName={user.tenantName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={{
            fullName: user.fullName,
            email: user.email,
            roles: user.roles.map((r) => r.name).join(', ') || 'Bez role',
          }}
          stores={stores}
          activeStoreId={user.activeStoreId}
          notifications={notifications}
        />
        <main className="flex-1 overflow-y-auto scroll-thin bg-canvas p-3.5">{children}</main>
      </div>
    </div>
  );
}
