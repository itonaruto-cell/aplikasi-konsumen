import { timingSafeEqual } from 'node:crypto';
// Vercel Cron mengirim "Authorization: Bearer <CRON_SECRET>"; tanpa CRON_SECRET di Vercel, rute cron menolak.
export function cronOk(auth: string | null): boolean {
  const expected = process.env.CRON_SECRET || '';
  if (!expected || !auth) return false;
  const a = Buffer.from(auth), b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
