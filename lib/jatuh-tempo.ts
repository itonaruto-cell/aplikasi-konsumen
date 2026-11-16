// Jatuh tempo angsuran dari tanggal penjualan di sistem (Proceed dari Approval Disbursement), sesuai ketentuan WOM:
//   01–03 → tgl 03 bulan berikutnya        04–20 → tanggal yang sama bulan berikutnya
//   21–22 → tgl 19 bulan berikutnya        23–25 → tgl 20 bulan berikutnya
//   26–28 → tgl 03 dua bulan berikutnya    29–30 → tgl 04 dua bulan berikutnya    31 → tgl 05 dua bulan berikutnya
// Juga pesan WhatsApp detail kontrak untuk konsumen yang baru cair.
import { angka, type CairItem } from './cair-types';

export type Tgl = { y: number; m: number; d: number };   // m = 1–12
const KODE_BLN = [/^JAN/, /^FEB/, /^MAR/, /^APR/, /^(MEI|MAY)/, /^JUN/, /^JUL/, /^(AGU|AGS|AUG)/, /^SEP/, /^(OKT|OCT)/, /^NOV/, /^(DES|DEC)/];
export const BLN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const sah = (y: number, m: number, d: number) => y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
const tahun = (y: number) => (y < 100 ? 2000 + y : y);

/** Baca tanggal cair dari tab tarikan: 13 (tanggal saja, bulan dari bulanHint), 2026-11-03, 03/11/2026, 3-Nov-2026, 3 Nopember 2026, serial Excel.
 *  Tanggal angka a/b/yyyy dibaca hari/bulan; kalau bisa dua-duanya, dipilih yang bulannya sama dengan bulanHint (YYYY-MM). */
export function bacaTgl(v: string, bulanHint = ''): Tgl | null {
  const s = String(v || '').trim();
  // Tarikan sales G Suite: kolom TGL hanya berisi tanggal (mis. "13"); bulan & tahun = bulan data tarikan
  if (/^\d{1,2}$/.test(s)) {
    const b = bulanHint.match(/^(\d{4})-(\d{2})$/);
    const t = b ? { y: +b[1], m: +b[2], d: +s } : null;
    return t && sah(t.y, t.m, t.d) ? t : null;
  }
  // Waktu UTC (mis. 2026-11-11T17:00:00.000Z) → tanggal Jakarta
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const x = new Date(s);
    if (isFinite(x.getTime())) { const [y, mm, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(x).split('-').map(Number); return { y, m: mm, d }; }
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const t = { y: +m[1], m: +m[2], d: +m[3] }; return sah(t.y, t.m, t.d) ? t : null; }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) {
    const a = +m[1], b = +m[2], y = tahun(+m[3]);
    const dm = sah(y, b, a) ? { y, m: b, d: a } : null, md = sah(y, a, b) ? { y, m: a, d: b } : null;
    // Dua-duanya mungkin (mis. 11/5/2026): pilih yang bulannya paling dekat dengan bulan data (tarikan G Suite = bulan/tanggal/tahun)
    const h = bulanHint.match(/^(\d{4})-(\d{2})$/);
    if (dm && md && h) {
      const jarak = (t: Tgl) => Math.abs(t.y * 12 + t.m - (+h[1] * 12 + +h[2]));
      return jarak(md) < jarak(dm) ? md : dm;
    }
    return dm || md;
  }
  m = s.match(/^(\d{1,2})[\s-]+([A-Za-z]+)[\s-]+(\d{2,4})/);
  if (m) {
    const i = KODE_BLN.findIndex((r) => r.test(m![2].toUpperCase().replace(/^NOP/, 'NOV').replace(/^PEB/, 'FEB')));
    const t = { y: tahun(+m[3]), m: i + 1, d: +m[1] };
    return i >= 0 && sah(t.y, t.m, t.d) ? t : null;
  }
  // Nov 12, 2026 · November 12 2026 · Thu Nov 12 2026
  m = s.match(/^(?:[A-Za-z]{3,},?\s+)?([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const i = KODE_BLN.findIndex((r) => r.test(m![1].toUpperCase().replace(/^NOP/, 'NOV').replace(/^PEB/, 'FEB')));
    const t = { y: +m[3], m: i + 1, d: +m[2] };
    if (i >= 0 && sah(t.y, t.m, t.d)) return t;
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const x = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 864e5);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
  }
  return null;
}

const tambahBulan = (t: Tgl, n: number, d: number): Tgl => { const k = t.m - 1 + n; return { y: t.y + Math.floor(k / 12), m: (k % 12) + 1, d }; };
/** Jatuh tempo tiap bulan (tanggal) dan angsuran ke-1. */
export function jatuhTempo(cair: Tgl): { tgl: number; pertama: Tgl } {
  const d = cair.d;
  const [n, tgl] = d <= 3 ? [1, 3] : d <= 20 ? [1, d] : d <= 22 ? [1, 19] : d <= 25 ? [1, 20] : d <= 28 ? [2, 3] : d <= 30 ? [2, 4] : [2, 5];
  return { tgl, pertama: tambahBulan(cair, n, tgl) };
}
export const dd = (n: number) => String(n).padStart(2, '0');
export const fmtTgl = (t: Tgl) => `${dd(t.d)} ${BLN_PENDEK[t.m - 1]} ${t.y}`;

/** Jatuh tempo untuk satu konsumen cair (null kalau tanggal cair tidak terbaca). */
export function jtCair(it: Pick<CairItem, 'tgl' | 'tglJual'>, bulanHint = '') {
  // TGL JUAL (tanggal penjualan di sistem) lebih dulu; TGL GL tarikan hanya berisi tanggal
  const t = bacaTgl(it.tglJual || '', bulanHint) || bacaTgl(it.tgl, bulanHint);
  return t ? { cair: t, ...jatuhTempo(t) } : null;
}

const ribu = (n: number) => (n ? Math.round(n).toLocaleString('en-US') : '-');
export const salamWaktu = (jam: number) => (jam < 11 ? 'Pagi' : jam < 15 ? 'Siang' : jam < 18 ? 'Sore' : 'Malam');
export const jamJkt = (now = new Date()) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).format(now));

export const INFO_SALINAN = [
  '=====',
  'Informasi tambahan terkait Salinan Perjanjian Pembiayaan :',
  '1. Salinan akan dikirimkan dalam lampiran e-mail ke e-mail Konsumen yang telah terdaftar di WOM Finance; atau ',
  '2. Konsumen mengakses file salinan Perjanjian Sewa Pembiayaan dari halaman web dengan link halaman web yang akan dikirimkan melalui SMS ke nomor handphone Konsumen yang telah terdaftar di WOM Finance dengan waktu ketersediaan untuk dapat diakses selama 6 (enam) bulan. Pengiriman link via SMS dilakukan max 7 hari kerja setelah Pencairan; atau',
  '3. Untuk keterangan lebih lanjut dapat menghubungi Contact Center di nomor 150999.',
  '=====',
].join('\n');

/** Pesan WhatsApp detail kontrak untuk konsumen yang baru cair. */
export function pesanKontrak(it: CairItem, bulanHint = '', now = new Date()): string {
  const jt = jtCair(it, bulanHint);
  return [
    `Selamat ${salamWaktu(jamJkt(now))} Bapak/Ibu ${it.nama.trim().toUpperCase() || '-'}`,
    '',
    'Berikut kami kirimkan detail kontrak pembiayaan WOM Finance : ',
    `Nomor kontrak : ${it.kontrak || '-'}`,
    `Pencairan : ${ribu(it.cair || it.pokok)}`,
    `Angsuran : ${ribu(angka(it.ekstra?.angsuran || ''))}`,
    `Tenor : ${it.tenor || '-'}`,
    `Jatuh tempo : setiap tgl ${jt ? dd(jt.tgl) : '-'}`,
    `Jatuh tempo angs 1 : ${jt ? fmtTgl(jt.pertama) : '-'}`,
    '',
    'Berikut kami kirimkan juga Tata Cara Pembayaran Angsuran WOM Finance',
    '',
    INFO_SALINAN,
    '',
    'Terima kasih',
  ].join('\n');
}
export const URL_TATA_CARA = '/template/tata-cara-bayar-wom.jpg';
