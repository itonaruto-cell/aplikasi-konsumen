// Report survey dengan analisa 6C + 1E + 1P (Panduan Survey 031 bab 10b), hasilnya teks siap tempel ke WhatsApp.
import { kosong6C, type Analisa6C } from './banding-types';

export const UNSUR: [keyof Analisa6C, string, string][] = [
  ['character', 'Character', 'Watak: hasil wawancara, keterangan keluarga/tetangga/rekan kerja, riwayat bayar (WOM/finance lain).'],
  ['capacity', 'Capacity', 'Kemampuan bayar: penghasilan bersih setelah cicilan, slip gaji / mutasi rekening / nota, lama kerja atau usaha, ramai tidaknya usaha.'],
  ['capital', 'Capital', 'Aset selain unit jaminan: rumah, tanah, toko, kendaraan lain, emas.'],
  ['collateral', 'Collateral', 'Jaminan: unit, atas nama, kondisi, kelengkapan BPKB/STNK/faktur, harga pasar.'],
  ['condition', 'Condition of Economy', 'Kondisi ekonomi / sektor usaha atau tempat kerja konsumen.'],
  ['constraint', 'Constraint', 'Hambatan: kesehatan, status kerja (kontrak/tetap), pinjaman lain, lingkungan tempat tinggal.'],
  ['eksistensi', 'Eksistensi (1E)', 'Dikenal di lingkungan rumah & kerja/usaha? Sudah berapa lama tinggal? Hasil cek lingkungan.'],
  ['purpose', 'Purpose (1P)', 'Tujuan dana (pendidikan, renovasi, modal usaha, pengobatan, dll.) dan bukti pendukungnya.'],
];
export const REKOMENDASI = ['Layak', 'Layak dengan catatan', 'Tidak layak'] as const;

export type ReportSurvey = {
  id: string; dibuat: string; diubah: string; oleh: string;
  nama: string; appNo: string; tglSurvey: string; surveyor: string;
  brand: 'MOBILKU' | 'MOTORKU'; program: string; status: string; pekerjaan: string; alamat: string;
  unit: string; pencairan: number; tenor: number; angsuran: number;
  c6: Analisa6C; rekomendasi: string; catatan: string;
};

export function reportBaru(p: Partial<ReportSurvey> = {}): ReportSurvey {
  return {
    id: '', dibuat: '', diubah: '', oleh: '', nama: '', appNo: '', tglSurvey: '', surveyor: '',
    brand: 'MOBILKU', program: '', status: '', pekerjaan: '', alamat: '',
    unit: '', pencairan: 0, tenor: 0, angsuran: 0, c6: kosong6C(), rekomendasi: '', catatan: '', ...p,
  };
}

export function rapikanReport(x: unknown): ReportSurvey {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<ReportSurvey>;
  const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v: unknown) => { const n = Number(v); return isFinite(n) && n > 0 ? Math.round(n) : 0; };
  return {
    id: str(o.id, 80), dibuat: str(o.dibuat, 40), diubah: str(o.diubah, 40), oleh: str(o.oleh, 200),
    nama: str(o.nama, 150), appNo: str(o.appNo, 60), tglSurvey: /^\d{4}-\d{2}-\d{2}$/.test(String(o.tglSurvey || '')) ? String(o.tglSurvey) : '',
    surveyor: str(o.surveyor, 150), brand: o.brand === 'MOTORKU' ? 'MOTORKU' : 'MOBILKU', program: str(o.program, 80), status: str(o.status, 40),
    pekerjaan: str(o.pekerjaan, 150), alamat: str(o.alamat, 300), unit: str(o.unit, 200),
    pencairan: num(o.pencairan), tenor: num(o.tenor), angsuran: num(o.angsuran),
    c6: Object.fromEntries(UNSUR.map(([k]) => [k, str(o.c6?.[k], 5000)])) as Analisa6C,
    rekomendasi: (REKOMENDASI as readonly string[]).includes(String(o.rekomendasi)) ? String(o.rekomendasi) : '',
    catatan: str(o.catatan, 5000),
  };
}

const rp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
const tgl = (iso: string) => (iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');

// Teks WhatsApp: *tebal* untuk judul, baris kosong antar bagian, poin "- " dari isian per baris
export function teksWa(r: ReportSurvey): string {
  const baris = (label: string, v: string) => (v.trim() ? `${label} : ${v.trim()}` : '');
  const ident = [
    baris('Nama', r.nama.toUpperCase()), baris('App No', r.appNo), baris('Tgl survey', tgl(r.tglSurvey)), baris('Surveyor', r.surveyor),
    baris('Produk', [r.brand === 'MOTORKU' ? 'MotorKu' : 'MobilKu', r.program].filter(Boolean).join(' – ')), baris('Status', r.status),
    baris('Pekerjaan', r.pekerjaan), baris('Alamat', r.alamat),
  ].filter(Boolean);
  const aju = [
    baris('Unit / jaminan', r.unit), baris('Pencairan', r.pencairan ? rp(r.pencairan) : ''),
    baris('Tenor', r.tenor ? `${r.tenor} bulan` : ''), baris('Angsuran', r.angsuran ? rp(r.angsuran) : ''),
  ].filter(Boolean);
  const isi = UNSUR.filter(([k]) => r.c6[k].trim()).map(([k, label]) => {
    const p = r.c6[k].split('\n').map((x) => x.trim()).filter(Boolean);
    return p.length === 1 ? `*${label}* : ${p[0]}` : [`*${label}* :`, ...p.map((x) => (/^[-•]/.test(x) ? x.replace(/^[-•]\s*/, '- ') : `- ${x}`))].join('\n');
  });
  const out = ['*REPORT SURVEY*', ...ident];
  if (aju.length) out.push('', '*PENGAJUAN*', ...aju);
  if (isi.length) out.push('', '*ANALISA 6C + 1E + 1P*', ...isi.flatMap((x, i) => (i ? ['', x] : [x])));
  if (r.rekomendasi || r.catatan.trim()) out.push('', `*KESIMPULAN* : ${r.rekomendasi || '-'}`, ...(r.catatan.trim() ? [r.catatan.trim()] : []));
  return out.join('\n');
}
