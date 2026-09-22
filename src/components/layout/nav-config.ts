import {
  Archive, ArrowLeftRight, BadgePercent, Banknote, BarChart3, Boxes, Building2,
  ClipboardList, CreditCard, FileSpreadsheet, FileText, Gift, Handshake, LayoutDashboard,
  Layers, ListChecks, Package, PackageSearch, Percent, PiggyBank, Receipt, RefreshCw,
  Settings2, ShieldCheck, ShoppingCart, Store, Tags, TrendingUp, Truck, Users, UserCog,
  Warehouse, Wallet, ScrollText, Plug, Ruler, Trash2, CalendarClock, Boxes as BoxesIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Package;
  permission?: string;
  /** Ključ za dinamički brojač (npr. broj primki u pripremi). */
  badgeKey?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Pregled',
    items: [
      { href: '/dashboard', label: 'Nadzorna ploča', icon: LayoutDashboard, permission: 'dashboard.view' },
      { href: '/reports', label: 'Izvještaji', icon: BarChart3, permission: 'report.sales' },
    ],
  },
  {
    label: 'Katalog',
    items: [
      { href: '/catalog/products', label: 'Artikli', icon: Package, permission: 'product.view' },
      { href: '/catalog/categories', label: 'Kategorije', icon: Layers, permission: 'product.view' },
      { href: '/catalog/brands', label: 'Brendovi', icon: Tags, permission: 'product.view' },
      { href: '/catalog/suppliers', label: 'Dobavljači', icon: Handshake, permission: 'supplier.view' },
    ],
  },
  {
    label: 'Cijene',
    items: [
      { href: '/pricing/price-lists', label: 'Cjenici', icon: FileSpreadsheet, permission: 'price.view' },
      { href: '/pricing/promotions', label: 'Akcije', icon: BadgePercent, permission: 'promotion.view' },
      { href: '/pricing/price-changes', label: 'Nivelacije', icon: Percent, permission: 'price.view' },
    ],
  },
  {
    label: 'Skladište',
    items: [
      { href: '/inventory/stock', label: 'Stanje zaliha', icon: Boxes, permission: 'stock.view' },
      { href: '/inventory/movements', label: 'Kartica artikla', icon: ScrollText, permission: 'stock.view' },
      { href: '/inventory/transfers', label: 'Međuskladišnice', icon: ArrowLeftRight, permission: 'transfer.view' },
      { href: '/inventory/stocktakes', label: 'Inventure', icon: ListChecks, permission: 'stocktake.manage' },
      { href: '/inventory/writeoffs', label: 'Otpisi', icon: Trash2, permission: 'writeoff.manage' },
      { href: '/inventory/replenishment', label: 'Prijedlog nabave', icon: PackageSearch, permission: 'stock.view' },
    ],
  },
  {
    label: 'Nabava',
    items: [
      { href: '/purchasing/orders', label: 'Narudžbenice', icon: ShoppingCart, permission: 'po.view' },
      { href: '/purchasing/receipts', label: 'Primke i kalkulacije', icon: Truck, permission: 'receipt.view' },
    ],
  },
  {
    label: 'Prodaja',
    items: [
      { href: '/sales/receipts', label: 'Računi', icon: Receipt, permission: 'sale.view' },
      { href: '/sales/shifts', label: 'Smjene i blagajna', icon: Wallet, permission: 'sale.view' },
      { href: '/sales/fiscal', label: 'Fiskalizacija', icon: ShieldCheck, permission: 'sale.view' },
    ],
  },
  {
    label: 'Kupci',
    items: [
      { href: '/customers', label: 'Kupci', icon: Users, permission: 'customer.view' },
      { href: '/customers/loyalty', label: 'Program vjernosti', icon: TrendingUp, permission: 'customer.view' },
      { href: '/customers/gift-cards', label: 'Poklon kartice', icon: Gift, permission: 'customer.view' },
    ],
  },
  {
    label: 'Postavke',
    items: [
      { href: '/settings/stores', label: 'Poslovnice', icon: Store, permission: 'store.manage' },
      { href: '/settings/users', label: 'Korisnici', icon: UserCog, permission: 'user.view' },
      { href: '/settings/roles', label: 'Role i prava', icon: ShieldCheck, permission: 'role.manage' },
      { href: '/settings/company', label: 'Tvrtka i porezi', icon: Building2, permission: 'settings.manage' },
      { href: '/settings/payment-methods', label: 'Načini plaćanja', icon: CreditCard, permission: 'settings.manage' },
      { href: '/settings/integrations', label: 'Integracije', icon: Plug, permission: 'integration.manage' },
      { href: '/settings/audit', label: 'Revizijski trag', icon: ClipboardList, permission: 'audit.view' },
    ],
  },
];

export const REPORT_LINKS = [
  { href: '/reports/sales', label: 'Promet po danima', icon: BarChart3, permission: 'report.sales' },
  { href: '/reports/products', label: 'Prodaja po artiklima', icon: Package, permission: 'report.sales' },
  { href: '/reports/stores', label: 'Usporedba poslovnica', icon: Store, permission: 'report.sales' },
  { href: '/reports/margin', label: 'Marža i RUC', icon: TrendingUp, permission: 'report.margin' },
  { href: '/reports/stock', label: 'Vrijednost zaliha', icon: Warehouse, permission: 'report.stock' },
  { href: '/reports/abc', label: 'ABC analiza', icon: Layers, permission: 'report.stock' },
  { href: '/reports/cashiers', label: 'Učinak prodavača', icon: Users, permission: 'report.sales' },
  { href: '/reports/tax', label: 'Rekapitulacija PDV-a', icon: FileText, permission: 'report.finance' },
  { href: '/reports/payments', label: 'Načini plaćanja', icon: Banknote, permission: 'report.finance' },
  { href: '/reports/hourly', label: 'Promet po satima', icon: CalendarClock, permission: 'report.sales' },
  { href: '/reports/slow-movers', label: 'Artikli bez obrtaja', icon: Archive, permission: 'report.stock' },
  { href: '/reports/kepu', label: 'Knjiga popisa (KEPU)', icon: PiggyBank, permission: 'report.finance' },
];

export { Settings2, RefreshCw, Ruler, BoxesIcon };
