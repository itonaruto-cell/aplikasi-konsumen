// Fee SGM Mobilku untuk Booking Mandiri (New App / Take Over), persen dari pokok hutang, masuk ke CMO-nya.
//                      tenor 11-18  23-24  35-36  47-60
//   Bombardir                 1,25   4,00   5,25   5,75
//   Extra 2                   1,00   2,00   3,00   3,00
//   Spesial                   1,00   1,00   1,00   1,00
//   All POT khusus top up / all POT unit komersil: 1,00 · all POT unit komersil bus: 0,50
// Tenor di antara kolom (mis. 30) memakai kolom tenor di bawahnya (23-24).
import type { CairItem } from './cair-types';

const TABEL: [string, RegExp, number[]][] = [
  ['Bombardir', /BOMBARDIR/, [1.25, 4, 5.25, 5.75]],
  ['Extra 2', /EXTRA ?(2|II)\b|EXTRA ?2/, [1, 2, 3, 3]],
  ['Spesial', /SPE[SC]IAL/, [1, 1, 1, 1]],
];
const kolomTenor = (t: number) => (t <= 22 ? 0 : t <= 34 ? 1 : t <= 46 ? 2 : 3);

export type FeeBM = { persen: number | null; nominal: number; dasar: string };

export function feeBookingMandiri(it: Pick<CairItem, 'offering' | 'unit' | 'tenor' | 'pokok'>): FeeBM {
  const off = (it.offering || '').toUpperCase(), unit = (it.unit || '').toUpperCase();
  const semua = `${off} ${unit}`;
  const jadi = (persen: number, dasar: string): FeeBM => ({ persen, nominal: Math.round((it.pokok || 0) * persen / 100), dasar });
  if (/\bBUS\b|MICRO ?BUS|MINI ?BUS/.test(semua)) return jadi(0.5, 'Unit komersil bus');
  if (/TOP ?UP/.test(off)) return jadi(1, 'Khusus top up');
  if (/KOMERSI[AL]L?|NIAGA|PICK ?UP|\bPU\b|TRUK|TRUCK|\bBOX\b/.test(semua)) return jadi(1, 'Unit komersil');
  for (const [nama, re, p] of TABEL) {
    if (!re.test(off)) continue;
    if (!it.tenor) return { persen: null, nominal: 0, dasar: `${nama}, tenor belum terbaca` };
    return jadi(p[kolomTenor(it.tenor)], `${nama} · tenor ${it.tenor}`);
  }
  return { persen: null, nominal: 0, dasar: off ? `POT ${it.offering} belum ada di tabel fee` : 'Product offering belum terbaca' };
}
