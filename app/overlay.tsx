'use client';
import { createContext, useContext, useEffect, useRef } from 'react';

// Supaya tombol kembali Android menutup panel/lembar yang sedang terbuka lebih dulu.
// Aplikasi (PerformaPanel) menyediakan fungsi pendaftar; komponen yang membuka lembar memanggil useOverlay.
type Register = (close: () => void) => () => void;
export const OverlayCtx = createContext<Register | null>(null);
// Halaman sebelumnya tetap hidup (tersembunyi) supaya kembali terasa instan; lembar di halaman tersembunyi
// tidak boleh ikut ditutup tombol kembali, jadi hanya didaftarkan selama halamannya tampil.
export const AktifCtx = createContext(true);

export function useOverlay(open: boolean, close: () => void) {
  const register = useContext(OverlayCtx);
  const aktif = useContext(AktifCtx);
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!open || !aktif || !register) return;
    return register(() => ref.current());
  }, [open, aktif, register]);
}
