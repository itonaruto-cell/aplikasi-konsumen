// Log follow up prospek (tab FU_LOG): satu baris setiap kali hasil follow up dicatat.
// Dipakai untuk laporan follow up harian, karena status di tab PROSPEK hanya menyimpan hasil terakhir.
import { appendRow, readRows } from './sheet-store';
import { FU_TARGET_HARIAN, bacaStatus, type HitungFU, type LaporanFU, type Prospek, type StatusProspek } from './prospek-types';

const TAB = 'FU_LOG';
const HEAD = ['WAKTU', 'TGL', 'ID', 'NAMA', 'TEMPAT', 'OLEH', 'EMAIL', 'STATUS', 'HASIL', 'FOTO'];
export const tglJkt = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

export type CatatanFU = { waktu: string; id: string; nama: string; tempat: string; oleh: string; email: string; status: StatusProspek; hasil: string; foto: string };
export async function catatFU(x: CatatanFU) {
  await appendRow(TAB, HEAD, [x.waktu, tglJkt(x.waktu), x.id, x.nama, x.tempat, x.oleh, x.email, x.status, x.hasil, x.foto]);
}
export async function bacaLog(): Promise<(CatatanFU & { tgl: string })[]> {
  return (await readRows(TAB, HEAD)).filter((r) => r[0] && r[2]).map((r) => ({
    waktu: r[0], tgl: r[1] || tglJkt(r[0]), id: r[2], nama: r[3], tempat: r[4], oleh: r[5], email: r[6],
    status: bacaStatus(r[7]), hasil: r[8], foto: r[9],
  }));
}

const nol = (): HitungFU => ({ dihubungi: 0, minat: 0, order: 0, tidak: 0, norespon: 0, foto: 0 });
const tambah = (h: HitungFU, s: StatusProspek, foto: boolean) => {
  h.dihubungi++;
  if (s === 'minat' || s === 'order') h.minat++;   // order termasuk minat
  if (s === 'order') h.order++;
  if (s === 'tidak') h.tidak++;
  if (s === 'norespon') h.norespon++;
  if (foto) h.foto++;
};

// Satu prospek dihitung sekali per hari, dengan hasil follow up terakhirnya hari itu
export function susunLaporan(log: (CatatanFU & { tgl: string })[], prospek: Prospek[], tgl: string): LaporanFU {
  const hari = log.filter((x) => x.tgl === tgl).sort((a, b) => a.waktu.localeCompare(b.waktu));
  const akhir = new Map<string, CatatanFU & { tgl: string; adaFoto: boolean }>();
  for (const x of hari) {
    const lama = akhir.get(x.id);
    akhir.set(x.id, { ...x, adaFoto: !!x.foto || !!lama?.adaFoto });
  }
  const total = nol();
  const per = new Map<string, HitungFU>();
  for (const x of akhir.values()) {
    tambah(total, x.status, x.adaFoto);
    if (!per.has(x.oleh)) per.set(x.oleh, nol());
    tambah(per.get(x.oleh)!, x.status, x.adaFoto);
  }
  const bulan = tgl.slice(0, 7);
  return {
    tgl, target: FU_TARGET_HARIAN, total,
    orang: [...per].map(([nama, h]) => ({ nama, ...h })).sort((a, b) => b.dihubungi - a.dihubungi || a.nama.localeCompare(b.nama)),
    minat: [...akhir.values()].filter((x) => x.status === 'minat' || x.status === 'order')
      .sort((a, b) => Number(b.status === 'order') - Number(a.status === 'order') || a.waktu.localeCompare(b.waktu))
      .map((x) => ({ nama: x.nama, tempat: x.tempat, oleh: x.oleh, hasil: x.hasil, order: x.status === 'order' })),
    db: {
      baruHariIni: prospek.filter((p) => p.dibuat && tglJkt(p.dibuat) === tgl).length,
      belumDihubungi: prospek.filter((p) => p.status === 'baru').length,
      orderBulanIni: new Set(log.filter((x) => x.status === 'order' && x.tgl.startsWith(bulan)).map((x) => x.id)).size,
    },
  };
}
