import 'server-only';
import { db } from '../db';
import { env } from '../env';

/**
 * Provjera je li sustav spreman za rad.
 *
 * Postavke se popunjavaju kroz više ekrana i lako je propustiti nešto bez čega
 * blagajna stane tek kad prvi kupac dođe na red. Ovdje se to pokazuje unaprijed,
 * s vezom na mjesto gdje se rješava.
 */

export type ReadinessLevel = 'blocker' | 'warning';

export interface ReadinessItem {
  id: string;
  level: ReadinessLevel;
  /** Kratak opis problema. */
  title: string;
  /** Što konkretno napraviti. */
  detail: string;
  href: string;
  action: string;
}

export async function readinessChecks(tenantId: string): Promise<ReadinessItem[]> {
  const items: ReadinessItem[] = [];

  const [companies, stores, paymentMethods, taxRates, defaultPriceList] = await Promise.all([
    db.company.findMany({ where: { tenantId }, select: { id: true, name: true, vatId: true } }),
    db.store.findMany({
      where: { tenantId, status: { in: ['ACTIVE', 'IN_PREPARATION'] } },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        fiscalEnabled: true,
        assortmentMode: true,
        // Skladišta se čitaju u cijelosti jer nam trebaju dvije brojke —
        // ukupno i prodajnih — a `_count` ne prima dva uvjeta nad istom vezom.
        warehouses: { select: { isSellable: true } },
        _count: {
          select: {
            registers: { where: { isActive: true } },
            assortment: { where: { isListed: true } },
            userAccess: true,
          },
        },
      },
    }),
    db.paymentMethod.count({ where: { tenantId, isActive: true } }),
    db.taxRate.count({ where: { tenantId } }),
    db.priceList.findFirst({ where: { tenantId, isDefault: true, isActive: true }, select: { id: true } }),
  ]);

  /* --- Organizacija ------------------------------------------------------ */
  if (stores.length === 0) {
    items.push({
      id: 'no-store',
      level: 'blocker',
      title: 'Nema nijedne poslovnice',
      detail: 'Bez poslovnice se ne može otvoriti smjena ni izdati račun.',
      href: '/settings/stores/new',
      action: 'Otvori poslovnicu',
    });
  }

  const withoutVat = companies.filter((c) => !c.vatId?.trim());
  if (withoutVat.length > 0) {
    items.push({
      id: 'company-vat',
      level: 'blocker',
      title: 'Tvrtka nema upisan OIB',
      detail: `${withoutVat.map((c) => c.name).join(', ')} — OIB se ispisuje na računu i traži ga fiskalizacija.`,
      href: '/settings/company',
      action: 'Dopuni podatke',
    });
  }

  /* --- Uvjeti za naplatu ------------------------------------------------- */
  if (paymentMethods === 0) {
    items.push({
      id: 'no-payment-method',
      level: 'blocker',
      title: 'Nema aktivnog načina plaćanja',
      detail: 'Blagajna ne može zaključiti račun bez barem jednog načina plaćanja.',
      href: '/settings/payment-methods',
      action: 'Otvori načine plaćanja',
    });
  }

  if (taxRates === 0) {
    items.push({
      id: 'no-tax-rate',
      level: 'blocker',
      title: 'Nema poreznih stopa',
      detail: 'Bez stope PDV-a račun se ne može rekapitulirati.',
      href: '/settings/company',
      action: 'Otvori postavke',
    });
  }

  if (!defaultPriceList) {
    items.push({
      id: 'no-default-price-list',
      level: 'blocker',
      title: 'Nema zadanog cjenika',
      detail: 'Poslovnice bez vlastitog cjenika nemaju odakle uzeti cijenu.',
      href: '/pricing/price-lists',
      action: 'Otvori cjenike',
    });
  }

  /* --- Po poslovnici ------------------------------------------------------ */

  // Centralno skladište i web shop ne naplaćuju na pultu, pa im blagajna i
  // prodajni prostor nisu potrebni — tražiti ih ondje bio bi lažni alarm.
  const SELLS_OVER_COUNTER = ['RETAIL', 'WHOLESALE', 'FRANCHISE', 'POPUP'];

  for (const store of stores) {
    const overCounter = SELLS_OVER_COUNTER.includes(store.type);

    if (overCounter && store._count.registers === 0) {
      items.push({
        id: `no-register-${store.id}`,
        level: 'blocker',
        title: `${store.code} nema blagajnu`,
        detail: `U poslovnici ${store.name} nije moguće otvoriti smjenu ni naplatiti račun.`,
        href: `/settings/stores/${store.id}`,
        action: 'Dodaj blagajnu',
      });
    }
    const missingWarehouse = overCounter
      ? store.warehouses.every((w) => !w.isSellable)
      : store.warehouses.length === 0;
    if (missingWarehouse) {
      items.push({
        id: `no-warehouse-${store.id}`,
        level: 'blocker',
        title: `${store.code} nema ${overCounter ? 'prodajno skladište' : 'skladište'}`,
        detail: `U lokaciju ${store.name} ne može se zaprimiti roba niti voditi zaliha.`,
        href: `/settings/stores/${store.id}`,
        action: 'Otvori poslovnicu',
      });
    }
    if (overCounter && store.assortmentMode === 'LISTED_ONLY' && store._count.assortment === 0) {
      items.push({
        id: `empty-assortment-${store.id}`,
        level: 'blocker',
        title: `${store.code} nema nijedan artikl u ponudi`,
        detail: `Poslovnica ${store.name} prodaje samo uvrštene artikle, a nijedan još nije uvršten.`,
        href: `/settings/stores/${store.id}`,
        action: 'Uredi ponudu',
      });
    }
    if (store._count.userAccess === 0) {
      items.push({
        id: `no-staff-${store.id}`,
        level: 'warning',
        title: `${store.code} nema dodijeljenog djelatnika`,
        detail: `Nijedan korisnik nema pristup poslovnici ${store.name}.`,
        href: '/settings/users',
        action: 'Otvori korisnike',
      });
    }
  }

  /* --- Cijene i fiskalizacija -------------------------------------------- */
  if (defaultPriceList) {
    const activeVariants = await db.productVariant.count({
      where: { isActive: true, product: { tenantId, status: 'ACTIVE' } },
    });
    const priced = await db.priceListItem.count({
      where: { priceListId: defaultPriceList.id, variant: { isActive: true, product: { tenantId, status: 'ACTIVE' } } },
    });
    const missing = activeVariants - priced;
    if (activeVariants === 0) {
      items.push({
        id: 'no-products',
        level: 'warning',
        title: 'Katalog je prazan',
        detail: 'Nema aktivnih artikala koje bi blagajna mogla prodati.',
        href: '/catalog/products/new',
        action: 'Dodaj artikl',
      });
    } else if (missing > 0) {
      items.push({
        id: 'products-without-price',
        level: 'warning',
        title: `${missing} artikala bez cijene`,
        detail: 'Artikl bez cijene u zadanom cjeniku blagajna ne može naplatiti.',
        href: '/pricing/price-lists',
        action: 'Otvori cjenike',
      });
    }
  }

  const fiscalStores = stores.filter((s) => s.fiscalEnabled).length;
  if (fiscalStores > 0 && env().FISCAL_ADAPTER === 'none') {
    items.push({
      id: 'fiscal-not-configured',
      level: 'warning',
      title: 'Fiskalizacija nije konfigurirana',
      detail: `${fiscalStores} poslovnica ima uključenu fiskalizaciju, a adapter je isključen (FISCAL_ADAPTER=none).`,
      href: '/settings/integrations',
      action: 'Otvori integracije',
    });
  }

  // Zapreke idu prve — one doslovno zaustavljaju rad.
  return items.sort((a, b) => (a.level === b.level ? 0 : a.level === 'blocker' ? -1 : 1));
}
