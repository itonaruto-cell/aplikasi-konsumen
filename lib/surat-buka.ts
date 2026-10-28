// Penanda surat yang sedang terbuka (dibaca saat aplikasi dibuka ulang), dipisah dari halaman Surat supaya ringan.
export const KUNCI_SURAT_BUKA = 'surat-buka';
export const suratTerbuka = (): { id: string; t: number } | null => {
  try {
    const s = localStorage.getItem(KUNCI_SURAT_BUKA);
    const x = s ? JSON.parse(s) as { id: string; t: number } : null;
    return x && Date.now() - x.t < 12 * 3_600_000 ? x : null;
  } catch { return null; }
};
