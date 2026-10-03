import { google } from 'googleapis';
import type { Calon } from './inject-types';

// Pencarian terbatas di database konsumen (tab yang sama dengan Cari konsumen).
// Hanya nama, nomor kontrak, cust no, kecamatan, kelurahan, dan unit yang dibaca dari sini:
// nomor HP, alamat, dan titik maps tidak pernah ikut, jadi aman dipakai semua akun terdaftar.

const DATA_RANGE = 'Sheet1!A1:Z';
const CACHE_MS = 120_000;
type Baris = Calon & { cari: string };
let cache: { at: number; rows: Baris[] } | null = null;

// Nomor kontrak kadang tersimpan sebagai angka berformat ("1.063.120.240.704.670").
// Notasi ilmiah (1,06E+15) berarti angkanya sudah terpotong: dikosongkan supaya diisi ulang.
export const rapikanKontrak = (v: string) => {
  const s = String(v || '').trim();
  if (/\de[+-]?\d+$/i.test(s)) return '';
  return /^[\d.,\s]+$/.test(s) ? s.replace(/\D/g, '') : s;
};

async function muat(): Promise<Baris[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const res = await google.sheets({ version: 'v4', auth }).spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID, range: DATA_RANGE,
  });
  const values = (res.data.values || []) as unknown[][];
  const head = (values[0] || []).map((h) => String(h || '').trim().toUpperCase());
  const col = (...names: string[]) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const c = {
    nama: col('NAMA KONSUMEN', 'NAMA'), kontrak: col('ORDER_NO', 'ORDER NO', 'NO KONTRAK', 'NO. KONTRAK'),
    cust: col('ID CUST', 'CUST NO', 'CUST_NO', 'ID CUSTOMER', 'CUSTOMER NO'), kec: col('KECAMATAN'), kel: col('KELURAHAN'),
    unit: col('TYPE UNIT DETAIL', 'TYPE UNIT'),
  };
  const sel = (r: unknown[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  const rows = values.slice(1).map((r) => {
    const x: Calon = {
      nama: sel(r, c.nama), kontrak: rapikanKontrak(sel(r, c.kontrak)), cust: sel(r, c.cust),
      kecamatan: sel(r, c.kec), kelurahan: sel(r, c.kel), unit: sel(r, c.unit),
    };
    return { ...x, cari: `${x.nama} ${x.kontrak} ${x.cust} ${x.kecamatan} ${x.kelurahan}`.toLowerCase() };
  }).filter((x) => x.nama);
  cache = { at: Date.now(), rows };
  return rows;
}

// Semua kata yang diketik harus ada (di nama, nomor kontrak, cust no, kecamatan, atau kelurahan)
export async function cariKonsumen(q: string, maks = 30): Promise<{ list: Calon[]; lebih: boolean }> {
  const kata = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!kata.length) return { list: [], lebih: false };
  const awal = kata.join(' ');
  const cocok = (await muat()).filter((r) => kata.every((k) => r.cari.includes(k)))
    .sort((a, b) => Number(b.nama.toLowerCase().startsWith(awal)) - Number(a.nama.toLowerCase().startsWith(awal)) || a.nama.localeCompare(b.nama));
  return {
    list: cocok.slice(0, maks).map(({ nama, kontrak, cust, kecamatan, kelurahan, unit }) => ({ nama, kontrak, cust, kecamatan, kelurahan, unit })),
    lebih: cocok.length > maks,
  };
}
