'use client';
import { useEffect, useState, type ReactNode } from 'react';
import type { KonsumenFull, MaFull, Orang, Performa, RekrutRegist, Sales, VisitRow } from '../../lib/performa-types';

/* ---------- Format ---------- */
export const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
export const cf = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
export const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
export const angka = (v?: number | null) => (isNum(v) ? nf.format(v) : '–');
export const rp = (v?: number | null) => (isNum(v) ? 'Rp ' + cf.format(v) : '–');
export const persen = (v?: number | null) => (isNum(v) ? nf.format(Math.round(v * 100)) + '%' : '–');
export const tone = (ach?: number | null) =>
  !isNum(ach) ? 'none' : ach >= 1 ? 'good' : ach >= 0.5 ? 'mid' : 'bad';
export const TEXT: Record<string, string> = {
  good: 'text-green-700 dark:text-green-300', mid: 'text-amber-700 dark:text-amber-300',
  bad: 'text-red-600 dark:text-red-300', none: 'text-neutral-400',
};
export const BAR: Record<string, string> = { good: 'bg-green-500', mid: 'bg-amber-500', bad: 'bg-red-500', none: 'bg-neutral-300' };
export const PILL: Record<string, string> = {
  good: 'bg-green-50 text-green-700 dark:bg-green-400/15 dark:text-green-300',
  mid: 'bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  bad: 'bg-red-50 text-red-600 dark:bg-red-400/15 dark:text-red-300',
  plain: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
};
// HURUF BESAR → Huruf Besar, tapi singkatan umum tetap kapital (BPR, MA, OI, WOM, …)
const ACRONYM = new Set(['BPR', 'MA', 'MAO', 'OI', 'WOM', 'NSC', 'BM', 'NC', 'AC', 'AMS', 'BRI', 'BCA', 'BNI', 'BTN', 'PT', 'CV', 'KSP', 'KUD', 'SPD', 'CMO', 'NB']);
export const nama = (n: string) => String(n || '').split(/(\s+|\/)/)
  .map((w) => (ACRONYM.has(w.toUpperCase()) ? w.toUpperCase() : w.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())))
  .join('');
export const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
export const keyOf = (s: string) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
export const waktu = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
export const tanggal = (s: string | null, short = false) => {
  if (!s) return '';
  const d = new Date(s.slice(0, 10) + 'T00:00:00');
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('id-ID', short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long', year: 'numeric' });
};
export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/* ---------- Status konsumen ---------- */
export const isMet = (v: VisitRow) => /^bertemu$/i.test(String(v.st || '').trim());
// pic: kalau diisi, hanya visit oleh orang itu yang dihitung
const visitsOf = (k: KonsumenFull, pic?: string) => (pic ? k.v.filter((v) => keyOf(v.pic) === keyOf(pic)) : k.v);
export function statusOf(k: KonsumenFull, pic?: string) {
  const vs = visitsOf(k, pic);
  const met = vs.filter(isMet)[0];
  if (!vs.length) return { key: 'belum' as const, label: 'Belum visit', cls: 'bad', ke: 0, n: 0 };
  if (met) return { key: 'bertemu' as const, label: `Bertemu V${met.ke}`, cls: 'good', ke: met.ke, n: vs.length };
  return { key: 'tidak' as const, label: 'Belum bertemu', cls: 'mid', ke: 0, n: vs.length };
}

/* ---------- Komponen kecil ---------- */
export function Bar({ ach, className = 'h-1.5' }: { ach?: number | null; className?: string }) {
  const w = isNum(ach) ? Math.max(0, Math.min(100, ach * 100)) : 0;
  return (
    <div className={`${className} w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800`}>
      <div className={`h-full rounded-full ${BAR[tone(ach)]}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} aria-pressed={value === k}
          className={`flex-1 min-h-10 rounded-lg px-2 py-2 text-sm font-medium transition ${value === k
            ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-neutral-100'
            : 'text-neutral-500 dark:text-neutral-400'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Chev() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-neutral-300" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function Pill({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${PILL[cls]}`}>{children}</span>;
}

export function Stat({ label, value, strong = false, className = '' }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`${strong ? 'text-lg font-semibold' : 'font-medium'} ${className}`}>{value}</p>
    </div>
  );
}

export function Field({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-neutral-500">{label}</dt>
      <dd className="text-right font-medium break-words">{value}</dd>
    </div>
  );
}

export function OpenRow({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="mt-2 flex w-full items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 text-left active:bg-neutral-50 dark:border-neutral-700 dark:active:bg-neutral-800">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900 underline-offset-2 dark:text-white">{title}</p>
        <p className="truncate text-xs text-neutral-500">{sub}</p>
      </div>
      <Chev />
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode="search"
      className="mt-2 h-10 w-full rounded-xl bg-neutral-100 px-3 text-sm outline-none placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-400 dark:bg-neutral-800" />
  );
}

/* ---------- Tumpukan panel (daftar → detail) ---------- */
export type View =
  | { t: 'orang'; o: Orang }
  | { t: 'maList'; title: string; sub: string; items: MaFull[] }
  | { t: 'kList'; title: string; sub: string; items: KonsumenFull[]; mode: 'cabang' | 'orang'; p0: 0 | 1 | 2 | 3; pic?: string }
  | { t: 'ma'; m: MaFull }
  | { t: 'k'; k: KonsumenFull; pic?: string };
export type Push = (v: View) => void;

/* ---------- Daftar MA ---------- */
function MaListView({ items, push }: { items: MaFull[]; push: Push }) {
  const [tab, setTab] = useState<'belum' | 'sudah'>(items.some((m) => !m.f) ? 'belum' : 'sudah');
  const [q, setQ] = useState('');
  const match = (m: MaFull) => !q || `${m.n} ${m.job} ${m.cat}`.toLowerCase().includes(q.toLowerCase());
  const belum = items.filter((m) => !m.f && match(m)).sort((a, b) => a.n.localeCompare(b.n));
  const sudah = items.filter((m) => m.f && match(m)).sort((a, b) => a.f - b.f || a.n.localeCompare(b.n));
  const list = tab === 'belum' ? belum : sudah;
  return (
    <>
      <Seg value={tab} onChange={setTab} options={[['belum', `Belum dimaintain (${belum.length})`], ['sudah', `Sudah (${sudah.length})`]]} />
      {items.length > 8 && <SearchBox value={q} onChange={setQ} placeholder="Cari nama MA atau pekerjaan" />}
      <ul className="mt-3 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {list.length === 0 && <li className="p-6 text-center text-sm text-neutral-500">{tab === 'belum' ? 'Semua MA sudah dimaintain bulan ini.' : 'Belum ada MA yang dimaintain.'}</li>}
        {list.map((m, i) => (
          <li key={m.n + i}>
            <button onClick={() => push({ t: 'ma', m })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-50 dark:active:bg-neutral-800">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{nama(m.n)}</p>
                <p className="truncate text-xs text-neutral-500">{[m.job && nama(m.job), m.t && `terakhir ${tanggal(m.t, true)}`].filter(Boolean).join(' · ') || '–'}</p>
              </div>
              {m.f ? <Pill cls={m.f >= 4 ? 'good' : 'plain'}>{m.f >= 4 ? '≥4X' : `${m.f}X`}</Pill> : <Pill cls="bad">Belum</Pill>}
              <Chev />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Daftar konsumen ---------- */
function KListView({ items, mode, p0, pic, push }: { items: KonsumenFull[]; mode: 'cabang' | 'orang'; p0: 0 | 1 | 2 | 3; pic?: string; push: Push }) {
  const [p, setP] = useState<'0' | '1' | '2' | '3'>(String(p0) as '0');
  const [visit, setVisit] = useState<'belum' | 'sudah'>(mode === 'orang' ? 'sudah' : 'belum');
  const [temu, setTemu] = useState<'semua' | 'bertemu' | 'tidak'>('semua');
  const [q, setQ] = useState('');

  const inP = items.filter((k) => p === '0' || k.p === Number(p));
  const withStatus = inP.map((k) => ({ k, s: statusOf(k, pic) }));
  const belumVisit = withStatus.filter((x) => x.s.key === 'belum');
  const sudahVisit = withStatus.filter((x) => x.s.key !== 'belum');
  const bertemu = sudahVisit.filter((x) => x.s.key === 'bertemu');
  const tidak = sudahVisit.filter((x) => x.s.key === 'tidak');
  const base = visit === 'belum' && mode === 'cabang' ? belumVisit : temu === 'bertemu' ? bertemu : temu === 'tidak' ? tidak : sudahVisit;
  const ql = q.toLowerCase();
  const list = base
    .filter((x) => !ql || `${x.k.n} ${x.k.k}`.toLowerCase().includes(ql))
    .sort((a, b) => a.k.n.localeCompare(b.k.n));
  const count = (n: number) => items.filter((k) => !n || k.p === n).length;

  return (
    <>
      <Seg value={p} onChange={setP}
        options={[['0', `Semua (${count(0)})`], ['1', `P1 (${count(1)})`], ['2', `P2 (${count(2)})`], ['3', `P3 (${count(3)})`]]} />
      {mode === 'cabang' && (
        <div className="mt-2">
          <Seg value={visit} onChange={setVisit} options={[['belum', `Belum visit (${belumVisit.length})`], ['sudah', `Sudah visit (${sudahVisit.length})`]]} />
        </div>
      )}
      {(mode === 'orang' || visit === 'sudah') && (
        <div className="mt-2">
          <Seg value={temu} onChange={setTemu}
            options={[['semua', `Semua (${sudahVisit.length})`], ['bertemu', `Bertemu (${bertemu.length})`], ['tidak', `Belum bertemu (${tidak.length})`]]} />
        </div>
      )}
      {inP.length > 8 && <SearchBox value={q} onChange={setQ} placeholder="Cari nama atau kecamatan" />}
      <ul className="mt-3 divide-y divide-neutral-100 rounded-2xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {list.length === 0 && <li className="p-6 text-center text-sm text-neutral-500">Tidak ada konsumen di kategori ini.</li>}
        {list.map(({ k, s }, i) => (
          <li key={k.n + i}>
            <button onClick={() => push({ t: 'k', k, pic })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-50 dark:active:bg-neutral-800">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{nama(k.n)}</p>
                <p className="truncate text-xs text-neutral-500">
                  {[k.k && `Kec. ${nama(k.k)}`, `P${k.p}`, s.n ? `${s.n}x visit` : ''].filter(Boolean).join(' · ')}
                </p>
              </div>
              <Pill cls={s.cls}>{s.label}</Pill>
              <Chev />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ---------- Detail konsumen ---------- */
function KDetail({ k, pic }: { k: KonsumenFull; pic?: string }) {
  const s = statusOf(k);
  const byKe: Record<number, VisitRow> = {};
  k.v.forEach((v) => { byKe[v.ke] = v; });
  const hl = s.key === 'bertemu' ? `Sudah bertemu di visit ke-${s.ke}` : s.key === 'tidak' ? 'Sudah dikunjungi, belum bertemu' : 'Belum dikunjungi';
  return (
    <>
      <p className="text-xl font-semibold">{nama(k.n)}</p>
      <p className="text-sm text-neutral-500">{[k.k && `Kec. ${nama(k.k)}`, `Prioritas ${k.p}`].filter(Boolean).join(' · ')}</p>
      <div className={`mt-3 rounded-2xl px-4 py-3 text-sm font-semibold ${PILL[s.cls]}`}>
        {hl}
        <span className="block text-xs font-normal opacity-80">{k.v.length ? `${k.v.length} kali visit` : 'Belum ada catatan visit'}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((n) => {
          const v = byKe[n];
          const cls = !v ? '' : isMet(v) ? PILL.good : PILL.mid;
          return (
            <div key={n} className={`rounded-xl border px-1 py-2 text-center text-xs font-semibold ${v ? `border-transparent ${cls}` : 'border-neutral-200 text-neutral-400 dark:border-neutral-800'}`}>
              <span className="block text-sm">V{n}</span>{!v ? 'Belum' : isMet(v) ? 'Bertemu' : 'Tidak'}
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-sm font-semibold text-neutral-500">Data konsumen</p>
      <dl className="mt-1 divide-y divide-neutral-100 dark:divide-neutral-800">
        <Field label="Kecamatan" value={k.k ? nama(k.k) : '–'} />
        <Field label="Prioritas" value={`P${k.p}`} />
        <Field label="Keterangan" value={k.ket} />
        <Field label="Info produk WOM" value={k.info} />
        <Field label="Penawaran WOM" value={k.pen} />
        <Field label="Tanggal inject" value={k.inj ? tanggal(k.inj) : ''} />
      </dl>

      {k.v.length > 0 && (
        <>
          <p className="mt-5 text-sm font-semibold text-neutral-500">Riwayat visit</p>
          <div className="mt-2 space-y-2">
            {k.v.map((v) => (
              <div key={v.ke} className={`rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-800/60 ${pic && keyOf(v.pic) !== keyOf(pic) ? 'opacity-70' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Visit {v.ke} · {tanggal(v.tgl)}</p>
                  <Pill cls={isMet(v) ? 'good' : 'mid'}>{nama(v.st)}</Pill>
                </div>
                <dl className="mt-1 divide-y divide-neutral-100 dark:divide-neutral-700/60">
                  <Field label="Bertemu dengan" value={v.bd} />
                  <Field label="Hasil visit" value={v.h} />
                  <Field label="Keterangan" value={v.kt} />
                  <Field label="PIC visit" value={v.pic ? nama(v.pic) : ''} />
                </dl>
                {v.note && <p className="mt-1 rounded-xl bg-white px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">{v.note}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ---------- Detail MA ---------- */
function MaDetail({ m }: { m: MaFull }) {
  const cls = !m.f ? 'bad' : m.f >= 4 ? 'good' : 'mid';
  return (
    <>
      <p className="text-xl font-semibold">{nama(m.n)}</p>
      <p className="text-sm text-neutral-500">{[m.job && nama(m.job), m.cat && nama(m.cat)].filter(Boolean).join(' · ')}</p>
      <div className={`mt-3 rounded-2xl px-4 py-3 text-sm font-semibold ${PILL[cls]}`}>
        {m.f ? `Sudah dimaintain ${m.f >= 4 ? '4X atau lebih' : m.f + 'X'} bulan ini` : 'Belum dimaintain bulan ini'}
        {m.t && <span className="block text-xs font-normal opacity-80">Terakhir tercatat {tanggal(m.t)}</span>}
      </div>

      <p className="mt-5 text-sm font-semibold text-neutral-500">Profil agent</p>
      <dl className="mt-1 divide-y divide-neutral-100 dark:divide-neutral-800">
        <Field label="Pekerjaan" value={m.job ? nama(m.job) : ''} />
        <Field label="Kategori" value={m.cat ? nama(m.cat) : ''} />
        <Field label="Reason" value={m.reason ? nama(m.reason) : ''} />
        <Field label="MAO" value={m.pic ? nama(m.pic) : ''} />
        <Field label="Tanggal inject" value={m.inj ? tanggal(m.inj) : ''} />
        <Field label="Sales M-1" value={isNum(m.sales) ? angka(m.sales) : ''} />
      </dl>

      <p className="mt-5 text-sm font-semibold text-neutral-500">Maintain bulan ini</p>
      <dl className="mt-1 divide-y divide-neutral-100 dark:divide-neutral-800">
        <Field label="Frekuensi" value={m.f ? (m.f >= 4 ? '≥4X' : `${m.f}X`) : 'Belum'} />
        <Field label="Hasil" value={m.hasil ? nama(m.hasil) : ''} />
      </dl>
      {m.tgl.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {m.tgl.map((t) => <span key={t} className={`rounded-lg px-2 py-1 text-xs font-medium ${PILL.plain}`}>{tanggal(t, true)}</span>)}
        </div>
      )}
    </>
  );
}

/* ---------- Detail satu orang ---------- */
function SalesRows({ label, s, money, bulan }: { label: string; s?: Sales; money?: boolean; bulan: Performa['bulan'] }) {
  const f = money ? rp : angka;
  const diffLalu = s?.diffLalu;
  return (
    <div className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-800/60">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{label}</p>
        <p className={`text-lg font-semibold ${TEXT[tone(s?.ach)]}`}>{persen(s?.ach)}</p>
      </div>
      <div className="mt-2"><Bar ach={s?.ach} /></div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div><dt className="text-xs text-neutral-500">{bulan.lalu}</dt><dd className="font-medium">{f(s?.lalu)}</dd></div>
        <div><dt className="text-xs text-neutral-500">{bulan.ini}</dt><dd className="font-semibold">{f(s?.ini)}</dd></div>
        <div><dt className="text-xs text-neutral-500">Target</dt><dd className="font-medium">{f(s?.target)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-neutral-500">
        vs {bulan.lalu}:{' '}
        <span className={isNum(diffLalu) && diffLalu < 0 ? 'text-red-600 dark:text-red-300' : 'text-green-700 dark:text-green-300'}>
          {isNum(diffLalu) ? (diffLalu > 0 ? '+' : diffLalu < 0 ? '−' : '') + (money ? 'Rp ' + cf.format(Math.abs(diffLalu)) : nf.format(Math.abs(diffLalu))) : '–'}
        </span>
        {' · '}
        {isNum(s?.diffTarget) && s!.diffTarget! < 0
          ? <>kurang <span className="text-neutral-700 dark:text-neutral-200">{money ? 'Rp ' + cf.format(-s!.diffTarget!) : nf.format(-s!.diffTarget!)}</span> ke target</>
          : <span className="text-green-700 dark:text-green-300">target tercapai</span>}
      </p>
    </div>
  );
}

export function RekrutTiles({ r }: { r: RekrutRegist }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {([['Rekrut', r.rekrut], ['Regist', r.regist]] as const).map(([label, x]) => {
        const ach = x && x.target ? x.jumlah / x.target : null;
        const kurang = x && x.target ? Math.max(0, x.target - x.jumlah) : null;
        return (
          <div key={label} className="rounded-xl bg-neutral-50 px-3 py-2 dark:bg-neutral-800/60">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-neutral-500">{label}</span>
              <span className={`text-xs font-semibold ${TEXT[tone(ach)]}`}>{persen(ach)}</span>
            </div>
            <p className="text-lg font-semibold">{x ? x.jumlah : '–'}<span className="text-sm font-normal text-neutral-400">/{x?.target ?? '–'}</span></p>
            <Bar ach={ach} />
            <p className="mt-1 text-xs text-neutral-500">{kurang === null ? '' : kurang ? `Kurang ${kurang}` : 'Target tercapai'}</p>
          </div>
        );
      })}
    </div>
  );
}

export function OrangDetail({ o, rank, total, data, push, hideHeader = false }: { o: Orang; rank: number; total: number; data: Performa; push: Push; hideHeader?: boolean }) {
  const v = o.visit, m = o.maintain;
  const full = data.aktivitas;
  // Daftar lengkap (dengan detail) milik orang ini
  const maItems: MaFull[] = (m?.list || []).map((x) =>
    (x.b && isNum(x.i) && full?.ma?.[x.b]?.[x.i]) ||
    { n: x.n, job: x.job, cat: '', reason: '', f: x.f, tgl: [], t: x.t, pic: o.nama, inj: '', hasil: '', sales: null });
  const kItems: KonsumenFull[] = (v?.list || []).map((x) =>
    (x.b && isNum(x.i) && full?.konsumen?.[x.b]?.[x.i]) ||
    { n: x.n, k: x.k, p: x.p, ket: '', info: '', pen: '', inj: '',
      v: Array.from({ length: x.v }, (_, i) => ({ ke: i + 1, tgl: '', st: x.m && x.ke === i + 1 ? 'Bertemu' : 'Tidak Bertemu', bd: '', h: '', kt: '', pic: o.nama, note: '' })) });

  return (
    <>
      {!hideHeader && (
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-lg font-semibold text-white dark:bg-white dark:text-neutral-900">{initials(o.nama)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{nama(o.nama)}</p>
          <p className="text-sm text-neutral-500">{[o.brand && nama(o.brand), rank ? `Peringkat ${rank} dari ${total} (amount)` : ''].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      )}

      {(o.unit || o.amount) && (
        <section className={`${hideHeader ? '' : 'mt-5'} space-y-3`}>
          <p className="text-sm font-semibold text-neutral-500">Sales</p>
          <SalesRows label="Amount" s={o.amount} money bulan={data.bulan} />
          <SalesRows label="Unit" s={o.unit} bulan={data.bulan} />
        </section>
      )}

      {m && (
        <section className="mt-5">
          <p className="text-sm font-semibold text-neutral-500">Maintain MA</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="MA dipegang" value={angka(m.ma)} strong />
            <Stat label="Sudah" value={angka(m.sudah)} strong className="text-green-700 dark:text-green-300" />
            <Stat label="Belum" value={angka(m.belum)} strong className={m.belum ? 'text-red-600 dark:text-red-300' : ''} />
          </div>
          <p className="mt-2 text-xs text-neutral-500">Minimal 2X: {m.x2} · 3X: {m.x3} · 4X: {m.x4}</p>
          {maItems.length > 0 && (
            <OpenRow title="Lihat nama MA" sub={m.belum ? `${m.belum} belum dimaintain` : 'Semua sudah dimaintain'}
              onClick={() => push({ t: 'maList', title: 'MA yang dipegang', sub: nama(o.nama), items: maItems })} />
          )}
        </section>
      )}

      {o.rekrut && (
        <section className="mt-5">
          <p className="text-sm font-semibold text-neutral-500">Rekrut & regist MA · {nama(o.brand)}</p>
          <div className="mt-2"><RekrutTiles r={o.rekrut} /></div>
        </section>
      )}

      {v && (
        <section className="mt-5">
          <p className="text-sm font-semibold text-neutral-500">Visit konsumen prioritas</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="Dikunjungi" value={angka(v.konsumen)} strong />
            <Stat label="Bertemu" value={angka(v.ditemui)} strong className="text-green-700 dark:text-green-300" />
            <Stat label="Belum bertemu" value={angka(v.konsumen - v.ditemui)} strong className={v.konsumen - v.ditemui ? 'text-amber-700 dark:text-amber-300' : ''} />
          </div>
          <p className="mt-2 text-xs text-neutral-500">Total {v.total} kali visit · ketuk prioritas untuk melihat nama konsumen</p>
          {([1, 2, 3] as const).map((p) => {
            const inP = (v.list || []).filter((k) => k.p === p);
            if (!inP.length) return null;
            const met = inP.filter((k) => k.m).length;
            return (
              <OpenRow key={p} title={`Prioritas ${p} · ${inP.length} konsumen`} sub={`${met} bertemu · ${inP.length - met} belum bertemu`}
                onClick={() => push({ t: 'kList', title: 'Konsumen yang dikunjungi', sub: nama(o.nama), items: kItems, mode: 'orang', p0: p, pic: o.nama })} />
            );
          })}
        </section>
      )}

      {o.oi && (
        <section className="mt-5">
          <p className="text-sm font-semibold text-neutral-500">Order in</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="Total OI" value={`${angka(o.oi.total)} / ${angka(o.oi.target)}`} strong />
            <Stat label="Pencapaian" value={persen(o.oi.ach)} strong className={TEXT[tone(o.oi.ach)]} />
            <Stat label="Success rate" value={persen(o.oi.successRate)} strong />
            <Stat label="Golive" value={angka(o.oi.golive)} />
            <Stat label="Pending" value={angka(o.oi.pending)} />
            <Stat label="Reject" value={angka(o.oi.reject)} />
          </div>
        </section>
      )}
    </>
  );
}

/* ---------- Panel bertumpuk ---------- */
export function Sheet({ stack, data, rankOf, push, pop, close }: {
  stack: View[]; data: Performa; rankOf: (n: string) => [number, number]; push: Push; pop: () => void; close: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') pop(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pop]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-t-3xl bg-white dark:bg-neutral-900">
        {stack.map((view, idx) => {
          const top = idx === stack.length - 1;
          // Semua panel tetap terpasang supaya filter & posisi scroll tidak hilang saat kembali
          return (
            <div key={idx} className={`max-h-[90dvh] overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3 ${top ? '' : 'hidden'}`}>
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              <div className="mb-3 flex items-center justify-between">
                {idx > 0
                  ? <button onClick={pop} className="-ml-2 flex min-h-11 items-center px-2 text-[15px] font-semibold">‹ Kembali</button>
                  : <span />}
                <button onClick={close} className="-mr-2 flex min-h-11 items-center px-2 text-[15px] text-neutral-500">Tutup</button>
              </div>
              {view.t === 'orang' && (() => { const [r, n] = rankOf(view.o.nama); return <OrangDetail o={view.o} rank={r} total={n} data={data} push={push} />; })()}
              {view.t === 'maList' && (<>
                <p className="text-lg font-semibold">{view.title}</p>
                <p className="mb-3 text-sm text-neutral-500">{view.sub}</p>
                <MaListView items={view.items} push={push} />
              </>)}
              {view.t === 'kList' && (<>
                <p className="text-lg font-semibold">{view.title}</p>
                <p className="mb-3 text-sm text-neutral-500">{view.sub}</p>
                <KListView items={view.items} mode={view.mode} p0={view.p0} pic={view.pic} push={push} />
              </>)}
              {view.t === 'k' && <KDetail k={view.k} pic={view.pic} />}
              {view.t === 'ma' && <MaDetail m={view.m} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
