/**
 * Razdoblja izvještavanja — čiste funkcije bez pristupa bazi,
 * pa ih mogu koristiti i klijentske komponente (filtri).
 */

import { round } from './money';

export interface PeriodRange {
  from: Date;
  to: Date;
}

/** Razdoblje iz naziva preseta (danas, 7d, 30d, mjesec, kvartal…). */
export function resolveRange(preset: string, now = new Date()): PeriodRange {
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'today':
      break;
    case 'yesterday':
      from.setDate(from.getDate() - 1);
      to.setDate(to.getDate() - 1);
      to.setHours(23, 59, 59, 999);
      break;
    case '7d':
      from.setDate(from.getDate() - 6);
      break;
    case '30d':
      from.setDate(from.getDate() - 29);
      break;
    case '90d':
      from.setDate(from.getDate() - 89);
      break;
    case 'month':
      from.setDate(1);
      break;
    case 'lastMonth': {
      from.setMonth(from.getMonth() - 1, 1);
      const end = new Date(from.getFullYear(), from.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { from, to: end };
    }
    case 'quarter':
      from.setMonth(Math.floor(from.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      from.setMonth(0, 1);
      break;
    default:
      from.setDate(from.getDate() - 29);
  }
  return { from, to };
}

export const RANGE_PRESETS = [
  { value: 'today', label: 'Danas' },
  { value: 'yesterday', label: 'Jučer' },
  { value: '7d', label: '7 dana' },
  { value: '30d', label: '30 dana' },
  { value: '90d', label: '90 dana' },
  { value: 'month', label: 'Ovaj mjesec' },
  { value: 'lastMonth', label: 'Prošli mjesec' },
  { value: 'quarter', label: 'Kvartal' },
  { value: 'year', label: 'Godina' },
] as const;

/** Prethodno razdoblje iste duljine — za izračun promjene u %. */
export function previousRange(range: PeriodRange): PeriodRange {
  const length = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - length - 1),
    to: new Date(range.from.getTime() - 1),
  };
}

export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return round(((current - previous) / Math.abs(previous)) * 100, 1);
}
