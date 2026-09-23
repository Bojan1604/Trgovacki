import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { StoreForm } from '@/components/settings/store-form';

export const metadata = { title: 'Nova poslovnica' };
export const dynamic = 'force-dynamic';

export default async function NewStorePage() {
  const user = await requirePageAccess('store.manage');

  const [companies, priceLists] = await Promise.all([
    db.company.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.priceList.findMany({
      where: { tenantId: user.tenantId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <StoreForm companies={companies} priceLists={priceLists} />;
}
