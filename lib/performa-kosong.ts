// Awal bulan baru tapi tabel sales di file pantauan masih angka bulan lalu (judul kolom bulan belum diganti):
// aplikasi menampilkan SALES bulan berjalan kosong (nol), sementara aktivitas (visit, maintain, rekrut) yang sudah
// tercatat di file bulan baru tetap tampil apa adanya. Sales bulan lalu ada di arsip (Saya › Performa bulan lalu).
// Data asli di tab PERFORMA tidak diubah; begitu tabel sales bulan baru masuk, angka aslinya langsung tampil.
import type { Aktivitas, Orang, Performa, Sales } from './performa-types';
import { bulanAktivitas, bulanData, namaBulan, todayJkt } from './performa-calc';
export { bulanData };

// YYYY-MM angka sales kalau sudah lewat bulan (kosong = masih bulan berjalan)
export const bulanBasi = (d: Performa | null | undefined, now = new Date()): string => {
  if (!d || d.arsip) return '';
  const b = bulanData(d);
  return b && b < todayJkt(now).slice(0, 7) ? b : '';
};
// YYYY-MM aktivitas terakhir kalau sudah lewat bulan (mis. yang terkirim masih file pantauan bulan lalu)
export const aktivitasBasi = (d: Performa | null | undefined, now = new Date()): string => {
  if (!d || d.arsip) return '';
  const today = todayJkt(now), b = bulanAktivitas(d, today);
  return b && b < today.slice(0, 7) ? b : '';
};
export const perluDikosongkan = (d: Performa | null | undefined, now = new Date()) => !!(bulanBasi(d, now) || aktivitasBasi(d, now));

const nol = (laluPenuh: number | null | undefined): Sales =>
  ({ lalu: null, ini: 0, target: null, ach: null, diffLalu: null, diffTarget: null, laluPenuh: laluPenuh ?? null });

// Tabel sheet yang berisi aktivitas (tetap tampil); tabel sales / order in / SOA / flag dikosongkan
const BLOK_AKTIVITAS = /status visit|hasil visit|maintain|rekrut|regist/i;

// Aktivitas bulan lalu → nol (daftar MA & konsumen prioritas tetap, riwayat/frekuensi dikosongkan)
function aktivitasNol(a: Aktivitas): Aktivitas {
  const map = <T, U>(r: Record<string, T> | undefined, f: (x: T) => U) => r ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, f(v)])) as Record<string, U> : undefined;
  return {
    visit: map(a.visit, (b) => map(b, (p) => ({ database: p.database, tervisit: 0, ditemui: 0 }))!) as Aktivitas['visit'],
    maintain: map(a.maintain, (m) => ({ ma: m.ma, sudah: 0, belum: m.ma }))!,
    rekrut: map(a.rekrut, (r) => ({ rekrut: r.rekrut ? { jumlah: 0, target: r.rekrut.target } : null, regist: r.regist ? { jumlah: 0, target: r.regist.target } : null })),
    konsumen: map(a.konsumen, (l) => l.map((k) => ({ ...k, v: [] }))),
    ma: map(a.ma, (l) => l.map((m) => ({ ...m, f: 0, tgl: [], t: '', hasil: '' }))),
  };
}
function orangAktivitasNol(o: Orang): Orang {
  return {
    ...o,
    ...(o.visit ? { visit: { total: 0, bertemu: 0, konsumen: 0, ditemui: 0, p1: 0, p2: 0, p3: 0, list: [] } } : {}),
    ...(o.maintain ? { maintain: { ma: o.maintain.ma, sudah: 0, belum: o.maintain.ma, x2: 0, x3: 0, x4: 0, list: (o.maintain.list || []).map((m) => ({ ...m, f: 0, t: '' })) } } : {}),
    ...(o.rekrut ? { rekrut: { rekrut: o.rekrut.rekrut ? { jumlah: 0, target: o.rekrut.rekrut.target } : null, regist: o.rekrut.regist ? { jumlah: 0, target: o.rekrut.regist.target } : null } } : {}),
  };
}

export function kosongkanBulan(d: Performa, now = new Date()): Performa {
  const today = todayJkt(now);
  const salesLama = bulanBasi(d, now), aktLama = aktivitasBasi(d, now);
  const lalu = namaBulan(salesLama || aktLama) || d.bulan?.ini || '';
  let orang = d.orang || [];
  if (salesLama) orang = orang.map(({ oi: _oi, approval: _ap, sukarela: _sk, ...o }): Orang => ({ ...o, unit: nol(o.unit?.ini), amount: nol(o.amount?.ini) }));
  if (aktLama) orang = orang.map(orangAktivitasNol);
  return {
    ...d,
    menunggu: salesLama || aktLama,
    ...(aktLama ? { aktivitasLama: aktLama } : {}),
    ...(salesLama ? {
      bulan: { lalu, ini: namaBulan(today) },
      cabangTotal: { unit: nol(d.cabangTotal?.unit?.ini), amount: nol(d.cabangTotal?.amount?.ini), oi: null },
      salesBrand: undefined,
      salesLalu: { bulan: lalu, orang: (d.orang || []).map((o) => ({ nama: o.nama, unit: o.unit?.ini ?? null, amount: o.amount?.ini ?? null })) },
    } : {}),
    ...(d.aktivitas && aktLama ? { aktivitas: aktivitasNol(d.aktivitas) } : {}),
    orang,
    blok: aktLama ? (salesLama ? [] : (d.blok || []).filter((b) => !BLOK_AKTIVITAS.test(b.t))) : salesLama ? (d.blok || []).filter((b) => BLOK_AKTIVITAS.test(b.t)) : d.blok,
    riwayat: undefined,
  };
}
