// Simpanan kecil di HP supaya aplikasi langsung tampil saat dibuka (data terakhir dulu, lalu diperbarui).
// Hanya akun & data performa; dihapus saat keluar (halaman login) atau saat sesi habis.
export const KUNCI_AKUN = 'mk-cache-akun';
export const KUNCI_PERFORMA = 'mk-cache-performa';

export function bacaCache<T>(kunci: string, email?: string): T | null {
  try {
    const s = localStorage.getItem(kunci);
    if (!s) return null;
    const x = JSON.parse(s) as { email?: string; data: T };
    if (email && x.email !== email) return null;
    return x.data ?? null;
  } catch { return null; }
}
export function simpanCache(kunci: string, data: unknown, email?: string) {
  try { localStorage.setItem(kunci, JSON.stringify({ email, t: Date.now(), data })); } catch { /* penuh / diblokir: abaikan */ }
}
export function hapusCache() {
  try { localStorage.removeItem(KUNCI_AKUN); localStorage.removeItem(KUNCI_PERFORMA); } catch { /* abaikan */ }
}

// Data performa mulai diambil bersamaan dengan data akun (tidak menunggu bergantian)
let awal: Promise<Response> | null = null;
export function mulaiAmbilPerforma() { if (!awal && typeof window !== 'undefined') awal = fetch('/api/performa', { cache: 'no-store' }); }
export function ambilPerformaAwal(): Promise<Response> | null { const p = awal; awal = null; return p; }
