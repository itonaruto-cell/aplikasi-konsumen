// Insentif hasil hitungan HO (dari sheet monitoring insentif), per orang.
// Datanya TIDAK ditulis di kode: disimpan sebagai JSON di Environment Variable INSENTIF_HO di Vercel
// dan dikirim lewat /api/insentif/ho. Staff hanya menerima barisnya sendiri; owner menerima semua.
// Bentuknya sengaja umum (kelompok label + nilai yang sudah berupa teks), supaya sheet bulan berikutnya
// yang kolomnya berbeda tetap bisa ditampilkan tanpa mengubah aplikasi.

import { keyOf } from './performa-calc';

export type KelompokHO = { judul: string; isi: [string, string][] };
export type LainHO = { label: string; nilai: number; ket?: string };   // dibayar terpisah, mis. bonus booking mandiri
export type OrangHO = {
  nama: string;
  peran: string;          // BMH / CMO / MAO
  total: number;          // grand final insentif (rupiah)
  ringkas: string;        // satu baris pencapaian
  grup: KelompokHO[];
  lain?: LainHO[];
};
export type InsentifHO = { bulan: string; sumber: string; diambil: string; orang: OrangHO[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const teks = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

export function parseHO(text: string | undefined | null): InsentifHO | null {
  if (!text) return null;
  try {
    const j: unknown = JSON.parse(text);
    if (!isObj(j) || !Array.isArray(j.orang)) return null;
    const orang: OrangHO[] = j.orang.filter(isObj).map((o) => ({
      nama: teks(o.nama), peran: teks(o.peran), total: Number(o.total) || 0, ringkas: teks(o.ringkas),
      grup: (Array.isArray(o.grup) ? o.grup : []).filter(isObj).map((g) => ({
        judul: teks(g.judul),
        isi: (Array.isArray(g.isi) ? g.isi : []).filter((x): x is unknown[] => Array.isArray(x) && x.length >= 2).map((x) => [teks(x[0]), teks(x[1])] as [string, string]),
      })),
      lain: (Array.isArray(o.lain) ? o.lain : []).filter(isObj).map((l) => ({ label: teks(l.label), nilai: Number(l.nilai) || 0, ket: teks(l.ket) || undefined })),
    })).filter((o) => o.nama);
    return orang.length ? { bulan: teks(j.bulan), sumber: teks(j.sumber), diambil: teks(j.diambil), orang } : null;
  } catch {
    return null;
  }
}

// Cocokkan satu nama ke daftar HO secara ketat: semua kata (3 huruf ke atas) dari nama yang lebih pendek
// harus ada di nama yang lebih panjang, dan hanya boleh cocok ke satu orang. Nama yang cocok ke dua orang
// (mis. hanya "Muhammad") tidak dianggap cocok, supaya insentif orang lain tidak pernah ikut terkirim.
const kata = (s: string) => keyOf(s).replace(/[^A-Z ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
export function cocokHO<T extends { nama: string }>(list: T[], nama: string | null | undefined): T | null {
  const a = kata(nama || '');
  if (!a.length) return null;
  const hit = list.filter((o) => {
    const b = kata(o.nama);
    return b.length > 0 && (a.every((w) => b.includes(w)) || b.every((w) => a.includes(w)));
  });
  return hit.length === 1 ? hit[0] : null;
}
