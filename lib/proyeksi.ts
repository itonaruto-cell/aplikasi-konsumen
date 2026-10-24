// Proyeksi sales: pencapaian bulan ini + bahan yang masih berjalan (sedang diproses, bahan survey),
// dibandingkan target (kurang berapa) dan bulan lalu (selisih).
import type { Sales } from './performa-types';
import { tahapOf, type Bahan } from './bahan-types';

export type Angka = { amount: number; unit: number };
export type Proyeksi = {
  tercapai: Angka; proses: Angka; survey: Angka;
  realistis: Angka;          // tercapai + sedang diproses
  maksimal: Angka;           // + bahan survey
  target: Angka | null; lalu: Angka | null;
  laluPenuh: Angka | null;   // bulan lalu sebulan penuh (lalu = s.d. tanggal yang sama)
};
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const nol = (): Angka => ({ amount: 0, unit: 0 });
const tambah = (a: Angka, b: Angka): Angka => ({ amount: a.amount + b.amount, unit: a.unit + b.unit });

export function jumlahBahan(list: Bahan[]): { proses: Angka; survey: Angka } {
  const proses = nol(), survey = nol();
  for (const b of list) {
    if (b.status !== 'aktif') continue;
    const t = tahapOf(b) === 'proses' ? proses : survey;
    t.amount += Number(b.nominal) || 0; t.unit += 1;
  }
  return { proses, survey };
}

export function hitungProyeksi(s: { amount?: Sales | null; unit?: Sales | null }, bahan: Bahan[]): Proyeksi {
  const { proses, survey } = jumlahBahan(bahan);
  const tercapai = { amount: isNum(s.amount?.ini) ? s.amount!.ini! : 0, unit: isNum(s.unit?.ini) ? s.unit!.ini! : 0 };
  const realistis = tambah(tercapai, proses);
  const ambil = (k: 'target' | 'lalu'): Angka | null => {
    const a = s.amount?.[k], u = s.unit?.[k];
    const lalu = (x?: Sales | null) => (isNum(x?.lalu) ? x!.lalu! : isNum(x?.ini) && isNum(x?.diffLalu) ? x!.ini! - x!.diffLalu! : null);
    const av = k === 'lalu' ? lalu(s.amount) : a, uv = k === 'lalu' ? lalu(s.unit) : u;
    return isNum(av) || isNum(uv) ? { amount: isNum(av) ? av : 0, unit: isNum(uv) ? uv : 0 } : null;
  };
  const ap = s.amount?.laluPenuh, up = s.unit?.laluPenuh;
  const laluPenuh = isNum(ap) || isNum(up) ? { amount: isNum(ap) ? ap : 0, unit: isNum(up) ? up : 0 } : null;
  return { tercapai, proses, survey, realistis, maksimal: tambah(realistis, survey), target: ambil('target'), lalu: ambil('lalu'), laluPenuh };
}
