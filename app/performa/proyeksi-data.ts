// Perhitungan proyeksi sales untuk seluruh cabang: dipakai halaman Proyeksi dan foto laporan proyeksi,
// supaya angkanya selalu sama.
import type { Orang } from '../../lib/performa-types';
import type { Bahan } from '../../lib/bahan-types';
import { brandOf, type Ctx } from '../../lib/performa-calc';
import { samaNama } from '../../lib/sales-brand';
import { hitungProyeksi, jumlahBahan, type Angka, type Proyeksi } from '../../lib/proyeksi';
import { posisiKosong } from '../../lib/kesehatan-data';
import { totalBrand } from './laporan-gambar';

export type Mode = 'realistis' | 'maksimal';
export type BrandP = 'mobilku' | 'motorku';
export type DataProyeksi = {
  cabang: Proyeksi;
  brand: { b: BrandP; p: Proyeksi }[];
  orang: { o: Orang; p: Proyeksi; brand: BrandP | '' }[];
  bahanOrang: Map<string, { mobil: Angka; motor: Angka }>;
  tanpaPemilik: number;
  nAktif: number;
};

export const plus = (a: Angka, ...b: Angka[]): Angka => b.reduce((x, y) => ({ amount: x.amount + y.amount, unit: x.unit + y.unit }), a);

export function hitungSemua(c: Ctx, bahan: Bahan[], mode: Mode): DataProyeksi {
  const aktif = bahan.filter((b) => b.status === 'aktif');
  const pemilik = (b: Bahan) => c.sales.find((o) => samaNama(o.nama, b.nama)) || null;
  const brandOrang = (o: Orang): BrandP | '' => { const b = brandOf(o); return b === 'mobilku' || b === 'motorku' ? b : ''; };
  // Jenis kendaraan yang diisi di Bahan survey dipakai dulu; kalau kosong, ikut brand staff pemiliknya
  const brandBahan = (b: Bahan): BrandP | '' => {
    if (b.kendaraan === 'motor') return 'motorku';
    if (b.kendaraan === 'mobil') return 'mobilku';
    const o = pemilik(b); return o ? brandOrang(o) : '';
  };
  const orang = c.sales.filter((o) => !posisiKosong(o.nama))
    .map((o) => ({ o, brand: brandOrang(o), p: hitungProyeksi(o, aktif.filter((b) => samaNama(o.nama, b.nama))) }))
    .sort((a, b) => b.p[mode].amount - a.p[mode].amount);
  const brand = (['mobilku', 'motorku'] as const).map((b) => ({ b, p: hitungProyeksi(totalBrand(c, b), aktif.filter((x) => brandBahan(x) === b)) }));
  const tanpaPemilik = aktif.filter((b) => !pemilik(b) && !b.kendaraan).length;
  // Bahan yang sedang berjalan per orang, dipisah mobil / motor (untuk info di simulasi)
  const nilai = (list: Bahan[]): Angka => { const j = jumlahBahan(list); return mode === 'maksimal' ? plus(j.proses, j.survey) : j.proses; };
  const bahanOrang = new Map(orang.map(({ o }) => {
    const milik = aktif.filter((b) => samaNama(o.nama, b.nama));
    return [o.nama, { mobil: nilai(milik.filter((b) => brandBahan(b) === 'mobilku')), motor: nilai(milik.filter((b) => brandBahan(b) === 'motorku')) }] as const;
  }));
  return { cabang: hitungProyeksi(c.data.cabangTotal || {}, aktif), brand, orang, bahanOrang, tanpaPemilik, nAktif: aktif.length };
}

// Bahan aktif seluruh tim (tanpa data konsumen) untuk proyeksi
export async function ambilBahanProyeksi(): Promise<Bahan[]> {
  const r = await fetch('/api/bahan?untuk=proyeksi', { cache: 'no-store' });
  const j = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(j?.list)) throw new Error(j?.error || 'Bahan gagal dimuat.');
  return j.list as Bahan[];
}
