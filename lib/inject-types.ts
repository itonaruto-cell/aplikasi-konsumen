// Inject P3: daftar konsumen yang diajukan staff untuk di-inject, dikumpulkan per bulan lalu diunduh owner untuk HO.
// Dipakai bersama oleh server (app/api/inject) dan halaman (app/performa/Inject.tsx).

export const KET_BAWAAN = 'INJECT P3';
// Urutan kolom persis seperti format yang diminta HO
export const KOLOM_HO = ['NAMA CABANG', 'NAMA KONSUMEN', 'NO KONTRAK', 'CUST NO', 'KECAMATAN', 'KETERANGAN'] as const;

// Satu konsumen hasil pencarian di database konsumen (tanpa nomor HP dan alamat)
export type Calon = {
  nama: string;
  kontrak: string;    // nomor kontrak (kolom ORDER_NO)
  cust: string;       // nomor customer (kolom ID CUST)
  kecamatan: string;
  kelurahan: string;
  unit: string;
};

export type Inject = {
  id: string;
  bulan: string;      // YYYY-MM
  cabang: string;
  konsumen: string;
  kontrak: string;
  cust: string;
  kecamatan: string;
  ket: string;
  oleh: string;       // nama staff yang mengajukan
  dibuat: string;     // ISO
  sumber: 'database' | 'manual';
  punyaku: boolean;   // diajukan oleh akun yang sedang login
};

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const bulanLabel = (ym: string) => `${BULAN[Number(ym.slice(5, 7)) - 1] || ''} ${ym.slice(0, 4)}`.trim();

export const barisHO = (x: Inject): string[] => [x.cabang, x.konsumen, x.kontrak, x.cust, x.kecamatan, x.ket];
// Yang masih perlu dilengkapi sebelum dikirim ke HO
export const kurang = (x: Pick<Inject, 'kontrak' | 'cust' | 'kecamatan'>): string[] =>
  [!x.kontrak && 'No kontrak', !x.cust && 'Cust no', !x.kecamatan && 'Kecamatan'].filter(Boolean) as string[];
