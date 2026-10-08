import { google } from 'googleapis';
import { appendRows, readRows, updateRowById } from './sheet-store';

// Koreksi data konsumen oleh owner (kecamatan, kelurahan, maps, no HP, dan kolom lain).
// Database konsumen aslinya (tab Sheet1) TIDAK diubah: koreksi disimpan terpisah di tab KOREKSI_KONSUMEN
// lalu ditimpakan setiap kali data dibaca. Jadi koreksi tetap berlaku walaupun Sheet1 diisi ulang,
// data aslinya tetap tersimpan, dan setiap koreksi bisa dikembalikan ke data asli.
// Satu baris tab = satu kolom dari satu konsumen; ID = KUNCI|KOLOM.

export const DATA_RANGE = 'Sheet1!A1:Z';
const TAB = 'KOREKSI_KONSUMEN';
const HEAD = ['ID', 'KUNCI', 'KOLOM', 'NILAI', 'NILAI_ASLI', 'STATUS', 'EMAIL', 'DIUBAH'];
const CACHE_MS = 30_000;
export const MAKS_NILAI = 300;

export type Koreksi = { kunci: string; kolom: string; nilai: string; asli: string; aktif: boolean; email: string; diubah: string };
// kunci konsumen → kolom → koreksi yang berlaku
export type PetaKoreksi = Map<string, Map<string, Koreksi>>;

/* ---------- Kunci satu konsumen ---------- */
// Nomor kontrak kadang tersimpan sebagai angka berformat ("1.063.120.240.704.670").
// Notasi ilmiah (1,06E+15) berarti angkanya sudah terpotong: dikosongkan supaya diisi ulang.
export const rapikanKontrak = (v: string) => {
  const s = String(v || '').trim();
  if (/\de[+-]?\d+$/i.test(s)) return '';
  return /^[\d.,\s]+$/.test(s) ? s.replace(/\D/g, '') : s;
};
const besar = (s: string) => String(s || '').trim().replace(/\s+/g, ' ').toUpperCase();

// Kunci dihitung dari data ASLI: nomor kontrak kalau utuh, selain itu nama + nopol + cust no.
export function kunciKonsumen(ambil: (...nama: string[]) => string): string {
  const k = rapikanKontrak(ambil('ORDER_NO', 'ORDER NO', 'NO KONTRAK', 'NO. KONTRAK'));
  if (/^\d{8,}$/.test(k)) return `K${k}`;
  return `N${besar(ambil('NAMA KONSUMEN', 'NAMA'))}|${besar(ambil('NOPOL'))}|${besar(ambil('ID CUST', 'CUST NO', 'CUST_NO'))}`;
}
export const pengambil = (head: string[], row: unknown[]) => (...nama: string[]) => {
  for (const n of nama) {
    const i = head.findIndex((h) => h.trim().toUpperCase() === n);
    if (i >= 0) return String(row[i] ?? '').trim();
  }
  return '';
};

/* ---------- Baca & tulis tab koreksi ---------- */
const keObj = (r: string[]): Koreksi & { id: string } => ({
  id: r[0], kunci: r[1], kolom: r[2], nilai: r[3], asli: r[4], aktif: r[5] !== 'batal', email: r[6], diubah: r[7],
});
const keBaris = (x: Koreksi) => [`${x.kunci}|${x.kolom}`, x.kunci, x.kolom, x.nilai, x.asli, x.aktif ? 'aktif' : 'batal', x.email, x.diubah];

let cache: { at: number; peta: PetaKoreksi } | null = null;
export const lupakanKoreksi = () => { cache = null; };

export async function bacaKoreksi(): Promise<PetaKoreksi> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.peta;
  const peta: PetaKoreksi = new Map();
  for (const x of (await readRows(TAB, HEAD)).filter((r) => r[0]).map(keObj)) {
    if (!x.aktif) continue;
    if (!peta.has(x.kunci)) peta.set(x.kunci, new Map());
    peta.get(x.kunci)!.set(x.kolom, x);
  }
  cache = { at: Date.now(), peta };
  return peta;
}

// Simpan beberapa koreksi sekaligus: yang sudah pernah ada diperbarui, sisanya ditambahkan
export async function simpanKoreksi(list: Koreksi[]) {
  if (!list.length) return;
  const ada = new Set((await readRows(TAB, HEAD)).map((r) => r[0]).filter(Boolean));
  const baru: string[][] = [];
  for (const x of list) {
    const row = keBaris(x);
    if (ada.has(row[0])) await updateRowById(TAB, HEAD, row[0], row);
    else baru.push(row);
  }
  await appendRows(TAB, HEAD, baru);
  lupakanKoreksi();
}

/* ---------- Timpakan koreksi ke data ---------- */
export type BarisTerkoreksi = { nilai: string[]; kunci: string; dikoreksi: Map<string, Koreksi> };
export function terapkan(head: string[], rows: unknown[][], peta: PetaKoreksi): BarisTerkoreksi[] {
  const idx = new Map(head.map((h, i) => [h, i] as const));
  return rows.map((r) => {
    const nilai = head.map((_, i) => String(r[i] ?? ''));
    const kunci = kunciKonsumen(pengambil(head, r));
    const k = peta.get(kunci);
    const dikoreksi = new Map<string, Koreksi>();
    k?.forEach((x, kolom) => {
      const i = idx.get(kolom);
      if (i === undefined) return;
      nilai[i] = x.nilai;
      dikoreksi.set(kolom, x);
    });
    return { nilai, kunci, dikoreksi };
  });
}

/* ---------- Database konsumen asli (Sheet1) ---------- */
export async function bacaDatabase(): Promise<{ head: string[]; rows: unknown[][] }> {
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
  return { head: (values[0] || []).map((h) => String(h || '').trim()), rows: values.slice(1) };
}
