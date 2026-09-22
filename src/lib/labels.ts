/** Prijevodi i vizualni tonovi statusa — jedno mjesto za cijelu aplikaciju. */

import type { Tone } from '@/components/ui/primitives';

type Entry = { label: string; tone: Tone };

export const DOC_STATUS: Record<string, Entry> = {
  DRAFT: { label: 'Nacrt', tone: 'neutral' },
  PENDING_APPROVAL: { label: 'Čeka odobrenje', tone: 'warning' },
  APPROVED: { label: 'Odobreno', tone: 'accent' },
  IN_PROGRESS: { label: 'U tijeku', tone: 'info' },
  COMPLETED: { label: 'Dovršeno', tone: 'positive' },
  POSTED: { label: 'Proknjiženo', tone: 'positive' },
  CANCELLED: { label: 'Poništeno', tone: 'negative' },
  REJECTED: { label: 'Odbijeno', tone: 'negative' },
};

export const PO_STATUS: Record<string, Entry> = {
  DRAFT: { label: 'Nacrt', tone: 'neutral' },
  SENT: { label: 'Poslana', tone: 'accent' },
  CONFIRMED: { label: 'Potvrđena', tone: 'info' },
  PARTIALLY_RECEIVED: { label: 'Djelomično zaprimljena', tone: 'warning' },
  RECEIVED: { label: 'Zaprimljena', tone: 'positive' },
  CANCELLED: { label: 'Poništena', tone: 'negative' },
  CLOSED: { label: 'Zatvorena', tone: 'neutral' },
};

export const TRANSFER_STATUS: Record<string, Entry> = {
  DRAFT: { label: 'Nacrt', tone: 'neutral' },
  REQUESTED: { label: 'Zatražena', tone: 'accent' },
  APPROVED: { label: 'Odobrena', tone: 'info' },
  DISPATCHED: { label: 'U tranzitu', tone: 'warning' },
  RECEIVED: { label: 'Zaprimljena', tone: 'positive' },
  PARTIALLY_RECEIVED: { label: 'Djelomično zaprimljena', tone: 'warning' },
  CANCELLED: { label: 'Poništena', tone: 'negative' },
  DISPUTED: { label: 'Sporna', tone: 'negative' },
};

export const STOCKTAKE_STATUS: Record<string, Entry> = {
  DRAFT: { label: 'Priprema', tone: 'neutral' },
  COUNTING: { label: 'Brojanje u tijeku', tone: 'warning' },
  REVIEW: { label: 'Provjera', tone: 'info' },
  APPROVED: { label: 'Odobrena', tone: 'accent' },
  POSTED: { label: 'Proknjižena', tone: 'positive' },
  CANCELLED: { label: 'Poništena', tone: 'negative' },
};

export const SALE_STATUS: Record<string, Entry> = {
  OPEN: { label: 'Otvoren', tone: 'warning' },
  SUSPENDED: { label: 'Parkiran', tone: 'warning' },
  COMPLETED: { label: 'Naplaćen', tone: 'positive' },
  REFUNDED: { label: 'Storniran', tone: 'negative' },
  PARTIALLY_REFUNDED: { label: 'Djelomični povrat', tone: 'warning' },
  CANCELLED: { label: 'Poništen', tone: 'negative' },
  QUOTE: { label: 'Ponuda', tone: 'info' },
  ON_HOLD: { label: 'Na čekanju', tone: 'neutral' },
};

export const FISCAL_STATUS: Record<string, Entry> = {
  NOT_REQUIRED: { label: 'Nije potrebna', tone: 'neutral' },
  PENDING: { label: 'Priprema', tone: 'warning' },
  QUEUED: { label: 'U redu čekanja', tone: 'warning' },
  SENT: { label: 'Poslano', tone: 'info' },
  CONFIRMED: { label: 'Fiskaliziran', tone: 'positive' },
  FAILED: { label: 'Greška', tone: 'negative' },
  SUBSEQUENTLY_SENT: { label: 'Naknadno dostavljen', tone: 'warning' },
};

export const PROMOTION_STATUS: Record<string, Entry> = {
  DRAFT: { label: 'Nacrt', tone: 'neutral' },
  SCHEDULED: { label: 'Zakazana', tone: 'info' },
  ACTIVE: { label: 'Aktivna', tone: 'positive' },
  PAUSED: { label: 'Pauzirana', tone: 'warning' },
  EXPIRED: { label: 'Istekla', tone: 'neutral' },
  CANCELLED: { label: 'Poništena', tone: 'negative' },
};

export const PRICE_CHANGE_STATUS: Record<string, Entry> = {
  DRAFT: { label: 'Nacrt', tone: 'neutral' },
  APPROVED: { label: 'Odobrena', tone: 'accent' },
  APPLIED: { label: 'Primijenjena', tone: 'positive' },
  CANCELLED: { label: 'Poništena', tone: 'negative' },
};

export const SHIFT_STATUS: Record<string, Entry> = {
  OPEN: { label: 'Otvorena', tone: 'positive' },
  CLOSED: { label: 'Zatvorena', tone: 'neutral' },
  RECONCILED: { label: 'Usklađena', tone: 'accent' },
};

export const PROMOTION_TYPE: Record<string, string> = {
  PERCENT_OFF: 'Postotni popust',
  AMOUNT_OFF: 'Popust u iznosu',
  FIXED_PRICE: 'Fiksna cijena',
  BUY_X_GET_Y: 'Kupi X dobij Y',
  BUNDLE_PRICE: 'Cijena paketa',
  NTH_ITEM_DISCOUNT: 'Svaki N-ti artikl',
  BASKET_THRESHOLD: 'Popust na košaricu',
  LOYALTY_MULTIPLIER: 'Množitelj bodova',
  FREE_SHIPPING: 'Besplatna dostava',
};

export const MOVEMENT_TYPE: Record<string, string> = {
  PURCHASE_RECEIPT: 'Primka',
  SALE: 'Prodaja',
  SALE_RETURN: 'Povrat kupca',
  SUPPLIER_RETURN: 'Povrat dobavljaču',
  TRANSFER_OUT: 'Izlaz — transfer',
  TRANSFER_IN: 'Ulaz — transfer',
  ADJUSTMENT_IN: 'Korekcija +',
  ADJUSTMENT_OUT: 'Korekcija −',
  WRITE_OFF: 'Otpis',
  STOCKTAKE: 'Inventura',
  PRODUCTION_IN: 'Sastavljanje',
  PRODUCTION_OUT: 'Rastavljanje',
  OWN_CONSUMPTION: 'Vlastita potrošnja',
  INITIAL: 'Početno stanje',
};

export const AUDIT_ACTION: Record<string, Entry> = {
  CREATE: { label: 'Kreiranje', tone: 'positive' },
  UPDATE: { label: 'Izmjena', tone: 'accent' },
  DELETE: { label: 'Brisanje', tone: 'negative' },
  LOGIN: { label: 'Prijava', tone: 'neutral' },
  LOGIN_FAILED: { label: 'Neuspjela prijava', tone: 'negative' },
  LOGOUT: { label: 'Odjava', tone: 'neutral' },
  APPROVE: { label: 'Odobrenje', tone: 'info' },
  POST: { label: 'Knjiženje', tone: 'positive' },
  CANCEL: { label: 'Poništenje', tone: 'negative' },
  PRICE_OVERRIDE: { label: 'Izmjena cijene', tone: 'warning' },
  DISCOUNT_OVERRIDE: { label: 'Ručni popust', tone: 'warning' },
  VOID: { label: 'Storno stavke', tone: 'warning' },
  REFUND: { label: 'Povrat', tone: 'warning' },
  DRAWER_OPEN: { label: 'Otvaranje ladice', tone: 'neutral' },
  EXPORT: { label: 'Izvoz podataka', tone: 'neutral' },
  IMPORT: { label: 'Uvoz podataka', tone: 'neutral' },
};

export const CUSTOMER_TYPE: Record<string, string> = {
  RETAIL: 'Fizička osoba',
  BUSINESS: 'Pravna osoba',
  EMPLOYEE: 'Zaposlenik',
};

export const STORE_TYPE: Record<string, string> = {
  RETAIL: 'Maloprodaja',
  WHOLESALE: 'Veleprodaja',
  WAREHOUSE: 'Skladište',
  ONLINE: 'Web shop',
  FRANCHISE: 'Franšiza',
  POPUP: 'Privremena lokacija',
};

export const PAYMENT_TYPE: Record<string, string> = {
  CASH: 'Gotovina',
  CARD: 'Kartica',
  BANK_TRANSFER: 'Transakcijski račun',
  GIFT_CARD: 'Poklon kartica',
  VOUCHER: 'Vaučer',
  LOYALTY_POINTS: 'Bodovi vjernosti',
  ON_ACCOUNT: 'Na odgodu',
  MOBILE: 'Mobilno plaćanje',
  CHECK: 'Ček',
  OTHER: 'Ostalo',
};
