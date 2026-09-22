/** Formatiranje brojeva, novca i datuma prema hrvatskim konvencijama. */

const NBSP = ' ';

export function formatMoney(value: number | string | null | undefined, currency = 'EUR', decimals = 2) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('hr-HR', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

/** Bez oznake valute — za tablice gdje je valuta u zaglavlju. */
export function formatAmount(value: number | string | null | undefined, decimals = 2) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat('hr-HR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatQty(value: number | string | null | undefined, decimals = 3) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const isInteger = Math.abs(safe % 1) < 1e-9;
  return new Intl.NumberFormat('hr-HR', {
    minimumFractionDigits: isInteger ? 0 : decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}

export function formatPercent(value: number | string | null | undefined, decimals = 1) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  return `${new Intl.NumberFormat('hr-HR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(n) ? n : 0)}${NBSP}%`;
}

/** Kompaktan prikaz za KPI kartice: 1,2 tis. / 3,4 mil. */
export function formatCompact(value: number | null | undefined) {
  const n = value ?? 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${formatAmount(n / 1_000_000, 1)}${NBSP}mil.`;
  if (abs >= 1_000) return `${formatAmount(n / 1_000, 1)}${NBSP}tis.`;
  return formatAmount(n, 0);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('hr-HR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export function formatTime(value: Date | string | null | undefined) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('hr-HR', { hour: '2-digit', minute: '2-digit' }).format(d);
}

/** "prije 5 min", "prije 2 h", "jučer" — za feedove i liste. */
export function formatRelative(value: Date | string | null | undefined) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'upravo';
  if (min < 60) return `prije ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `prije ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'jučer';
  if (days < 30) return `prije ${days} d`;
  return formatDate(d);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Parsiranje broja iz korisničkog unosa: prihvaća i "1.234,56" i "1234.56". */
export function parseNumber(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (!input) return 0;
  const cleaned = String(input).trim().replace(/\s/g, '');
  const normalized =
    cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}
