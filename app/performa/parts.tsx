'use client';
import type { ReactNode } from 'react';
import type { Orang } from '../../lib/performa-types';
import type { RankRow } from '../../lib/performa-calc';
import { initials, nama, persen, angka } from './ui';

/* ---------- Ikon garis (tanpa library) ---------- */
const P: Record<string, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z" />,
  trophy: (<><path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>),
  pin: (<><circle cx="12" cy="11" r="3" /><path d="M17.7 16.7 13.4 21a2 2 0 0 1-2.8 0l-4.3-4.3a8 8 0 1 1 11.3 0z" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M5 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  refresh: <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />,
  flame: <path d="M12 22c4 0 7-2.8 7-7 0-4.5-4-7-5-11-2 2-3 4-3 6-1-1-1.5-2-1.7-3C7 9 5 11.5 5 15c0 4.2 3 7 7 7z" />,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  right: <path d="m9 6 6 6-6 6" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  lock: (<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  users: (<><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 11l2 2 4-4" /></>),
  logout: <path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2M9 12h12l-3-3m0 6 3-3" />,
  map: (<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14m6-12v14" /></>),
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

/* ---------- Bar netral ---------- */
export function Line({ v, className = 'h-1.5', color = 'bg-neutral-900 dark:bg-white', track = 'bg-neutral-200/80 dark:bg-neutral-800' }: {
  v: number | null | undefined; className?: string; color?: string; track?: string;
}) {
  const w = typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(100, v * 100)) : 0;
  return (
    <div className={`${className} w-full overflow-hidden rounded-full ${track}`}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
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
export function Podium({ rows, onOpen, reached }: { rows: RankRow[]; onOpen: (o: Orang) => void; reached?: (r: RankRow) => boolean }) {
  const top = rows.filter((r) => r.rank).slice(0, 3);
  if (!top.length) return <p className="py-6 text-center text-sm text-neutral-500">Belum ada data untuk peringkat ini.</p>;
  const order = [top[1], top[0], top[2]];
  const H = ['h-[84px]', 'h-[116px]', 'h-[68px]'];
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
