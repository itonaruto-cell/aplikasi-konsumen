// Surat IM / Berita Acara dari template SK. Isi baku (latar belakang, tujuan, pengajuan) tetap dari template;
// yang diisi di aplikasi: kop (judul, perihal, nomor), baris "Dibuat oleh", data konsumen, dan lampiran foto.
// Template baru cukup ditambahkan ke TEMPLATE_SURAT.

export type FotoSurat = { id: string; ket: string };
export type LampiranSurat = { judul: string; foto: FotoSurat[] };
export type Surat = {
  id: string; dibuat: string; diubah: string; oleh: string;
  template: string;
  judul: string;             // baris 1 kop, mis. BERITA ACARA
  perihal: string;           // baris 2 kop, mis. IM SAKPOLE ERROR A.N JENNY
  perihalOtomatis: boolean;  // ikut nama konsumen sampai diubah sendiri
  noUrut: string; kode: string; tanggal: string; // nomor = noUrut/kode/bulan romawi/tahun (dari tanggal surat)
  approval: string; tglApproval: string; ket: string; // baris "Dibuat oleh"
  data: Record<string, string>;
  lampiran: LampiranSurat[];
};

export type IsianData = { k: string; label: string; ph?: string; besar?: boolean; saran?: string[] };
export type TemplateSurat = {
  id: string; nama: string; ringkas: string; sk: string;
  judul: string; perihal: (d: Record<string, string>) => string;
  latar: string[]; tujuan: string[]; pengajuan: string[];
  data: IsianData[]; lampiran: string[];
};

export const PEMBUAT = { peran: 'Dibuat oleh', nama: 'Niko Widyasmara', jabatan: 'BMH MobilKu Kendal' };
export const PENYETUJU: { peran: string; nama: string; jabatan: string }[] = [
  { peran: 'Diketahui oleh', nama: 'Dyah Pamungkas', jabatan: 'BOH' },
  { peran: 'Disetujui oleh', nama: 'Muhammad Aji Susilo', jabatan: 'Branch Head' },
  { peran: 'Disetujui oleh', nama: 'Untik Hartati', jabatan: 'AMM NDS JATARA' },
  { peran: 'Disetujui oleh', nama: 'Geri Neno A', jabatan: 'AOM' },
  { peran: 'Disetujui oleh', nama: 'Azza Dwi Septian', jabatan: 'CAM' },
  { peran: 'Disetujui oleh', nama: 'Moga Mulya Saputra', jabatan: 'BU Head' },
];

export const TEMPLATE_SURAT: TemplateSurat[] = [
  {
    id: 'sakpole',
    nama: 'IM SAKPOLE error',
    ringkas: 'Golive tanpa validasi STNK via aplikasi SAKPOLE (data pajak/kendaraan tidak muncul)',
    sk: 'SK No 251/SK/OPP/10-24 (Versi 03)',
    judul: 'BERITA ACARA',
    perihal: (d) => `IM SAKPOLE ERROR A.N ${(d.nama || '').trim().toUpperCase() || '…'}`,
    latar: [
      'Sesuai SK No 251/SK/OPP/10-24 (Versi 03) terkait Pengecekan Validasi STNK bahwa BMH/MS diwajibkan untuk melampirkan Hasil screenshot hasil validasi melalui aplikasi masing-masing daerah, CAC melakukan validasi hasil screenshot dan kesesuaian dengan data fotokopi STNK yang diterima, serta Tim Operation di cabang wajib melakukan pengecekan atas hasil validasi STNK.',
      'Tidak munculnya data pajak dan data kendaraan pada aplikasi SAKPOLE di salah satu aplikasi konsumen Cabang Kendal.',
    ],
    tujuan: ['Dapat dilanjutkannya Proses Golive Aplikasi tanpa dilakukan pengecekan pada Aplikasi SAKPOLE'],
    pengajuan: [
      'Dapat dilanjutkan Proses Golive tanpa Pengecekan Aplikasi SAKPOLE',
      'Wajib dilampirkan Foto STNK Asli dan dilakukan Validasi dan Cek Keasliannya oleh BMH dan BOH',
    ],
    data: [
      { k: 'nama', label: 'Nama Konsumen', besar: true },
      { k: 'app', label: 'No APP', ph: 'APP0631…', besar: true },
      { k: 'tipe', label: 'Tipe Konsumen', saran: ['New Customer', 'Repeat Order'] },
      { k: 'jenis', label: 'Jenis Aplikasi', saran: ['Dana Tunai', 'Pembiayaan Baru'] },
      { k: 'soa', label: 'SOA', saran: ['Agent', 'Walk In', 'Channel Mediator', 'Direct Marketing'] },
      { k: 'kendaraan', label: 'Type Kendaraan', ph: 'Toyota Avanza 1.3 G MT' },
      { k: 'tahun', label: 'Tahun Kendaraan', ph: '2018' },
      { k: 'polis', label: 'No Polis', ph: 'H 1234 AB', besar: true },
      { k: 'rangka', label: 'No Rangka', besar: true },
      { k: 'mesin', label: 'No Mesin', besar: true },
      { k: 'pajak', label: 'Masa Pajak', ph: '12-05-2027' },
    ],
    lampiran: ['Hasil Pengecekan SAKPOLE kondisi saat ini'],
  },
];
export const templateSurat = (id: string) => TEMPLATE_SURAT.find((t) => t.id === id) || TEMPLATE_SURAT[0];

const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export function nomorSurat(s: Pick<Surat, 'noUrut' | 'kode' | 'tanggal'>): string {
  const [y, m] = (s.tanggal || '').split('-').map(Number);
  return [s.noUrut.trim() || '…', s.kode.trim() || 'MKT-KENDAL', ROMAWI[(m || 1) - 1] || '…', y || '…'].join('/');
}
export const perihalSurat = (s: Surat) => (s.perihalOtomatis ? templateSurat(s.template).perihal(s.data) : s.perihal);

export function suratBaru(template: string, x: Partial<Surat> = {}): Surat {
  const t = templateSurat(template);
  return {
    id: '', dibuat: '', diubah: '', oleh: '', template: t.id,
    judul: t.judul, perihal: '', perihalOtomatis: true, noUrut: '', kode: 'MKT-KENDAL', tanggal: '',
    approval: 'Submitted', tglApproval: '', ket: '',
    data: Object.fromEntries(t.data.map((d) => [d.k, ''])),
    lampiran: t.lampiran.map((judul) => ({ judul, foto: [] })),
    ...x,
  };
}

const str = (v: unknown, n = 2000) => (typeof v === 'string' ? v.slice(0, n) : '');
export function rapikanSurat(x: unknown): Surat {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const t = templateSurat(str(o.template, 40));
  const d = (o.data && typeof o.data === 'object' ? o.data : {}) as Record<string, unknown>;
  const lamp = Array.isArray(o.lampiran) ? o.lampiran : [];
  const lampiran: LampiranSurat[] = lamp.slice(0, 20).map((l) => {
    const y = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
    const foto = (Array.isArray(y.foto) ? y.foto : []).slice(0, 30).map((f) => {
      const z = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
      return { id: str(z.id, 120), ket: str(z.ket, 200) };
    }).filter((f) => /^[A-Za-z0-9_-]+$/.test(f.id));
    return { judul: str(y.judul, 300), foto };
  });
  t.lampiran.forEach((judul, i) => { if (!lampiran[i]) lampiran[i] = { judul, foto: [] }; else lampiran[i].judul = judul; });
  return {
    id: str(o.id, 80), dibuat: str(o.dibuat, 40), diubah: str(o.diubah, 40), oleh: str(o.oleh, 120),
    template: t.id,
    judul: str(o.judul, 200) || t.judul,
    perihal: str(o.perihal, 300), perihalOtomatis: o.perihalOtomatis !== false,
    noUrut: str(o.noUrut, 20), kode: str(o.kode, 60) || 'MKT-KENDAL', tanggal: /^\d{4}-\d{2}-\d{2}$/.test(str(o.tanggal)) ? str(o.tanggal) : '',
    approval: typeof o.approval === 'string' ? str(o.approval, 60) : 'Submitted', tglApproval: str(o.tglApproval, 40), ket: str(o.ket, 300),
    data: Object.fromEntries(t.data.map((f) => [f.k, str(d[f.k], 300)])),
    lampiran,
  };
}

export const namaFileSurat = (s: Surat) =>
  `IM ${templateSurat(s.template).nama.replace(/^IM /, '')} - ${(s.data.nama || 'tanpa nama').trim().toUpperCase()}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Nomor urut berikutnya: terbesar di daftar + 1 (sebagai saran, tetap bisa diubah). */
export function noUrutBerikut(list: Surat[]): string {
  const n = Math.max(0, ...list.map((s) => parseInt(s.noUrut, 10)).filter((x) => Number.isFinite(x)));
  return n ? String(n + 1) : '';
}
