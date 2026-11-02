// Awal bulan baru tapi Apps Script masih mengirim file pantauan bulan lalu: aplikasi menampilkan bulan berjalan
// dalam keadaan kosong (angka nol), sementara data bulan lalu tetap utuh di arsip (Saya › Performa bulan lalu).
// Data asli di tab PERFORMA tidak diubah; begitu file bulan baru tersambung, angka aslinya langsung tampil.
import type { Aktivitas, Orang, Performa, Sales } from './performa-types';
import { bulanData, namaBulan, todayJkt } from './performa-calc';
export { bulanData };

// YYYY-MM data kalau sudah lewat bulan (kosong = masih bulan berjalan)
export const bulanBasi = (d: Performa | null | undefined, now = new Date()): string => {
  if (!d || d.arsip) return '';
  const b = bulanData(d);
  return b && b < todayJkt(now).slice(0, 7) ? b : '';
};

const nol = (laluPenuh: number | null | undefined): Sales =>
  ({ lalu: null, ini: 0, target: null, ach: null, diffLalu: null, diffTarget: null, laluPenuh: laluPenuh ?? null });

function orangKosong(o: Orang): Orang {
  return {
    nama: o.nama, brand: o.brand,
    unit: nol(o.unit?.ini), amount: nol(o.amount?.ini),
    ...(o.visit ? { visit: { total: 0, bertemu: 0, konsumen: 0, ditemui: 0, p1: 0, p2: 0, p3: 0, list: [] } } : {}),
    ...(o.maintain ? { maintain: { ma: o.maintain.ma, sudah: 0, belum: o.maintain.ma, x2: 0, x3: 0, x4: 0, list: (o.maintain.list || []).map((m) => ({ ...m, f: 0, t: '' })) } } : {}),
    ...(o.rekrut ? { rekrut: { rekrut: o.rekrut.rekrut ? { jumlah: 0, target: null } : null, regist: o.rekrut.regist ? { jumlah: 0, target: null } : null } } : {}),
  };
}

function aktivitasKosong(a: Aktivitas): Aktivitas {
  const map = <T, U>(r: Record<string, T> | undefined, f: (x: T) => U) => r ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, f(v)])) as Record<string, U> : undefined;
  return {
    visit: map(a.visit, (b) => map(b, (p) => ({ database: p.database, tervisit: 0, ditemui: 0 }))!) as Aktivitas['visit'],
    maintain: map(a.maintain, (m) => ({ ma: m.ma, sudah: 0, belum: m.ma }))!,
    rekrut: map(a.rekrut, (r) => ({ rekrut: r.rekrut ? { jumlah: 0, target: null } : null, regist: r.regist ? { jumlah: 0, target: null } : null })),
    konsumen: map(a.konsumen, (l) => l.map((k) => ({ ...k, v: [] }))),
    ma: map(a.ma, (l) => l.map((m) => ({ ...m, f: 0, tgl: [], t: '', hasil: '' }))),
  };
}

export function kosongkanBulan(d: Performa, now = new Date()): Performa {
  const today = todayJkt(now);
  const lalu = namaBulan(bulanData(d)) || d.bulan?.ini || '';
  return {
    cabang: d.cabang,
    updated: today,
    dikirim: d.dikirim,
    menunggu: bulanData(d),
    bulan: { lalu, ini: namaBulan(today) },
    cabangTotal: { unit: nol(d.cabangTotal?.unit?.ini), amount: nol(d.cabangTotal?.amount?.ini), oi: null },
    ...(d.aktivitas ? { aktivitas: aktivitasKosong(d.aktivitas) } : {}),
    orang: (d.orang || []).map(orangKosong),
    blok: [],
    salesLalu: { bulan: lalu, orang: (d.orang || []).map((o) => ({ nama: o.nama, unit: o.unit?.ini ?? null, amount: o.amount?.ini ?? null })) },
  };
}
