/**
 * Apstrakcija fiskalizacije.
 *
 * Sustav ne ovisi o konkretnoj zemlji ni servisu — svaka implementacija
 * (HR Porezna uprava, SI FURS, RS, BA…) implementira `FiscalAdapter`.
 * Do uključenja pravog certifikata koristi se `NoopFiscalAdapter`, koji
 * račun označava kao NOT_REQUIRED i ne mijenja poslovni tok.
 */

export interface FiscalInvoicePayload {
  saleId: string;
  number: string;
  sequenceNo: number;
  issuedAt: Date;
  /** OIB izdavatelja (pravna osoba). */
  issuerVatId: string;
  /** OIB operatera (blagajnika). */
  operatorVatId: string;
  inVatSystem: boolean;
  storeCode: string;
  registerCode: string;
  /** N = slijednost po naplatnom uređaju, P = po poslovnom prostoru. */
  sequenceMark: 'N' | 'P';
  total: number;
  /** Rekapitulacija PDV-a po stopama. */
  taxes: { rate: number; base: number; amount: number }[];
  /** G gotovina, K kartica, C ček, T transakcijski račun, O ostalo. */
  paymentType: 'G' | 'K' | 'C' | 'T' | 'O';
  /** Storno / povrat: referenca na izvorni JIR. */
  refundOfJir?: string | null;
}

export interface FiscalResult {
  ok: boolean;
  jir?: string;
  zki?: string;
  qrUrl?: string;
  requestXml?: string;
  responseXml?: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
}

export interface FiscalAdapter {
  readonly id: string;
  readonly requiresFiscalization: boolean;
  /** Zaštitni kod izdavatelja — računa se lokalno, prije slanja. */
  computeZki(payload: FiscalInvoicePayload): Promise<string>;
  /** Slanje računa; implementacija je odgovorna za timeout i retry politiku. */
  fiscalize(payload: FiscalInvoicePayload): Promise<FiscalResult>;
}
