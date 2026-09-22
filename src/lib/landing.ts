/**
 * Odredište nakon prijave.
 *
 * Nije svaka rola dobrodošla na nadzornoj ploči — blagajnik, primjerice, nema
 * pravo `dashboard.view`. Zato se odredište bira prema pravima, a ne fiksno.
 * Čisti modul bez pristupa bazi, pa ga smiju uvoziti i poslužitelj i preglednik.
 */

import { hasPermission } from './permissions';

/** Stranica za korisnika koji nema pravo ni na jedno odredište s popisa. */
export const NO_ACCESS_PATH = '/no-access';

/**
 * Redoslijed je namjeran: prvo nadzorna ploča, pa blagajna, pa ostatak.
 * Svaki unos mora tražiti točno ono pravo koje ta stranica provjerava —
 * inače bi preusmjeravanje moglo vrtjeti korisnika u krug.
 */
const LANDING_ROUTES: ReadonlyArray<{ href: string; permission: string }> = [
  { href: '/dashboard', permission: 'dashboard.view' },
  { href: '/pos', permission: 'pos.operate' },
  { href: '/sales/receipts', permission: 'sale.view' },
  { href: '/inventory/stock', permission: 'stock.view' },
  { href: '/catalog/products', permission: 'product.view' },
  { href: '/purchasing/orders', permission: 'po.view' },
  { href: '/customers', permission: 'customer.view' },
  { href: '/reports/sales', permission: 'report.sales' },
  { href: '/settings/users', permission: 'user.view' },
];

/** Prva stranica koju korisnik s danim pravima smije vidjeti. */
export function landingPath(permissions: string[]): string {
  const match = LANDING_ROUTES.find((route) => hasPermission(permissions, route.permission));
  return match?.href ?? NO_ACCESS_PATH;
}
