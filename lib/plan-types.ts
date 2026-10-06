// Plan aktivitas harian: rencana pagi, realisasi yang dicentang sepanjang hari, dan report sore.
// Dipakai bersama oleh server (app/api/plan) dan halaman (app/performa/Plan.tsx).
import { addDays, dayOfWeek } from './performa-calc';

export const JENIS = ['visit', 'maintain', 'rekrut', 'regist', 'survey', 'map', 'lainnya'] as const;
export type Jenis = (typeof JENIS)[number];
export const JENIS_LABEL: Record<Jenis, string> = {
  visit: 'Visit', maintain: 'Maintain MA', rekrut: 'Rekrut MA', regist: 'Regist MA',
  survey: 'Survey', map: 'Map pencairan', lainnya: 'Lainnya',
};
export type StatusPlan = 'rencana' | 'selesai' | 'batal';
export const MIN_AKTIVITAS = 5;

export type PlanItem = {
  id: string;         // "wajib:<id survey>" = map pencairan wajib yang belum disentuh (belum tersimpan)
  tgl: string;        // yyyy-MM-dd (WIB)
  nama: string;       // nama staff seperti di pantauan
  jenis: Jenis;
  siapa: string;      // konsumen / MA / kegiatan
  lokasi: string;
  catatan: string;
  status: StatusPlan;
  hasil: string;      // hasil singkat setelah dikerjakan
  wajib: boolean;     // map pencairan dari survey hari sebelumnya
  punyaku: boolean;
  spv: boolean;       // milik akun owner (SPV): tidak masuk plan tim dan report
  request: boolean;   // visit by request CMO: konsumen diketik sendiri karena belum ada di database
  dibuat: string;
  diubah: string;
};

// Urutan tampil: map pencairan wajib, lalu survey, lalu sisanya menurut waktu dibuat
const bobot = (x: Pick<PlanItem, 'jenis' | 'wajib'>) => (x.wajib ? 0 : x.jenis === 'survey' ? 1 : 2);
export const urutkan = <T extends Pick<PlanItem, 'jenis' | 'wajib' | 'dibuat'>>(list: T[]): T[] =>
  [...list].sort((a, b) => bobot(a) - bobot(b) || a.dibuat.localeCompare(b.dibuat));

// total = aktivitas yang direncanakan (yang dibatalkan tidak dihitung)
export const ringkas = (list: Pick<PlanItem, 'status'>[]) => {
  const batal = list.filter((x) => x.status === 'batal').length;
  const selesai = list.filter((x) => x.status === 'selesai').length;
  return { total: list.length - batal, selesai, batal };
};

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const tanggalPanjang = (tgl: string) =>
  `${HARI[dayOfWeek(tgl)]}, ${Number(tgl.slice(8, 10))} ${BULAN[Number(tgl.slice(5, 7)) - 1]} ${tgl.slice(0, 4)}`;
export const tanggalPendek = (tgl: string, hariIni: string) =>
  tgl === hariIni ? 'Hari ini' : tgl === addDays(hariIni, 1) ? 'Besok' : tgl === addDays(hariIni, -1) ? 'Kemarin'
    : `${HARI[dayOfWeek(tgl)].slice(0, 3)}, ${Number(tgl.slice(8, 10))} ${BULAN[Number(tgl.slice(5, 7)) - 1].slice(0, 3)}`;

const baris = (x: PlanItem, mode: 'plan' | 'report') => {
  const inti = `${JENIS_LABEL[x.jenis]} · ${x.siapa}${x.lokasi ? ` (${x.lokasi})` : ''}${x.request ? ' · by request CMO' : ''}`;
  if (mode === 'plan') return `• ${inti}${x.catatan ? `, ${x.catatan}` : ''}`;
  const tanda = x.status === 'selesai' ? '✅' : x.status === 'batal' ? '✖️' : '⬜';
  const ket = x.hasil || (x.status === 'batal' ? 'batal' : '');
  return `${tanda} ${inti}${ket ? `: ${ket}` : ''}`;
};

// Teks siap kirim ke WhatsApp: plan pagi atau report sore, dikelompokkan per staff
export function teksPlan(list: PlanItem[], tgl: string, cabang: string, mode: 'plan' | 'report', pendek: (nama: string) => string = (n) => n): string {
  const per = new Map<string, PlanItem[]>();
  list.forEach((x) => per.set(x.nama, [...(per.get(x.nama) || []), x]));
  const r = ringkas(list);
  const kepala = [
    `*${mode === 'plan' ? 'PLAN' : 'REPORT'} AKTIVITAS · ${cabang.toUpperCase()}*`,
    tanggalPanjang(tgl),
    mode === 'plan' ? `${r.total} aktivitas direncanakan` : `Plan ${r.total} · selesai ${r.selesai}${r.batal ? ` · batal ${r.batal}` : ''}`,
  ];
  const badan = [...per].sort((a, b) => a[0].localeCompare(b[0])).map(([nama, items]) => {
    const s = ringkas(items);
    const tampil = urutkan(mode === 'plan' ? items.filter((x) => x.status !== 'batal') : items);
    return [`*${pendek(nama)}* · ${mode === 'plan' ? `${s.total} aktivitas` : `${s.selesai}/${s.total} selesai`}`, ...tampil.map((x) => baris(x, mode))].join('\n');
  });
  return [kepala.join('\n'), ...badan].join('\n\n');
}
