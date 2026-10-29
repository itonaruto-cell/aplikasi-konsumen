import { sheetsApi } from './sheets-api';
import { angka, rapikanFlag, rapikanSumber, type CairItem } from './cair-types';

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
function kolomTeks(h: string[], r: string[][], pola: RegExp[], bukanJenis = false): number {
  const hn = h.map(N);
  for (const p of pola) {
    for (let j = 0; j < hn.length; j++) {
      if (!p.test(hn[j])) continue;
      const isi = r.map((b) => (b[j] || '').trim()).filter(Boolean);
      // Kolom unit tidak boleh hanya berisi jenis kendaraan (MOBIL / MOTOR)
      if (bukanJenis && isi.length && isi.every((v) => /^(MOBIL|MOTOR)(KU)?$/i.test(v))) continue;
      if (!isi.length || isi.filter(hurufSaja).length >= isi.length * 0.8) return j;
    }
  }
  return -1;
}
// Pencarian kolom dari isinya, kalau judulnya tidak dikenali
const MERK = /\b(TOYOTA|HONDA|DAIHATSU|SUZUKI|MITSUBISHI|NISSAN|DATSUN|ISUZU|WULING|HYUNDAI|MAZDA|KIA|CHEVROLET|FORD|BMW|MERCEDES|YAMAHA|KAWASAKI|TVS|VESPA|PIAGGIO|CHERY|DFSK|MG|HINO|AVANZA|XENIA|BRIO|JAZZ|BEAT|VARIO|NMAX|SCOOPY|MIO|ERTIGA|SIGRA|CALYA|AYLA|AGYA|INNOVA|RUSH|TERIOS|XPANDER|LIVINA|GRAN ?MAX|L300|CARRY|FORTUNER|PAJERO|HRV|HR-V|CRV|CR-V|MOBILIO|BRV|BR-V|YARIS|VIOS|ALTIS|CAMRY|ALPHARD|VELOZ|RAIZE|ROCKY|TERIOS|LUXIO|APV|ERTIGA|SWIFT|IGNIS|BALENO|XL7|S-PRESSO|KONA|CRETA|STARGAZER|CONFERO|ALMAZ|CORTEZ|AIR ?EV|PANTHER|ELF|TRAGA|COLT|CANTER|FUSO|DUTRO|DYNA|HILUX|TRITON|NAVARA|D-MAX|PCX|ADV|CBR|KLX|AEROX|LEXI|FREEGO|GENIO|SUPRA|REVO|SONIC|SATRIA|NEX|ADDRESS|FAZZIO|XMAX|R15|VIXION|GRAND ?NEW|ALL ?NEW|NEW)\b/;
const PERUSAHAAN = /^(PT|CV)\b\.?\s*\S|\s(PT|CV)\.?$/;
const TANGGAL = /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$|^\d{4}-\d{2}-\d{2}|^\d{1,2}[ -](JAN|FEB|MAR|APR|MEI|MAY|JUN|JUL|AGU|AUG|SEP|OKT|OCT|NOV|DES|DEC)/i;
function kolomIsi(h: string[], r: string[][], cocok: RegExp, minimal: number, kecuali: number[] = [], judulDulu?: RegExp): number {
  let terbaik = -1, skor = 0;
  h.forEach((judul, j) => {
    if (kecuali.includes(j)) return;
    const isi = r.map((b) => (b[j] || '').trim().toUpperCase()).filter(Boolean);
    if (!isi.length) return;
    let s = isi.filter((v) => cocok.test(v)).length / isi.length;
    if (judulDulu && judulDulu.test(N(judul))) s += 0.5;
    if (s >= minimal && s > skor) { skor = s; terbaik = j; }
  });
  return terbaik;
}
export function kolomCair(h: string[], r: string[][] = []) {
  const k = kolomCairJudul(h, r);
  if (r.length) {
    const jangan = [k.nama, k.cmo, k.kontrak, k.cust];
    // Kolom unit dari judul tapi isinya bukan kendaraan (mis. jumlah unit): cari dari isinya
    const isiUnit = k.unit >= 0 ? r.map((b) => (b[k.unit] || '').toUpperCase()).filter(Boolean) : [];
    if (k.unit < 0 || (isiUnit.length && isiUnit.filter((v) => MERK.test(v) || /[A-Z]{3,}.*\d|\d.*[A-Z]{3,}/.test(v)).length < isiUnit.length * 0.3)) {
      const j = kolomIsi(h, r, MERK, 0.3, jangan);
      if (j >= 0) k.unit = j;
    }
    if (k.tgl < 0) k.tgl = kolomIsi(h, r, TANGGAL, 0.5, jangan, /TGL|TANGGAL|DATE|GO ?LIVE|CAIR|AGREEMENT/);
    if (k.soa < 0) k.soa = kolomIsi(h, r, PERUSAHAAN, 0.05, jangan, /SO[AR]|SOURCE|SUMBER|AGEN|SUPPLIER|DEALER|MITRA|REFERRAL|REF/);
    if (k.flag < 0) k.flag = kolomIsi(h, r, /^(NORMAL|BANDING|PRE ?APP|AUTO ?APP)/, 0.5, jangan, /FLAG|APPROVAL/);
  }
  return k;
}
function kolomCairJudul(h: string[], r: string[][] = []) {
  return {
    nama: kolomNama(h, r),
    kontrak: cariKolom(h, [/^NO ?KONTRAK$/, /^(NO )?AGRE?E?ME?NT( NO)?$/, /^AGRMNT NO$/, /^NO PERJANJIAN$/, /^(?!.*(TGL|TANGGAL|DATE)).*KONTRAK/]),
    cust: cariKolom(h, [/^NO ?CUST(OMER)?$/, /^(CUST|CUSTOMER) ?(NO|ID)$/, /^ID ?CUST(OMER)?$/, /^CIF$/]),
    app: cariKolom(h, [/^NO ?APP(LIKASI)?$/, /^APP(LICATION)? ?(NO|ID)$/]),
    cmo: kolomTeks(h, r, [/^NAMA CMO$/, /^CMO$/, /^NAMA CMO\b/, /^(NAMA )?SALES$/, /^PIC$/]),
    tipe: cariKolom(h, [/^TIPE KENDARAAN$/, /JENIS KENDARAAN/, /TIPE KENDARAAN/]),
    unit: kolomTeks(h, r, [/^(NAMA )?(MERK|MEREK)$/, /^(TYPE|TIPE) UNIT/, /^(MERK|MEREK)/, /^UNIT$/, /^(ASSET|ASET) (NAME|NAMA|DESC|TYPE|TIPE)/, /^OBJEK/, /^(TYPE|TIPE|MODEL)$/,
      /(TYPE|TIPE|MODEL|VARIAN|VARIANT)/, /(ASSET|ASET|OBJEK|OBJECT|KENDARAAN|UNIT|MOBIL|MOTOR) ?(DESC|DESKRIPSI|DESCRIPTION|NAME|NAMA|DETAIL)?/, /DESKRIPSI|DESCRIPTION/], true),
    pokok: cariKolom(h, [/^POKOK HTG$/, /POKOK HTG/, /POKOK HUTANG/, /^AMM?OUNT$/, /^PENCAIRAN$/]),
    tgl: cariKolom(h, [/^TGL GL$/, /^(TGL|TANGGAL) GO ?LIVE$/, /^TGL JUAL$/, /TGL.*(GOLIVE|GO LIVE|CAIR|KONTRAK|AGREEMENT)/, /TANGGAL.*(GOLIVE|GO LIVE|CAIR|KONTRAK)/, /(GOLIVE|GO LIVE) DATE/, /AGREEMENT DATE/, /^TGL$/, /^TANGGAL$/]),
    kec: cariKolom(h, [/^KECAMATAN$/]),
    kel: cariKolom(h, [/^KELURAHAN$/, /^DESA$/]),
    produk: cariKolom(h, [/^BRAND$/, /^PRODUK$/, /^PRODUCT$/, /^NAMA PRODUK$/]),
    flag: cariKolom(h, [/^FLAG( APPROVAL| APP)?$/, /FLAG/, /^(JALUR|TIPE|JENIS) APPROVAL$/]),
    offering: cariKolom(h, [/^PRODU(K|CT) ?OFFERING( TYPE| NAME| NAMA)?$/, /OFFERING/, /^POT$/]),
    tenor: cariKolom(h, [/^TENOR$/, /^TENOR\b/, /TENOR/, /JANGKA WAKTU/]),
    soa: cariKolom(h, [/^SO[AR] ?2$/, /^SO[AR]$/, /^SO[AR] ?\d$/, /^(NAMA |NAME )?SOA( NAME| NAMA| DESC)?$/, /^SOA\b/, /\bSOA\b/, /SOURCE OF APP/]),
    sumber: kolomTeks(h, r, [/^(?!.*SOA)(SUMBER|SOURCE|CHANNEL|CHANEL|JALUR|ASAL)( (ORDER|DATA|APLIKASI|APP|KONSUMEN))?$/, /^(TIPE|JENIS|KATEGORI) (ORDER|SUMBER|CHANNEL)$/,
      /^(ORDER|DATA) (SOURCE|SUMBER|CHANNEL)$/, /^(?!.*SOA)(?!SOURCE OF APP).*(SUMBER|SOURCE|CHANNEL|CHANEL)/, /^RETAIL/, /AGGREGATOR|AGREGATOR/]),
  };
}

const ribuan = (n: number) => Math.round(n).toLocaleString('id-ID');
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
    const jenis = N(`${sel(b, k.produk)} ${sel(b, k.tipe)}`);
    const brand = /MOTOR/.test(jenis) ? 'MOTORKU' : /MOBIL/.test(jenis) ? 'MOBILKU' : sel(b, k.produk);
    const pokok = angka(sel(b, k.pokok));
    const r: Record<string, string> = { [J.nama]: nama.toUpperCase() };
    if (kontrak) r[J.kontrak] = kontrak;
    if (cust) r[J.cust] = cust;
    if (sel(b, k.app)) r['NO APP'] = sel(b, k.app);
    const unitTeks = gabungUnit(t.h, b, k.unit);
    if (unitTeks) r[J.unit] = unitTeks;
    if (brand) r[J.produk] = brand;
    if (sel(b, k.kec)) r[J.kec] = sel(b, k.kec);
    if (sel(b, k.kel)) r[J.kel] = sel(b, k.kel);
    if (sel(b, k.cmo)) r['CMO'] = sel(b, k.cmo);
    if (sel(b, k.tgl)) r['TGL CAIR'] = sel(b, k.tgl);
    if (pokok) r['POKOK HUTANG'] = 'Rp ' + ribuan(pokok);
    // Kolom tambahan secukupnya (angsuran, tenor, tahun, nopol, LTV, merk, HP, sumber, offering), judul mengikuti Sheet1
    for (const [kunciJ, v] of Object.entries(ekstraCair(t.h, b, k, headSheet1))) if (!(kunciJ in r)) r[kunciJ] = v;
    r.__CAIR = '1'; r.__CAIR_INFO = JSON.stringify({ tgl: sel(b, k.tgl), cmo: sel(b, k.cmo) });
    out.push(r);
  }
  return out;
}

// Kolom tarikan yang dipakai di Cari konsumen (selain nama/kontrak/cust/unit/CMO/tgl/pokok yang dipetakan terpisah).
// Judulnya disamakan dengan Sheet1 kalau ada, supaya tampil di tempat yang sama (mis. ANGSURAN & TENOR di kotak atas).
const EKSTRA: [string[], RegExp[]][] = [
  [['ANGSURAN'], [/^NOMINAL ANGS/, /^ANGSURAN$/, /^ANGS(URAN)?\b/, /ANGSURAN/, /INSTAL+MENT/]],
  [['TENOR'], [/^TENOR$/, /^TENOR\b/, /TENOR/]],
  [['TAHUN UNIT', 'TAHUN'], [/^TAHUN( UNIT| KENDARAAN| MOBIL| MOTOR)?$/, /^THN\b/, /^(YEAR|TAHUN) ?(OF )?(MFG|MANUFACTURE|PEMBUATAN|RAKIT)?$/, /TAHUN/]],
  [['NOPOL'], [/^NOPOL$/, /^NO\.? ?POL(ISI)?$/, /PLAT|NOPOL/]],
  [['LTV'], [/^LTV\b/, /LTV/]],
  [['BRAND UNIT'], [/^(NAMA )?(MERK|MEREK)( UNIT| KENDARAAN)?$/]],
  [['NO HP'], [/^(NO\.? ?)?(HP|WA|TELP|TELEPON|HANDPHONE|PHONE)( ?\d)?$/, /^(NO\.? )?(HP|TELP)/]],
  [['PRODUK OFFERING'], [/OFFERING/]],
];
export function ekstraCair(h: string[], b: string[], k: ReturnType<typeof kolomCair>, headSheet1: string[]): Record<string, string> {
  const hs = headSheet1.map((x) => x.trim());
  const hn = h.map(N);
  const out: Record<string, string> = {};
  const dipakai = new Set([k.nama, k.kontrak, k.cust, k.app, k.unit, k.cmo, k.tgl, k.pokok]);
  for (const [nama, pola] of EKSTRA) {
    let j = -1;
    for (const p of pola) { j = hn.findIndex((x, i) => !dipakai.has(i) && p.test(x)); if (j >= 0) break; }
    const v = j >= 0 ? (b[j] || '').trim() : '';
    if (!v) continue;
    const judul = hs.find((x) => nama.includes(x.toUpperCase())) || nama[0];
    out[judul] = v;
    dipakai.add(j);
  }
  if (k.unit >= 0) { const u = gabungUnit(h, b, k.unit); if (u) out[hs.find((x) => /^TYPE UNIT( DETAIL)?$/i.test(x)) || 'TYPE UNIT DETAIL'] = u; }
  if (k.cmo >= 0 && (b[k.cmo] || '').trim()) out.CMO = (b[k.cmo] || '').trim();
  // Sumber order yang sudah dirapikan (Retail / Aggregator / Tele / Booking Mandiri / ...)
  const soa = [...new Set([...hn.map((x, i) => (/\bSO[AR]\b|SO[AR] ?\d|SOURCE OF APP/.test(x) ? i : -1)), k.soa])].filter((i) => i >= 0);
  const sb = sumberOrder(k.sumber >= 0 ? b[k.sumber] || '' : '', k.offering >= 0 ? b[k.offering] || '' : '', soa.map((i) => b[i] || '').join(' | '));
  if (sb) out['SUMBER ORDER'] = sb;
  if (k.tgl >= 0 && (b[k.tgl] || '').trim()) out['TGL CAIR'] = (b[k.tgl] || '').trim();
  return out;
}

// Unit: kalau kolom yang terbaca hanya MERK, digabung dengan kolom TYPE/MODEL (mis. HONDA + BEAT)
function gabungUnit(h: string[], b: string[], iUnit: number): string {
  const v = iUnit >= 0 ? (b[iUnit] || '').trim() : '';
  if (iUnit < 0 || !/^(NAMA )?(MERK|MEREK|BRAND)/.test(N(h[iUnit]))) return v;
  const hn = h.map(N);
  let iTipe = hn.findIndex((x) => /RINCI/.test(x) && /TIPE|TYPE/.test(x));
  if (iTipe < 0) iTipe = hn.findIndex((x) => /^(TYPE|TIPE|MODEL)( UNIT| MOBIL| MOTOR| KENDARAAN)?$/.test(x) && !/^(MOBIL|MOTOR)$/i.test((b[hn.indexOf(x)] || '').trim()));
  let tipe = iTipe >= 0 ? (b[iTipe] || '').trim() : '';
  // TIPE RINCI sering sudah diawali merk ("TOYOTA AGYA ..."): jangan dobel
  if (v && tipe.toUpperCase().startsWith(v.toUpperCase())) tipe = tipe.slice(v.length).trim();
  return [v, tipe].filter(Boolean).join(' ').replace(/\b(\w+) \1\b/gi, '$1');
}

// Semua isi baris tarikan (judul asli) per kunci no kontrak / cust no, untuk melengkapi konsumen yang sudah ada di Sheet1
export function isiCair(t: Tabel | null, headSheet1: string[] = []): Map<string, Record<string, string>> {
  const m = new Map<string, Record<string, string>>();
  if (!t) return m;
  const k = kolomCair(t.h, t.r);
  for (const b of t.r) {
    const isi = ekstraCair(t.h, b, k, headSheet1);
    const kk = k.kontrak >= 0 ? kunciKontrak(b[k.kontrak] || '') : '';
    const kc = k.cust >= 0 ? (b[k.cust] || '').trim().toUpperCase() : '';
    if (kk.length >= 6) m.set(kk, isi);
    if (kc) m.set(kc, isi);
  }
  return m;
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
  const semuaSoa = [...new Set([...t.h.map((x, i) => (/\bSO[AR]\b|SO[AR] ?\d|SOURCE OF APP/.test(N(x)) ? i : -1)), k.soa])].filter((i) => i >= 0);
  const out: CairItem[] = [];
  for (const b of t.r) {
    const nama = sel(b, k.nama), kontrak = sel(b, k.kontrak);
    if (!nama && !kontrak) continue;
    if (/^(GRAND )?TOTAL$/i.test(nama) || /^(GRAND )?TOTAL$/i.test(sel(b, k.cmo))) continue;
    const jenis = N(`${sel(b, k.produk)} ${sel(b, k.tipe)}`);
    out.push({
      nama: nama.toUpperCase(), kontrak, cust: sel(b, k.cust), app: sel(b, k.app), cmo: sel(b, k.cmo),
      unit: gabungUnit(t.h, b, k.unit) || sel(b, k.tipe), pokok: angka(sel(b, k.pokok)), tgl: sel(b, k.tgl),
      brand: /MOTOR/.test(jenis) ? 'motorku' : /MOBIL/.test(jenis) ? 'mobilku' : '',
      sumber: sumberOrder(sel(b, k.sumber), sel(b, k.offering), semuaSoa.map((i) => sel(b, i)).join(' | ')),
      offering: sel(b, k.offering), tenor: Math.round(angka(sel(b, k.tenor))) || 0, flag: rapikanFlag(sel(b, k.flag)),
      ekstra: (() => { const e = ekstraCair(t.h, b, k, []); return { angsuran: e.ANGSURAN || '', tahun: e['TAHUN UNIT'] || '', nopol: e.NOPOL || '', ltv: e.LTV || '' }; })(),
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
