export interface PosProduct {
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  fullName: string;
  barcode: string | null;
  price: number;
  taxRate: number;
  unit: string;
  isWeighted: boolean;
  ageRestriction: number | null;
  allowDiscount: boolean;
  deposit: number;
  stock: number | null;
}

export interface CartLine {
  key: string;
  variantId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  basePrice: number;
  discountPct: number;
  isWeighted: boolean;
  ageRestriction: number | null;
  allowDiscount: boolean;
}

export interface QuoteLine {
  key: string;
  variantId: string;
  sku: string;
  name: string;
  quantity: number;
  originalPrice: number;
  basePrice: number;
  unitPrice: number;
  promoDiscount: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  depositAmount: number;
  lineTotal: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  depositTotal: number;
  total: number;
  taxLines: { rate: number; name: string; base: number; amount: number }[];
  discounts: { lineKey: string | null; promotionCode: string; description: string; amount: number }[];
}

export interface PosCustomer {
  id: string;
  code?: string;
  name: string;
  type?: string;
  vatId?: string | null;
  phone?: string | null;
  email?: string | null;
  group?: string | null;
  discountPct: number;
  points: number;
  tier: string | null;
  cardNumber?: string | null;
}

export interface PaymentMethodOption {
  id: string;
  code: string;
  name: string;
  type: string;
  opensDrawer: boolean;
  allowsChange: boolean;
  requiresRef: boolean;
}

export interface PosSession {
  store: {
    id: string;
    code: string;
    name: string;
    city: string | null;
    company: { legalName: string; vatId: string; addressLine: string | null; city: string | null; invoiceFooter: string | null };
    allowNegativeStock: boolean;
    fiscalEnabled: boolean;
  };
  /** `busyBy` je ime blagajnika koji na tom uređaju već ima otvorenu smjenu. */
  registers: { id: string; code: string; name: string; busyBy: string | null }[];
  paymentMethods: PaymentMethodOption[];
  shift: {
    id: string;
    number: string;
    registerId: string;
    registerName: string;
    openedAt: string;
    salesCount: number;
    salesTotal: number;
    expectedCash: number;
  } | null;
  parked: { id: string; number: string; total: number; issuedAt: string; note: string | null; lineCount: number }[];
  user: {
    id: string;
    name: string;
    maxDiscountPct: number;
    canDiscount: boolean;
    canRefund: boolean;
    canPriceOverride: boolean;
  };
}

export interface CompletedSale {
  id: string;
  number: string;
  total: number;
  change: number;
  issuedAt: string;
  fiscalStatus: string;
  fiscalJir: string | null;
  fiscalZki: string | null;
  fiscalQrUrl: string | null;
}
