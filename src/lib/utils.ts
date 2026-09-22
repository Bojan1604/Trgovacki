import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Stabilan slug iz hrvatskog teksta (č,ć,ž,š,đ → c,c,z,s,d). */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/č|ć/g, 'c')
    .replace(/ž/g, 'z')
    .replace(/š/g, 's')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** EAN-13 kontrolna znamenka. */
export function ean13CheckDigit(body12: string) {
  const digits = body12.padStart(12, '0').slice(0, 12).split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

export function isValidEan13(code: string) {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === code[12];
}

/** Validacija hrvatskog OIB-a (ISO 7064, MOD 11-10). */
export function isValidOib(oib: string) {
  if (!/^\d{11}$/.test(oib)) return false;
  let remainder = 10;
  for (let i = 0; i < 10; i++) {
    remainder = (remainder + Number(oib[i])) % 10 || 10;
    remainder = (remainder * 2) % 11;
  }
  const check = (11 - remainder) % 10;
  return check === Number(oib[10]);
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms = 250) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function range(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

export function sum<T>(items: T[], pick: (item: T) => number) {
  return items.reduce((acc, item) => acc + (pick(item) || 0), 0);
}

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K) {
  return items.reduce<Record<K, T[]>>(
    (acc, item) => {
      const k = key(item);
      (acc[k] ??= []).push(item);
      return acc;
    },
    {} as Record<K, T[]>,
  );
}

/** Dekodiranje internog barkoda s ugrađenom težinom/cijenom (prefiks 2x). */
export function parseWeightBarcode(code: string): { itemCode: string; weightKg?: number; price?: number } | null {
  if (!/^2\d{12}$/.test(code)) return null;
  const itemCode = code.slice(1, 6);
  const value = Number(code.slice(6, 12));
  // Prefiks 23/24 = cijena, 21/22 = težina (konvencija se podešava u postavkama)
  const flag = code.slice(0, 2);
  if (flag === '23' || flag === '24') return { itemCode, price: value / 100 };
  return { itemCode, weightKg: value / 1000 };
}
