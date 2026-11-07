// Bagi prospek harian otomatis: Senin–Sabtu ±07.00 WIB, masing-masing PIC tetap (Naufal & Rizal) mendapat
// 10 prospek baru dari database prospek yang belum ada PIC-nya (status belum dihubungi, urut paling lama masuk).
import { keyOf } from './performa-calc';
import type { Prospek } from './prospek-types';

export const BAGI_HARIAN = 10;
// Penerima tetap; nama lengkap diambil dari pantauan / PIC yang sudah ada, cadangannya nama di bawah ini
export const PENERIMA = [
  { cocok: /NAUFAL/i, cadangan: 'MUHAMMAD NAUFAL RAFLI AL HAFIZ' },
  { cocok: /RIZAL/i, cadangan: 'MUHAMMAD RIZAL HIMAWAN' },
];

// Panggilan singkat untuk notifikasi: "Naufal", "Rizal"
export const sebut = (nama: string) => {
  const p = PENERIMA.find((x) => x.cocok.test(nama));
  const k = p ? (nama.match(p.cocok)?.[0] || '') : nama.trim().split(/\s+/).find((w) => !/^(MUHAMMAD|MUH|MOH|M\.?)$/i.test(w)) || nama;
  return k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
};

/** Nama penerima persis seperti yang sudah dipakai (PIC prospek dulu, lalu nama di pantauan). */
export function namaPenerima(prospek: Prospek[], namaTim: string[]): string[] {
  return PENERIMA.map(({ cocok, cadangan }) =>
    prospek.map((p) => p.pic).find((n) => n && cocok.test(n)) || namaTim.find((n) => cocok.test(n)) || cadangan);
}

/** Pembagian hari ini: [{ id, pic }]. Kalau stok kurang, dibagi bergiliran sampai habis. */
export function susunBagi(prospek: Prospek[], penerima: string[], per = BAGI_HARIAN): { id: string; pic: string }[] {
  const stok = prospek
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.pic && p.status === 'baru')
    .sort((a, b) => (a.p.dibuat || '').localeCompare(b.p.dibuat || '') || a.i - b.i)
    .map(({ p }) => p);
  const hasil: { id: string; pic: string }[] = [];
  const dapat = new Map(penerima.map((n) => [keyOf(n), 0]));
  let k = 0;
  for (const p of stok) {
    const bisa = penerima.filter((n) => dapat.get(keyOf(n))! < per);
    if (!bisa.length) break;
    const n = bisa[k++ % bisa.length];
    dapat.set(keyOf(n), dapat.get(keyOf(n))! + 1);
    hasil.push({ id: p.id, pic: n });
  }
  return hasil;
}
