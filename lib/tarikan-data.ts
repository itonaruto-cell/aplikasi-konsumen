import { sheetsApi } from './sheets-api';
import { rapikanSumber, type CairItem } from './cair-types';

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
// Ejaan judul yang sering beda (COSTUMER, CUSTUMER, CUSTOMMER) diseragamkan jadi CUSTOMER
const N = (s: string) => s.toUpperCase().replace(/[_.]/g, ' ').replace(/\bC[OU]STU?M+[EO]R\b/g, 'CUSTOMER').replace(/\s+/g, ' ').trim();
export function cariKolom(h: string[], pola: RegExp[]): number {
  const hn = h.map(N);
  for (const p of pola) { const i = hn.findIndex((x) => p.test(x)); if (i >= 0) return i; }
  return -1;
}
// Kolom nama konsumen: judul yang umum dulu. Kalau tidak ada, dari kolom yang judulnya mirip nama, dipilih yang
// isinya huruf dan paling beragam (nama konsumen beda tiap baris; nama wilayah/BU/cabang sama semua).
const BUKAN_KONSUMEN = /CMO|SALES|PIC|SPV|MAO|\bMA\b|AGEN|DEALER|SHOWROOM|IBU|PASANGAN|SURVEY|\bBH\b|\bMH\b|\bBU\b|KOLEKTOR|COLL|BPKB|STNK|KTP|^NO\b|\bNO$|NOMOR|\bID\b|TGL|TANGGAL|DATE|CABANG|BRANCH|AREA|REGION|WILAYAH|KANTOR|OFFICE|PRODUK|PRODUCT|UNIT|ASSET|MERK|TIPE|TYPE|STATUS|KET|SUPPLIER|VENDOR|ASURANSI|INSURANCE|BANK|LEASING|FINANCE|PERUSAHAAN|COMPANY|USAHA|PEKERJAAN|PROFESI/;
const hurufSaja = (v: string) => /[A-Za-z]/.test(v) && !/^[\d\s.,\-\/:]+$/.test(v);
function ragam(r: string[][], i: number): number {
  const isi = r.map((b) => (b[i] || '').trim()).filter(Boolean);
  if (isi.length < 1) return 0;
  const huruf = isi.filter(hurufSaja);
  if (huruf.length < isi.length * 0.8) return 0;
  return new Set(huruf.map((x) => x.toUpperCase())).size / isi.length;
}
function kolomNama(h: string[], r: string[][]): number {
  const cocok = (i: number) => i >= 0 && (r.length < 3 || ragam(r, i) >= 0.5);
  const i = cariKolom(h, [/^NAMA (KONSUMEN|CUSTOMER|CUST|DEBITUR|NASABAH|PEMOHON|KONS)$/, /^(CUSTOMER|CUST|CUSTOMMER|CLIENT) ?NAME$/, /^NAMA KONSUMEN/, /^NAMA$/, /^NAME$/, /^KONSUMEN$/, /^CUSTOMER$/, /^DEBITUR$/, /^NASABAH$/]);
  if (cocok(i)) return i;
  const calon = h.map(N).map((x, j) => ({ j, x })).filter(({ x }) => /NAMA|NAME|CUSTOMER|CUSTOMMER|KONSUMEN|DEBITUR|NASABAH|PEMOHON/.test(x) && !BUKAN_KONSUMEN.test(x));
  const terbaik = calon.map(({ j }) => ({ j, s: r.length ? ragam(r, j) : 1 })).filter((x) => x.s >= 0.5).sort((a, b) => b.s - a.s)[0];
  return terbaik ? terbaik.j : -1;
}
// Kolom teks (bukan angka) pertama yang cocok, mis. TYPE UNIT harus berisi huruf, bukan nominal
function kolomTeks(h: string[], r: string[][], pola: RegExp[]): number {
  const hn = h.map(N);
  for (const p of pola) {
    for (let j = 0; j < hn.length; j++) {
      if (!p.test(hn[j])) continue;
      const isi = r.map((b) => (b[j] || '').trim()).filter(Boolean);
      if (!isi.length || isi.filter(hurufSaja).length >= isi.length * 0.8) return j;
    }
  }
  return -1;
}
export function kolomCair(h: string[], r: string[][] = []) {
  return {
    nama: kolomNama(h, r),
    kontrak: cariKolom(h, [/^NO ?KONTRAK$/, /^(NO )?AGRE?E?ME?NT( NO)?$/, /^AGRMNT NO$/, /^NO PERJANJIAN$/, /^(?!.*(TGL|TANGGAL|DATE)).*KONTRAK/]),
    cust: cariKolom(h, [/^NO ?CUST(OMER)?$/, /^(CUST|CUSTOMER) ?(NO|ID)$/, /^ID ?CUST(OMER)?$/, /^CIF$/]),
    app: cariKolom(h, [/^NO ?APP(LIKASI)?$/, /^APP(LICATION)? ?(NO|ID)$/]),
    cmo: kolomTeks(h, r, [/^NAMA CMO$/, /^CMO$/, /^NAMA CMO\b/, /^(NAMA )?SALES$/, /^PIC$/]),
    tipe: cariKolom(h, [/^TIPE KENDARAAN$/, /JENIS KENDARAAN/, /TIPE KENDARAAN/]),
    unit: kolomTeks(h, r, [/^(TYPE|TIPE) UNIT/, /^(MERK|MEREK)/, /^UNIT$/, /^(ASSET|ASET) (NAME|NAMA|DESC|TYPE|TIPE)/, /^OBJEK/, /^(TYPE|TIPE|MODEL)( KENDARAAN)?$/]),
    pokok: cariKolom(h, [/^POKOK HTG$/, /POKOK HTG/, /POKOK HUTANG/, /^AMM?OUNT$/, /^PENCAIRAN$/]),
    tgl: cariKolom(h, [/TGL.*(GOLIVE|GO LIVE|CAIR|KONTRAK|AGREEMENT)/, /TANGGAL.*(GOLIVE|GO LIVE|CAIR|KONTRAK)/, /(GOLIVE|GO LIVE) DATE/, /AGREEMENT DATE/, /^TGL$/, /^TANGGAL$/]),
    kec: cariKolom(h, [/^KECAMATAN$/]),
    kel: cariKolom(h, [/^KELURAHAN$/, /^DESA$/]),
    produk: cariKolom(h, [/^PRODUK$/, /^PRODUCT$/, /^BRAND$/]),
    offering: cariKolom(h, [/^PRODU(K|CT) ?OFFERING( TYPE| NAME| NAMA)?$/, /OFFERING/, /^POT$/]),
    tenor: cariKolom(h, [/^TENOR$/, /^TENOR\b/, /TENOR/, /JANGKA WAKTU/]),
    soa: cariKolom(h, [/^SOA ?2$/, /^SOA$/, /^(NAMA |NAME )?SOA( NAME| NAMA| DESC)?$/, /^SOA\b/, /\bSOA\b/, /SOURCE OF APP/]),
    sumber: kolomTeks(h, r, [/^(?!.*SOA)(SUMBER|SOURCE|CHANNEL|CHANEL|JALUR|ASAL)( (ORDER|DATA|APLIKASI|APP|KONSUMEN))?$/, /^(TIPE|JENIS|KATEGORI) (ORDER|SUMBER|CHANNEL)$/,
      /^(ORDER|DATA) (SOURCE|SUMBER|CHANNEL)$/, /^(?!.*SOA)(?!SOURCE OF APP).*(SUMBER|SOURCE|CHANNEL|CHANEL)/, /^RETAIL/, /AGGREGATOR|AGREGATOR/]),
  };
}

const angka = (v: string) => Number(v.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
export const kunciKontrak = (v: string) => v.replace(/\D/g, '');

// Baris Cari konsumen dari tab CAIR. Nama kolom mengikuti judul di Sheet1 (kalau ada), supaya filter & tampilan sama.
// Konsumen yang nomor kontrak / cust no-nya sudah ada di Sheet1 tidak ditambahkan lagi.
export function barisCair(t: Tabel | null, headSheet1: string[], sudahAda: Set<string>): Record<string, string>[] {
  if (!t || !t.r.length) return [];
  const k = kolomCair(t.h, t.r);
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
  const k = kolomCair(t.h, t.r);
  for (const b of t.r) {
    const info = { tgl: k.tgl >= 0 ? b[k.tgl] || '' : '', cmo: k.cmo >= 0 ? b[k.cmo] || '' : '' };
    const kk = k.kontrak >= 0 ? kunciKontrak(b[k.kontrak] || '') : '';
    const kc = k.cust >= 0 ? (b[k.cust] || '').trim().toUpperCase() : '';
    if (kk.length >= 6) m.set(kk, info);
    if (kc) m.set(kc, info);
  }
  return m;
}

// Daftar konsumen cair untuk halaman Pantau (semua baris tab CAIR, bulan berjalan)
export function daftarCair(t: Tabel | null): CairItem[] {
  if (!t) return [];
  const k = kolomCair(t.h, t.r);
  const sel = (b: string[], i: number) => (i >= 0 ? (b[i] || '').trim() : '');
  // Semua kolom SOA (SOA, SOA 2, ...): kalau salah satunya perusahaan (PT/CV) → Aggregator
  const semuaSoa = t.h.map((x, i) => (/\bSOA\b|SOURCE OF APP/.test(N(x)) ? i : -1)).filter((i) => i >= 0);
  const out: CairItem[] = [];
  for (const b of t.r) {
    const nama = sel(b, k.nama), kontrak = sel(b, k.kontrak);
    if (!nama && !kontrak) continue;
    if (/^(GRAND )?TOTAL$/i.test(nama) || /^(GRAND )?TOTAL$/i.test(sel(b, k.cmo))) continue;
    const jenis = N(sel(b, k.tipe) || sel(b, k.produk));
    out.push({
      nama: nama.toUpperCase(), kontrak, cust: sel(b, k.cust), app: sel(b, k.app), cmo: sel(b, k.cmo),
      unit: sel(b, k.unit) || sel(b, k.tipe), pokok: angka(sel(b, k.pokok)), tgl: sel(b, k.tgl),
      brand: /MOTOR/.test(jenis) ? 'motorku' : /MOBIL/.test(jenis) ? 'mobilku' : '',
      sumber: sumberOrder(sel(b, k.sumber), sel(b, k.offering), semuaSoa.map((i) => sel(b, i)).join(' | ')),
      offering: sel(b, k.offering), tenor: Math.round(angka(sel(b, k.tenor))) || 0,
    });
  }
  return out;
}

// Sumber order: dari kolom sumber/channel, kalau kosong dari produk offering.
// Order retail yang SOA-nya perusahaan (PT / CV) = Aggregator.
export function sumberOrder(sumber: string, offering: string, soa: string): string {
  const off = offering.toUpperCase();
  let x = rapikanSumber(sumber) || (/RETAIL/.test(off) ? 'Retail' : rapikanSumber(offering));
  // SOA berisi nama perusahaan: "PT ...", "PT. ...", "... PT", "CV ..."
  const soaPT = /(^|[^A-Z])(PT|CV)([^A-Z]|$)/i.test(soa);
  if (soaPT && (!x || x === 'Retail' || /RETAIL/.test(off))) x = 'Aggregator';
  return x;
}
