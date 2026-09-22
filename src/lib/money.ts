/**
 * Novčana aritmetika.
 *
 * Sve novčane vrijednosti se u domeni računaju u cijelim brojevima (minorne
 * jedinice, npr. centi) kako bi se izbjegle greške zaokruživanja tipa
 * 0.1 + 0.2 !== 0.3. Prisma Decimal se konvertira na ulazu i izlazu.
 */

import { Prisma } from '@prisma/client';

export type Decimalish = Prisma.Decimal | number | string | null | undefined;

/** Broj decimala u kojima se drže cijene (4 = podrška za cijene tipa 0,1234). */
export const PRICE_SCALE = 4;
/** Broj decimala za konačne iznose na dokumentu. */
export const AMOUNT_SCALE = 2;

export function toNumber(value: Decimalish): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseFloat(value) || 0;
  return value.toNumber();
}

/** Zaokruživanje "half away from zero" — kako nalaže računovodstvena praksa. */
export function round(value: number, scale = AMOUNT_SCALE): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** scale;
  const shifted = value * factor;
  // korekcija binarne reprezentacije prije zaokruživanja
  const corrected = Number.parseFloat(shifted.toPrecision(15));
  return (corrected < 0 ? -Math.round(-corrected) : Math.round(corrected)) / factor;
}

export const roundAmount = (v: number) => round(v, AMOUNT_SCALE);
export const roundPrice = (v: number) => round(v, PRICE_SCALE);
export const roundQty = (v: number) => round(v, 4);

/** Zaokruživanje ukupnog iznosa gotovinskog računa na najbližih 5 centi. */
export function roundCash(value: number, step = 0.05): number {
  if (step <= 0) return roundAmount(value);
  return roundAmount(Math.round(value / step) * step);
}

/** Iznos PDV-a iz cijene koja UKLJUČUJE porez. */
export function taxFromGross(gross: number, ratePct: number): number {
  return roundAmount(gross - gross / (1 + ratePct / 100));
}

/** Iznos PDV-a iz osnovice BEZ poreza. */
export function taxFromNet(net: number, ratePct: number): number {
  return roundAmount(net * (ratePct / 100));
}

export function netFromGross(gross: number, ratePct: number): number {
  return roundAmount(gross / (1 + ratePct / 100));
}

/** Marža u % na prodajnu cijenu bez PDV-a. */
export function marginPct(netSale: number, cost: number): number {
  if (netSale <= 0) return 0;
  return round(((netSale - cost) / netSale) * 100, 2);
}

/** Razlika u cijeni (RUC) u % na nabavnu cijenu. */
export function markupPct(netSale: number, cost: number): number {
  if (cost <= 0) return 0;
  return round(((netSale - cost) / cost) * 100, 2);
}

/**
 * Razrez ukupnog iznosa na stavke po zadanim udjelima, bez gubitka centi.
 * Ostatak zaokruživanja ide na stavku s najvećim udjelom.
 */
export function allocate(total: number, weights: number[], scale = AMOUNT_SCALE): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || weights.length === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const rounded = raw.map((v) => round(v, scale));
  const diff = round(total - rounded.reduce((a, b) => a + b, 0), scale);
  if (diff !== 0) {
    let idx = 0;
    for (let i = 1; i < weights.length; i++) if (weights[i] > weights[idx]) idx = i;
    rounded[idx] = round(rounded[idx] + diff, scale);
  }
  return rounded;
}
