'use client';
import { createContext, useContext, useEffect, useRef } from 'react';

// Supaya tombol kembali Android menutup panel/lembar yang sedang terbuka lebih dulu.
// Aplikasi (PerformaPanel) menyediakan fungsi pendaftar; komponen yang membuka lembar memanggil useOverlay.
type Register = (close: () => void) => () => void;
export const OverlayCtx = createContext<Register | null>(null);

export function useOverlay(open: boolean, close: () => void) {
  const register = useContext(OverlayCtx);
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!open || !register) return;
    return register(() => ref.current());
  }, [open, register]);
}
