'use client';
import { useEffect, useRef, useState } from 'react';
import type { Orang } from '../../lib/performa-types';
import type { Ctx } from '../../lib/performa-calc';
import { gambarAchievement, gambarAktivitas, pakaiFont, tinggiAchievement, tinggiAktivitas } from './laporan-gambar';
import { useOverlay } from '../overlay';
import { PillSeg } from './parts';

// Laporan bergambar: achievement (cabang, Mobilku, Motorku) dan aktivitas CMO & MAO.
// Gambar dibuat di HP dari data pantauan terakhir, bisa diunduh (PNG), dibagikan, atau dibuka layar penuh
// supaya gampang di-screenshot.

type Jenis = 'achievement' | 'aktivitas';
const JUDUL: Record<Jenis, string> = { achievement: 'Achievement', aktivitas: 'Aktivitas CMO & MAO' };

const muatGambar = (src: string) => new Promise<HTMLImageElement | null>((ok) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => ok(null);
  img.src = src;
});

async function buatGambar(jenis: Jenis, c: Ctx, spv: Orang | null): Promise<Blob | null> {
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-instrument').trim();
  if (fam) {
    pakaiFont(`${fam}, system-ui, sans-serif`);
    try { await Promise.all([400, 600, 700].map((w) => document.fonts.load(`${w} 40px ${fam}`))); } catch { /* pakai font cadangan */ }
  }
  const logo = await muatGambar('/icon-192.png');
  const cv = document.createElement('canvas');
  cv.width = 1080;
  cv.height = jenis === 'achievement' ? tinggiAchievement(c, spv) : tinggiAktivitas(c, spv);
  const g = cv.getContext('2d');
  if (!g) return null;
  if (jenis === 'achievement') gambarAchievement(g, c, spv, logo);
  else gambarAktivitas(g, c, spv, logo);
  return new Promise((ok) => cv.toBlob((b) => ok(b), 'image/png'));
}

function LayarPenuh({ url, onClose }: { url: string; onClose: () => void }) {
  useOverlay(true, onClose);
  const [petunjuk, setPetunjuk] = useState(true);
  useEffect(() => { const t = setTimeout(() => setPetunjuk(false), 2500); return () => clearTimeout(t); }, []);
  return (
    <button onClick={onClose} aria-label="Tutup layar penuh"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#F4F2EE] p-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Laporan" className="max-h-full max-w-full object-contain" />
      {petunjuk && (
        <span className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+24px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900/85 px-4 py-2 text-sm font-semibold text-white">
          Siap di-screenshot · ketuk untuk menutup
        </span>
      )}
    </button>
  );
}

export default function Laporan({ c, spv }: { c: Ctx; spv: Orang | null }) {
  const [jenis, setJenis] = useState<Jenis>('achievement');
  const [gambar, setGambar] = useState<{ jenis: Jenis; url: string; blob: Blob } | null>(null);
  const [err, setErr] = useState('');
  const [penuh, setPenuh] = useState(false);
  const [toast, setToast] = useState('');
  const urlLama = useRef('');

  useEffect(() => {
    let alive = true;
    setErr('');
    buatGambar(jenis, c, spv).then((blob) => {
      if (!alive) return;
      if (!blob) { setErr('Gambar tidak bisa dibuat di HP ini.'); return; }
      const url = URL.createObjectURL(blob);
      if (urlLama.current) URL.revokeObjectURL(urlLama.current);
      urlLama.current = url;
      setGambar({ jenis, url, blob });
    }).catch(() => { if (alive) setErr('Gambar tidak bisa dibuat. Coba muat ulang.'); });
    return () => { alive = false; };
  }, [jenis, c, spv]);
  useEffect(() => () => { if (urlLama.current) URL.revokeObjectURL(urlLama.current); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);

  const siap = gambar && gambar.jenis === jenis ? gambar : null;
  const namaFile = `Laporan ${JUDUL[jenis]} ${String(c.data.cabang || 'Kendal')} ${c.today}.png`.replace(/[^\w\s.&-]/g, '').replace(/\s+/g, '-');
  const bisaBagikan = typeof navigator !== 'undefined' && !!navigator.canShare && !!siap
    && navigator.canShare({ files: [new File([siap.blob], namaFile, { type: 'image/png' })] });
  const bagikan = async () => {
    if (!siap) return;
    try {
      await navigator.share({ files: [new File([siap.blob], namaFile, { type: 'image/png' })], title: `Laporan ${JUDUL[jenis]}` });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setToast('Gagal membagikan. Pakai Unduh gambar.');
    }
  };

  return (
    <div className="pb-8">
      <div className="px-4 pt-3">
        <PillSeg value={jenis} full onChange={(v) => setJenis(v)} options={[['achievement', 'Achievement'], ['aktivitas', 'Aktivitas CMO & MAO']]} />
      </div>
      <p className="px-4 pt-3 text-[13px] leading-snug text-neutral-500">
        {jenis === 'achievement'
          ? 'Cabang, Mobilku, dan Motorku beserta pencapaian tiap PIC.'
          : 'Visit konsumen prioritas P1–P3, maintain MA, rekrut, dan regist per orang.'}
        {' '}Dibuat dari data pantauan terakhir.
      </p>

      <div className="mx-4 mt-3 overflow-hidden rounded-[20px] border border-neutral-200 bg-[#F4F2EE] dark:border-neutral-800">
        {err ? (
          <p className="p-6 text-center text-sm text-red-700 dark:text-red-400">{err}</p>
        ) : siap ? (
          <button onClick={() => setPenuh(true)} aria-label="Buka layar penuh" className="block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={siap.url} alt={`Laporan ${JUDUL[jenis]}`} className="block w-full" />
          </button>
        ) : (
          <div aria-label="Membuat gambar" className="aspect-[1080/1600] w-full animate-pulse bg-neutral-200/70 dark:bg-neutral-800/70" />
        )}
      </div>

      <div className="mt-3 grid gap-2 px-4">
        <a href={siap?.url} download={namaFile} aria-disabled={!siap}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white dark:bg-white dark:text-neutral-900 ${siap ? '' : 'pointer-events-none opacity-50'}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" /></svg>
          Unduh gambar
        </a>
        <div className={`grid gap-2 ${bisaBagikan ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {bisaBagikan && (
            <button onClick={bagikan} className="min-h-12 rounded-2xl bg-[#0F8048] text-[15px] font-bold text-white">Bagikan (WhatsApp)</button>
          )}
          <button onClick={() => setPenuh(true)} disabled={!siap}
            className="min-h-12 rounded-2xl border border-neutral-300 text-[15px] font-semibold disabled:opacity-50 dark:border-neutral-700">
            Layar penuh untuk screenshot
          </button>
        </div>
      </div>

      {penuh && siap && <LayarPenuh url={siap.url} onClose={() => setPenuh(false)} />}
      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center px-5">
          <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">{toast}</div>
        </div>
      )}
    </div>
  );
}
