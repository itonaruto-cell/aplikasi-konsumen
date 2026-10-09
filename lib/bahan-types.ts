// Bahan survey: daftar konsumen yang rencana disurvey / sudah disurvey, per staff.
// Dipakai bersama oleh server (app/api/bahan) dan halaman (app/performa/Bahan.tsx).

export const SUMBER = ['Agent', 'Telesales', 'Booking mandiri', 'Lainnya'] as const;
export type Sumber = (typeof SUMBER)[number];
export type StatusBahan = 'aktif' | 'cair' | 'batal';
// Tahap bahan yang masih aktif: belum disurvey (bahan survey) atau sudah disurvey dan sedang diproses
export const TAHAP = ['survey', 'proses'] as const;
export type Tahap = (typeof TAHAP)[number];
export const TAHAP_LABEL: Record<Tahap, string> = { survey: 'Bahan survey', proses: 'Sedang diproses' };
// Bahan lama (sebelum ada kolom TAHAP) ditebak dari isi step-nya
export const tebakTahap = (step: string): Tahap =>
  /(sudah|habis|selesai)\s*(di)?survey|approv|banding|map\b|pencairan|proses|akad|\bpo\b|tinggal\s*(melengkapi|dokumen|submit)/i.test(step || '') ? 'proses' : 'survey';
export const tahapOf = (b: { tahap?: Tahap; step: string }): Tahap => b.tahap || tebakTahap(b.step);

export type Bahan = {
  id: string;
  email: string;      // pemilik bahan (staff)
  nama: string;       // nama staff seperti di pantauan
  konsumen: string;
  nominal: number;    // nominal pencairan (rupiah)
  sumber: Sumber;
  ket: string;        // nama agent, atau sumber lain yang ditulis sendiri
  agg: boolean;       // sumber Agent: MA aggregator (bukan MA retail). Menentukan hitungan insentif MAO
  step: string;       // posisi terakhir, diisi bebas
  pic: string;        // PIC survey: nama staff seperti di pantauan (boleh kosong)
  status: StatusBahan;
  tahap: Tahap;       // berlaku selama status aktif
  dibuat: string;     // ISO
  diubah: string;     // ISO
};
