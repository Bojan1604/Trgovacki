import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { accessibleStoreIds, getSessionUser } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { PosTerminal } from '@/components/pos/pos-terminal';

export const dynamic = 'force-dynamic';

export default async function PosPage({
  searchParams,
}: {
  searchParams: Promise<{ store?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!hasPermission(user.permissions, 'pos.operate')) redirect('/dashboard');

  const storeIds = await accessibleStoreIds(user);
  const storeId = params.store ?? user.activeStoreId ?? storeIds[0];
  if (!storeId) redirect('/dashboard');

  const categories = await db.category.findMany({
    where: { tenantId: user.tenantId, isActive: true, level: 1 },
    select: { id: true, name: true, code: true },
    orderBy: { sortOrder: 'asc' },
    take: 24,
  });

  return (
    <PosTerminal
      storeId={storeId}
      categories={categories}
      operator={{ id: user.id, name: user.fullName, initials: user.initials }}
    />
  );
}
