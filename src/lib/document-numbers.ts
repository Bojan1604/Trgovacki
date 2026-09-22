/**
 * Tipovi dokumenata i zadane postavke njihovih brojača.
 * Čisti modul bez pristupa bazi — koriste ga i poslužiteljski servis
 * numeracije i skripta za punjenje demo podataka.
 */

export type DocumentType =
  | 'sale' | 'invoice' | 'proforma' | 'credit_note'
  | 'purchase_order' | 'goods_receipt' | 'transfer' | 'stock_take'
  | 'write_off' | 'shift' | 'price_change' | 'customer';

export const SEQUENCE_DEFAULTS: Record<DocumentType, { prefix: string; padding: number }> = {
  sale: { prefix: '', padding: 0 },
  invoice: { prefix: 'R', padding: 5 },
  proforma: { prefix: 'P', padding: 5 },
  credit_note: { prefix: 'O', padding: 5 },
  purchase_order: { prefix: 'NAR', padding: 5 },
  goods_receipt: { prefix: 'PR', padding: 5 },
  transfer: { prefix: 'MS', padding: 5 },
  stock_take: { prefix: 'INV', padding: 4 },
  write_off: { prefix: 'OT', padding: 4 },
  shift: { prefix: 'SM', padding: 5 },
  price_change: { prefix: 'NIV', padding: 4 },
  customer: { prefix: 'K', padding: 6 },
};

