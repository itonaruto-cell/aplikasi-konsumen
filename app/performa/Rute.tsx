'use client';
import { useMemo, useState } from 'react';
import type { KonsumenFull, Performa } from '../../lib/performa-types';
import { belumVisit, kecGroups, konsumenOf, perluUlang, type BrandKey } from '../../lib/performa-calc';
import { nama, type Push } from './ui';
import { Ico, PillSeg } from './parts';

export default function Rute({ data, push, mode0, brand0 }: { data: Performa; push: Push; mode0: 'belum' | 'ulang'; brand0: BrandKey }) {
  const [brand, setBrand] = useState<BrandKey>(brand0);
  const [mode, setMode] = useState<'belum' | 'ulang'>(mode0);
  const [p, setP] = useState(0);
  const [openKec, setOpenKec] = useState<string | null>(null);
  const cabang = nama(data.cabang);

  const all = konsumenOf(data, brand);
  const cnt = (f: (k: KonsumenFull) => boolean, pp = 0) => all.filter((x) => f(x.k) && (!pp || x.k.p === pp)).length;
  const groups = useMemo(() => kecGroups(data, brand, mode, p), [data, brand, mode, p]);
  const first = groups[0]?.kec ?? null;
  const isOpen = (kec: string) => (openKec === null ? kec === first : openKec === kec);
  const f = mode === 'belum' ? belumVisit : perluUlang;

  return (
    <div className="pb-8">
      <div className="flex flex-col gap-2.5 px-4 pt-3">
        <PillSeg value={brand} onChange={(b) => { setBrand(b); setOpenKec(null); }} full
          options={[['mobilku', 'Mobilku'], ['motorku', 'Motorku'], ['semua', 'Semua']]} />
        <PillSeg value={mode} onChange={(m) => { setMode(m); setOpenKec(null); }} full
          options={[['belum', `Belum visit · ${cnt(belumVisit)}`], ['ulang', `Visit ulang · ${cnt(perluUlang)}`]]} />
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {[0, 1, 2, 3].map((n) => (
            <button key={n} onClick={() => { setP(n); setOpenKec(null); }} aria-pressed={p === n}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${p === n
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                : 'border-neutral-300 dark:border-neutral-700'}`}>
              {n ? `P${n} · ${cnt(f, n)}` : 'Semua P'}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && (
        <p className="mx-4 mt-6 rounded-2xl bg-neutral-100 p-6 text-center text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
          {mode === 'belum' ? 'Semua konsumen di pilihan ini sudah dikunjungi.' : 'Tidak ada konsumen yang perlu visit ulang.'}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2.5 px-4">
        {groups.map((g) => {
          const opened = isOpen(g.kec);
          const noKec = g.kec === 'Tanpa kecamatan';
          const hot = g.items.length >= 2;
          return (
            <section key={g.kec} className="overflow-hidden rounded-[20px] border border-neutral-200 dark:border-neutral-800">
              <button onClick={() => setOpenKec(opened ? '' : g.kec)} aria-expanded={opened}
                className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-50 dark:active:bg-neutral-900">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold ${hot
                  ? 'bg-[#FDF0DC] text-[#8A4F00] dark:bg-[#3A2A12] dark:text-[#F2A33A]'
                  : 'bg-neutral-100 dark:bg-neutral-800'}`}>{g.items.length}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold">{noKec ? g.kec : `Kec. ${nama(g.kec)}`}</span>
                  <span className="block truncate text-[13px] text-neutral-500">
                    {[g.belum && `${g.belum} belum visit`, g.ulang && `${g.ulang} perlu visit ulang`].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Ico n={opened ? 'up' : 'down'} className="h-[18px] w-[18px] text-neutral-500" sw={2} />
              </button>
              {opened && (
                <div className="border-t border-neutral-200 dark:border-neutral-800">
                  {g.items.map(({ k, brand: b }, i) => (
                    <button key={k.n + i} onClick={() => push({ t: 'k', k })}
                      className="flex min-h-12 w-full items-center gap-2.5 border-b border-neutral-100 px-4 py-2.5 text-left last:border-0 active:bg-neutral-50 dark:border-neutral-800/70 dark:active:bg-neutral-900">
                      <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-bold dark:bg-neutral-800">P{k.p}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px]">{nama(k.n)}</span>
                        {brand === 'semua' && <span className="block text-xs text-neutral-500">{b === 'mobilku' ? 'Mobilku' : 'Motorku'}</span>}
                      </span>
                      <span className={`shrink-0 text-[13px] font-semibold ${mode === 'belum' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {mode === 'belum' ? 'Belum visit' : `${k.v.length}x visit`}
                      </span>
                    </button>
                  ))}
                  {!noKec && (
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Kecamatan ${nama(g.kec)}, ${cabang}`)}`} target="_blank" rel="noreferrer"
                      className="mx-4 my-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-neutral-900 text-sm font-semibold text-white active:opacity-90 dark:bg-white dark:text-neutral-900">
                      <Ico n="pin" className="h-[18px] w-[18px]" sw={2} />Buka Kec. {nama(g.kec)} di Maps
                    </a>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <p className="px-4 pt-4 text-[13px] leading-relaxed text-neutral-500">
        Kecamatan diurutkan dari yang paling banyak tugasnya. Konsumen tanpa kecamatan (kebanyakan P1) dikumpulkan di grup &quot;Tanpa kecamatan&quot;.
      </p>
    </div>
  );
}
