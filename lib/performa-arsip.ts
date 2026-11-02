// Arsip bulanan: saat data bulan baru pertama kali masuk, data bulan sebelumnya (performa + daftar konsumen,
// konsumen cair, data OI) disimpan di tab ARSIP_PERFORMA supaya tetap bisa dibuka dari aplikasi.
// Satu baris per bulan per jenis; JSON dipotong per 45.000 karakter ke kolom D dst.
import { sheetsApi } from './sheets-api';

export const TAB_ARSIP = 'ARSIP_PERFORMA';
export type JenisArsip = 'performa' | 'cair' | 'oi';
const POTONG = 45_000, MAKS_KOLOM = 60;
const KOLOM = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

let siap = false;
async function pastikanTab() {
  if (siap) return;
  const api = sheetsApi();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  if (!(meta.data.sheets || []).some((s) => s.properties?.title === TAB_ARSIP)) {
    await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: TAB_ARSIP, gridProperties: { columnCount: MAKS_KOLOM + 4 } } } }] } });
    await api.spreadsheets.values.update({ spreadsheetId, range: `${TAB_ARSIP}!A1:D1`, valueInputOption: 'RAW', requestBody: { values: [['BULAN', 'JENIS', 'DISIMPAN', 'DATA (JSON, jangan diubah)']] } });
  }
  siap = true;
}

async function kunciBaris(): Promise<string[]> {
  const res = await sheetsApi().spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${TAB_ARSIP}!A:B` });
  return (res.data.values || []).map((r) => `${String(r[0] || '')}|${String(r[1] || '')}`);
}

export async function simpanArsip(bulan: string, jenis: JenisArsip, isi: unknown) {
  if (!/^\d{4}-\d{2}$/.test(bulan)) return;
  await pastikanTab();
  const json = JSON.stringify(isi);
  const potong: string[] = [];
  for (let i = 0; i < json.length && potong.length < MAKS_KOLOM; i += POTONG) potong.push(json.slice(i, i + POTONG));
  if (potong.length * POTONG < json.length) throw new Error('Arsip terlalu besar.');
  const kunci = await kunciBaris();
  let r = kunci.indexOf(`${bulan}|${jenis}`) + 1;
  if (r <= 0) r = Math.max(2, kunci.length + 1);
  const baris = [bulan, jenis, new Date().toISOString(), ...potong];
  const api = sheetsApi();
  await api.spreadsheets.values.clear({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${TAB_ARSIP}!A${r}:${KOLOM(MAKS_KOLOM + 3)}${r}` });
  await api.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${TAB_ARSIP}!A${r}:${KOLOM(baris.length - 1)}${r}`, valueInputOption: 'RAW', requestBody: { values: [baris] } });
  cache.delete(`${bulan}|${jenis}`);
}

const cache = new Map<string, { at: number; v: unknown }>();
export async function bacaArsip<T>(bulan: string, jenis: JenisArsip): Promise<T | null> {
  const k = `${bulan}|${jenis}`;
  const c = cache.get(k);
  if (c && Date.now() - c.at < 10 * 60_000) return c.v as T | null;
  await pastikanTab();
  const kunci = await kunciBaris();
  const r = kunci.indexOf(k) + 1;
  let v: T | null = null;
  if (r > 0) {
    const res = await sheetsApi().spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${TAB_ARSIP}!D${r}:${KOLOM(MAKS_KOLOM + 3)}${r}` });
    const json = (res.data.values?.[0] || []).map((x) => String(x || '')).join('');
    try { v = json ? JSON.parse(json) as T : null; } catch { v = null; }
  }
  cache.set(k, { at: Date.now(), v });
  return v;
}

export async function daftarArsip(): Promise<string[]> {
  await pastikanTab();
  return [...new Set((await kunciBaris()).filter((x) => x.endsWith('|performa')).map((x) => x.split('|')[0]).filter((b) => /^\d{4}-\d{2}$/.test(b)))].sort().reverse();
}
