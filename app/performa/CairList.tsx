'use client';
import { useEffect, useMemo, useState } from 'react';
import { SearchBox, Chev, rp, type Push } from './ui';
import { brandOf, keyOf } from '../../lib/performa-calc';
import { kunciSumber, type CairItem, type DataCair } from '../../lib/cair-types';
import type { Orang } from '../../lib/performa-types';

// Konsumen yang sudah cair bulan ini (tab tarikan sales), per brand, bisa difilter per channel/sumber order & CMO.

let simpan: { at: number; p: Promise<DataCair> } | null = null;
export function ambilCair(paksa = false): Promise<DataCair> {
  if (!paksa && simpan && Date.now() - simpan.at < 60_000) return simpan.p;
  const p = fetch('/api/cair', { cache: 'no-store' })
    .then(async (res) => {
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return { ada: false, list: [], error: j?.error || 'Data cair tidak bisa dimuat.' };
      return { list: [], ...j } as DataCair;
    })
    .catch(() => ({ ada: false, list: [], error: 'Koneksi bermasalah. Coba lagi.' }));
  simpan = { at: Date.now(), p };
  p.then((d) => { if (d.error) simpan = null; });
  return p;
}

const kataNama = (s: string) => keyOf(s).split(' ').filter(Boolean);
// Brand dari tab tarikan; kalau kosong, dari brand CMO-nya di pantauan
export function brandItem(it: CairItem, orang: Orang[]): 'mobilku' | 'motorku' | '' {
  if (it.brand) return it.brand;
  const k = kataNama(it.cmo);
  if (!k.length) return '';
  const o = orang.find((x) => { const n = kataNama(x.nama); return n.join(' ') === k.join(' ') || (k[0].length >= 3 && n[0] === k[0]); });
  const b = o ? brandOf(o) : '';
  return b === 'mobilku' || b === 'motorku' ? b : '';
}

export function CairList({ brand, sumber0, orang, push }: { brand?: 'mobilku' | 'motorku'; sumber0?: string; orang: Orang[]; push: Push }) {
  const [d, setD] = useState<DataCair | null>(null);
  const [q, setQ] = useState('');
  const [sb, setSb] = useState(sumber0 ? kunciSumber(sumber0) : '');
  const [cmo, setCmo] = useState('');
  useEffect(() => { ambilCair().then(setD); }, []);

  const rows = useMemo(() => (d?.list || []).filter((it) => !brand || brandItem(it, orang) === brand), [d, brand, orang]);
  const hitung = (f: (it: CairItem) => string, list: CairItem[]) => {
    const m = new Map<string, number>();
    list.forEach((it) => { const v = f(it); if (v) m.set(v, (m.get(v) || 0) + 1); });
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const daftarSb = useMemo(() => hitung((it) => it.sumber, rows), [rows]);
  const daftarCmo = useMemo(() => hitung((it) => it.cmo, rows.filter((it) => !sb || kunciSumber(it.sumber) === sb)), [rows, sb]);
  const tampil = rows.filter((it) => (!sb || kunciSumber(it.sumber) === sb) && (!cmo || it.cmo === cmo)
    && (!q.trim() || [it.nama, it.kontrak, it.cust, it.app, it.cmo, it.unit].join(' ').toLowerCase().includes(q.trim().toLowerCase())));
  const total = tampil.reduce((s, it) => s + (it.pokok || 0), 0);

  const chip = (on: boolean) => `flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold ${on
    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900' : 'border-neutral-300 dark:border-neutral-700'}`;

  if (!d) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-neutral-200/70 dark:bg-neutral-800/70" />)}</div>;
  if (d.error) return (
    <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
      {d.error}
      <button onClick={() => { setD(null); ambilCair(true).then(setD); }} className="mt-3 block min-h-11 rounded-full bg-red-700 px-5 font-semibold text-white">Coba lagi</button>
    </div>
  );
  if (!d.ada) return (
    <div className="rounded-2xl border border-neutral-200 p-5 text-center text-sm dark:border-neutral-800">
      <p className="font-semibold">Data cair belum masuk</p>
      <p className="mt-1 text-neutral-500">Muncul setelah Apps Script pantauan mengirim tab tarikan sales.</p>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <span className="flex flex-col rounded-2xl bg-neutral-100 p-2.5 dark:bg-neutral-800"><b className="text-xl">{tampil.length}</b><span className="text-xs text-neutral-500">unit cair</span></span>
        <span className="flex flex-col rounded-2xl bg-neutral-100 p-2.5 dark:bg-neutral-800"><b className="text-xl">{rp(total)}</b><span className="text-xs text-neutral-500">pokok hutang</span></span>
      </div>
      <SearchBox value={q} onChange={setQ} placeholder="Cari nama, no kontrak, no cust, CMO" />
      {daftarSb.length > 0 && (
        <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="group" aria-label="Sumber order">
          <button onClick={() => setSb('')} className={chip(!sb)}>Semua sumber</button>
          {daftarSb.map(([v, n]) => <button key={v} onClick={() => setSb(sb === kunciSumber(v) ? '' : kunciSumber(v))} className={chip(sb === kunciSumber(v))}>{v} · {n}</button>)}
        </div>
      )}
      {daftarCmo.length > 1 && (
        <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="group" aria-label="CMO">
          <button onClick={() => setCmo('')} className={chip(!cmo)}>Semua CMO</button>
          {daftarCmo.map(([v, n]) => <button key={v} onClick={() => setCmo(cmo === v ? '' : v)} className={chip(cmo === v)}>{v} · {n}</button>)}
        </div>
      )}
      {tampil.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">{rows.length ? 'Tidak ada yang cocok.' : 'Belum ada konsumen cair bulan ini.'}</p>
      ) : (
        <ul className="mt-2">
          {tampil.map((it, i) => (
            <li key={i}>
              <button onClick={() => push({ t: 'cairRow', it })}
                className="flex min-h-14 w-full items-center gap-3 border-b border-neutral-200 py-2.5 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-800">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{it.nama || it.kontrak}</span>
                    {it.sumber && <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-px text-[11px] font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">{it.sumber}</span>}
                  </span>
                  <span className="block truncate text-[12px] text-neutral-500">{[it.cmo, it.unit, it.tgl].filter(Boolean).join(' · ')}</span>
                </span>
                {it.pokok > 0 && <span className="shrink-0 text-[13px] font-semibold">{rp(it.pokok).replace('Rp ', '')}</span>}
                <Chev />
              </button>
            </li>
          ))}
        </ul>
      )}
      {d.kolom && (
        <p className="mt-3 text-[11px] leading-snug text-neutral-400">
          Dari tab {d.sumber}. Kolom terbaca: {Object.entries({ nama: 'nama', kontrak: 'no kontrak', cust: 'no cust', cmo: 'CMO', unit: 'unit', sumber: 'sumber', tgl: 'tanggal', pokok: 'pokok' })
            .map(([k, l]) => `${l} = ${d.kolom![k] || '–'}`).join(' · ')}
        </p>
      )}
    </div>
  );
}

export function CairDetail({ it }: { it: CairItem }) {
  const baris: [string, string][] = [['No kontrak', it.kontrak], ['No cust', it.cust], ['No app', it.app], ['CMO', it.cmo], ['Unit', it.unit],
    ['Pokok hutang', it.pokok ? rp(it.pokok) : ''], ['Tanggal cair', it.tgl], ['Sumber order', it.sumber], ['Brand', it.brand === 'motorku' ? 'Motorku' : it.brand === 'mobilku' ? 'Mobilku' : '']];
  return (
    <dl className="divide-y divide-neutral-200 dark:divide-neutral-800">
      {baris.filter(([, v]) => v).map(([l, v]) => (
        <div key={l} className="flex justify-between gap-4 py-2.5 text-sm">
          <dt className="shrink-0 text-neutral-500">{l}</dt>
          <dd className="text-right font-medium break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
