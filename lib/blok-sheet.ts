// Tabel tambahan dari sheet BAHAN REVIEW MKT yang dikirim file Apps Script "BlokSheet" (dicari dari JUDUL tabel,
// bukan huruf kolom, jadi tetap terbaca walau posisinya digeser): sales per PIC & brand (kolom bulan lalu),
// flag approval, order in per brand, sales by SOA ACC/AMM, detail SOA MA ACC/AMM.
// Disimpan terpisah di tab BLOK_SHEET lalu digabung ke data performa saat dibaca (judul sama → menggantikan blok lama).
// Versi 2 Apps Script mengirim isi tab apa adanya (grid); tabelnya dicari di lib/blok-grid.ts.
import { sheetsApi } from './sheets-api';
import type { Blok, Performa } from './performa-types';
import { bulanData } from './performa-calc';
import { bacaGrid, pakaiGrid, type Grid, type HasilGrid } from './blok-grid';

export const TAB_BLOK = 'BLOK_SHEET';
const CHUNK = 40_000, CACHE_MS = 60_000;
export type BlokSheet = { sumber: string; dikirim: string; blok: Blok[]; tidakAda: string[]; grid?: Grid; hasil?: HasilGrid };

const SEKSI = new Set(['cabang', 'mobilku', 'motorku']);
const sel = (v: unknown): string | number | null =>
  typeof v === 'number' ? (isFinite(v) ? v : null) : typeof v === 'string' ? (v.trim() ? v.trim().slice(0, 200) : null) : null;
export function rapikanBlokSheet(x: unknown): BlokSheet | null {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  if (Array.isArray(o.grid)) {
    const grid: Grid = o.grid.slice(0, 400).map((row) => (Array.isArray(row) ? row.slice(0, 120).map(sel) : []));
    const hasil = bacaGrid(grid);
    return { sumber: String(o.sumber || '').slice(0, 200), dikirim: String(o.dikirim || new Date().toISOString()).slice(0, 40), grid, hasil,
      blok: hasil.blok, tidakAda: hasil.tidakAda };
  }
  if (!Array.isArray(o.blok)) return null;
  const blok: Blok[] = o.blok.slice(0, 40).map((b) => {
    const y = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
    const s = String(y.s || 'cabang'), t = String(y.t || '').trim().slice(0, 80);
    if (!SEKSI.has(s) || !t || !Array.isArray(y.h) || !Array.isArray(y.r)) return null;
    const h = y.h.slice(0, 40).map((v) => { const z = sel(v); return z === null ? null : String(z); });
    const r = y.r.slice(0, 80).filter(Array.isArray).map((row) => (row as unknown[]).slice(0, 40).map(sel));
    return { s, t, h, r };
  }).filter((b): b is Blok => !!b);
  return {
    sumber: String(o.sumber || '').slice(0, 200), dikirim: String(o.dikirim || new Date().toISOString()).slice(0, 40), blok,
    tidakAda: (Array.isArray(o.tidakAda) ? o.tidakAda : []).map((v) => String(v).slice(0, 80)).slice(0, 40),
  };
}

let tabSiap = false;
async function pastikanTab() {
  if (tabSiap) return;
  const api = sheetsApi(), spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  if (!(meta.data.sheets || []).some((s) => s.properties?.title === TAB_BLOK)) {
    await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: TAB_BLOK } } }] } });
  }
  tabSiap = true;
}

let cache: { at: number; x: BlokSheet | null } | null = null;
export async function simpanBlokSheet(x: BlokSheet) {
  await pastikanTab();
  const api = sheetsApi(), spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const json = JSON.stringify(x.grid ? { sumber: x.sumber, dikirim: x.dikirim, grid: x.grid } : x);
  const chunks: string[][] = [];
  for (let i = 0; i < json.length; i += CHUNK) chunks.push([json.slice(i, i + CHUNK)]);
  await api.spreadsheets.values.clear({ spreadsheetId, range: `${TAB_BLOK}!A:A` });
  await api.spreadsheets.values.update({
    spreadsheetId, range: `${TAB_BLOK}!A1:A${chunks.length + 1}`, valueInputOption: 'RAW',
    requestBody: { values: [['Diisi otomatis oleh Apps Script BlokSheet. Jangan diubah.'], ...chunks] },
  });
  cache = { at: Date.now(), x };
}
export async function bacaBlokSheet(segar = false): Promise<BlokSheet | null> {
  if (!segar && cache && Date.now() - cache.at < CACHE_MS) return cache.x;
  let x: BlokSheet | null = null;
  try {
    const res = await sheetsApi().spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${TAB_BLOK}!A2:A` });
    const json = ((res.data.values || []) as unknown[][]).map((r) => String(r[0] ?? '')).join('');
    x = json ? rapikanBlokSheet(JSON.parse(json)) : null;
  } catch (err) {
    // Tab belum ada (file BlokSheet belum pernah mengirim)
    if ((err as { code?: number }).code !== 400) console.error('Gagal membaca BLOK_SHEET:', err);
  }
  cache = { at: Date.now(), x };
  return x;
}

// Bulan file pantauan dari namanya, mis. "PANTAUAN CABANG KENDAL NOVEMBER 2026 (APP)" → 2026-11
const NAMA_BLN = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
function bulanSumber(s: string): string {
  const u = s.toUpperCase();
  const i = NAMA_BLN.findIndex((n) => new RegExp(`\\b${n}\\b`).test(u));
  const y = u.match(/\b(20\d{2})\b/);
  return i >= 0 && y ? `${y[1]}-${String(i + 1).padStart(2, '0')}` : '';
}

/** Gabungkan tabel BlokSheet ke data performa: judul sama menggantikan blok lama, judul baru ditambahkan.
 *  Hanya kalau dari file bulan yang sama (dari nama file), atau — kalau bulannya tidak terbaca — dikirim ≤ 3 hari berdekatan. */
export function gabungBlok(d: Performa, x: BlokSheet | null): Performa {
  if (!x?.blok.length) return d;
  const bs = bulanSumber(x.sumber), bd = bulanData(d);
  const beda = Math.abs(new Date(x.dikirim).getTime() - new Date(d.dikirim).getTime());
  const cocok = bs && bd ? bs === bd : isFinite(beda) && beda <= 3 * 86400_000;
  if (!cocok) { console.warn('BlokSheet tidak digabung.', JSON.stringify({ sumber: x.sumber, bs, bd, blok: x.dikirim, performa: d.dikirim })); return d; }
  const kunci = (b: Blok) => `${b.s}|${b.t.toLowerCase()}`;
  const baru = new Map(x.blok.map((b) => [kunci(b), b]));
  const lama = (d.blok || []).map((b) => baru.get(kunci(b)) || b);
  const ada = new Set(lama.map(kunci));
  const g: Performa = { ...d, blok: [...lama, ...x.blok.filter((b) => !ada.has(kunci(b)))], blokSheet: x.dikirim, blokTidakAda: x.tidakAda };
  // Isi sheet lengkap: angka sales / order in / approval per orang, total cabang, bulan & aktivitas ikut dari sheet
  return x.grid && x.hasil ? pakaiGrid(g, x.hasil) : g;
}
