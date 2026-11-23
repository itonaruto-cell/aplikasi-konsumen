// Target maintain MA: owner/SPV memberi tiap MA (agent) tingkat warna = berapa kali wajib dimaintain bulan ini.
// Dibandingkan dengan jumlah maintain yang tercatat (tab AKTIVITAS MAINTAIN), lalu sisa kekurangannya dibagi ke
// sisa hari kerja (Senin–Sabtu) sebagai saran jadwal harian.
import type { MaFull } from './performa-types';

export type BrandMa = 'mobilku' | 'motorku';
export type LevelId = 'kuning' | 'orange' | 'hijau' | 'biru' | 'putih';
export type Level = { id: LevelId; target: number; label: string; wajib: string; bg: string; fg: string };
export const LEVEL: Level[] = [
  { id: 'kuning', target: 4, label: 'KUNING', wajib: 'Wajib 4x (boleh lebih)', bg: '#F6D31E', fg: '#1A1A1A' },
  { id: 'orange', target: 3, label: 'ORANGE', wajib: 'Wajib 3x', bg: '#F28C28', fg: '#FFFFFF' },
  { id: 'hijau', target: 2, label: 'HIJAU', wajib: 'Wajib 2x', bg: '#3CC84E', fg: '#0B2410' },
  { id: 'biru', target: 1, label: 'BIRU', wajib: 'Wajib 1x', bg: '#3B82F6', fg: '#FFFFFF' },
  { id: 'putih', target: 0, label: 'PUTIH', wajib: 'Tidak perlu maintain lagi', bg: '#E5E7EB', fg: '#1A1A1A' },
];
export const levelDari = (t: number): Level => (t >= 4 ? LEVEL[0] : LEVEL.find((l) => l.target === t) || LEVEL[4]);
export const KET_AWAL = 'Kapos Kendal • Batch 1';

/** Kunci MA: huruf & angka saja, supaya beda spasi/titik di sheet tidak membuat targetnya hilang. */
export const kunciMa = (n: string) => String(n || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export type TargetMa = { target: Record<BrandMa, Record<string, number>>; ket: Record<BrandMa, string>; bolehUbah?: boolean };

export type BarisMa = { m: MaFull; kunci: string; f: number; target: number | null; kurang: number; capai: boolean };
export type HasilTarget = {
  baris: BarisMa[];
  grup: { level: Level; baris: BarisMa[] }[];
  belum: BarisMa[];   // MA yang belum diberi target
  wajib: number;      // MA dengan target ≥ 1x
  capai: number;      // MA wajib yang sudah mencapai targetnya
  kurang: number;     // total kekurangan maintain
};

export function hitungTarget(list: MaFull[], t: Record<string, number>): HasilTarget {
  const baris = list.filter((m) => m.n).map((m): BarisMa => {
    const kunci = kunciMa(m.n), f = Math.max(0, Number(m.f) || 0);
    const target = kunci in t ? t[kunci] : null;
    const kurang = target ? Math.max(0, target - f) : 0;
    return { m, kunci, f, target, kurang, capai: !!target && f >= target };
  });
  const ada = baris.filter((b) => b.target !== null);
  return {
    baris,
    grup: LEVEL.map((level) => ({ level, baris: ada.filter((b) => levelDari(b.target!).id === level.id) })).filter((g) => g.baris.length),
    belum: baris.filter((b) => b.target === null),
    wajib: ada.filter((b) => b.target! > 0).length,
    capai: ada.filter((b) => b.target! > 0 && b.capai).length,
    kurang: ada.reduce((s, b) => s + b.kurang, 0),
  };
}

/* ---------- Sisa hari kerja (Senin–Sabtu, termasuk hari ini) ---------- */
const tambahHari = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export function hariKerjaDari(today: string): string[] {
  const [y, m] = today.split('-').map(Number);
  const akhir = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const out: string[] = [];
  for (let d = today; d <= akhir; d = tambahHari(d, 1)) if (new Date(d + 'T00:00:00Z').getUTCDay() !== 0) out.push(d);
  return out;
}

/**
 * Saran jadwal: kekurangan tiap MA disebar ke sisa hari kerja (paling banyak sekali sehari per MA), berjarak
 * merata, dan beban harian seimbang (kalau sama, hari lebih awal didahulukan). MA dengan kekurangan terbesar dulu.
 */
export function jadwalSaran(baris: BarisMa[], hari: string[]): { tgl: string; ma: BarisMa[] }[] {
  const D = hari.length;
  if (!D) return [];
  const isi: BarisMa[][] = hari.map(() => []);
  const tugas = baris.filter((b) => b.kurang > 0).sort((a, b) => b.kurang - a.kurang || a.m.n.localeCompare(b.m.n));
  for (const b of tugas) {
    const k = Math.min(b.kurang, D);
    // Sisa hari dibagi k ruas; tiap maintain jatuh di ruasnya sendiri (berjarak), di hari yang bebannya paling ringan
    for (let j = 0; j < k; j++) {
      const a = Math.floor((j * D) / k), z = Math.max(a, Math.floor(((j + 1) * D) / k) - 1);
      let pilih = -1;
      for (let d = a; d <= z; d++) if (!isi[d].includes(b) && (pilih < 0 || isi[d].length < isi[pilih].length)) pilih = d;
      if (pilih < 0) for (let d = 0; d < D; d++) if (!isi[d].includes(b) && (pilih < 0 || isi[d].length < isi[pilih].length)) pilih = d;
      if (pilih < 0) break;
      isi[pilih].push(b);
    }
  }
  return hari.map((tgl, i) => ({ tgl, ma: isi[i] }));
}

export function rapikanTarget(x: unknown): TargetMa {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<TargetMa>;
  const t = (v: unknown) => Object.fromEntries(Object.entries((v && typeof v === 'object' ? v : {}) as Record<string, unknown>)
    .map(([k, n]) => [kunciMa(k), Math.max(0, Math.min(9, Math.round(Number(n))))] as const).filter(([k, n]) => k && isFinite(n)));
  return {
    target: { mobilku: t(o.target?.mobilku), motorku: t(o.target?.motorku) },
    ket: { mobilku: String(o.ket?.mobilku || KET_AWAL).slice(0, 80), motorku: String(o.ket?.motorku || KET_AWAL).slice(0, 80) },
    bolehUbah: !!o.bolehUbah,
  };
}
