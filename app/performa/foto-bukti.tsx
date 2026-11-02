'use client';
import { useState } from 'react';
import { Ico } from './parts';
import { useOverlay } from '../overlay';

/* ---------- Foto bukti ---------- */
// Foto diperkecil di HP (sisi terpanjang maks. 1000 px, JPEG) supaya muat disimpan di tab FOTO (maks. ±130 KB).
const MAKS_B64 = 175_000;
export async function kecilkanFoto(file: File): Promise<{ mime: string; data: string; url: string }> {
  const url = URL.createObjectURL(file);
  try {
    // createImageBitmap lebih hemat memori untuk foto kamera besar; <img> sebagai cadangan
    let img: CanvasImageSource, w = 0, h = 0;
    try {
      const bm = await createImageBitmap(file);
      img = bm; w = bm.width; h = bm.height;
    } catch {
      const i = await new Promise<HTMLImageElement>((ok, no) => { const x = new Image(); x.onload = () => ok(x); x.onerror = no; x.src = url; });
      img = i; w = i.naturalWidth; h = i.naturalHeight;
    }
    if (!w || !h) throw new Error('rusak');
    for (const [sisi, q] of [[1000, 0.72], [900, 0.6], [760, 0.55], [640, 0.5], [520, 0.45]] as const) {
      const k = Math.min(1, sisi / Math.max(w, h));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      const g = cv.getContext('2d');
      if (!g) break;
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      const dataUrl = cv.toDataURL('image/jpeg', q);
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
      if (data.length <= MAKS_B64) return { mime: 'image/jpeg', data, url: dataUrl };
    }
    throw new Error('besar');
  } finally { URL.revokeObjectURL(url); }
}

export function FotoBukti({ id, nama }: { id: string; nama: string }) {
  const [besar, setBesar] = useState(false);
  const [gagal, setGagal] = useState(false);
  useOverlay(besar, () => setBesar(false));
  if (!id || gagal) return null;
  const src = `/api/foto/${encodeURIComponent(id)}`;
  return (
    <>
      <button onClick={() => setBesar(true)} aria-label={`Lihat foto bukti follow up ${nama}`}
        className="flex items-center gap-1.5 rounded-full bg-green-50 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-green-800 dark:bg-green-400/15 dark:text-green-300">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" onError={() => setGagal(true)} className="h-6 w-6 rounded-full object-cover" />
        Bukti FU
      </button>
      {besar && (
        <div role="dialog" aria-label={`Foto bukti ${nama}`} className="fixed inset-0 z-[70] flex flex-col bg-black/95" onClick={() => setBesar(false)}>
          <div className="flex justify-end p-2 pt-[calc(env(safe-area-inset-top)+8px)]">
            <button onClick={() => setBesar(false)} aria-label="Tutup foto" className="flex h-12 w-12 items-center justify-center text-white"><Ico n="x" className="h-6 w-6" sw={2} /></button>
          </div>
          <div className="flex flex-1 items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Foto bukti ${nama}`} className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

