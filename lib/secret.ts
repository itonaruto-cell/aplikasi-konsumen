import { timingSafeEqual } from 'node:crypto';

// Cek header x-performa-secret dari Apps Script
export function secretOk(given: string | null): boolean {
  const expected = process.env.PERFORMA_SECRET || '';
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
