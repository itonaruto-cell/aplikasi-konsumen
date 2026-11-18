// Isi tab BAHAN REVIEW MKT apa adanya (dikirim Apps Script BlokSheet versi 2). Tabelnya dicari DI SINI dari judul
// tabel & judul kolom, bukan dari huruf kolom: kalau Pak Aji menyusun ulang sheet lagi, cukup file ini yang diperbarui
// (tidak perlu menempel ulang kode Apps Script).
//
// Hasilnya blok berbentuk tetap (urutan kolom sama seperti sebelumnya, jadi pembaca lama tetap benar) dan angka
// sales / order in / approval per orang untuk mengisi data pantauan.
import type { Aktivitas, Blok, OrderIn, Orang, Performa, RekrutRegist, Sales } from './performa-types';
import { brandBaris, samaNama } from './sales-brand';

export type Sel = string | number | null;
export type Grid = Sel[][];
type Pos = { r: number; c: number };

const N = (v: unknown) => String(v ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const num = (v: unknown) => (isNum(v) ? v : null);
const isTotal = (v: unknown) => /^(GRAND )?TOTAL$/.test(N(v));
const BULAN = /^(JAN|FEB|MAR|APR|MEI|MAY|JUN|JUL|AGU|AGS|AUG|SEP|OKT|OCT|NOV|DES|DEC)[A-Z]*$/;
const sel = (g: Grid, r: number, c: number): Sel => g[r]?.[c] ?? null;
const teks = (v: Sel) => (v === null ? null : String(v));

function cari(g: Grid, re: RegExp): Pos[] {
  const out: Pos[] = [];
  g.forEach((row, r) => row.forEach((v, c) => { if (v !== null && re.test(N(v))) out.push({ r, c }); }));
  return out;
}
// Lebar tabel = judul kolom yang terisi berturut-turut dari sel pertama
function lebar(g: Grid, r: number, c: number) { let w = 0; while (w < 60 && N(sel(g, r, c + w))) w++; return w; }
const kepalaBaris = (g: Grid, p: Pos) => Array.from({ length: lebar(g, p.r, p.c) }, (_, j) => N(sel(g, p.r, p.c + j)));
// Baris isi di bawah judul kolom: sampai baris TOTAL (ikut) atau baris kosong
function isi(g: Grid, rh: number, c: number, w: number): Sel[][] {
  const out: Sel[][] = [];
  for (let r = rh + 1; r < Math.min(g.length, rh + 41); r++) {
    const row = Array.from({ length: w }, (_, j) => sel(g, r, c + j));
    if (row.every((v) => v === null)) break;
    out.push(row);
    if (isTotal(row[0])) break;
  }
  return out;
}
function tabel(g: Grid, p: Pos, t: string, s = 'cabang'): Blok {
  const w = lebar(g, p.r, p.c);
  return { s, t, h: Array.from({ length: w }, (_, j) => teks(sel(g, p.r, p.c + j))), r: isi(g, p.r, p.c, w) };
}
// Judul kolom pertama = kepala, dan baris judul kolomnya memuat kolom `berisi`
const kepala = (g: Grid, re: RegExp, berisi?: RegExp) =>
  cari(g, re).filter((p) => !berisi || kepalaBaris(g, p).some((h) => berisi.test(h)));

/* ---------- Tabel sales (per CMO / per brand) → kolom tetap ---------- */
// Urutan tetap: nama | BRAND | bulan lalu (s.d. tgl sama) | bulan ini | TARGET | % ACH | DIFF M1 | DIFF TGT | bulan lalu FULL | DIFF M1 FULL
function rapikanSales(b: Blok): Blok {
  const H = b.h.map(N);
  const i = (re: RegExp, kecuali?: RegExp) => H.findIndex((h, j) => j > 0 && re.test(h) && !(kecuali && kecuali.test(h)));
  const bln = H.map((h, j) => (j > 0 && BULAN.test(h) ? j : -1)).filter((j) => j >= 0);
  const kol = [0, i(/^BRAND$/), bln[0] ?? -1, bln[1] ?? -1, i(/^TARGET$/), i(/% ?ACH/), i(/^DIFF (TO )?M-?1$/), i(/^DIFF (TO )?(TGT|TARGET)$/),
    i(/FULL$/, /DIFF/), i(/^DIFF.*FULL$/)];
  const ambil = (row: Sel[], j: number, k: number) => (j >= 0 ? row[j] ?? null : k === 1 && brandBaris(row[0]) ? N(row[0]) : null);
  return { ...b, h: kol.map((j, k) => (j >= 0 ? b.h[j] : k === 1 ? 'BRAND' : null)), r: b.r.map((row) => kol.map((j, k) => ambil(row, j, k))) };
}

/* ---------- Tabel per brand berdampingan dengan judul sendiri (SALES BY SOA ACC/AMM · MOTORKU / MOBILKU) ---------- */
function perBrand(g: Grid, judul: RegExp, t: string): Blok[] {
  return cari(g, judul).map((p, k) => {
    let rh = p.r + 1;
    while (rh < p.r + 4 && !N(sel(g, rh, p.c))) rh++;
    const b = tabel(g, { r: rh, c: p.c }, t);
    let s = '';
    for (let j = p.c + 1; j < p.c + Math.max(b.h.length, 3) && !s; j++) s = brandBaris(sel(g, p.r, j));
    return { ...b, s: s || (k === 0 ? 'motorku' : 'mobilku') };
  }).filter((b) => b.h.length >= 3);
}

/* ---------- SALES BY SOA MA ACC/AMM: baris = grup MA, kolom = brand × bulan (judul kolom 2 baris) ---------- */
function soaMa(g: Grid, judul: RegExp, t: string): Blok[] {
  const out: Blok[] = [];
  for (const p of cari(g, judul)) {
    const rb = p.r + 1, rm = p.r + 2;
    let w = 1;
    while (w < 40 && N(sel(g, rm, p.c + w))) w++;
    const rows = isi(g, rm, p.c, w);
    let brand = '', kol: number[] = [];
    const simpan = () => {
      if (!brand || !kol.length) return;
      out.push({ s: brand, t, h: ['GRUP', ...kol.map((j) => teks(sel(g, rm, p.c + j)))], r: rows.map((row) => [row[0], ...kol.map((j) => row[j] ?? null)]) });
    };
    for (let j = 1; j < w; j++) {
      const br = brandBaris(sel(g, rb, p.c + j));
      if (br) { simpan(); brand = br; kol = []; }
      kol.push(j);
    }
    simpan();
  }
  return out;
}

/* ---------- Semua tabel ---------- */
export type HasilGrid = { blok: Blok[]; tidakAda: string[]; bulan?: { lalu: string; ini: string }; updated?: string; aktivitas?: AktivitasGrid };
export function bacaGrid(g: Grid): HasilGrid {
  const blok: Blok[] = [], tidakAda: string[] = [];
  const satu = (nama: string, ps: Pos[], t: string, rapi?: (b: Blok) => Blok) => {
    if (!ps.length) { tidakAda.push(nama); return; }
    const b = tabel(g, ps[0], t);
    blok.push(rapi ? rapi(b) : b);
  };
  satu('SALES BY CMO · BY CMO ACC', kepala(g, /^BY (CMO|PIC) (ACC|ACCOUNT)$/), 'Sales account per PIC', rapikanSales);
  satu('SALES BY CMO · BY CMO AMM', kepala(g, /^BY (CMO|PIC) (AMM|AMMOUNT|AMOUNT)$/), 'Sales amount per PIC', rapikanSales);
  satu('SALES BY BRAND · BY BRAND ACC', kepala(g, /^BY BRAND (ACC|ACCOUNT)$/), 'Sales account per brand', rapikanSales);
  satu('SALES BY BRAND · BY BRAND AMM', kepala(g, /^BY BRAND (AMM|AMMOUNT|AMOUNT)$/), 'Sales amount per brand', rapikanSales);
  satu('SALES BY FLAG APPROVAL · BY BRAND', kepala(g, /^(BY BRAND|SALES ACCOUNT)$/, /^NORMAL$/), 'Sales per flag approval');
  satu('ORDER IN · BY BRAND', kepala(g, /^BY BRAND$/, /^GO ?LIVE$/), 'Order in per brand');
  satu('ORDER IN · BY CMO', kepala(g, /^BY (CMO|PIC)$/, /^GO ?LIVE$/), 'Order in per PIC');
  satu('SUCCESS RATE APP · BY CMO', kepala(g, /^BY (CMO|PIC)$/, /^APPROVE$/), 'Approval per PIC');
  for (const [nama, re, t] of [
    ['SALES BY SOA ACC', /^SALES BY SOA (ACC|ACCOUNT)$/, 'Sales by SOA account'],
    ['SALES BY SOA AMM', /^SALES BY SOA (AMM|AMMOUNT|AMOUNT)$/, 'Sales by SOA amount'],
  ] as const) { const x = perBrand(g, re, t); if (x.length) blok.push(...x); else tidakAda.push(nama); }
  for (const [nama, re, t] of [
    ['SALES BY SOA MA ACC', /^(SALES BY SOA MA|DETAIL SOA MA) (ACC|ACCOUNT)$/, 'SOA MA account'],
    ['SALES BY SOA MA AMM', /^(SALES BY SOA MA|DETAIL SOA MA) (AMM|AMMOUNT|AMOUNT)$/, 'SOA MA amount'],
  ] as const) { const x = soaMa(g, re, t); if (x.length) blok.push(...x); else tidakAda.push(nama); }

  // Label bulan dari tabel sales per CMO (OKT · NOV) dan tanggal "UPDATE PER"
  const pic = blok.find((b) => b.t === 'Sales account per PIC');
  const bulan = pic && pic.h[2] && pic.h[3] ? { lalu: N(pic.h[2]), ini: N(pic.h[3]) } : undefined;
  let updated: string | undefined;
  for (const p of cari(g, /^UPDATE PER\b/)) {
    for (let j = p.c + 1; j < p.c + 6 && !updated; j++) { const v = sel(g, p.r, j); if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) updated = v; }
  }
  const akt = aktivitasGrid(g);
  if (akt.blok.length) blok.push(...akt.blok); else tidakAda.push('AKTIVITAS MOTORKU / MOBILKU');
  return { blok, tidakAda, bulan, updated, aktivitas: akt };
}

/* ---------- Panel AKTIVITAS MOTORKU / MOBILKU: visit prioritas, hasil visit, maintain, rekrut ---------- */
// Menghasilkan ringkasan aktivitas + blok per brand (Status visit, Hasil visit, Maintain, Rekrut & regist)
export type AktivitasGrid = { visit: Aktivitas['visit']; maintain: Aktivitas['maintain']; rekrut: Record<string, RekrutRegist>; blok: Blok[] };
export function aktivitasGrid(g: Grid): AktivitasGrid {
  const visit: Aktivitas['visit'] = {}, maintain: Aktivitas['maintain'] = {}, rekrut: Record<string, RekrutRegist> = {}, blok: Blok[] = [];
  const judul = cari(g, /^AKTIVITAS (MOTORKU|MOBILKU|MOTOR|MOBIL)$/);
  for (const p of judul) {
    const br = brandBaris(N(sel(g, p.r, p.c)).replace('AKTIVITAS ', ''));
    if (!br) continue;
    // Bagian brand ini: dari judulnya sampai judul AKTIVITAS berikutnya di kolom yang sama
    const akhir = judul.filter((x) => x.c === p.c && x.r > p.r).map((x) => x.r).sort((a, b) => a - b)[0] ?? g.length;
    const dalam = (re: RegExp) => cari(g, re).filter((x) => x.r > p.r && x.r < akhir && x.c >= p.c && x.c < p.c + 20);
    const status: Record<number, Sel[][]> = {}, hasil: Record<number, Sel[][]> = {};
    for (const pr of dalam(/^VISIT PRIORITY [123]$/)) {
      const k = Number(N(sel(g, pr.r, pr.c)).slice(-1));
      const st = dalam(/^STATUS VISIT$/).find((x) => x.c === pr.c && x.r > pr.r && x.r <= pr.r + 3);
      if (!st) continue;
      status[k] = isi(g, st.r, st.c, 2);
      const hv = dalam(/^HASIL VISIT$/).filter((x) => x.c === pr.c && x.r > st.r).sort((a, b) => a.r - b.r)[0];
      if (hv) hasil[k] = isi(g, hv.r, hv.c, 2);
    }
    const nilai = (rows: Sel[][] | undefined, re: RegExp) => num(rows?.find((r) => re.test(N(r[0])))?.[1]);
    const v = ([1, 2, 3] as const).map((k) => {
      const tot = nilai(status[k], /^(GRAND )?TOTAL$/) ?? 0, bt = nilai(status[k], /^BERTEMU$/) ?? 0, tb = nilai(status[k], /^TIDAK BERTEMU$/) ?? 0;
      return { database: tot, tervisit: bt + tb, ditemui: bt };
    });
    if (status[1] || status[2] || status[3]) visit[br] = { p1: v[0], p2: v[1], p3: v[2] };
    // Blok tabel 3 prioritas berdampingan: label | Prioritas 1 | Prioritas 2 | Prioritas 3
    const gabung = (x: Record<number, Sel[][]>, t: string, kepala: string) => {
      const label: string[] = [];
      for (const k of [1, 2, 3]) for (const r of x[k] || []) { const l = String(r[0] ?? '').trim(); if (l && !label.some((y) => N(y) === N(l))) label.push(l); }
      if (label.length) blok.push({ s: br, t, h: [kepala, 'Prioritas 1', 'Prioritas 2', 'Prioritas 3'],
        r: label.map((l) => [l, ...[1, 2, 3].map((k) => num(x[k]?.find((r) => N(r[0]) === N(l))?.[1]))]) });
    };
    gabung(status, 'Status visit', 'STATUS VISIT');
    gabung(hasil, 'Hasil visit', 'HASIL VISIT');
    // MAINTAIN 1X = MA yang sudah dimaintain minimal sekali; PRESENTASE = terhadap jumlah MA
    const m = dalam(/^JUMLAH MAINTAIN$/)[0];
    if (m) {
      const b = tabel(g, m, 'Maintain', br);
      blok.push(b);
      const x1 = b.r.find((r) => /^MAINTAIN 1 ?X$/.test(N(r[0])));
      const sudah = num(x1?.[1]), pr = num(x1?.[2]);
      if (isNum(sudah)) { const ma = pr && pr > 0 ? Math.round(sudah / pr) : sudah; maintain[br] = { ma, sudah, belum: Math.max(0, ma - sudah) }; }
    }
    const rk = dalam(/^PARAMETER$/)[0];
    if (rk) {
      const b = tabel(g, rk, 'Rekrut & regist', br);
      blok.push(b);
      const t = (re: RegExp) => { const r = b.r.find((x) => re.test(N(x[0]))); return r && isNum(r[1]) ? { jumlah: r[1], target: num(r[2]) } : null; };
      rekrut[br] = { rekrut: t(/^REKRUT/), regist: t(/^REGIST/) };
    }
  }
  return { visit, maintain, rekrut, blok };
}

/* ---------- Angka per orang & total cabang ke data pantauan ---------- */
const kolom = (b: Blok, re: RegExp) => b.h.findIndex((h, j) => j > 0 && re.test(N(h)));
const salesDari = (r: Sel[]): Sales => ({ lalu: num(r[2]), ini: num(r[3]), target: num(r[4]), ach: num(r[5]), diffLalu: num(r[6]), diffTarget: num(r[7]), laluPenuh: num(r[8]) });
function oiDari(b: Blok, r: Sel[]): OrderIn {
  const v = (re: RegExp) => { const i = kolom(b, re); return i >= 0 ? num(r[i]) : null; };
  return { cancel: v(/^CANCEL$/), reject: v(/^REJECT$/), pending: v(/^PENDING$/), poPending: v(/^PO PENDING$/), golive: v(/^GO ?LIVE$/),
    total: v(/^TOTAL( OI)?$/), successRate: v(/SUCCESS/), target: v(/^TARGET$/), ach: v(/% ?ACH/) };
}
function apDari(b: Blok, r: Sel[]): NonNullable<Orang['approval']> {
  const v = (re: RegExp) => { const i = kolom(b, re); return i >= 0 ? num(r[i]) : null; };
  return { approve: v(/^APPROVE$/), banding: v(/^BANDING$/), reject: v(/^REJECT$/), cancel: v(/^CANCEL$/), total: v(/^TOTAL$/) };
}
const bukanOrang = (n: string) => !n || isTotal(n) || /NON ?AKTIF|^TOTAL|^CMO$|^MAO$/.test(N(n));

/** Isi sales / order in / approval per orang, total cabang, label bulan, dan ringkasan aktivitas dari isi sheet. */
export function pakaiGrid(d: Performa, h: HasilGrid): Performa {
  const B = (t: string) => h.blok.find((b) => b.s === 'cabang' && b.t === t);
  const acc = B('Sales account per PIC'), amm = B('Sales amount per PIC'), oi = B('Order in per PIC'), ap = B('Approval per PIC');
  // Nama dari tabel sheet. Orang lain di kiriman yang tidak punya data visit/maintain/rekrut dibuang: itu "nama" hasil
  // baca kolom yang sudah bergeser (mis. "-5", "% ACH") dari Apps Script lama
  const namaSheet = [...(acc?.r || []), ...(amm?.r || [])].map((r) => String(r[0] ?? '').trim()).filter((n) => !bukanOrang(n));
  const orang = (namaSheet.length ? (d.orang || []).filter((o) => namaSheet.some((n) => samaNama(n, o.nama)) || o.visit || o.maintain || o.rekrut)
    : [...(d.orang || [])]);
  const temukan = (nama: string, brand: Sel) => {
    let i = orang.findIndex((o) => samaNama(o.nama, nama));
    if (i < 0) { orang.push({ nama, brand: N(brand) || '' }); i = orang.length - 1; }
    return i;
  };
  const isiDari = (b: Blok | undefined, f: (o: Orang, r: Sel[]) => Orang) => {
    for (const r of b?.r || []) {
      const nama = String(r[0] ?? '').trim();
      if (bukanOrang(nama)) continue;
      const i = temukan(nama, b === acc || b === amm ? r[1] : r[kolom(b!, /^BRAND$/)] ?? null);
      orang[i] = f(orang[i], r);
    }
  };
  // Unit/amount dari sheet belum dipotong motor sukarela: tanda lama dihapus supaya dihitung ulang (pisahSukarela)
  isiDari(acc, (o, r) => ({ ...o, unit: salesDari(r), sukarela: undefined }));
  isiDari(amm, (o, r) => ({ ...o, amount: salesDari(r), sukarela: undefined }));
  isiDari(oi, (o, r) => ({ ...o, oi: oiDari(oi!, r) }));
  isiDari(ap, (o, r) => ({ ...o, approval: apDari(ap!, r) }));

  const oiBrand = B('Order in per brand');
  const oiTot = oiBrand?.r.find((r) => isTotal(r[0])) || oi?.r.find((r) => isTotal(r[0]));
  const ct = d.cabangTotal || { unit: null, amount: null, oi: null };
  const tot = (b: Blok | undefined) => { const r = b?.r.find((x) => isTotal(x[0])); return r && isNum(r[3]) ? salesDari(r) : null; };
  const cabangTotal = {
    unit: tot(B('Sales account per brand')) || ct.unit, amount: tot(B('Sales amount per brand')) || ct.amount,
    oi: oiTot ? oiDari(oiBrand && oiBrand.r.includes(oiTot) ? oiBrand : oi!, oiTot) : ct.oi,
  };
  const akt = h.aktivitas && Object.keys(h.aktivitas.visit).length + Object.keys(h.aktivitas.maintain).length ? h.aktivitas : null;
  const aktivitas = akt ? { ...(d.aktivitas || {}), visit: { ...(d.aktivitas?.visit || {}), ...akt.visit },
    maintain: { ...(d.aktivitas?.maintain || {}), ...akt.maintain }, rekrut: { ...(d.aktivitas?.rekrut || {}), ...akt.rekrut } } : d.aktivitas;
  return { ...d, orang, cabangTotal, aktivitas: aktivitas as Aktivitas | undefined,
    bulan: h.bulan || d.bulan, updated: h.updated && (!d.updated || h.updated >= d.updated) ? h.updated : d.updated };
}
