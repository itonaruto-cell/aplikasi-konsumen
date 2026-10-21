// Pengingat follow up prospek sore (Vercel Cron, Senin–Sabtu ±15.00 WIB).
// Tim yang memegang prospek aktif tapi follow up hari ini belum capai target dapat notifikasi HP;
// owner dapat ringkasan per orang.
import type { Notif } from './performa-calc';
import { FU_TARGET_HARIAN, type LaporanFU, type Prospek } from './prospek-types';
import { keyOf } from './performa-calc';

const pendek = (n: string) => {
  const w = String(n || '').trim().split(/\s+/);
  const x = w.find((s) => !/^(MUHAMMAD|MUHAMAD|MOHAMMAD|MOH\.?|MOCH\.?|M\.?)$/i.test(s)) || w[0] || '';
  return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();
};

// Prospek yang masih perlu dihubungi (belum order / belum ditolak) per PIC
export function peganganAktif(prospek: Prospek[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of prospek) {
    if (!p.pic || p.status === 'order' || p.status === 'tidak') continue;
    m.set(keyOf(p.pic), (m.get(keyOf(p.pic)) || 0) + 1);
  }
  return m;
}

export function pesanTim(nama: string, lap: LaporanFU, pegangan: Map<string, number>): Notif | null {
  const aktif = pegangan.get(keyOf(nama)) || 0;
  if (!aktif) return null;
  const sudah = lap.orang.find((o) => keyOf(o.nama) === keyOf(nama))?.dihubungi || 0;
  const target = lap.target || FU_TARGET_HARIAN;
  if (sudah >= target) return null;
  const kurang = target - sudah;
  return {
    title: sudah ? `Follow up ${sudah}/${target} hari ini` : 'Belum ada follow up hari ini',
    body: `${pendek(nama)}, kurang ${kurang} follow up lagi sebelum laporan sore. Masih ada ${aktif} prospek di pegangan kamu. Jangan lupa foto buktinya.`,
    url: '/', tag: 'pengingat-fu',
  };
}

export function pesanOwner(lap: LaporanFU, pegangan: Map<string, number>, namaPic: string[]): Notif {
  const target = lap.target || FU_TARGET_HARIAN;
  const baris = namaPic.filter((n) => (pegangan.get(keyOf(n)) || 0) > 0).map((n) => {
    const sudah = lap.orang.find((o) => keyOf(o.nama) === keyOf(n))?.dihubungi || 0;
    return `${pendek(n)} ${sudah}/${target}`;
  });
  return {
    title: `Follow up prospek: ${lap.total.dihubungi} hari ini`,
    body: `${baris.length ? baris.join(' · ') + '. ' : ''}Minat ${lap.total.minat}, order ${lap.total.order}. Laporan lengkap di Laporan → Follow up.`,
    url: '/', tag: 'pengingat-fu',
  };
}
