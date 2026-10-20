// Ambil prospek dari Google Maps lewat Apify (actor "Google Maps Scraper" buatan compass).
// Dipakai halaman Database prospek (owner) dan route /api/prospek/maps.
import { rapikanHp, rapikanMaps } from './prospek-types';

export const ACTOR = 'compass~crawler-google-places';

export const WILAYAH: { kab: string; kec: string[] }[] = [
  { kab: 'Batang', kec: ['Gringsing', 'Banyuputih', 'Limpung', 'Subah', 'Tulis', 'Kandeman', 'Batang', 'Warungasem', 'Bandar', 'Tersono', 'Pecalungan', 'Bawang', 'Blado', 'Reban', 'Wonotunggal'] },
  { kab: 'Kendal', kec: ['Weleri', 'Rowosari', 'Kangkung', 'Cepiring', 'Patebon', 'Kendal', 'Brangsong', 'Kaliwungu', 'Kaliwungu Selatan', 'Pegandon', 'Ngampel', 'Gemuh', 'Ringinarum', 'Sukorejo', 'Boja', 'Singorojo', 'Limbangan', 'Patean', 'Pageruyung', 'Plantungan'] },
  { kab: 'Semarang', kec: ['Tugu', 'Ngaliyan', 'Mijen', 'Semarang Barat', 'Gunungpati'] },
];
export const KATA_KUNCI = ['showroom mobil bekas', 'jual beli mobil', 'bengkel mobil', 'rental mobil', 'travel', 'ekspedisi truk', 'cuci mobil', 'sparepart mobil', 'dealer mobil', 'toko bangunan'];
export const KATA_INTI = KATA_KUNCI.slice(0, 6);

// "bengkel mobil Gringsing, Batang"
export const pencarian = (kata: string[], kec: { kab: string; kec: string }[]) =>
  kec.flatMap((w) => kata.map((k) => `${k} ${w.kec}, ${w.kab}`));

export type ItemMaps = { nama: string; hp: string; profesi: string; alamat: string; maps: string; sumber: string };
type Raw = Record<string, unknown>;
const t = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
// Satu tempat dari dataset Apify → calon prospek. Tempat tutup permanen / tanpa nomor HP dilewati.
export function dariApify(r: Raw): ItemMaps | null {
  if (r.permanentlyClosed === true) return null;
  const hp = rapikanHp(String(r.phoneUnformatted || r.phone || ''));
  if (!hp) return null;
  const cari = t(r.searchString, 120);
  const kab = (cari.match(/,\s*([^,]+)$/) || [])[1] || '';
  const depan = cari.replace(/,\s*[^,]+$/, '').toLowerCase();
  const kecamatan = WILAYAH.flatMap((w) => w.kec).filter((k) => depan.endsWith(' ' + k.toLowerCase())).sort((a, b) => b.length - a.length)[0] || '';
  return {
    nama: t(r.title, 100) || '(tanpa nama)', hp,
    profesi: t(r.categoryName || (Array.isArray(r.categories) ? r.categories[0] : ''), 80),
    alamat: t(r.address, 160), maps: rapikanMaps(r.url),
    sumber: t(`Maps ${kab}${kecamatan && kecamatan !== kab ? ` · ${kecamatan}` : ''}`, 40),
  };
}
