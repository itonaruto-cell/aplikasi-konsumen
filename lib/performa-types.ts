// Bentuk data performa yang dikirim Apps Script: angka, plus daftar nama MA dan
// nama + kecamatan konsumen prioritas yang dikunjungi (tanpa no kontrak / no HP / alamat).
// Dipakai bersama oleh server (lib/performa.ts) dan halaman (app/PerformaPanel.tsx).

export type Sales = {
  lalu: number | null; ini: number | null; target: number | null;
  ach: number | null; diffLalu: number | null; diffTarget: number | null;
};

export type OrderIn = {
  cancel?: number | null; reject?: number | null; pending?: number | null; poPending?: number | null;
  golive: number | null; total: number | null; successRate: number | null;
  target: number | null; ach: number | null;
};

export type Orang = {
  nama: string;
  brand: string;
  unit?: Sales;
  amount?: Sales;
  oi?: OrderIn;
  approval?: { approve: number | null; banding: number | null; reject: number | null; cancel: number | null; total: number | null };
  visit?: {
    total: number; bertemu: number; konsumen: number; ditemui: number; p1: number; p2: number; p3: number;
    list?: KonsumenVisit[];
  };
  maintain?: { ma: number; sudah: number; belum: number; x2: number; x3: number; x4: number; list?: MaItem[] };
  rekrut?: RekrutRegist;   // hanya untuk MAO (pemegang MA), angka brand-nya
};

export type Target = { jumlah: number; target: number | null };
export type RekrutRegist = { rekrut: Target | null; regist: Target | null };

// Konsumen yang dikunjungi orang ini: n = nama, k = kecamatan, p = prioritas, v = jumlah visit,
// m = sudah ditemui, ke = ditemui di visit ke berapa
export type KonsumenVisit = { n: string; k: string; p: number; v: number; m: boolean; ke: number };
// MA yang dipegang: n = nama, f = frekuensi maintain bulan ini, t = terakhir tercatat, job = pekerjaan
export type MaItem = { n: string; f: number; t: string; job: string };

export type Aktivitas = {
  visit: Record<string, Record<'p1' | 'p2' | 'p3', { database: number; tervisit: number; ditemui: number }>>;
  maintain: Record<string, { ma: number; sudah: number; belum: number }>;
  rekrut?: Record<string, RekrutRegist>;
};

export type Performa = {
  cabang: string;
  updated: string | null;   // tanggal "UPDATE PER" di sheet
  dikirim: string;          // waktu kiriman terakhir dari Apps Script (ISO)
  bulan: { lalu: string; ini: string };
  cabangTotal: { unit: Sales | null; amount: Sales | null; oi: OrderIn | null };
  aktivitas?: Aktivitas;   // ringkasan cabang (motorku & mobilku)
  orang: Orang[];
};
