// Draf form banding di HP (localStorage), supaya isian tidak hilang saat pindah ke WA/aplikasi lain.
// Android sering mematikan tab di latar belakang; saat kembali halaman dimuat ulang dari awal.
import type { Banding } from './banding-types';

const KUNCI_DRAF = 'banding-draf:';
const KUNCI_BUKA = 'banding-buka';
const UMUR_DRAF = 7 * 86_400_000;
const UMUR_BUKA = 12 * 3_600_000;

export type Draf = { t: number; b: Banding; idBaru?: string };
export type Buka = { id: string; lembar: 'form' | 'wa'; t: number };

const baca = <T,>(k: string): T | null => {
  try { const s = localStorage.getItem(k); return s ? (JSON.parse(s) as T) : null; } catch { return null; }
};
const tulis = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* penyimpanan penuh/diblokir */ } };
const buang = (k: string) => { try { localStorage.removeItem(k); } catch { /* abaikan */ } };

/** Kunci draf: id form, atau 'baru' untuk form yang belum pernah tersimpan. */
export const kunciDraf = (id: string) => KUNCI_DRAF + (id || 'baru');

export function simpanDraf(id: string, b: Banding, idBaru?: string) { tulis(kunciDraf(id), { t: Date.now(), b, idBaru } satisfies Draf); }
export function hapusDraf(id: string) { buang(kunciDraf(id)); }

export function ambilDraf(id: string): Draf | null {
  const d = baca<Draf>(kunciDraf(id));
  if (!d || !d.b || typeof d.t !== 'number' || Date.now() - d.t > UMUR_DRAF) return null;
  return d;
}

/**
 * Draf dipakai hanya bila dibuat dari versi server yang sama (diubah sama) — berarti ada
 * isian yang belum sempat terkirim. Kalau server lebih baru (sudah tersimpan), pakai server.
 */
export function pilihAwal(server: Banding, d: Draf | null): { b: Banding; dariDraf: boolean } {
  if (!d) return { b: server, dariDraf: false };
  if (!server.id) return { b: d.b, dariDraf: true };
  if (d.b.id === server.id && (d.b.diubah || '') === (server.diubah || '')) return { b: d.b, dariDraf: true };
  return { b: server, dariDraf: false };
}

export function tandaiBuka(id: string, lembar: 'form' | 'wa') { tulis(KUNCI_BUKA, { id, lembar, t: Date.now() } satisfies Buka); }
export function lepasBuka() { buang(KUNCI_BUKA); }
export function bacaBuka(): Buka | null {
  const x = baca<Buka>(KUNCI_BUKA);
  if (!x || typeof x.t !== 'number' || Date.now() - x.t > UMUR_BUKA) return null;
  return x;
}

/** Bersihkan draf yang sudah kedaluwarsa. */
export function rapikanDraf() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(KUNCI_DRAF) && !ambilDraf(k.slice(KUNCI_DRAF.length))) localStorage.removeItem(k);
    }
  } catch { /* abaikan */ }
}

export const idBandingBaru = () => `bdg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`;
export const idSah = (id: string) => /^bdg_[a-z0-9]{6,12}_[a-z0-9-]{6,12}$/i.test(id);
