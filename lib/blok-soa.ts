// Membaca tabel dari sheet BAHAN REVIEW MKT (dikirim Apps Script BlokSheet) untuk tab Mobilku / Motorku:
// order in per status (tabel ORDER IN · BY BRAND), sales by SOA (SALES BY SOA ACC & AMM), detail SOA MA (ACC & AMM).
// Kolom dicari dari judulnya, jadi tetap benar walau Pak Aji menambah / menggeser kolom di sheet.
import type { Blok, Performa } from './performa-types';
import { brandBaris } from './sales-brand';

const N = (v: unknown) => String(v ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const angka = (v: unknown): number | null => (isNum(v) ? v : null);
const isTotal = (v: unknown) => /^(GRAND )?TOTAL$/.test(N(v));
const kol = (b: Blok | undefined, re: RegExp) => (b ? b.h.findIndex((h) => re.test(N(h))) : -1);
const blok = (d: Performa, judul: string) => (d.blok || []).find((b) => b.s === 'cabang' && b.t.toLowerCase() === judul.toLowerCase());
const jumlah = (xs: (number | null)[]) => (xs.some(isNum) ? xs.reduce<number>((s, x) => s + (isNum(x) ? x : 0), 0) : null);
export const namaRapi = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bWom\b/, 'WOM').replace(/\bSoa\b/, 'SOA').replace(/\bMa\b/, 'MA');

/* ---------- Order in per status (ORDER IN · BY BRAND) ---------- */
export type OiBrand = { golive: number | null; pending: number | null; poPending: number | null; reject: number | null; cancel: number | null;
  total: number | null; sr: number | null; target: number | null; ach: number | null; m1: number | null };
export function orderInBrand(d: Performa, brand: string): OiBrand | null {
  const b = blok(d, 'Order in per brand');
  const r = b?.r.find((x) => brandBaris(x[0]) === brand);
  if (!b || !r) return null;
  const v = (re: RegExp) => { const i = kol(b, re); return i >= 0 ? angka(r[i]) : null; };
  const iSr = kol(b, /SUCCESS/);
  // Kolom setelah SUCCESS RATE berjudul nama bulan lalu (mis. OKT) = order in bulan lalu
  const m1 = iSr >= 0 && /^(JAN|FEB|MAR|APR|MEI|MAY|JUN|JUL|AGU|AGS|AUG|SEP|OKT|OCT|NOV|DES|DEC|M-?1)/.test(N(b.h[iSr + 1])) ? angka(r[iSr + 1]) : null;
  return { golive: v(/^GO ?LIVE$/), pending: v(/^PENDING$/), poPending: v(/^PO PENDING$/), reject: v(/^REJECT$/), cancel: v(/^CANCEL$/),
    total: v(/^TOTAL( OI)?$/), sr: v(/SUCCESS/), target: v(/^TARGET$/), ach: v(/% ?ACH/), m1 };
}

/* ---------- Sales by SOA (SALES BY SOA ACC & AMM) ---------- */
export type SoaBaris = { n: string; unit: number | null; amount: number | null };
export type SalesSoa = { soa: SoaBaris[]; total: SoaBaris; target: SoaBaris; m1: SoaBaris; terisi: boolean };
function perSoa(b: Blok | undefined, brand: string) {
  if (!b) return null;
  const iB = kol(b, /^BRAND$/), iG = b.h.findIndex((h, i) => i > iB && isTotal(h));
  if (iB < 0 || iG < 0) return null;
  const baris = b.r.filter((r) => !isTotal(r[0]) && brandBaris(r[iB]) === brand);
  const ambil = (i: number) => jumlah(baris.map((r) => angka(r[i])));
  const soa = b.h.slice(iB + 1, iG).map((h, j) => ({ n: N(h), v: ambil(iB + 1 + j) })).filter((x) => x.n);
  return { soa, total: ambil(iG), target: ambil(kol(b, /^TARGET$/)), m1: ambil(kol(b, /^M-?1$/)) };
}
export function salesSoa(d: Performa, brand: string): SalesSoa | null {
  const u = perSoa(blok(d, 'Sales by SOA account'), brand), a = perSoa(blok(d, 'Sales by SOA amount'), brand);
  if (!u && !a) return null;
  const nama = [...new Set([...(u?.soa || []), ...(a?.soa || [])].map((x) => x.n))];
  const soa = nama.map((n) => ({ n: namaRapi(n), unit: u?.soa.find((x) => x.n === n)?.v ?? null, amount: a?.soa.find((x) => x.n === n)?.v ?? null }));
  const brs = (k: 'total' | 'target' | 'm1', n: string): SoaBaris => ({ n, unit: u?.[k] ?? null, amount: a?.[k] ?? null });
  return { soa, total: brs('total', 'Total'), target: brs('target', 'Target'), m1: brs('m1', 'Bulan lalu'),
    terisi: soa.some((x) => isNum(x.unit) || isNum(x.amount)) };
}

/* ---------- Detail SOA MA (DETAIL SOA MA ACC & AMM) ---------- */
export type DetailSoaMa = { grup: SoaBaris[]; total: SoaBaris; m1: SoaBaris; selisih: SoaBaris; terisi: boolean };
function perGrup(b: Blok | undefined, brand: string) {
  const r = b?.r.find((x) => brandBaris(x[0]) === brand);
  if (!b || !r) return null;
  const iT = b.h.findIndex((h, i) => i > 0 && isTotal(h));
  const grup = b.h.slice(1, iT > 0 ? iT : undefined).map((h, j) => ({ n: N(h), v: angka(r[1 + j]) })).filter((x) => x.n);
  const v = (i: number) => (i >= 0 ? angka(r[i]) : null);
  return { grup, total: v(iT), m1: v(kol(b, /^M-?1$/)), selisih: v(kol(b, /DIFF/)) };
}
export function detailSoaMa(d: Performa, brand: string): DetailSoaMa | null {
  const u = perGrup(blok(d, 'Detail SOA MA account'), brand), a = perGrup(blok(d, 'Detail SOA MA amount'), brand);
  if (!u && !a) return null;
  const nama = [...new Set([...(u?.grup || []), ...(a?.grup || [])].map((x) => x.n))];
  const grup = nama.map((n) => ({ n: namaRapi(n), unit: u?.grup.find((x) => x.n === n)?.v ?? null, amount: a?.grup.find((x) => x.n === n)?.v ?? null }));
  const brs = (k: 'total' | 'm1' | 'selisih', n: string): SoaBaris => ({ n, unit: u?.[k] ?? null, amount: a?.[k] ?? null });
  return { grup, total: brs('total', 'Total'), m1: brs('m1', 'Bulan lalu'), selisih: brs('selisih', 'Selisih'),
    terisi: [...grup, brs('total', '')].some((x) => (isNum(x.unit) && x.unit !== 0) || (isNum(x.amount) && x.amount !== 0)) };
}
