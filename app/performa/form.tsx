'use client';
import type { ReactNode } from 'react';
import { useOverlay } from '../overlay';
// Isian dan lembar bawah yang dipakai bersama halaman Bahan survey, Insentif, Inject P3, dan Plan.

const DASAR = 'rounded-xl border border-neutral-300 bg-white px-3 text-base font-normal text-neutral-900 outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-50';
export const FIELD = `w-full ${DASAR}`;

export const rupiah = (v: number) => 'Rp ' + Math.round(v).toLocaleString('id-ID');

// Angka bulat dengan pemisah ribuan (rupiah, unit, jumlah MA)
export function AngkaInput({ value, onChange, id, placeholder = '0', className = '', lebar = 'w-full', label }: {
  value: number; onChange: (v: number) => void; id?: string; placeholder?: string; className?: string; lebar?: string; label?: string;
}) {
  return (
    <input id={id} aria-label={label} inputMode="numeric" autoComplete="off" placeholder={placeholder}
      value={value ? Math.round(value).toLocaleString('id-ID') : ''}
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, 13)) || 0)}
      className={`${DASAR} ${lebar} ${className}`} />
  );
}

// Tombol kurang / tambah (48dp)
export function Stepper({ label, sub, value, onMinus, onPlus }: {
  label: string; sub: string; value: string; onMinus: () => void; onPlus: () => void;
}) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold">{label}</p>
        <p className="truncate text-[13px] text-neutral-500">{sub}</p>
      </div>
      <button onClick={onMinus} aria-label={`Kurangi ${label.toLowerCase()}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-xl font-semibold active:scale-95 dark:border-neutral-700">−</button>
      <span className="w-14 shrink-0 whitespace-nowrap text-center text-[15px] font-bold">{value}</span>
      <button onClick={onPlus} aria-label={`Tambah ${label.toLowerCase()}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xl font-semibold text-white active:scale-95 dark:bg-white dark:text-neutral-900">+</button>
    </div>
  );
}

// Lembar bawah dengan judul dan tombol Tutup; isi diatur pemakainya (bagian yang bisa digulir + kaki)
export function Lembar({ judul, onClose, children }: { judul: string; onClose: () => void; children: ReactNode }) {
  useOverlay(true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white pt-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50">
        <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <div className="flex shrink-0 items-center justify-between px-5">
          <p className="text-lg font-bold">{judul}</p>
          <button onClick={onClose} className="-mr-2 flex min-h-11 items-center px-2 text-[15px] text-neutral-500">Tutup</button>
        </div>
        {children}
      </div>
    </div>
  );
}
