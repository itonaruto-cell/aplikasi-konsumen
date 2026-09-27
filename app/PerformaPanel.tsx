'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Aktivitas, KonsumenFull, MaFull, Orang, Performa, RekrutRegist, Sales, VisitRow } from '../lib/performa-types';

/* ---------- Format ---------- */
const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const cf = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const angka = (v?: number | null) => (isNum(v) ? nf.format(v) : '–');
const rp = (v?: number | null) => (isNum(v) ? 'Rp ' + cf.format(v) : '–');
const persen = (v?: number | null) => (isNum(v) ? nf.format(Math.round(v * 100)) + '%' : '–');
const tone = (ach?: number | null) =>
  !isNum(ach) ? 'none' : ach >= 1 ? 'good' : ach >= 0.5 ? 'mid' : 'bad';
const TEXT: Record<string, string> = {
  good: 'text-green-700 dark:text-green-300', mid: 'text-amber-700 dark:text-amber-300',
  bad: 'text-red-600 dark:text-red-300', none: 'text-slate-400',
};
const BAR: Record<string, string> = { good: 'bg-green-500', mid: 'bg-amber-500', bad: 'bg-red-500', none: 'bg-slate-300' };
const PILL: Record<string, string> = {
  good: 'bg-green-50 text-green-700 dark:bg-green-400/15 dark:text-green-300',
  mid: 'bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  bad: 'bg-red-50 text-red-600 dark:bg-red-400/15 dark:text-red-300',
  plain: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};
// HURUF BESAR → Huruf Besar, tapi singkatan umum tetap kapital (BPR, MA, OI, WOM, …)
const ACRONYM = new Set(['BPR', 'MA', 'MAO', 'OI', 'WOM', 'NSC', 'BM', 'NC', 'AC', 'AMS', 'BRI', 'BCA', 'BNI', 'BTN', 'PT', 'CV', 'KSP', 'KUD', 'SPD', 'CMO', 'NB']);
const nama = (n: string) => String(n || '').split(/(\s+|\/)/)
  .map((w) => (ACRONYM.has(w.toUpperCase()) ? w.toUpperCase() : w.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())))
  .join('');
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const keyOf = (s: string) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
const waktu = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const tanggal = (s: string | null, short = false) => {
  if (!s) return '';
  const d = new Date(s.slice(0, 10) + 'T00:00:00');
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('id-ID', short ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long', year: 'numeric' });
};
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/* ---------- Status konsumen ---------- */
const isMet = (v: VisitRow) => /^bertemu$/i.test(String(v.st || '').trim());
// pic: kalau diisi, hanya visit oleh orang itu yang dihitung
const visitsOf = (k: KonsumenFull, pic?: string) => (pic ? k.v.filter((v) => keyOf(v.pic) === keyOf(pic)) : k.v);
function statusOf(k: KonsumenFull, pic?: string) {
  const vs = visitsOf(k, pic);
  const met = vs.filter(isMet)[0];
  if (!vs.length) return { key: 'belum' as const, label: 'Belum visit', cls: 'bad', ke: 0, n: 0 };
  if (met) return { key: 'bertemu' as const, label: `Bertemu V${met.ke}`, cls: 'good', ke: met.ke, n: vs.length };
  return { key: 'tidak' as const, label: 'Belum bertemu', cls: 'mid', ke: 0, n: vs.length };
}

/* ---------- Komponen kecil ---------- */
function Bar({ ach, className = 'h-1.5' }: { ach?: number | null; className?: string }) {
  const w = isNum(ach) ? Math.max(0, Math.min(100, ach * 100)) : 0;
  return (
    <div className={`${className} w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800`}>
      <div className={`h-full rounded-full ${BAR[tone(ach)]}`} style={{ width: `${w}%` }} />
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} aria-pressed={value === k}
          className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition ${value === k
            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
            : 'text-slate-500 dark:text-slate-400'}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Chev() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function Pill({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${PILL[cls]}`}>{children}</span>;
}

function Stat({ label, value, strong = false, className = '' }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`${strong ? 'text-lg font-semibold' : 'font-medium'} ${className}`}>{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="text-right font-medium break-words">{value}</dd>
    </div>
  );
}

function OpenRow({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="mt-2 flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left active:bg-slate-50 dark:border-slate-700 dark:active:bg-slate-800">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#1F4E78] dark:text-sky-300">{title}</p>
        <p className="truncate text-xs text-slate-500">{sub}</p>
      </div>
      <Chev />
    </button>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode="search"
      className="mt-2 h-10 w-full rounded-xl bg-slate-100 px-3 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-sky-300 dark:bg-slate-800" />
  );
}

/* ---------- Tumpukan panel (daftar → detail) ---------- */
type View =
  | { t: 'orang'; o: Orang }
  | { t: 'maList'; title: string; sub: string; items: MaFull[] }
  | { t: 'kList'; title: string; sub: string; items: KonsumenFull[]; mode: 'cabang' | 'orang'; p0: 0 | 1 | 2 | 3; pic?: string }
  | { t: 'ma'; m: MaFull }
  | { t: 'k'; k: KonsumenFull; pic?: string };
type Push = (v: View) => void;

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
      <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {list.length === 0 && <li className="p-6 text-center text-sm text-slate-500">{tab === 'belum' ? 'Semua MA sudah dimaintain bulan ini.' : 'Belum ada MA yang dimaintain.'}</li>}
        {list.map((m, i) => (
          <li key={m.n + i}>
            <button onClick={() => push({ t: 'ma', m })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{nama(m.n)}</p>
                <p className="truncate text-xs text-slate-500">{[m.job && nama(m.job), m.t && `terakhir ${tanggal(m.t, true)}`].filter(Boolean).join(' · ') || '–'}</p>
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
      <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {list.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Tidak ada konsumen di kategori ini.</li>}
        {list.map(({ k, s }, i) => (
          <li key={k.n + i}>
            <button onClick={() => push({ t: 'k', k, pic })} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{nama(k.n)}</p>
                <p className="truncate text-xs text-slate-500">
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
      <p className="text-sm text-slate-500">{[k.k && `Kec. ${nama(k.k)}`, `Prioritas ${k.p}`].filter(Boolean).join(' · ')}</p>
      <div className={`mt-3 rounded-2xl px-4 py-3 text-sm font-semibold ${PILL[s.cls]}`}>
        {hl}
        <span className="block text-xs font-normal opacity-80">{k.v.length ? `${k.v.length} kali visit` : 'Belum ada catatan visit'}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((n) => {
          const v = byKe[n];
          const cls = !v ? '' : isMet(v) ? PILL.good : PILL.mid;
          return (
            <div key={n} className={`rounded-xl border px-1 py-2 text-center text-[11px] font-semibold ${v ? `border-transparent ${cls}` : 'border-slate-200 text-slate-400 dark:border-slate-800'}`}>
              <span className="block text-sm">V{n}</span>{!v ? 'Belum' : isMet(v) ? 'Bertemu' : 'Tidak'}
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-sm font-semibold text-slate-500">Data konsumen</p>
      <dl className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
        <Field label="Kecamatan" value={k.k ? nama(k.k) : '–'} />
        <Field label="Prioritas" value={`P${k.p}`} />
        <Field label="Keterangan" value={k.ket} />
        <Field label="Info produk WOM" value={k.info} />
        <Field label="Penawaran WOM" value={k.pen} />
        <Field label="Tanggal inject" value={k.inj ? tanggal(k.inj) : ''} />
      </dl>

      {k.v.length > 0 && (
        <>
          <p className="mt-5 text-sm font-semibold text-slate-500">Riwayat visit</p>
          <div className="mt-2 space-y-2">
            {k.v.map((v) => (
              <div key={v.ke} className={`rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60 ${pic && keyOf(v.pic) !== keyOf(pic) ? 'opacity-70' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Visit {v.ke} · {tanggal(v.tgl)}</p>
                  <Pill cls={isMet(v) ? 'good' : 'mid'}>{nama(v.st)}</Pill>
                </div>
                <dl className="mt-1 divide-y divide-slate-100 dark:divide-slate-700/60">
                  <Field label="Bertemu dengan" value={v.bd} />
                  <Field label="Hasil visit" value={v.h} />
                  <Field label="Keterangan" value={v.kt} />
                  <Field label="PIC visit" value={v.pic ? nama(v.pic) : ''} />
                </dl>
                {v.note && <p className="mt-1 rounded-xl bg-white px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">{v.note}</p>}
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
      <p className="text-sm text-slate-500">{[m.job && nama(m.job), m.cat && nama(m.cat)].filter(Boolean).join(' · ')}</p>
      <div className={`mt-3 rounded-2xl px-4 py-3 text-sm font-semibold ${PILL[cls]}`}>
        {m.f ? `Sudah dimaintain ${m.f >= 4 ? '4X atau lebih' : m.f + 'X'} bulan ini` : 'Belum dimaintain bulan ini'}
        {m.t && <span className="block text-xs font-normal opacity-80">Terakhir tercatat {tanggal(m.t)}</span>}
      </div>

      <p className="mt-5 text-sm font-semibold text-slate-500">Profil agent</p>
      <dl className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
        <Field label="Pekerjaan" value={m.job ? nama(m.job) : ''} />
        <Field label="Kategori" value={m.cat ? nama(m.cat) : ''} />
        <Field label="Reason" value={m.reason ? nama(m.reason) : ''} />
        <Field label="MAO" value={m.pic ? nama(m.pic) : ''} />
        <Field label="Tanggal inject" value={m.inj ? tanggal(m.inj) : ''} />
        <Field label="Sales M-1" value={isNum(m.sales) ? angka(m.sales) : ''} />
      </dl>

      <p className="mt-5 text-sm font-semibold text-slate-500">Maintain bulan ini</p>
      <dl className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
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
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{label}</p>
        <p className={`text-lg font-semibold ${TEXT[tone(s?.ach)]}`}>{persen(s?.ach)}</p>
      </div>
      <div className="mt-2"><Bar ach={s?.ach} /></div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div><dt className="text-xs text-slate-500">{bulan.lalu}</dt><dd className="font-medium">{f(s?.lalu)}</dd></div>
        <div><dt className="text-xs text-slate-500">{bulan.ini}</dt><dd className="font-semibold">{f(s?.ini)}</dd></div>
        <div><dt className="text-xs text-slate-500">Target</dt><dd className="font-medium">{f(s?.target)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-slate-500">
        vs {bulan.lalu}:{' '}
        <span className={isNum(diffLalu) && diffLalu < 0 ? 'text-red-600 dark:text-red-300' : 'text-green-700 dark:text-green-300'}>
          {isNum(diffLalu) ? (diffLalu > 0 ? '+' : diffLalu < 0 ? '−' : '') + (money ? 'Rp ' + cf.format(Math.abs(diffLalu)) : nf.format(Math.abs(diffLalu))) : '–'}
        </span>
        {' · '}
        {isNum(s?.diffTarget) && s!.diffTarget! < 0
          ? <>kurang <span className="text-slate-700 dark:text-slate-200">{money ? 'Rp ' + cf.format(-s!.diffTarget!) : nf.format(-s!.diffTarget!)}</span> ke target</>
          : <span className="text-green-700 dark:text-green-300">target tercapai</span>}
      </p>
    </div>
  );
}

function RekrutTiles({ r }: { r: RekrutRegist }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {([['Rekrut', r.rekrut], ['Regist', r.regist]] as const).map(([label, x]) => {
        const ach = x && x.target ? x.jumlah / x.target : null;
        const kurang = x && x.target ? Math.max(0, x.target - x.jumlah) : null;
        return (
          <div key={label} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <span className={`text-xs font-semibold ${TEXT[tone(ach)]}`}>{persen(ach)}</span>
            </div>
            <p className="text-lg font-semibold">{x ? x.jumlah : '–'}<span className="text-sm font-normal text-slate-400">/{x?.target ?? '–'}</span></p>
            <Bar ach={ach} />
            <p className="mt-1 text-[11px] text-slate-500">{kurang === null ? '' : kurang ? `Kurang ${kurang}` : 'Target tercapai'}</p>
          </div>
        );
      })}
    </div>
  );
}

function OrangDetail({ o, rank, total, data, push }: { o: Orang; rank: number; total: number; data: Performa; push: Push }) {
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
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1F4E78] text-lg font-semibold text-white">{initials(o.nama)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{nama(o.nama)}</p>
          <p className="text-sm text-slate-500">{[o.brand && nama(o.brand), rank ? `Peringkat ${rank} dari ${total} (amount)` : ''].filter(Boolean).join(' · ')}</p>
        </div>
      </div>

      {(o.unit || o.amount) && (
        <section className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-slate-500">Sales</p>
          <SalesRows label="Amount" s={o.amount} money bulan={data.bulan} />
          <SalesRows label="Unit" s={o.unit} bulan={data.bulan} />
        </section>
      )}

      {m && (
        <section className="mt-5">
          <p className="text-sm font-semibold text-slate-500">Maintain MA</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="MA dipegang" value={angka(m.ma)} strong />
            <Stat label="Sudah" value={angka(m.sudah)} strong className="text-green-700 dark:text-green-300" />
            <Stat label="Belum" value={angka(m.belum)} strong className={m.belum ? 'text-red-600 dark:text-red-300' : ''} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Minimal 2X: {m.x2} · 3X: {m.x3} · 4X: {m.x4}</p>
          {maItems.length > 0 && (
            <OpenRow title="Lihat nama MA" sub={m.belum ? `${m.belum} belum dimaintain` : 'Semua sudah dimaintain'}
              onClick={() => push({ t: 'maList', title: 'MA yang dipegang', sub: nama(o.nama), items: maItems })} />
          )}
        </section>
      )}

      {o.rekrut && (
        <section className="mt-5">
          <p className="text-sm font-semibold text-slate-500">Rekrut & regist MA · {nama(o.brand)}</p>
          <div className="mt-2"><RekrutTiles r={o.rekrut} /></div>
        </section>
      )}

      {v && (
        <section className="mt-5">
          <p className="text-sm font-semibold text-slate-500">Visit konsumen prioritas</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Stat label="Dikunjungi" value={angka(v.konsumen)} strong />
            <Stat label="Bertemu" value={angka(v.ditemui)} strong className="text-green-700 dark:text-green-300" />
            <Stat label="Belum bertemu" value={angka(v.konsumen - v.ditemui)} strong className={v.konsumen - v.ditemui ? 'text-amber-700 dark:text-amber-300' : ''} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Total {v.total} kali visit · ketuk prioritas untuk melihat nama konsumen</p>
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
          <p className="text-sm font-semibold text-slate-500">Order in</p>
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
function Sheet({ stack, data, rankOf, push, pop, close }: {
  stack: View[]; data: Performa; rankOf: (n: string) => [number, number]; push: Push; pop: () => void; close: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') pop(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pop]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl rounded-t-3xl bg-white dark:bg-slate-900">
        {stack.map((view, idx) => {
          const top = idx === stack.length - 1;
          // Semua panel tetap terpasang supaya filter & posisi scroll tidak hilang saat kembali
          return (
            <div key={idx} className={`max-h-[88vh] overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3 ${top ? '' : 'hidden'}`}>
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
              <div className="mb-3 flex items-center justify-between">
                {idx > 0
                  ? <button onClick={pop} className="text-sm font-medium text-[#1F4E78] dark:text-sky-300">‹ Kembali</button>
                  : <span />}
                <button onClick={close} className="text-sm text-slate-500">Tutup</button>
              </div>
              {view.t === 'orang' && (() => { const [r, n] = rankOf(view.o.nama); return <OrangDetail o={view.o} rank={r} total={n} data={data} push={push} />; })()}
              {view.t === 'maList' && (<>
                <p className="text-lg font-semibold">{view.title}</p>
                <p className="mb-3 text-sm text-slate-500">{view.sub}</p>
                <MaListView items={view.items} push={push} />
              </>)}
              {view.t === 'kList' && (<>
                <p className="text-lg font-semibold">{view.title}</p>
                <p className="mb-3 text-sm text-slate-500">{view.sub}</p>
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

/* ---------- Aktivitas cabang ---------- */
const BRANDS: ['mobilku' | 'motorku', string][] = [['mobilku', 'Mobilku'], ['motorku', 'Motorku']];

function AktivitasCabang({ a, push }: { a: Aktivitas; push: Push }) {
  const [brand, setBrand] = useState<'mobilku' | 'motorku'>('mobilku');
  const v = a.visit[brand];
  const brandLabel = brand === 'mobilku' ? 'Mobilku' : 'Motorku';
  return (
    <>
      <h2 className="mt-6 text-sm font-semibold text-slate-500">Aktivitas cabang</h2>

      <div className="mt-2 rounded-2xl bg-white p-2 dark:bg-slate-900">
        <p className="px-2 pt-2 text-sm font-medium">Maintain MA</p>
        {BRANDS.map(([k, label]) => {
          const m = a.maintain[k];
          if (!m) return null;
          const items = a.ma?.[k];
          return (
            <button key={k} disabled={!items?.length}
              onClick={() => items && push({ t: 'maList', title: `MA ${label}`, sub: `${m.ma} MA · cabang`, items })}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left active:bg-slate-50 disabled:active:bg-transparent dark:active:bg-slate-800">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{label}</span>
                  <span><b className="text-base">{m.sudah}</b><span className="text-slate-400">/{m.ma} MA</span></span>
                </div>
                <div className="mt-1"><Bar ach={ratio(m.sudah, m.ma)} /></div>
                <p className="mt-1 text-xs text-slate-500">
                  {m.belum ? <><span className="font-medium text-red-600 dark:text-red-300">{m.belum} belum</span> dimaintain bulan ini</> : 'Semua sudah dimaintain bulan ini'}
                </p>
              </div>
              {!!items?.length && <Chev />}
            </button>
          );
        })}
      </div>

      {a.rekrut && (
        <div className="mt-3 rounded-2xl bg-white p-4 dark:bg-slate-900">
          <p className="text-sm font-medium">Rekrut & regist MA</p>
          <div className="mt-3 space-y-3">
            {BRANDS.map(([k, label]) => a.rekrut?.[k] && (
              <div key={k}>
                <p className="mb-1.5 text-xs font-medium text-slate-500">{label}</p>
                <RekrutTiles r={a.rekrut[k]} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 rounded-2xl bg-white p-2 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3 px-2 pt-2">
          <p className="text-sm font-medium">Visit prioritas</p>
          <div className="w-48"><Seg value={brand} options={BRANDS} onChange={setBrand} /></div>
        </div>
        <div className="mt-1">
          {(['p1', 'p2', 'p3'] as const).map((p, i) => {
            const x = v?.[p];
            if (!x) return null;
            const belum = x.database - x.tervisit;
            const items = a.konsumen?.[brand];
            return (
              <button key={p} disabled={!items?.length}
                onClick={() => items && push({ t: 'kList', title: `Konsumen prioritas ${brandLabel}`, sub: 'Cabang · ketuk nama untuk detail', items, mode: 'cabang', p0: (i + 1) as 1 | 2 | 3 })}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left active:bg-slate-50 disabled:active:bg-transparent dark:active:bg-slate-800">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">Prioritas {i + 1}</span>
                    <span><b className="text-base">{x.tervisit}</b><span className="text-slate-400">/{x.database} tervisit</span></span>
                  </div>
                  <div className="mt-1"><Bar ach={ratio(x.tervisit, x.database)} /></div>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="text-green-700 dark:text-green-300">{x.ditemui} bertemu</span>
                    {' · '}{x.tervisit - x.ditemui} belum bertemu
                    {' · '}<span className={belum ? 'text-red-600 dark:text-red-300' : ''}>{belum} belum visit</span>
                  </p>
                </div>
                {!!items?.length && <Chev />}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ---------- Panel utama ---------- */
type SortKey = 'amount' | 'unit';
const achOf = (o: Orang, k: SortKey) => (k === 'amount' ? o.amount?.ach : o.unit?.ach) ?? null;

function Metric({ label, s, money, active }: { label: string; s?: Sales; money?: boolean; active: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span className={`text-xs ${active ? 'font-medium text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}>{label}</span>
        <span className={`text-sm font-semibold ${TEXT[tone(s?.ach)]}`}>{persen(s?.ach)}</span>
      </div>
      <div className="mt-1"><Bar ach={s?.ach} /></div>
      <p className="mt-1 truncate text-[11px] text-slate-500">
        {s ? (money ? `${rp(s.ini)} / ${rp(s.target)}` : `${angka(s.ini)} / ${angka(s.target)} unit`) : 'Belum ada data'}
      </p>
    </div>
  );
}

export default function PerformaPanel({ reloadKey = 0 }: { reloadKey?: number }) {
  const [data, setData] = useState<Performa | null>(null);
  const [kosong, setKosong] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sort, setSort] = useState<SortKey>('amount');
  const [stack, setStack] = useState<View[]>([]);
  const push: Push = (v) => setStack((s) => [...s, v]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const close = () => setStack([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = await fetch('/api/performa', { cache: 'no-store' });
        if (res.status === 401) { window.location.href = '/login'; return; }
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) setErr(json?.error || 'Performa gagal dimuat.');
        else if (json?.kosong) { setKosong(true); setData(null); }
        else { setKosong(false); setData(json as Performa); }
      } catch {
        if (alive) setErr('Koneksi bermasalah. Periksa internet lalu coba lagi.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  useEffect(() => {
    document.body.style.overflow = stack.length ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [stack.length]);

  // Peringkat hanya untuk yang punya data sales (amount / unit)
  const ranked = useMemo(() => {
    const list = (data?.orang || []).filter((o) => o.amount || o.unit);
    return list.sort((a, b) => {
      const sa = achOf(a, sort), sb = achOf(b, sort);
      if (sa === null && sb === null) return a.nama.localeCompare(b.nama);
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sb - sa;
    });
  }, [data, sort]);

  const amountRank = useMemo(() => {
    const m = new Map<string, number>();
    [...(data?.orang || [])].filter((o) => isNum(o.amount?.ach))
      .sort((a, b) => (b.amount!.ach as number) - (a.amount!.ach as number))
      .forEach((o, i) => m.set(o.nama, i + 1));
    return m;
  }, [data]);

  if (loading && !data) {
    return (
      <section className="space-y-3 px-5 pt-4">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />)}
      </section>
    );
  }
  if (err) {
    return <p className="mx-5 mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{err}</p>;
  }
  if (kosong || !data) {
    return (
      <div className="mx-5 mt-4 rounded-2xl bg-white p-8 text-center dark:bg-slate-900">
        <p className="font-medium">Belum ada data performa</p>
        <p className="mt-1 text-sm text-slate-500">Data muncul setelah Apps Script pantauan cabang mengirim kiriman pertamanya.</p>
      </div>
    );
  }

  const t = data.cabangTotal;
  return (
    <section className="px-5 pt-4">
      <p className="text-xs text-slate-500">
        Cabang {nama(data.cabang)} · data per {tanggal(data.updated)} · diperbarui {waktu(data.dikirim)}
      </p>

      {/* Pencapaian cabang: amount & unit */}
      <div className="mt-3 rounded-2xl bg-white p-4 dark:bg-slate-900">
        <p className="text-sm font-medium">Pencapaian cabang · {data.bulan.ini}</p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          {([['Amount', t.amount, true], ['Unit', t.unit, false]] as const).map(([label, s, money]) => (
            <div key={label}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-3xl font-semibold leading-tight ${TEXT[tone(s?.ach)]}`}>{persen(s?.ach)}</p>
              <p className="mb-2 text-xs text-slate-500">{s ? (money ? `${rp(s.ini)} dari ${rp(s.target)}` : `${angka(s.ini)} dari ${angka(s.target)} unit`) : '–'}</p>
              <Bar ach={s?.ach} className="h-2" />
            </div>
          ))}
        </div>
      </div>

      {/* Peringkat */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-500">Peringkat tim</h2>
        <div className="w-44"><Seg value={sort} onChange={setSort} options={[['amount', 'Amount'], ['unit', 'Unit']]} /></div>
      </div>
      <ul className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {ranked.map((o, i) => (
          <li key={o.nama} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
            <button onClick={() => setStack([{ t: 'orang', o }])} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
              <span className="mt-2 w-5 shrink-0 text-center text-sm font-semibold text-slate-500">{achOf(o, sort) !== null ? i + 1 : '–'}</span>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1F4E78]/10 text-sm font-semibold text-[#1F4E78] dark:bg-sky-400/15 dark:text-sky-300">
                {initials(o.nama)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{nama(o.nama)}</p>
                <p className="truncate text-xs text-slate-500">{nama(o.brand)}</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Metric label="Amount" s={o.amount} money active={sort === 'amount'} />
                  <Metric label="Unit" s={o.unit} active={sort === 'unit'} />
                </div>
              </div>
              <span className="mt-2"><Chev /></span>
            </button>
          </li>
        ))}
      </ul>
      <p className="px-1 pt-2 text-xs text-slate-500">Ketuk nama untuk detail performa, daftar MA, dan konsumen yang dikunjungi.</p>

      {data.aktivitas && <AktivitasCabang a={data.aktivitas} push={push} />}

      <p className="px-1 py-4 text-xs text-slate-500">Angka diperbarui otomatis tiap 30 menit dari sheet pantauan cabang. Ketuk baris maintain atau prioritas untuk melihat nama.</p>

      {stack.length > 0 && (
        <Sheet stack={stack} data={data} push={push} pop={pop} close={close}
          rankOf={(n) => [amountRank.get(n) || 0, amountRank.size]} />
      )}
    </section>
  );
}
