'use client';
// Cara menyimpan hasil PDF di HP: "Bagikan" (menu bagikan, mis. WhatsApp) atau "Unduh ke HP" (langsung ke folder Unduhan).
// Pilihan disimpan di perangkat ini dan dipakai oleh Alat PDF, PDF survey, dan gabung mutasi.
import { useEffect, useState } from 'react';

export type CaraSimpan = 'bagi' | 'unduh';
const KUNCI_CARA = 'pdf-cara-simpan';
// Pilihan disimpan di HP ini. "bagi" = menu bagikan (WhatsApp, dll.), "unduh" = langsung masuk ke folder Unduhan
export function bacaCaraSimpan(): CaraSimpan {
  try { return localStorage.getItem(KUNCI_CARA) === 'unduh' ? 'unduh' : 'bagi'; } catch { return 'bagi'; }
}
function simpanCaraSimpan(v: CaraSimpan) { try { localStorage.setItem(KUNCI_CARA, v); } catch { /* penyimpanan dimatikan: pilihan berlaku sampai halaman ditutup */ } }

export function PilihCaraSimpan() {
  const [cara, setCara] = useState<CaraSimpan>('bagi');
  useEffect(() => { setCara(bacaCaraSimpan()); }, []);
  const pilih = (v: CaraSimpan) => { setCara(v); simpanCaraSimpan(v); };
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <span className="text-neutral-500 dark:text-neutral-400">Setelah jadi:</span>
      <div role="radiogroup" aria-label="Cara simpan PDF" className="flex rounded-xl bg-neutral-100 p-0.5 dark:bg-neutral-900">
        {(['bagi', 'unduh'] as const).map((v) => (
          <button key={v} role="radio" aria-checked={cara === v} onClick={() => pilih(v)}
            className={`min-h-9 rounded-[10px] px-3 font-semibold ${cara === v ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white' : 'text-neutral-500 dark:text-neutral-400'}`}>
            {v === 'bagi' ? 'Bagikan' : 'Unduh ke HP'}
          </button>
        ))}
      </div>
    </div>
  );
}

export async function kirimFile(files: File[]) {
  if (bacaCaraSimpan() === 'bagi' && navigator.canShare?.({ files })) {
    try { await navigator.share({ files }); return; } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
    await new Promise((r) => setTimeout(r, 400));
  }
}
