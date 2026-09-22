import 'server-only';
import { db, type Tx } from '../db';

export type DocumentType =
  | 'sale' | 'invoice' | 'proforma' | 'credit_note'
  | 'purchase_order' | 'goods_receipt' | 'transfer' | 'stock_take'
  | 'write_off' | 'shift' | 'price_change' | 'customer';

const DEFAULTS: Record<DocumentType, { prefix: string; padding: number }> = {
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

/**
 * Atomarno dohvaća sljedeći redni broj dokumenta.
 *
 * Koristi UPDATE ... RETURNING preko Prisma `upsert` unutar transakcije, čime je
 * zajamčena slijednost brojeva i pod konkurentnim opterećenjem (više blagajni).
 */
export async function nextSequenceValue(
  tenantId: string,
  documentType: DocumentType | string,
  options: { storeId?: string | null; year?: number; tx?: Tx } = {},
): Promise<{ value: number; year: number; prefix: string; padding: number }> {
  const client = options.tx ?? db;
  const year = options.year ?? new Date().getFullYear();
  const storeId = options.storeId ?? null;
  const base = documentType.split(':')[0] as DocumentType;
  const defaults = DEFAULTS[base] ?? { prefix: '', padding: 0 };

  const rows = await client.$queryRaw<{ currentValue: number; prefix: string; padding: number }[]>`
    INSERT INTO number_sequences ("id", "tenantId", "storeId", "documentType", "year", "prefix", "suffix", "padding", "currentValue", "updatedAt")
    VALUES (gen_random_uuid()::text, ${tenantId}, ${storeId}, ${documentType}, ${year}, ${defaults.prefix}, '', ${defaults.padding}, 1, NOW())
    ON CONFLICT ("tenantId", "storeId", "documentType", "year")
    DO UPDATE SET "currentValue" = number_sequences."currentValue" + 1, "updatedAt" = NOW()
    RETURNING "currentValue" AS "currentValue", "prefix", "padding"
  `;

  const row = rows[0];
  return { value: row.currentValue, year, prefix: row.prefix, padding: row.padding };
}

/** Generički broj dokumenta: PREFIKS-00042/2026 */
export async function nextDocumentNumber(
  tenantId: string,
  documentType: DocumentType | string,
  options: { storeId?: string | null; storeCode?: string; tx?: Tx } = {},
) {
  const seq = await nextSequenceValue(tenantId, documentType, options);
  const num = seq.padding > 0 ? String(seq.value).padStart(seq.padding, '0') : String(seq.value);
  const parts = [seq.prefix ? `${seq.prefix}-${num}` : num];
  if (options.storeCode) parts.push(options.storeCode);
  parts.push(String(seq.year));
  return { number: parts.join('/'), sequenceNo: seq.value, year: seq.year };
}

/**
 * Broj maloprodajnog računa prema hrvatskim propisima:
 *   <redni broj>/<oznaka poslovnog prostora>/<oznaka naplatnog uređaja>
 * Slijednost je po naplatnom uređaju (oznaka "N") ili po poslovnom prostoru ("P").
 */
export async function nextReceiptNumber(
  tenantId: string,
  args: { storeId: string; storeCode: string; registerCode: string; seqMark?: 'N' | 'P'; tx?: Tx },
) {
  const seqMark = args.seqMark ?? 'N';
  // Slijednost "N" = po naplatnom uređaju, "P" = po poslovnom prostoru.
  // Brojač se razlikuje po documentType kako bi svaki uređaj imao svoj niz.
  const documentType = seqMark === 'N' ? `sale:${args.registerCode}` : 'sale';
  const seq = await nextSequenceValue(tenantId, documentType, {
    storeId: args.storeId,
    tx: args.tx,
  });
  return {
    number: `${seq.value}/${args.storeCode}/${args.registerCode}`,
    sequenceNo: seq.value,
    year: seq.year,
  };
}
