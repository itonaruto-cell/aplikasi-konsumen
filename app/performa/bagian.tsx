'use client';
import { useState, type ReactNode } from 'react';
import { Ico } from './parts';
// Bagian lipat, label isian, dan pilihan tombol yang dipakai bersama Report survey dan Format BCP.

export function Bagian({ judul, sub, children, buka = true }: { judul: string; sub?: string; children: ReactNode; buka?: boolean }) {
  const [open, setOpen] = useState(buka);
  return (
    <section className="mt-3 rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{judul}</span>
          {sub && <span className="block truncate text-[12px] text-neutral-500">{sub}</span>}
        </span>
        <Ico n="down" className={`h-4 w-4 shrink-0 text-neutral-400 transition ${open ? 'rotate-180' : ''}`} sw={2} />
      </button>
      {open && <div className="border-t border-neutral-200 px-4 pb-4 pt-3 dark:border-neutral-800">{children}</div>}
    </section>
  );
}
export function Isian({ label, hint, children, grup = false }: { label: string; hint?: string; children: ReactNode; grup?: boolean }) {
  // Pilihan tombol tidak boleh dibungkus <label> (ketukan di label akan menekan tombol pertama)
  const Tag = grup ? 'div' : 'label';
  return (
    <Tag className="mt-3 block first:mt-0">
      <span className="block text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">{label}</span>
      {hint && <span className="block text-[12px] leading-snug text-neutral-500">{hint}</span>}
      <span className="mt-1 block">{children}</span>
    </Tag>
  );
}
export function Pilih({ opsi, value, onChange, label }: { opsi: readonly string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {opsi.map((o) => (
        <button key={o} onClick={() => onChange(value === o ? '' : o)} aria-pressed={value === o}
          className={`min-h-9 rounded-full px-3 text-[13px] font-semibold ${value === o ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{o}</button>
      ))}
    </div>
  );
}
