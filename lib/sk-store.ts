// Dokumen SK (ringkasan) untuk fitur Tanya SK. Disimpan di Google Sheets aplikasi (tab dibuat otomatis):
//  SK_DOK    : daftar dokumen (satu baris per dokumen)
//  SK_TEKS   : isi teks yang sudah dipotong per bagian, untuk pencarian & jawaban
//  SK_BERKAS : file PDF asli (base64, dipecah per 45.000 karakter, satu potongan per baris)
// Isi SK tidak disimpan di repo (repo publik); hanya owner yang bisa memperbarui lewat aplikasi.
import { sheetsApi } from './sheets-api';
import { buatIndeks, type PotonganSK } from './sk-cari';

export const TAB_DOK = 'SK_DOK', TAB_TEKS = 'SK_TEKS', TAB_BERKAS = 'SK_BERKAS';
const HEAD_DOK = ['DOK', 'JUDUL', 'KETERANGAN', 'NAMA_FILE', 'HALAMAN', 'POTONGAN', 'UKURAN', 'DIPERBARUI', 'OLEH', 'URUT'];
const HEAD_TEKS = ['DOK', 'HAL', 'BAGIAN', 'ISI'];
const HEAD_BERKAS = ['DOK', 'KE', 'DATA'];
const CHUNK = 45_000;

export type DokSK = { dok: string; judul: string; keterangan: string; namaFile: string; halaman: number; potongan: number; ukuran: number; diperbarui: string; oleh: string; urut: number };
export const validDok = (d: unknown): d is string => typeof d === 'string' && /^[a-z0-9_-]{2,30}$/.test(d);

function sheets() {
  return sheetsApi();
}
const sid = () => process.env.GOOGLE_SHEET_ID;

const idTab = new Map<string, number>();
async function siapkan(tab: string, header: string[]): Promise<number> {
  const ada = idTab.get(tab);
  if (ada !== undefined) return ada;
  const api = sheets();
  const meta = await api.spreadsheets.get({ spreadsheetId: sid(), fields: 'sheets.properties(title,sheetId)' });
  let id = (meta.data.sheets || []).find((s) => s.properties?.title === tab)?.properties?.sheetId;
  if (id == null) {
    const r = await api.spreadsheets.batchUpdate({ spreadsheetId: sid(), requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } });
    id = r.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
    await api.spreadsheets.values.update({ spreadsheetId: sid(), range: `${tab}!A1`, valueInputOption: 'RAW', requestBody: { values: [header] } });
  }
  idTab.set(tab, id);
  return id;
}

async function baca(tab: string, header: string[], kolom: string) {
  await siapkan(tab, header);
  const r = await sheets().spreadsheets.values.get({ spreadsheetId: sid(), range: `${tab}!A2:${kolom}` });
  return ((r.data.values || []) as unknown[][]).map((x) => header.map((_, i) => String(x[i] ?? '')));
}

// Ganti semua baris milik satu dokumen: hapus baris lama, lalu tambahkan yang baru (bertahap supaya kiriman tidak terlalu besar)
async function ganti(tab: string, header: string[], dok: string, rows: string[][], perKirim: number) {
  const sheetId = await siapkan(tab, header);
  const api = sheets();
  const r = await api.spreadsheets.values.get({ spreadsheetId: sid(), range: `${tab}!A2:A` });
  const kol = ((r.data.values || []) as unknown[][]).map((x) => String(x[0] ?? ''));
  const rentang: [number, number][] = [];
  kol.forEach((v, i) => {
    if (v !== dok) return;
    const idx = i + 1; // indeks baris (0 = judul kolom)
    const akhir = rentang[rentang.length - 1];
    if (akhir && akhir[1] === idx) akhir[1] = idx + 1; else rentang.push([idx, idx + 1]);
  });
  if (rentang.length) {
    await api.spreadsheets.batchUpdate({
      spreadsheetId: sid(),
      requestBody: { requests: rentang.reverse().map(([s, e]) => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: s, endIndex: e } } })) },
    });
  }
  for (let i = 0; i < rows.length; i += perKirim) {
    await api.spreadsheets.values.append({
      spreadsheetId: sid(), range: `${tab}!A1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows.slice(i, i + perKirim) },
    });
  }
}

export type ImporSK = { dok: string; judul: string; keterangan?: string; namaFile?: string; halaman?: number; urut?: number; teks: { hal: number; bagian: string; isi: string }[]; pdf?: string; pdfUkuran?: number };

export async function simpanDokumen(d: ImporSK, oleh: string) {
  if (d.pdf) {
    const parts: string[][] = [];
    for (let i = 0, k = 1; i < d.pdf.length; i += CHUNK, k++) parts.push([d.dok, String(k), d.pdf.slice(i, i + CHUNK)]);
    await ganti(TAB_BERKAS, HEAD_BERKAS, d.dok, parts, 8);
    pdfMem.delete(d.dok);
  }
  await ganti(TAB_TEKS, HEAD_TEKS, d.dok, d.teks.map((t) => [d.dok, String(t.hal), t.bagian, t.isi]), 300);
  const lama = (await daftarDokumen(true)).find((x) => x.dok === d.dok);
  const ukuran = d.pdfUkuran || (d.pdf ? Math.floor(d.pdf.length * 3 / 4) : lama?.ukuran || 0);
  await ganti(TAB_DOK, HEAD_DOK, d.dok, [[d.dok, d.judul, d.keterangan || '', d.namaFile || lama?.namaFile || `${d.dok}.pdf`, String(d.halaman || lama?.halaman || ''),
    String(d.teks.length), String(ukuran), new Date().toISOString(), oleh, String(d.urut ?? lama?.urut ?? 99)]], 10);
  cache = null; daftarCache = null;
}

// PDF besar dikirim beberapa bagian (batas kiriman Vercel ±4,5 MB). Bagian pertama ikut simpanDokumen
// (mengganti PDF lama); bagian berikutnya ditambahkan di sini, nomor potongan melanjutkan.
export const PDF_PER_BAGIAN = 60 * CHUNK; // 2.700.000 karakter base64 ≈ 2 MB
export async function tambahBagianPdf(dok: string, ke: number, data: string) {
  const mulai = (ke - 1) * (PDF_PER_BAGIAN / CHUNK) + 1;
  const rows: string[][] = [];
  for (let i = 0, k = mulai; i < data.length; i += CHUNK, k++) rows.push([dok, String(k), data.slice(i, i + CHUNK)]);
  await siapkan(TAB_BERKAS, HEAD_BERKAS);
  const api = sheets();
  for (let i = 0; i < rows.length; i += 8) {
    await api.spreadsheets.values.append({ spreadsheetId: sid(), range: `${TAB_BERKAS}!A1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: rows.slice(i, i + 8) } });
  }
  pdfMem.delete(dok);
}

export async function hapusDokumen(dok: string) {
  await ganti(TAB_BERKAS, HEAD_BERKAS, dok, [], 1);
  await ganti(TAB_TEKS, HEAD_TEKS, dok, [], 1);
  await ganti(TAB_DOK, HEAD_DOK, dok, [], 1);
  pdfMem.delete(dok); cache = null; daftarCache = null;
}

let daftarCache: { at: number; d: DokSK[] } | null = null;
export async function daftarDokumen(force = false): Promise<DokSK[]> {
  if (!force && daftarCache && Date.now() - daftarCache.at < 5 * 60_000) return daftarCache.d;
  const d = (await baca(TAB_DOK, HEAD_DOK, 'J')).filter((r) => validDok(r[0])).map((r) => ({
    dok: r[0], judul: r[1], keterangan: r[2], namaFile: r[3], halaman: Number(r[4]) || 0, potongan: Number(r[5]) || 0,
    ukuran: Number(r[6]) || 0, diperbarui: r[7], oleh: r[8], urut: Number(r[9]) || 99,
  })).sort((a, b) => a.urut - b.urut || a.judul.localeCompare(b.judul));
  daftarCache = { at: Date.now(), d };
  return d;
}

// Teks + indeks pencarian, disimpan sebentar di memori server
let cache: { at: number; pot: PotonganSK[]; ix: ReturnType<typeof buatIndeks> } | null = null;
export async function indeksSK() {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache;
  const [dok, teks] = await Promise.all([daftarDokumen(true), baca(TAB_TEKS, HEAD_TEKS, 'D')]);
  const judul = new Map(dok.map((d) => [d.dok, d.judul]));
  const pot = teks.filter((r) => judul.has(r[0]) && r[3]).map((r) => ({ dok: r[0], judul: judul.get(r[0]) || r[0], hal: Number(r[1]) || 0, bagian: r[2], isi: r[3] }));
  cache = { at: Date.now(), pot, ix: buatIndeks(pot) };
  return cache;
}

const pdfMem = new Map<string, Buffer>();
export async function ambilPdf(dok: string): Promise<Buffer | null> {
  if (!validDok(dok)) return null;
  const hit = pdfMem.get(dok);
  if (hit) return hit;
  await siapkan(TAB_BERKAS, HEAD_BERKAS);
  const api = sheets();
  const r = await api.spreadsheets.values.get({ spreadsheetId: sid(), range: `${TAB_BERKAS}!A2:A` });
  const baris = ((r.data.values || []) as unknown[][]).map((x, i) => (String(x[0] ?? '') === dok ? i + 2 : 0)).filter(Boolean);
  if (!baris.length) return null;
  const isi = await api.spreadsheets.values.get({ spreadsheetId: sid(), range: `${TAB_BERKAS}!A${baris[0]}:C${baris[baris.length - 1]}` });
  const data = ((isi.data.values || []) as unknown[][]).filter((x) => String(x[0] ?? '') === dok)
    .sort((a, b) => Number(a[1]) - Number(b[1])).map((x) => String(x[2] ?? '')).join('');
  const buf = Buffer.from(data, 'base64');
  if (pdfMem.size > 8) pdfMem.clear();
  pdfMem.set(dok, buf);
  return buf;
}
