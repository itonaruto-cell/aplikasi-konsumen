'use client';
import { useEffect, useMemo, useState } from 'react';
import { SearchBox, Chev, type Push } from './ui';

// Bahan OI: isi tab data OI (order in) dari pantauan cabang, dikirim Apps Script bersama data performa.
// Kolomnya mengikuti tab di pantauan; di sini cukup ditebak kolom nama, status, tanggal, dan CMO untuk daftar.

export type DataOi = { ada: boolean; sumber?: string; dikirim?: string; semua?: boolean; h: string[]; r: string[][]; cmo: number; error?: string };

let simpan: { at: number; p: Promise<DataOi> } | null = null;
export function ambilOi(paksa = false): Promise<DataOi> {
  if (!paksa && simpan && Date.now() - simpan.at < 60_000) return simpan.p;
  const p = fetch('/api/oi', { cache: 'no-store' })
    .then(async (res) => {
      const j = await res.json().catch(() => ({}));
      if (!res.ok) return { ada: false, h: [], r: [], cmo: -1, error: j?.error || 'Data OI tidak bisa dimuat.' };
      return { h: [], r: [], cmo: -1, ...j } as DataOi;
    })
    .catch(() => ({ ada: false, h: [], r: [], cmo: -1, error: 'Koneksi bermasalah. Coba lagi.' }));
  simpan = { at: Date.now(), p };
  p.then((d) => { if (d.error) simpan = null; });
  return p;
}

const N = (s: string) => s.toUpperCase().replace(/[_.]/g, ' ').replace(/\bC[OU]STU?M+[EO]R\b/g, 'CUSTOMER').replace(/\s+/g, ' ').trim();
const kolom = (h: string[], pola: RegExp[]) => { const hn = h.map(N); for (const p of pola) { const i = hn.findIndex((x) => p.test(x)); if (i >= 0) return i; } return -1; };
const STATUS_OI = /^(GO ?LIVE|GOLIVE|PENDING|PO ?PENDING|REJECT|REJECTED|CANCEL|CANCELLED|BATAL|APPROVE|APPROVED|DDI|SURVEY|PROSES|ON ?PROCESS|RETURN|BANDING)/;
export function kolomOi(h: string[], r: string[][] = []) {
  const k = {
    nama: kolom(h, [/^NAMA (KONSUMEN|CUSTOMER|CUST|DEBITUR|NASABAH|PEMOHON)$/, /^(CUSTOMER|CUST) NAME$/, /^NAMA KONSUMEN/, /^NAMA$/, /^KONSUMEN$/]),
    status: kolom(h, [/^STATUS( APLIKASI| APP| OI| ORDER)?$/, /^STATUS/, /^HASIL$/]),
    tgl: kolom(h, [/^TGL (OI|ORDER|INPUT|MASUK)/, /^TANGGAL (OI|ORDER|INPUT|MASUK)/, /^TANGGAL APLIKASI$/, /^TGL$/, /^TANGGAL$/, /TGL|TANGGAL|DATE/]),
    app: kolom(h, [/^NO ?APP(LIKASI)?$/, /^APP(LICATION)? ?(NO|ID)$/, /^NO ?ORDER$/, /^NO KONTRAK$/]),
    unit: kolom(h, [/^TIPE KENDARAAN RINCI$/, /^(TYPE|TIPE) UNIT/, /^UNIT$/, /^(NAMA )?(MERK|MEREK)/, /^TIPE KENDARAAN$/]),
  };
  // Kolom status dari isinya kalau judulnya tidak dikenali (GOLIVE / PENDING / REJECT / CANCEL ...)
  if (r.length) {
    const cocok = (j: number) => { const isi = r.map((b) => N(b[j] || '')).filter(Boolean); return isi.length ? isi.filter((v) => STATUS_OI.test(v)).length / isi.length : 0; };
    if (k.status < 0 || cocok(k.status) < 0.5) {
      let best = -1, s = 0.5;
      h.forEach((_, j) => { const c = cocok(j); if (c > s) { s = c; best = j; } });
      if (best >= 0) k.status = best;
    }
  }
  return k;
}
const kunci = (s: string) => N(s).replace(/[^A-Z ]/g, '').trim();
// Nama CMO di data OI kadang hanya nama depan / tanpa gelar
export function namaCocok(a: string, b: string) {
  const x = kunci(a), y = kunci(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [p, q] = x.length <= y.length ? [x, y] : [y, x];
  return p.length >= 3 && (q.split(' ').includes(p) || q.startsWith(p + ' '));
}
const warnaStatus = (s: string) => {
  const u = N(s);
  if (/GO ?LIVE|CAIR|APPROVE|DISBURS/.test(u)) return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300';
  if (/REJECT|TOLAK/.test(u)) return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
  if (/CANCEL|BATAL/.test(u)) return 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
};

export function BahanOi({ nama, push }: { nama?: string; push: Push }) {
  const [d, setD] = useState<DataOi | null>(null);
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');
  const [cmo, setCmo] = useState('');
  const muat = (paksa = false) => { setD(null); ambilOi(paksa).then(setD); };
  useEffect(() => { ambilOi().then(setD); }, []);

  const k = useMemo(() => kolomOi(d?.h || [], d?.r || []), [d]);
  const rows = useMemo(() => {
    if (!d?.ada) return [];
    // Baris copy cancel (no app berakhiran _1, _2, ...) tidak ditampilkan supaya aplikasi tidak dobel
    const appKol = k.app;
    return d.r.filter((r) => (!nama || d.cmo < 0 || namaCocok(r[d.cmo] || '', nama))
      && !(appKol >= 0 && /_\d+$/.test((r[appKol] || '').trim()))
      && !r.some((v) => /^APP\w*_\d+$/i.test((v || '').trim())));
  }, [d, nama, k]);
  const hitung = (i: number, list: string[][]) => {
    const m = new Map<string, number>();
    if (i >= 0) list.forEach((r) => { const v = (r[i] || '').trim(); if (v) m.set(v, (m.get(v) || 0) + 1); });
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  const daftarCmo = useMemo(() => (nama || !d ? [] : hitung(d.cmo, rows)), [d, rows, nama]);
  const daftarStatus = useMemo(() => hitung(k.status, rows.filter((r) => !cmo || r[d!.cmo] === cmo)), [k, rows, cmo, d]);
  const tampil = rows.filter((r) => (!cmo || r[d!.cmo] === cmo) && (!st || (r[k.status] || '').trim() === st)
    && (!q.trim() || r.join(' ').toLowerCase().includes(q.trim().toLowerCase())));

  const chip = (on: boolean) => `flex min-h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold ${on
    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900' : 'border-neutral-300 dark:border-neutral-700'}`;

  if (!d) return <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-neutral-200/70 dark:bg-neutral-800/70" />)}</div>;
  if (d.error) return (
    <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
      {d.error}
      <button onClick={() => muat(true)} className="mt-3 block min-h-11 rounded-full bg-red-700 px-5 font-semibold text-white">Coba lagi</button>
    </div>
  );
  if (!d.ada) return (
    <div className="rounded-2xl border border-neutral-200 p-5 text-center text-sm dark:border-neutral-800">
      <p className="font-semibold">Data OI belum masuk</p>
      <p className="mt-1 text-neutral-500">Data OI muncul setelah Apps Script pantauan cabang mengirim tab data OI.</p>
    </div>
  );

  return (
    <div>
      <SearchBox value={q} onChange={setQ} placeholder="Cari nama, no app, status" />
      {daftarCmo.length > 1 && (
        <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="group" aria-label="CMO">
          <button onClick={() => setCmo('')} className={chip(!cmo)}>Semua CMO</button>
          {daftarCmo.map(([v, n]) => <button key={v} onClick={() => setCmo(cmo === v ? '' : v)} className={chip(cmo === v)}>{v} · {n}</button>)}
        </div>
      )}
      {daftarStatus.length > 1 && (
        <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]" role="group" aria-label="Status OI">
          <button onClick={() => setSt('')} className={chip(!st)}>Semua status</button>
          {daftarStatus.map(([v, n]) => <button key={v} onClick={() => setSt(st === v ? '' : v)} className={chip(st === v)}>{v} · {n}</button>)}
        </div>
      )}
      <p className="mt-3 text-[13px] text-neutral-500">{tampil.length} data OI</p>
      {tampil.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">{rows.length ? 'Tidak ada yang cocok.' : nama ? 'Belum ada data OI untuk nama ini.' : 'Belum ada data OI.'}</p>
      ) : (
        <ul className="mt-1">
          {tampil.slice(0, 300).map((r, i) => {
            const nm = (k.nama >= 0 ? r[k.nama] : '') || r.find(Boolean) || '-';
            const status = k.status >= 0 ? r[k.status] : '';
            const sub = [k.app >= 0 ? r[k.app] : '', k.tgl >= 0 ? r[k.tgl] : '', k.unit >= 0 ? r[k.unit] : '', !nama && d.cmo >= 0 ? r[d.cmo] : '']
              .filter((v) => v && v.trim().toUpperCase() !== (status || '').trim().toUpperCase()).join(' · ');
            return (
              <li key={i}>
                <button onClick={() => push({ t: 'oiRow', h: d.h, r, judul: nm })}
                  className="flex min-h-14 w-full items-center gap-3 border-b border-neutral-200 py-2.5 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-800">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{nm}</span>
                      {status && <span className={`shrink-0 rounded-full px-2 py-px text-[11px] font-bold ${warnaStatus(status)}`}>{status}</span>}
                    </span>
                    {sub && <span className="block truncate text-[12px] text-neutral-500">{sub}</span>}
                  </span>
                  <Chev />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {tampil.length > 300 && <p className="py-3 text-center text-[13px] text-neutral-500">Menampilkan 300 dari {tampil.length}. Cari lebih spesifik.</p>}
    </div>
  );
}

export function OiDetail({ h, r }: { h: string[]; r: string[] }) {
  return (
    <dl className="divide-y divide-neutral-200 dark:divide-neutral-800">
      {h.map((x, i) => (r[i] || '').trim() ? (
        <div key={i} className="flex justify-between gap-4 py-2.5 text-sm">
          <dt className="shrink-0 text-neutral-500">{x}</dt>
          <dd className="text-right font-medium break-words">{r[i]}</dd>
        </div>
      ) : null)}
    </dl>
  );
}
