import type { Calon } from './inject-types';
import { bacaDatabase, bacaKoreksi, terapkan, rapikanKontrak, type PetaKoreksi } from './koreksi-konsumen';

// Pencarian terbatas di database konsumen (tab yang sama dengan Cari konsumen), sudah termasuk koreksi owner.
// Hanya nama, nomor kontrak, cust no, kecamatan, kelurahan, dan unit yang dibaca dari sini:
// nomor HP, alamat, dan titik maps tidak pernah ikut, jadi aman dipakai semua akun terdaftar.

export { rapikanKontrak };
const CACHE_MS = 120_000;
type Baris = Calon & { cari: string };
let cache: { at: number; rows: Baris[] } | null = null;
export const lupakanKonsumen = () => { cache = null; };

// Koreksi gagal dibaca tidak boleh menghentikan pencarian: pakai data asli
export async function koreksiAman(): Promise<PetaKoreksi> {
  try { return await bacaKoreksi(); } catch (err) { console.error('Gagal membaca koreksi konsumen:', err); return new Map(); }
}

async function muat(): Promise<Baris[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const [{ head: asli, rows: values }, peta] = await Promise.all([bacaDatabase(), koreksiAman()]);
  const head = asli.map((h) => h.toUpperCase());
  const col = (...names: string[]) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const c = {
    nama: col('NAMA KONSUMEN', 'NAMA'), kontrak: col('ORDER_NO', 'ORDER NO', 'NO KONTRAK', 'NO. KONTRAK'),
    cust: col('ID CUST', 'CUST NO', 'CUST_NO', 'ID CUSTOMER', 'CUSTOMER NO'), kec: col('KECAMATAN'), kel: col('KELURAHAN'),
    unit: col('TYPE UNIT DETAIL', 'TYPE UNIT'),
  };
  const sel = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  const rows = terapkan(asli, values, peta).map(({ nilai: r }) => {
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
