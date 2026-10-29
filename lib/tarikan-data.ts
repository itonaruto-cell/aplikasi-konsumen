import { sheetsApi } from './sheets-api';

// Data mentah dari file pantauan, dikirim Apps Script (kirimDataTarikan) tiap 30 menit:
// - CAIR    : baris tab tarikan sales bulan berjalan (konsumen yang sudah cair) → ikut tampil di Cari konsumen
// - DATA_OI : tab data OI (order in) → tampil di halaman Bahan OI
// Tiap tab: baris 1 = keterangan (sumber & waktu kirim), baris 2 = judul kolom, baris 3 dst = data.

export type Tabel = { sumber: string; dikirim: string; h: string[]; r: string[][] };
export const TAB_CAIR = 'CAIR';
export const TAB_OI = 'DATA_OI';
const CACHE_MS = 60_000;
export const MAKS_BARIS = 5000;
export const MAKS_KOLOM = 80;

const siap = new Set<string>();
async function pastikanTab(tab: string) {
  if (siap.has(tab)) return;
  const api = sheetsApi();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  if (!(meta.data.sheets || []).some((s) => s.properties?.title === tab)) {
    await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } });
  }
  siap.add(tab);
}

const teks = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);

// Rapikan kiriman: judul kolom & isi jadi teks, buang kolom tanpa judul & tanpa isi, batasi ukuran
export function rapikanTabel(x: unknown): { sumber: string; h: string[]; r: string[][] } | null {
  const o = x as { sumber?: unknown; h?: unknown; r?: unknown } | null;
  if (!o || !Array.isArray(o.h) || !Array.isArray(o.r)) return null;
  const h0 = o.h.slice(0, MAKS_KOLOM).map(teks);
  const r0 = o.r.slice(0, MAKS_BARIS).filter(Array.isArray).map((b) => h0.map((_, i) => teks((b as unknown[])[i])));
  const pakai = h0.map((h, i) => !!h || r0.some((b) => b[i]));
  const h = h0.filter((_, i) => pakai[i]).map((v, i) => v || `KOLOM ${i + 1}`);
  const r = r0.map((b) => b.filter((_, i) => pakai[i])).filter((b) => b.some(Boolean));
  if (!h.length) return null;
  return { sumber: teks(o.sumber), h, r };
}

const cache = new Map<string, { at: number; t: Tabel | null }>();

export async function simpanTabel(tab: string, t: { sumber: string; h: string[]; r: string[][] }, sekarang = new Date().toISOString()) {
  await pastikanTab(tab);
  const api = sheetsApi();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  await api.spreadsheets.values.clear({ spreadsheetId, range: `${tab}!A:ZZ` });
  await api.spreadsheets.values.update({
    spreadsheetId, range: `${tab}!A1`, valueInputOption: 'RAW',
    requestBody: { values: [['Diisi otomatis dari pantauan. Jangan diubah.', t.sumber, sekarang], t.h, ...t.r] },
  });
  cache.set(tab, { at: Date.now(), t: { ...t, dikirim: sekarang } });
}

export async function bacaTabel(tab: string): Promise<Tabel | null> {
  const c = cache.get(tab);
  if (c && Date.now() - c.at < CACHE_MS) return c.t;
  let t: Tabel | null = null;
  try {
    const res = await sheetsApi().spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${tab}!A1:CZ` });
    const v = (res.data.values || []) as unknown[][];
    if (v.length >= 2) {
      const h = (v[1] || []).map(teks);
      t = { sumber: teks(v[0]?.[1]), dikirim: teks(v[0]?.[2]), h, r: v.slice(2).map((b) => h.map((_, i) => teks(b[i]))).filter((b) => b.some(Boolean)) };
    }
  } catch (err) {
    // Tab belum ada (belum pernah dikirim) → anggap kosong
    if ((err as { code?: number }).code !== 400) throw err;
  }
  cache.set(tab, { at: Date.now(), t });
  return t;
}

/* ---------- Konsumen cair (tab tarikan sales) → baris Cari konsumen ---------- */
const N = (s: string) => s.toUpperCase().replace(/[_.]/g, ' ').replace(/\s+/g, ' ').trim();
export function cariKolom(h: string[], pola: RegExp[]): number {
  const hn = h.map(N);
  for (const p of pola) { const i = hn.findIndex((x) => p.test(x)); if (i >= 0) return i; }
  return -1;
}
// Kolom nama konsumen: judul yang umum dulu, lalu judul apa saja yang mengandung NAMA/NAME/CUSTOMER/KONSUMEN
// asal bukan nama orang kantor (CMO, sales, SPV, agent, dealer, dst.) atau nomor/tanggal.
const BUKAN_KONSUMEN = /CMO|SALES|PIC|SPV|MAO|\bMA\b|AGEN|DEALER|SHOWROOM|IBU|PASANGAN|SURVEY|\bBH\b|\bMH\b|KOLEKTOR|COLL|BPKB|STNK|KTP|^NO\b|\bNO$|NOMOR|\bID\b|TGL|TANGGAL|DATE|CABANG|BRANCH|PRODUK|PRODUCT|UNIT|ASSET|MERK|TIPE|TYPE|STATUS|KET/;
function kolomNama(h: string[]): number {
  const i = cariKolom(h, [/^NAMA (KONSUMEN|CUSTOMER|CUST|DEBITUR|NASABAH|PEMOHON|KONS)$/, /^(CUSTOMER|CUST|CUSTOMMER|CLIENT) ?NAME$/, /^NAMA KONSUMEN/, /^NAMA$/, /^NAME$/, /^KONSUMEN$/, /^CUSTOMER$/, /^DEBITUR$/, /^NASABAH$/]);
  if (i >= 0) return i;
  return h.map(N).findIndex((x) => /NAMA|NAME|CUSTOMER|CUSTOMMER|KONSUMEN|DEBITUR|NASABAH|PEMOHON/.test(x) && !BUKAN_KONSUMEN.test(x));
}
export function kolomCair(h: string[]) {
  return {
    nama: kolomNama(h),
    kontrak: cariKolom(h, [/^NO ?KONTRAK$/, /^(NO )?AGRE?E?ME?NT( NO)?$/, /^AGRMNT NO$/, /^NO PERJANJIAN$/, /^(?!.*(TGL|TANGGAL|DATE)).*KONTRAK/]),
    cust: cariKolom(h, [/^NO ?CUST(OMER)?$/, /^(CUST|CUSTOMER) ?(NO|ID)$/, /^ID ?CUST(OMER)?$/, /^CIF$/]),
    app: cariKolom(h, [/^NO ?APP(LIKASI)?$/, /^APP(LICATION)? ?(NO|ID)$/]),
    cmo: cariKolom(h, [/^NAMA CMO$/, /^CMO$/, /^NAMA CMO\b/, /^(NAMA )?SALES$/, /^PIC$/]),
    tipe: cariKolom(h, [/^TIPE KENDARAAN$/, /JENIS KENDARAAN/, /TIPE KENDARAAN/]),
    unit: cariKolom(h, [/^(TYPE|TIPE) UNIT/, /^(MERK|MEREK)/, /^UNIT$/, /^ASSET/, /^OBJEK/]),
    pokok: cariKolom(h, [/^POKOK HTG$/, /POKOK HTG/, /POKOK HUTANG/, /^AMM?OUNT$/, /^PENCAIRAN$/]),
    tgl: cariKolom(h, [/TGL.*(GOLIVE|GO LIVE|CAIR|KONTRAK|AGREEMENT)/, /TANGGAL.*(GOLIVE|GO LIVE|CAIR|KONTRAK)/, /(GOLIVE|GO LIVE) DATE/, /AGREEMENT DATE/, /^TGL$/, /^TANGGAL$/]),
    kec: cariKolom(h, [/^KECAMATAN$/]),
    kel: cariKolom(h, [/^KELURAHAN$/, /^DESA$/]),
    produk: cariKolom(h, [/^PRODUK$/, /^PRODUCT$/]),
  };
}

const angka = (v: string) => Number(v.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
export const kunciKontrak = (v: string) => v.replace(/\D/g, '');

// Baris Cari konsumen dari tab CAIR. Nama kolom mengikuti judul di Sheet1 (kalau ada), supaya filter & tampilan sama.
// Konsumen yang nomor kontrak / cust no-nya sudah ada di Sheet1 tidak ditambahkan lagi.
export function barisCair(t: Tabel | null, headSheet1: string[], sudahAda: Set<string>): Record<string, string>[] {
  if (!t || !t.r.length) return [];
  const k = kolomCair(t.h);
  if (k.nama < 0) return [];
  const hs = headSheet1.map((x) => x.trim());
  const judul = (...pilihan: string[]) => hs.find((x) => pilihan.includes(x.toUpperCase())) || pilihan[0];
  const J = {
    nama: judul('NAMA KONSUMEN', 'NAMA'), kontrak: judul('NO KONTRAK', 'NO. KONTRAK', 'ORDER_NO', 'ORDER NO'),
    cust: judul('ID CUST', 'CUST NO', 'CUST_NO', 'ID CUSTOMER', 'CUSTOMER NO'), unit: judul('TYPE UNIT DETAIL', 'TYPE UNIT'),
    produk: judul('PRODUK'), kec: judul('KECAMATAN'), kel: judul('KELURAHAN'),
  };
  const sel = (b: string[], i: number) => (i >= 0 ? b[i] || '' : '');
  const out: Record<string, string>[] = [];
  const dipakai = new Set<string>();
  for (const b of t.r) {
    const nama = sel(b, k.nama);
    if (!nama || /^(GRAND )?TOTAL$/i.test(nama)) continue;
    const kontrak = sel(b, k.kontrak), cust = sel(b, k.cust);
    const kk = kunciKontrak(kontrak), kc = cust.toUpperCase();
    if ((kk.length >= 6 && sudahAda.has(kk)) || (kc && sudahAda.has(kc))) continue;
    const kunci = kk || kc || nama.toUpperCase();
    if (dipakai.has(kunci)) continue;
    dipakai.add(kunci);
    const jenis = N(sel(b, k.tipe) || sel(b, k.produk));
    const brand = /MOTOR/.test(jenis) ? 'MOTORKU' : /MOBIL/.test(jenis) ? 'MOBILKU' : sel(b, k.produk);
    const pokok = angka(sel(b, k.pokok));
    const r: Record<string, string> = { [J.nama]: nama.toUpperCase() };
    if (kontrak) r[J.kontrak] = kontrak;
    if (cust) r[J.cust] = cust;
    if (sel(b, k.app)) r['NO APP'] = sel(b, k.app);
    if (sel(b, k.unit)) r[J.unit] = sel(b, k.unit);
    if (brand) r[J.produk] = brand;
    if (sel(b, k.kec)) r[J.kec] = sel(b, k.kec);
    if (sel(b, k.kel)) r[J.kel] = sel(b, k.kel);
    if (sel(b, k.cmo)) r['CMO'] = sel(b, k.cmo);
    if (sel(b, k.tgl)) r['TGL CAIR'] = sel(b, k.tgl);
    if (pokok) r['POKOK HUTANG'] = String(pokok);
    r.__CAIR = '1'; r.__CAIR_INFO = JSON.stringify({ tgl: sel(b, k.tgl), cmo: sel(b, k.cmo) });
    out.push(r);
  }
  return out;
}

// Kunci satu baris Sheet1 (no kontrak & cust no) untuk mencocokkan dengan data cair
export function pembuatKunci(head: string[]): (r: unknown[]) => string[] {
  const hu = head.map((x) => x.trim().toUpperCase());
  const iK = ['NO KONTRAK', 'NO. KONTRAK', 'ORDER_NO', 'ORDER NO'].map((x) => hu.indexOf(x)).filter((i) => i >= 0);
  const iC = ['ID CUST', 'CUST NO', 'CUST_NO', 'ID CUSTOMER', 'CUSTOMER NO'].map((x) => hu.indexOf(x)).filter((i) => i >= 0);
  return (r) => [
    ...iK.map((i) => kunciKontrak(String(r[i] ?? ''))).filter((v) => v.length >= 6),
    ...iC.map((i) => String(r[i] ?? '').trim().toUpperCase()).filter(Boolean),
  ];
}
export function kunciSheet1(head: string[], rows: unknown[][]): Set<string> {
  const k = pembuatKunci(head);
  return new Set(rows.flatMap(k));
}
// Kunci semua konsumen di tab CAIR → info singkat (untuk menandai konsumen Sheet1 yang sudah cair)
export function petaCair(t: Tabel | null): Map<string, { tgl: string; cmo: string }> {
  const m = new Map<string, { tgl: string; cmo: string }>();
  if (!t) return m;
  const k = kolomCair(t.h);
  for (const b of t.r) {
    const info = { tgl: k.tgl >= 0 ? b[k.tgl] || '' : '', cmo: k.cmo >= 0 ? b[k.cmo] || '' : '' };
    const kk = k.kontrak >= 0 ? kunciKontrak(b[k.kontrak] || '') : '';
    const kc = k.cust >= 0 ? (b[k.cust] || '').trim().toUpperCase() : '';
    if (kk.length >= 6) m.set(kk, info);
    if (kc) m.set(kc, info);
  }
  return m;
}
