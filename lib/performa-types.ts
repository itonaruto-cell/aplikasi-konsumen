// Bentuk data performa yang dikirim Apps Script: angka, daftar MA, dan daftar konsumen prioritas
// beserta riwayat visit (tanpa no kontrak / no HP / alamat / no ref MA).
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
// b + i = posisi konsumen di aktivitas.konsumen[b][i] (untuk detail)
export type KonsumenVisit = { n: string; k: string; p: number; v: number; m: boolean; ke: number; b?: string; i?: number };
// MA yang dipegang: n = nama, f = frekuensi maintain bulan ini, t = terakhir tercatat, job = pekerjaan
// b + i = posisi MA di aktivitas.ma[b][i] (untuk detail)
export type MaItem = { n: string; f: number; t: string; job: string; b?: string; i?: number };

// Satu visit: ke = visit ke-, st = status, bd = bertemu dengan, h = hasil, kt = keterangan
export type VisitRow = { ke: number; tgl: string; st: string; bd: string; h: string; kt: string; pic: string; note: string };
// Konsumen prioritas lengkap: n = nama, k = kecamatan, p = prioritas, ket = kategori/keterangan,
// info/pen = info & penawaran produk WOM, inj = tanggal inject, v = riwayat visit
export type KonsumenFull = { n: string; k: string; p: number; ket: string; info: string; pen: string; inj: string; v: VisitRow[] };
// MA lengkap: job = pekerjaan, cat = kategori, f = frekuensi, tgl = tanggal maintain tercatat,
// t = terakhir, pic = MAO pemegang, inj = tanggal inject, sales = sales M-1
export type MaFull = {
  n: string; job: string; cat: string; reason: string; f: number; tgl: string[]; t: string;
  pic: string; inj: string; hasil: string; sales: number | null;
};

export type Aktivitas = {
  visit: Record<string, Record<'p1' | 'p2' | 'p3', { database: number; tervisit: number; ditemui: number }>>;
  maintain: Record<string, { ma: number; sudah: number; belum: number }>;
  rekrut?: Record<string, RekrutRegist>;
  konsumen?: Record<string, KonsumenFull[]>;
  ma?: Record<string, MaFull[]>;
};

export type Performa = {
  cabang: string;
  updated: string | null;   // tanggal "UPDATE PER" di sheet
  dikirim: string;          // waktu kiriman terakhir dari Apps Script (ISO)
  bulan: { lalu: string; ini: string };
  cabangTotal: { unit: Sales | null; amount: Sales | null; oi: OrderIn | null };
  aktivitas?: Aktivitas;   // ringkasan cabang (motorku & mobilku)
  orang: Orang[];
  riwayat?: Riwayat;       // ditambahkan server: urutan peringkat hari sebelumnya (untuk panah naik/turun)
};

// Urutan nama (huruf besar) per ukuran peringkat, bulan berjalan
export type Metric = 'amount' | 'unit' | 'visit' | 'bertemu' | 'maintain';
export type Peringkat = Partial<Record<Metric, string[]>>;
export type Riwayat = { kemarin?: { tgl: string; rank: Peringkat } };
