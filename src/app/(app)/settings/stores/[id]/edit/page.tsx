import { notFound } from 'next/navigation';
import { requirePageAccess } from '@/lib/page-auth';
import { db } from '@/lib/db';
import { StoreForm } from '@/components/settings/store-form';

export const metadata = { title: 'Izmjena poslovnice' };
export const dynamic = 'force-dynamic';

export default async function EditStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageAccess('store.manage');

  const [store, companies, priceLists] = await Promise.all([
    db.store.findFirst({ where: { id, tenantId: user.tenantId } }),
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
  if (!store) notFound();

  return (
    <StoreForm
      companies={companies}
      priceLists={priceLists}
      initial={{
        id: store.id,
        companyId: store.companyId,
        code: store.code,
        name: store.name,
        type: store.type,
        status: store.status,
        addressLine: store.addressLine ?? '',
        city: store.city ?? '',
        postalCode: store.postalCode ?? '',
        region: store.region ?? '',
        phone: store.phone ?? '',
        email: store.email ?? '',
        managerName: store.managerName ?? '',
        squareMeters: store.squareMeters ? String(store.squareMeters) : '',
        priceListId: store.priceListId ?? '',
        allowNegativeStock: store.allowNegativeStock,
        fiscalEnabled: store.fiscalEnabled,
      }}
    />
  );
}
