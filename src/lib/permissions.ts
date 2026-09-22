/**
 * Katalog prava pristupa.
 * Format: "<modul>.<akcija>". Rola nosi listu stringova; "*" = sve.
 */

export const PERMISSION_GROUPS = [
  {
    module: 'dashboard',
    label: 'Nadzorna ploča',
    permissions: [{ key: 'dashboard.view', label: 'Pregled nadzorne ploče' }],
  },
  {
    module: 'catalog',
    label: 'Katalog',
    permissions: [
      { key: 'product.view', label: 'Pregled artikala' },
      { key: 'product.create', label: 'Kreiranje artikala' },
      { key: 'product.update', label: 'Izmjena artikala' },
      { key: 'product.delete', label: 'Brisanje artikala' },
      { key: 'product.import', label: 'Uvoz/izvoz artikala' },
      { key: 'category.manage', label: 'Upravljanje kategorijama' },
      { key: 'supplier.view', label: 'Pregled dobavljača' },
      { key: 'supplier.manage', label: 'Upravljanje dobavljačima' },
    ],
  },
  {
    module: 'pricing',
    label: 'Cijene i akcije',
    permissions: [
      { key: 'price.view', label: 'Pregled cjenika' },
      { key: 'price.update', label: 'Izmjena cijena' },
      { key: 'price.approve', label: 'Odobravanje nivelacije' },
      { key: 'promotion.view', label: 'Pregled akcija' },
      { key: 'promotion.manage', label: 'Upravljanje akcijama' },
    ],
  },
  {
    module: 'inventory',
    label: 'Skladište',
    permissions: [
      { key: 'stock.view', label: 'Pregled zaliha' },
      { key: 'stock.adjust', label: 'Korekcija zalihe' },
      { key: 'transfer.view', label: 'Pregled međuskladišnica' },
      { key: 'transfer.manage', label: 'Kreiranje međuskladišnica' },
      { key: 'transfer.approve', label: 'Odobravanje međuskladišnica' },
      { key: 'stocktake.manage', label: 'Vođenje inventure' },
      { key: 'stocktake.approve', label: 'Knjiženje inventure' },
      { key: 'writeoff.manage', label: 'Otpis robe' },
      { key: 'writeoff.approve', label: 'Odobravanje otpisa' },
    ],
  },
  {
    module: 'purchasing',
    label: 'Nabava',
    permissions: [
      { key: 'po.view', label: 'Pregled narudžbenica' },
      { key: 'po.manage', label: 'Kreiranje narudžbenica' },
      { key: 'po.approve', label: 'Odobravanje narudžbenica' },
      { key: 'receipt.view', label: 'Pregled primki' },
      { key: 'receipt.manage', label: 'Kreiranje primki i kalkulacija' },
      { key: 'receipt.post', label: 'Knjiženje primki' },
    ],
  },
  {
    module: 'sales',
    label: 'Prodaja',
    permissions: [
      { key: 'sale.view', label: 'Pregled računa' },
      { key: 'pos.operate', label: 'Rad na blagajni' },
      { key: 'pos.discount', label: 'Ručni popust' },
      { key: 'pos.price_override', label: 'Izmjena cijene na blagajni' },
      { key: 'pos.void', label: 'Storniranje stavke' },
      { key: 'pos.refund', label: 'Povrat / storno računa' },
      { key: 'pos.open_drawer', label: 'Otvaranje ladice bez prodaje' },
      { key: 'shift.manage', label: 'Otvaranje i zatvaranje smjene' },
      { key: 'shift.view_all', label: 'Pregled svih smjena' },
    ],
  },
  {
    module: 'customers',
    label: 'Kupci',
    permissions: [
      { key: 'customer.view', label: 'Pregled kupaca' },
      { key: 'customer.manage', label: 'Upravljanje kupcima' },
      { key: 'loyalty.manage', label: 'Upravljanje programom vjernosti' },
      { key: 'giftcard.manage', label: 'Upravljanje poklon karticama' },
    ],
  },
  {
    module: 'reports',
    label: 'Izvještaji',
    permissions: [
      { key: 'report.sales', label: 'Izvještaji prodaje' },
      { key: 'report.margin', label: 'Izvještaji marže i nabave' },
      { key: 'report.stock', label: 'Izvještaji zaliha' },
      { key: 'report.finance', label: 'Financijski izvještaji' },
      { key: 'report.export', label: 'Izvoz podataka' },
    ],
  },
  {
    module: 'settings',
    label: 'Postavke',
    permissions: [
      { key: 'store.manage', label: 'Upravljanje poslovnicama' },
      { key: 'user.view', label: 'Pregled korisnika' },
      { key: 'user.manage', label: 'Upravljanje korisnicima' },
      { key: 'role.manage', label: 'Upravljanje rolama i pravima' },
      { key: 'settings.manage', label: 'Sistemske postavke' },
      { key: 'integration.manage', label: 'Integracije i fiskalizacija' },
      { key: 'audit.view', label: 'Pregled revizijskog traga' },
    ],
  },
] as const;

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.key, p.label])),
);

/** Preddefinirane sistemske role. */
export const SYSTEM_ROLES = [
  {
    code: 'OWNER',
    name: 'Vlasnik',
    description: 'Puni pristup cijelom sustavu.',
    permissions: ['*'],
  },
  {
    code: 'CHAIN_MANAGER',
    name: 'Voditelj lanca',
    description: 'Operativno vođenje svih poslovnica osim sistemskih postavki.',
    permissions: ALL_PERMISSIONS.filter(
      (p) => !['settings.manage', 'integration.manage', 'role.manage'].includes(p),
    ),
  },
  {
    code: 'STORE_MANAGER',
    name: 'Voditelj poslovnice',
    description: 'Vođenje jedne ili više poslovnica, nabava i zalihe.',
    permissions: [
      'dashboard.view', 'product.view', 'supplier.view', 'price.view', 'promotion.view',
      'stock.view', 'stock.adjust', 'transfer.view', 'transfer.manage', 'stocktake.manage',
      'writeoff.manage', 'po.view', 'po.manage', 'receipt.view', 'receipt.manage',
      'sale.view', 'pos.operate', 'pos.discount', 'pos.void', 'pos.refund', 'pos.open_drawer',
      'shift.manage', 'shift.view_all', 'customer.view', 'customer.manage',
      'report.sales', 'report.stock', 'report.margin', 'user.view',
    ],
  },
  {
    code: 'CASHIER',
    name: 'Prodavač / blagajnik',
    description: 'Rad na blagajni i osnovni uvid u artikle i zalihu.',
    permissions: [
      'product.view', 'stock.view', 'sale.view', 'pos.operate', 'shift.manage',
      'customer.view', 'customer.manage', 'price.view',
    ],
  },
  {
    code: 'BUYER',
    name: 'Nabava',
    description: 'Nabava, dobavljači, kalkulacije i cjenici.',
    permissions: [
      'dashboard.view', 'product.view', 'product.create', 'product.update', 'category.manage',
      'supplier.view', 'supplier.manage', 'price.view', 'price.update', 'promotion.view',
      'promotion.manage', 'stock.view', 'po.view', 'po.manage', 'po.approve',
      'receipt.view', 'receipt.manage', 'receipt.post', 'report.margin', 'report.stock',
    ],
  },
  {
    code: 'ACCOUNTANT',
    name: 'Računovodstvo',
    description: 'Uvid u financije, izvještaje i revizijski trag.',
    permissions: [
      'dashboard.view', 'product.view', 'price.view', 'stock.view', 'sale.view',
      'receipt.view', 'po.view', 'report.sales', 'report.margin', 'report.stock',
      'report.finance', 'report.export', 'audit.view', 'shift.view_all',
    ],
  },
  {
    code: 'AUDITOR',
    name: 'Kontrola',
    description: 'Pristup samo za čitanje.',
    permissions: [
      'dashboard.view', 'product.view', 'price.view', 'stock.view', 'sale.view',
      'po.view', 'receipt.view', 'transfer.view', 'customer.view',
      'report.sales', 'report.stock', 'report.margin', 'report.finance', 'audit.view',
    ],
  },
] as const;

export function hasPermission(granted: string[], required: string): boolean {
  if (granted.includes('*')) return true;
  if (granted.includes(required)) return true;
  const [module] = required.split('.');
  return granted.includes(`${module}.*`);
}

export function hasAnyPermission(granted: string[], required: string[]): boolean {
  return required.some((r) => hasPermission(granted, r));
}
