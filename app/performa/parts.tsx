'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { Orang } from '../../lib/performa-types';
import type { RankRow } from '../../lib/performa-calc';
import { initials, nama, persen, angka, rp } from './ui';
import { useOverlay } from '../overlay';

/* ---------- Ikon garis (tanpa library) ---------- */
const P: Record<string, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" />,
  chart: (<><path d="M4 20h16" /><path d="M7 16v-5m5 5V6m5 10v-8" /></>),
  car: (<><path d="M3 16v-3.5l2-5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5l2 5V16h-2" /><path d="M3 12.5h18M8.5 16h7" /><circle cx="6.5" cy="16.5" r="1.8" /><circle cx="17.5" cy="16.5" r="1.8" /></>),
  trophy: (<><path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>),
  pin: (<><circle cx="12" cy="11" r="3" /><path d="M17.7 16.7 13.4 21a2 2 0 0 1-2.8 0l-4.3-4.3a8 8 0 1 1 11.3 0z" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M5 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  refresh: <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />,
  flame: <path d="M12 22c4 0 7-2.8 7-7 0-4.5-4-7-5-11-2 2-3 4-3 6-1-1-1.5-2-1.7-3C7 9 5 11.5 5 15c0 4.2 3 7 7 7z" />,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  right: <path d="m9 6 6 6-6 6" />,
  left: <path d="m15 6-6 6 6 6" />,
  check: <path d="m5 12 5 5L20 7" />,
  edit: (<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>),
  list: (<><path d="M10 6h10M10 12h10M10 18h10" /><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17" /></>),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  lock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  users: (<><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 11l2 2 4-4" /></>),
  logout: <path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2M9 12h12l-3-3m0 6 3-3" />,
  map: (<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14m6-12v14" /></>),
  share: (<><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5" /></>),
};

export function Ico({ n, className = 'h-5 w-5', fill = 'none', sw = 1.9 }: { n: string; className?: string; fill?: string; sw?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[n]}
    </svg>
  );
}

/* ---------- Nama pendek: "MUHAMMAD NAUFAL RAFLI" → "Naufal" ---------- */
const SKIP = new Set(['MUHAMMAD', 'MUHAMAD', 'MOHAMMAD', 'MOHAMAD', 'MOCH', 'MOCH.', 'MOH', 'MOH.', 'M', 'M.', 'MUH', 'MUH.']);
export const shortName = (n: string) => {
  const w = String(n || '').trim().split(/\s+/);
  return nama(w.find((x) => !SKIP.has(x.toUpperCase())) || w[0] || '');
};
export const twoNames = (n: string) => {
  const w = String(n || '').trim().split(/\s+/).filter((x) => !SKIP.has(x.toUpperCase()));
  return nama(w.slice(0, 2).join(' '));
};
export const niceInitials = (n: string) => initials(String(n || '').split(/\s+/).filter((x) => !SKIP.has(x.toUpperCase())).join(' ') || n);

/* ---------- Avatar ---------- */
export function Avatar({ o, size = 40, className = '' }: { o: Pick<Orang, 'nama'>; size?: number; className?: string }) {
  return (
    <span style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-neutral-200 font-bold text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100 ${className}`}>
      {niceInitials(o.nama)}
    </span>
  );
}

/* ---------- Bar netral (terisi pelan saat pertama tampil) ---------- */
export function Line({ v, className = 'h-1.5', color = 'bg-neutral-900 dark:bg-white', track = 'bg-neutral-200/80 dark:bg-neutral-800' }: {
  v: number | null | undefined; className?: string; color?: string; track?: string;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t); }, []);
  const w = typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(100, v * 100)) : 0;
  return (
    <div className={`${className} w-full overflow-hidden rounded-full ${track}`}>
      <div className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out motion-reduce:transition-none`} style={{ width: `${on ? w : 0}%` }} />
    </div>
  );
}

/* ---------- Angka menghitung naik ---------- */
export function useCountUp(target: number, ms = 800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!isFinite(target)) { setV(target); return; }
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
export function CountPct({ v }: { v: number | null | undefined }) {
  const n = useCountUp(typeof v === 'number' && isFinite(v) ? Math.round(v * 100) : 0);
  return <>{typeof v === 'number' && isFinite(v) ? `${Math.round(n)}%` : '–'}</>;
}

/* ---------- Warna & gambar brand ---------- */
export type BrandId = 'mobilku' | 'motorku';
export const BRAND: Record<BrandId, { label: string; hex: [string, string]; bg: string; grad: string; soft: string; text: string; ring: string; line: string }> = {
  mobilku: {
    label: 'Mobilku', hex: ['#1B2F5B', '#12213F'], bg: 'bg-[#1B2F5B]', grad: 'bg-gradient-to-br from-[#1B2F5B] to-[#12213F]',
    soft: 'bg-[#E9EEF8] dark:bg-[#1B2A4A]', text: 'text-[#1B2F5B] dark:text-[#9DB5E8]', ring: 'ring-[#1B2F5B] dark:ring-[#9DB5E8]',
    line: 'bg-[#1B2F5B] dark:bg-[#9DB5E8]',
  },
  motorku: {
    label: 'Motorku', hex: ['#1D6A4B', '#134B35'], bg: 'bg-[#1D6A4B]', grad: 'bg-gradient-to-br from-[#1D6A4B] to-[#134B35]',
    soft: 'bg-[#E5F2EB] dark:bg-[#123325]', text: 'text-[#1D6A4B] dark:text-[#8FD1B2]', ring: 'ring-[#1D6A4B] dark:ring-[#8FD1B2]',
    line: 'bg-[#1D6A4B] dark:bg-[#8FD1B2]',
  },
};
export function BrandIcon({ b, className = 'h-4 w-4' }: { b: BrandId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {b === 'mobilku'
        ? (<><path d="M3 16v-3l2-5h14l2 5v3H3z" /><circle cx="7.5" cy="16.5" r="1.8" /><circle cx="16.5" cy="16.5" r="1.8" /></>)
        : (<><circle cx="5.5" cy="16" r="3.5" /><circle cx="18.5" cy="16" r="3.5" /><path d="M5.5 16 10 11h5l3.5 5M14 7h3l1.5 4" /></>)}
    </svg>
  );
}
export function BrandChip({ b }: { b: BrandId | '' }) {
  if (!b) return null;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${BRAND[b].soft} ${BRAND[b].text}`}>
      <BrandIcon b={b} className="h-3 w-3" />{BRAND[b].label}
    </span>
  );
}
// Gambar garis mobil / motor untuk hiasan kartu
export function BrandArt({ b, className = '' }: { b: BrandId; className?: string }) {
  return b === 'mobilku' ? (
    <svg viewBox="0 0 120 50" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 36v-8q2-6 10-7l18-3 13-9q4-3 10-3h22q6 0 10 4l10 9 11 2q7 2 7 8v7h-8" /><path d="M22 36h56M102 36h3" />
      <path d="M45 18l10-8q2-1 5-1h10v9zM74 9h9q3 0 5 2l7 7H74z" />
      <circle cx="30" cy="38" r="8" /><circle cx="30" cy="38" r="3" /><circle cx="92" cy="38" r="8" /><circle cx="92" cy="38" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 120 60" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="24" cy="44" r="13" /><circle cx="24" cy="44" r="4" /><circle cx="96" cy="44" r="13" /><circle cx="96" cy="44" r="4" />
      <path d="M24 44l18-16h26l10 16h-18l-8-10" /><path d="M40 22h20q6 0 8 6" /><path d="M78 44l6-24 10-3m-6 3 8 24" /><path d="M84 17l-6-3" />
    </svg>
  );
}

/* ---------- Tampilan kosong yang ramah ---------- */
export function Kosong({ art = 'motor', title, text, children }: { art?: 'motor' | 'mobil' | 'bendera'; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="relative flex h-28 w-52 items-end justify-center">
        <span className="absolute inset-x-6 bottom-2 h-2.5 rounded-full bg-neutral-100 dark:bg-neutral-900" />
        {art === 'bendera' ? (
          <svg viewBox="0 0 200 110" className="relative h-28 w-52 text-[#1D6A4B] dark:text-[#8FD1B2]" fill="none" aria-hidden="true">
            <path d="M18 96 C 55 74, 80 104, 118 82 S 172 56, 180 42" stroke="currentColor" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" />
            <path d="M178 44V10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><path d="M178 12h-24l7 9-7 9h24z" fill="#F5C451" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
            <g transform="translate(6 62) scale(0.55)"><circle cx="24" cy="44" r="13" stroke="currentColor" strokeWidth="4" /><circle cx="96" cy="44" r="13" stroke="currentColor" strokeWidth="4" /><path d="M24 44l18-16h26l10 16h-18l-8-10M40 22h20q6 0 8 6M78 44l6-24 10-3" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></g>
          </svg>
        ) : (
          <span className={`relative ${art === 'mobil' ? 'text-[#1B2F5B] dark:text-[#9DB5E8]' : 'text-[#1D6A4B] dark:text-[#8FD1B2]'}`}>
            <BrandArt b={art === 'mobil' ? 'mobilku' : 'motorku'} className="h-20 w-40" />
          </span>
        )}
      </div>
      <p className="mt-3 text-lg font-bold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-400">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/* ---------- Konfeti ---------- */
const CONF = ['#F5C451', '#1B2F5B', '#1D6A4B', '#E8618C', '#FFFFFF', '#F2A33A'];
export function Confetti({ n = 60 }: { n?: number }) {
  const [pieces] = useState(() => Array.from({ length: n }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.6, dur: 2.2 + Math.random() * 1.6,
    w: [8, 6, 10, 5][i % 4], h: [14, 6, 4, 12][i % 4], c: CONF[i % CONF.length], rot: Math.random() * 360,
  })));
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span key={i} className="ck-confetti absolute top-[-20px]"
          style={{ left: `${p.left}%`, width: p.w, height: p.h, background: p.c, borderRadius: p.w === p.h ? '50%' : 2,
            animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}
export const vibrate = (p: number | number[] = [30, 40, 30]) => { try { navigator.vibrate?.(p); } catch { /* abaikan */ } };

/* ---------- Foto visit (salinan kecil dari Drive) ---------- */
export function FotoVisit({ id, alt }: { id: string; alt: string }) {
  const [gagal, setGagal] = useState(false);
  const [besar, setBesar] = useState(false);
  useOverlay(besar, () => setBesar(false));
  if (!id || gagal) return null;
  const src = `/api/foto/${encodeURIComponent(id)}`;
  return (
    <>
      <button onClick={() => setBesar(true)} className="mt-2 block w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800" aria-label={`Perbesar ${alt}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" onError={() => setGagal(true)} className="h-44 w-full object-cover" />
      </button>
      {besar && (
        <div role="dialog" aria-label={alt} className="fixed inset-0 z-[70] flex flex-col bg-black/95" onClick={() => setBesar(false)}>
          <div className="flex justify-end p-2 pt-[calc(env(safe-area-inset-top)+8px)]">
            <button onClick={() => setBesar(false)} aria-label="Tutup foto" className="flex h-12 w-12 items-center justify-center text-white"><Ico n="x" className="h-6 w-6" sw={2} /></button>
          </div>
          <div className="flex flex-1 items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Tombol pilihan bentuk pil (min. 40dp) ---------- */
export function PillSeg<T extends string>({ value, options, onChange, full = false }: {
  value: T; options: [T, string, boolean?][]; onChange: (v: T) => void; full?: boolean;
}) {
  return (
    <div role="tablist" className={`flex gap-0.5 rounded-full bg-neutral-100 p-[3px] dark:bg-neutral-900 ${full ? 'w-full' : 'w-max'}`}>
      {options.map(([k, label, disabled]) => (
        <button key={k} role="tab" aria-selected={value === k} disabled={disabled} onClick={() => onChange(k)}
          className={`min-h-10 whitespace-nowrap rounded-full px-3.5 text-sm transition disabled:opacity-40 ${full ? 'flex-1' : ''} ${value === k
            ? 'bg-white font-bold text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
            : 'font-semibold text-neutral-500 dark:text-neutral-400'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Tab garis bawah ala Threads (48dp) ---------- */
export function UnderTabs<T extends string>({ value, options, onChange, small = false }: { value: T; options: [T, string][]; onChange: (v: T) => void; small?: boolean }) {
  return (
    <div role="tablist" className="grid border-b border-neutral-200 dark:border-neutral-800" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={`min-h-12 whitespace-nowrap ${small ? 'text-sm' : 'text-[15px]'} transition ${value === k
            ? 'font-bold text-neutral-900 shadow-[inset_0_-2px_0_currentColor] dark:text-white'
            : 'font-semibold text-neutral-500 dark:text-neutral-400'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Nilai peringkat ---------- */
export const rankVal = (r: RankRow) => (r.val === null ? '–' : r.pct ? persen(r.val) : angka(r.val));

export function MoveMark({ r }: { r: RankRow }) {
  if (r.move === 'up') return <span aria-label={`naik ${r.moveBy}`} className="flex text-green-700 dark:text-green-400"><Ico n="up" className="h-3.5 w-3.5" sw={2.6} /></span>;
  if (r.move === 'down') return <span aria-label={`turun ${r.moveBy}`} className="flex text-red-600 dark:text-red-400"><Ico n="down" className="h-3.5 w-3.5" sw={2.6} /></span>;
  if (r.move === 'new') return <span className="text-[10px] font-bold text-green-700 dark:text-green-400">BARU</span>;
  return <span aria-label="tetap" className="text-xs text-neutral-400">–</span>;
}

/* ---------- Podium juara 1–3 ---------- */
export function Podium({ rows, onOpen, reached, detail }: {
  rows: RankRow[]; onOpen: (o: Orang) => void; reached?: (r: RankRow) => boolean; detail?: (r: RankRow) => string;
}) {
  const top = rows.filter((r) => r.rank).slice(0, 3);
  if (!top.length) return <p className="py-6 text-center text-sm text-neutral-500">Belum ada data untuk peringkat ini.</p>;
  const order = [top[1], top[0], top[2]];
  const H = detail ? ['h-[100px]', 'h-[132px]', 'h-[84px]'] : ['h-[84px]', 'h-[116px]', 'h-[68px]'];
  const RING = ['ring-[#BFC3C9]', 'ring-[#F5C451]', 'ring-[#D9A37A]'];
  const champ = top[0];
  return (
    <div>
      {reached && reached(champ) && (
        <div className="mb-2 flex justify-center">
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FFF1C7] px-3 py-1 text-[13px] font-bold text-[#6B4A00] dark:bg-[#3A2F12] dark:text-[#F5C451]">
            <Ico n="trophy" className="h-3.5 w-3.5" sw={2} />{shortName(champ.o.nama)} tembus target
          </span>
        </div>
      )}
      <div className="grid grid-cols-3 items-end gap-2">
        {order.map((r, i) => r ? (
          <button key={r.o.nama} onClick={() => onOpen(r.o)} className="flex min-w-0 flex-col items-center gap-1.5 active:scale-[0.98]">
            <Avatar o={r.o} size={i === 1 ? 58 : 50} className={`ring-2 ${RING[i]} ring-offset-[3px] ring-offset-white dark:ring-offset-neutral-950`} />
            <span className="flex max-w-full items-center gap-0.5 truncate text-sm font-bold">
              <span className="truncate">{shortName(r.o.nama)}</span>{r.move === 'up' && <MoveMark r={r} />}
            </span>
            <span className={`flex w-full flex-col items-center justify-center gap-0.5 rounded-t-2xl rounded-b-md ${H[i]} ${i === 1
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              : 'bg-neutral-100 dark:bg-neutral-900'}`}>
              <span className={`${i === 1 ? 'text-[26px]' : 'text-[22px]'} font-bold leading-none tracking-tight`}>{rankVal(r)}</span>
              {detail && detail(r) && (
                <span className={`max-w-full truncate px-1 text-xs font-semibold ${i === 1 ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-600 dark:text-neutral-400'}`}>{detail(r)}</span>
              )}
              <span className={`text-[13px] font-bold ${i === 1 ? 'text-[#F5C451] dark:text-[#B07800]' : 'text-neutral-500'}`}>#{r.rank}</span>
            </span>
          </button>
        ) : <span key={i} />)}
      </div>
    </div>
  );
}

/* ---------- Kartu umum ---------- */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[20px] border border-neutral-200 dark:border-neutral-800 ${className}`}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-6">
      <h2 className="text-[19px] font-bold tracking-tight">{children}</h2>
      {right}
    </div>
  );
}

// Nilai asli di bawah persen: amount → rupiah, unit → jumlah unit
export const salesDetail = (metric: string) => (r: RankRow) =>
  metric === 'amount' ? (typeof r.o.amount?.ini === 'number' ? rp(r.o.amount.ini) : '')
    : metric === 'unit' ? (typeof r.o.unit?.ini === 'number' ? `${angka(r.o.unit.ini)} unit` : '')
      : '';

// Bagikan teks: lembar bagikan bawaan HP (WhatsApp ada di sana); kalau tidak ada, langsung buka WhatsApp
export async function shareText(text: string) {
  try {
    if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

export function ShareBtn({ onClick, label = 'Bagikan' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} aria-label={label || 'Bagikan ke WhatsApp'} className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-bold active:bg-neutral-100 dark:active:bg-neutral-900">
      <Ico n="share" className="h-[18px] w-[18px]" sw={2} />{label}
    </button>
  );
}
