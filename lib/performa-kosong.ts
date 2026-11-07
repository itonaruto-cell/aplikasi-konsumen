// Awal bulan baru tapi tabel sales di file pantauan masih angka bulan lalu (judul kolom bulan belum diganti):
// aplikasi menampilkan SALES bulan berjalan kosong (nol), sementara aktivitas (visit, maintain, rekrut) yang sudah
// tercatat di file bulan baru tetap tampil apa adanya. Sales bulan lalu ada di arsip (Saya › Performa bulan lalu).
// Data asli di tab PERFORMA tidak diubah; begitu tabel sales bulan baru masuk, angka aslinya langsung tampil.
import type { Orang, Performa, Sales } from './performa-types';
import { bulanData, namaBulan, todayJkt } from './performa-calc';
export { bulanData };

// YYYY-MM angka sales kalau sudah lewat bulan (kosong = masih bulan berjalan)
export const bulanBasi = (d: Performa | null | undefined, now = new Date()): string => {
  if (!d || d.arsip) return '';
  const b = bulanData(d);
  return b && b < todayJkt(now).slice(0, 7) ? b : '';
};

const nol = (laluPenuh: number | null | undefined): Sales =>
  ({ lalu: null, ini: 0, target: null, ach: null, diffLalu: null, diffTarget: null, laluPenuh: laluPenuh ?? null });

// Tabel sheet yang berisi aktivitas (tetap tampil); tabel sales / order in / SOA / flag dikosongkan
const BLOK_AKTIVITAS = /status visit|hasil visit|maintain|rekrut|regist/i;

export function kosongkanBulan(d: Performa, now = new Date()): Performa {
  const today = todayJkt(now);
  const lalu = namaBulan(bulanData(d)) || d.bulan?.ini || '';
  const orang = (d.orang || []).map(({ oi: _oi, approval: _ap, sukarela: _sk, ...o }): Orang => ({ ...o, unit: nol(o.unit?.ini), amount: nol(o.amount?.ini) }));
  return {
    ...d,
    menunggu: bulanData(d),
    bulan: { lalu, ini: namaBulan(today) },
    cabangTotal: { unit: nol(d.cabangTotal?.unit?.ini), amount: nol(d.cabangTotal?.amount?.ini), oi: null },
    orang,
    blok: (d.blok || []).filter((b) => BLOK_AKTIVITAS.test(b.t)),
    salesBrand: undefined,
    riwayat: undefined,
    salesLalu: { bulan: lalu, orang: (d.orang || []).map((o) => ({ nama: o.nama, unit: o.unit?.ini ?? null, amount: o.amount?.ini ?? null })) },
  };
}
