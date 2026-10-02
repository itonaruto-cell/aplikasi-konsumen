// Bahan survey: daftar konsumen yang rencana disurvey / sudah disurvey, per staff.
// Dipakai bersama oleh server (app/api/bahan) dan halaman (app/performa/Bahan.tsx).

export const SUMBER = ['Agent', 'Telesales', 'Booking mandiri', 'Lainnya'] as const;
export type Sumber = (typeof SUMBER)[number];
export type StatusBahan = 'aktif' | 'cair' | 'batal';

export type Bahan = {
  id: string;
  email: string;      // pemilik bahan (staff)
  nama: string;       // nama staff seperti di pantauan
  konsumen: string;
  nominal: number;    // nominal pencairan (rupiah)
  sumber: Sumber;
  ket: string;        // nama agent, atau sumber lain yang ditulis sendiri
  step: string;       // posisi terakhir, diisi bebas
  status: StatusBahan;
  dibuat: string;     // ISO
  diubah: string;     // ISO
};
