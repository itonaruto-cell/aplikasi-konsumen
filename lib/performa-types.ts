// Bentuk data performa yang dikirim Apps Script (hanya angka, tanpa data konsumen).
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
  visit?: { total: number; bertemu: number; konsumen: number; ditemui: number; p1: number; p2: number; p3: number };
  maintain?: { ma: number; sudah: number; belum: number; x2: number; x3: number; x4: number };
};

export type Performa = {
  cabang: string;
  updated: string | null;   // tanggal "UPDATE PER" di sheet
  dikirim: string;          // waktu kiriman terakhir dari Apps Script (ISO)
  bulan: { lalu: string; ini: string };
  cabangTotal: { unit: Sales | null; amount: Sales | null; oi: OrderIn | null };
  orang: Orang[];
};
