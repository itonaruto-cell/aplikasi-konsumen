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
// Susunan sheet: per brand satu tabel berdampingan (judul SALES BY SOA ACC / AMM, label MOTORKU / MOBILKU di atasnya),
// baris = SOA (PROGRAM INTERNAL WOM, BOOKING MANDIRI, CHANNEL (MEDIATOR), TELESALES, OTHER, GRAND TOTAL),
// kolom = BY CMO | OKT (bulan lalu) | NOV (bulan ini) | TARGET | % ACH | DIFF TO M1 | DIFF TO TGT.
export type SoaBaris = { n: string; unit: number | null; amount: number | null; unitLalu?: number | null; amountLalu?: number | null;
  targetUnit?: number | null; targetAmount?: number | null };
export type SalesSoa = { soa: SoaBaris[]; total: SoaBaris | null; terisi: boolean };
type Sub = { h: (string | null)[]; r: (string | number | null)[][] };
// Satu blok bisa berisi beberapa tabel berdampingan (dipisah kolom kosong): dipecah per tabel
function pecah(b: Blok): Sub[] {
  const awal = b.h.map((h, i) => (h != null && (i === 0 || b.h[i - 1] == null) ? i : -1)).filter((i) => i >= 0);
  return awal.map((a, k) => {
    let e = awal[k + 1] ?? b.h.length;
    while (e > a && b.h[e - 1] == null) e--;
    return { h: b.h.slice(a, e), r: b.r.map((r) => r.slice(a, e)) };
  }).filter((x) => x.h.length >= 3);
}
const kolSub = (x: Sub, re: RegExp) => x.h.findIndex((h) => re.test(N(h)));
const kolBulan = (x: Sub, label: string, cadangan: number) => { const i = label ? kolSub(x, new RegExp(`^${N(label)}`)) : -1; return i >= 0 ? i : cadangan; };
// Tabel SOA milik brand mana: dari blok khusus brand (s), atau jumlah GRAND TOTAL bulan ini = sales brand itu,
// atau urutan di sheet (kiri Motorku, kanan Mobilku)
function subBrand(d: Performa, judul: string, brand: string): Sub | null {
  const khusus = (d.blok || []).find((b) => b.s === brand && b.t.toLowerCase() === judul.toLowerCase());
  if (khusus) return pecah(khusus)[0] || null;
  const b = blok(d, judul);
  if (!b) return null;
  const subs = pecah(b);
  if (!subs.length) return null;
  const totalIni = (x: Sub) => angka(x.r.find((r) => isTotal(r[0]))?.[kolBulan(x, d.bulan?.ini || '', 2)]);
  const acuan = blok(d, 'Sales account per brand');
  const salesBrand = (br: string) => angka(acuan?.r.find((r) => brandBaris(r[0]) === br)?.[3]);
  if (/account/i.test(judul)) {
    const cocok = subs.filter((x) => isNum(totalIni(x)) && totalIni(x) === salesBrand(brand));
    const lain = subs.filter((x) => isNum(totalIni(x)) && totalIni(x) === salesBrand(brand === 'mobilku' ? 'motorku' : 'mobilku'));
    if (cocok.length === 1 && !lain.includes(cocok[0])) return cocok[0];
  }
  // Tabel amount mengikuti posisi tabel account; cadangan: urutan kiri Motorku, kanan Mobilku
  const acc = /amount/i.test(judul) ? subBrand(d, 'Sales by SOA account', brand) : null;
  const accSubs = acc ? pecah(blok(d, 'Sales by SOA account') || { s: '', t: '', h: [], r: [] }) : [];
  const pos = acc ? accSubs.findIndex((x) => x.h.join('|') === acc.h.join('|') && JSON.stringify(x.r) === JSON.stringify(acc.r)) : -1;
  if (pos >= 0 && subs[pos]) return subs[pos];
  return subs[brand === 'motorku' ? 0 : 1] || null;
}
export function salesSoa(d: Performa, brand: string): SalesSoa | null {
  const u = subBrand(d, 'Sales by SOA account', brand), a = subBrand(d, 'Sales by SOA amount', brand);
  if (!u && !a) return null;
  const baca = (x: Sub | null) => {
    if (!x) return new Map<string, { ini: number | null; lalu: number | null; target: number | null }>();
    const iIni = kolBulan(x, d.bulan?.ini || '', 2), iLalu = kolBulan(x, d.bulan?.lalu || '', 1), iT = kolSub(x, /^TARGET$/);
    return new Map(x.r.filter((r) => N(r[0])).map((r) => [N(r[0]), { ini: angka(r[iIni]), lalu: angka(r[iLalu]), target: iT >= 0 ? angka(r[iT]) : null }]));
  };
  const mu = baca(u), ma = baca(a);
  const nama = [...new Set([...mu.keys(), ...ma.keys()])];
  const jadi = (n: string): SoaBaris => {
    const x = mu.get(n), y = ma.get(n);
    return { n: namaRapi(n), unit: x?.ini ?? null, amount: y?.ini ?? null, unitLalu: x?.lalu ?? null, amountLalu: y?.lalu ?? null,
      targetUnit: x?.target ?? null, targetAmount: y?.target ?? null };
  };
  const soa = nama.filter((n) => !isTotal(n)).map(jadi);
  const t = nama.find((n) => isTotal(n));
  return { soa, total: t ? jadi(t) : null, terisi: soa.some((x) => isNum(x.unit) || isNum(x.amount)) };
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
