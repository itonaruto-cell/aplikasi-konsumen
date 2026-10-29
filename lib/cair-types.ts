// Konsumen yang sudah cair bulan ini (tab tarikan sales di pantauan), dipakai halaman Pantau.
export type CairItem = {
  nama: string; kontrak: string; cust: string; app: string; cmo: string; unit: string;
  pokok: number; tgl: string; brand: 'mobilku' | 'motorku' | ''; sumber: string;
  offering?: string; tenor?: number; flag?: string;
  ekstra?: { angsuran: string; tahun: string; nopol: string; ltv: string };
};
export type DataCair = { ada: boolean; sumber?: string; dikirim?: string; list: CairItem[]; adaSumber?: boolean; kolom?: Record<string, string>; semuaKolom?: string[]; error?: string };

// Nama channel / sumber order dirapikan supaya cocok dengan tabel "Sales per channel"
export function rapikanSumber(v: string): string {
  const u = v.toUpperCase().replace(/[_.\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!u) return '';
  if (/AG+RE?GAT/.test(u)) return 'Aggregator';
  if (/BOOKING|\bBM\b|MANDIRI/.test(u)) return 'Booking Mandiri';
  if (/TELE/.test(u)) return 'Tele';
  if (/RETAIL|\bMA\b|AGEN|MEDIATOR/.test(u)) return 'Retail';
  if (/\bRO\b|REPEAT/.test(u)) return 'RO';
  if (/WALK|DATANG/.test(u)) return 'Walk In';
  if (/DIGITAL|ONLINE|SOSMED|SOCIAL|WEB/.test(u)) return 'Digital';
  return u.toLowerCase().replace(/\b\w/g, (h) => h.toUpperCase());
}
export const kunciSumber = (v: string) => rapikanSumber(v).toUpperCase();

// Flag approval: Normal / Banding / Pre App / Auto App
export function rapikanFlag(v: string): string {
  const u = v.toUpperCase().replace(/[_.\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!u) return '';
  if (/BANDING|APPEAL/.test(u)) return 'Banding';
  if (/PRE ?APP/.test(u)) return 'Pre App';
  if (/AUTO ?APP/.test(u)) return 'Auto App';
  if (/NORMAL|REGULER|REGULAR/.test(u)) return 'Normal';
  return u.toLowerCase().replace(/\b\w/g, (h) => h.toUpperCase());
}
export const kunciFlag = (v: string) => rapikanFlag(v).toUpperCase();

// Angka dari teks tampilan sheet: 35.200.000 / 35,200,000 / 35.200.000,00 / 35,200,000.00 / Rp 35.200.000
export function angka(v: string): number {
  let x = String(v || '').replace(/[^0-9,.-]/g, '');
  if (!x) return 0;
  const titik = x.lastIndexOf('.'), koma = x.lastIndexOf(',');
  if (titik >= 0 && koma >= 0) {
    // pemisah desimal = yang paling belakang
    x = titik > koma ? x.replace(/,/g, '') : x.replace(/\./g, '').replace(',', '.');
  } else if (koma >= 0) {
    // hanya koma: ribuan kalau polanya 1,234,567; selain itu desimal (72,92)
    x = /^-?\d{1,3}(,\d{3})+$/.test(x) ? x.replace(/,/g, '') : x.replace(',', '.');
  } else if (titik >= 0) {
    x = /^-?\d{1,3}(\.\d{3})+$/.test(x) ? x.replace(/\./g, '') : x;
  }
  const n = Number(x);
  return isFinite(n) ? n : 0;
}
