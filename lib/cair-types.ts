// Konsumen yang sudah cair bulan ini (tab tarikan sales di pantauan), dipakai halaman Pantau.
export type CairItem = {
  nama: string; kontrak: string; cust: string; app: string; cmo: string; unit: string;
  pokok: number; tgl: string; brand: 'mobilku' | 'motorku' | ''; sumber: string;
};
export type DataCair = { ada: boolean; sumber?: string; dikirim?: string; list: CairItem[]; adaSumber?: boolean; kolom?: Record<string, string>; error?: string };

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
