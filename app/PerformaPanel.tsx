'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Aktivitas, KonsumenVisit, MaItem, Orang, Performa, RekrutRegist, Sales } from '../lib/performa-types';

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
const nama = (n: string) => n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
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
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${value === k
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

/* ---------- Peringkat ---------- */
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

/* ---------- Rekrut & regist ---------- */
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

/* ---------- Aktivitas cabang ---------- */
const BRANDS: ['mobilku' | 'motorku', string][] = [['mobilku', 'Mobilku'], ['motorku', 'Motorku']];

function AktivitasCabang({ a }: { a: Aktivitas }) {
  const [brand, setBrand] = useState<'mobilku' | 'motorku'>('mobilku');
  const v = a.visit[brand];
  return (
    <>
      <h2 className="mt-6 text-sm font-semibold text-slate-500">Aktivitas cabang</h2>

      <div className="mt-2 rounded-2xl bg-white p-4 dark:bg-slate-900">
        <p className="text-sm font-medium">Maintain MA</p>
        <div className="mt-3 space-y-3">
          {BRANDS.map(([k, label]) => {
            const m = a.maintain[k];
            if (!m) return null;
            return (
              <div key={k}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>{label}</span>
                  <span><b className="text-base">{m.sudah}</b><span className="text-slate-400">/{m.ma} MA</span></span>
                </div>
                <div className="mt-1"><Bar ach={ratio(m.sudah, m.ma)} /></div>
                <p className="mt-1 text-xs text-slate-500">
                  {m.belum ? <><span className="font-medium text-red-600 dark:text-red-300">{m.belum} belum</span> dimaintain bulan ini</> : 'Semua sudah dimaintain bulan ini'}
                </p>
              </div>
            );
          })}
        </div>
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

      <div className="mt-3 rounded-2xl bg-white p-4 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Visit prioritas</p>
          <div className="w-48"><Seg value={brand} options={BRANDS} onChange={setBrand} /></div>
        </div>
        <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
          {(['p1', 'p2', 'p3'] as const).map((p, i) => {
            const x = v?.[p];
            if (!x) return null;
            const belum = x.database - x.tervisit;
            return (
              <div key={p} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">Prioritas {i + 1}</span>
                  <span><b className="text-base">{x.tervisit}</b><span className="text-slate-400">/{x.database} tervisit</span></span>
                </div>
                <div className="mt-1"><Bar ach={ratio(x.tervisit, x.database)} /></div>
                <p className="mt-1 text-xs text-slate-500">
                  <span className="text-green-700 dark:text-green-300">{x.ditemui} ditemui</span>
                  {' · '}{x.tervisit - x.ditemui} belum ditemui
                  {' · '}<span className={belum ? 'text-red-600 dark:text-red-300' : ''}>{belum} belum visit</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
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

function Stat({ label, value, strong = false, className = '' }: { label: string; value: string; strong?: boolean; className?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`${strong ? 'text-lg font-semibold' : 'font-medium'} ${className}`}>{value}</p>
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

type Sub = { kind: 'ma' } | { kind: 'visit'; p: 0 | 1 | 2 | 3 };

function MaList({ list }: { list: MaItem[] }) {
  const [tab, setTab] = useState<'belum' | 'sudah'>(list.some((m) => !m.f) ? 'belum' : 'sudah');
  const belum = list.filter((m) => !m.f).sort((a, b) => a.n.localeCompare(b.n));
  const sudah = list.filter((m) => m.f).sort((a, b) => a.f - b.f || a.n.localeCompare(b.n));
  const items = tab === 'belum' ? belum : sudah;
  return (
    <>
      <Seg value={tab} onChange={setTab} options={[['belum', `Belum dimaintain (${belum.length})`], ['sudah', `Sudah (${sudah.length})`]]} />
      <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {items.length === 0 && <li className="p-6 text-center text-sm text-slate-500">{tab === 'belum' ? 'Semua MA sudah dimaintain bulan ini.' : 'Belum ada MA yang dimaintain.'}</li>}
        {items.map((m, i) => (
          <li key={m.n + i} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{nama(m.n)}</p>
              {m.job && <p className="truncate text-xs text-slate-500">{nama(m.job)}</p>}
            </div>
            {m.f ? (
              <div className="shrink-0 text-right">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m.f >= 4 ? 'bg-green-50 text-green-700 dark:bg-green-400/15 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {m.f >= 4 ? '≥4X' : `${m.f}X`}
                </span>
                {m.t && <p className="mt-1 text-[11px] text-slate-500">terakhir {tanggal(m.t, true)}</p>}
              </div>
            ) : (
              <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-400/15 dark:text-red-300">Belum</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function VisitList({ list, p0 }: { list: KonsumenVisit[]; p0: 0 | 1 | 2 | 3 }) {
  const [p, setP] = useState<'0' | '1' | '2' | '3'>(String(p0) as '0');
  const inP = list.filter((k) => p === '0' || k.p === Number(p));
  const [tab, setTab] = useState<'belum' | 'sudah'>('belum');
  const belum = inP.filter((k) => !k.m).sort((a, b) => a.n.localeCompare(b.n));
  const sudah = inP.filter((k) => k.m).sort((a, b) => a.n.localeCompare(b.n));
  const items = tab === 'belum' ? belum : sudah;
  const count = (n: number) => list.filter((k) => !n || k.p === n).length;
  return (
    <>
      <Seg value={p} onChange={setP}
        options={[['0', `Semua (${count(0)})`], ['1', `P1 (${count(1)})`], ['2', `P2 (${count(2)})`], ['3', `P3 (${count(3)})`]]} />
      <div className="mt-2">
        <Seg value={tab} onChange={setTab} options={[['belum', `Belum ditemui (${belum.length})`], ['sudah', `Sudah ditemui (${sudah.length})`]]} />
      </div>
      <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {items.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Tidak ada konsumen di kategori ini.</li>}
        {items.map((k, i) => (
          <li key={k.n + i} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{nama(k.n)}</p>
              <p className="truncate text-xs text-slate-500">{[k.k && `Kec. ${nama(k.k)}`, `P${k.p}`, `${k.v}x visit`].filter(Boolean).join(' · ')}</p>
            </div>
            {k.m ? (
              <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-400/15 dark:text-green-300">Ditemui V{k.ke}</span>
            ) : (
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">Belum ditemui</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function Detail({ o, rank, total, bulan, onClose }: { o: Orang; rank: number; total: number; bulan: Performa['bulan']; onClose: () => void }) {
  const [sub, setSub] = useState<Sub | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (box.current) box.current.scrollTop = 0; }, [sub]);
  const v = o.visit, m = o.maintain;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div ref={box} onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3 dark:bg-slate-900">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />

        {sub ? (
          <>
            <button onClick={() => setSub(null)} className="mb-3 text-sm font-medium text-[#1F4E78] dark:text-sky-300">‹ Kembali ke {nama(o.nama).split(' ')[0]}</button>
            <p className="text-lg font-semibold">{sub.kind === 'ma' ? 'MA yang dipegang' : 'Konsumen yang dikunjungi'}</p>
            <p className="mb-3 text-sm text-slate-500">{nama(o.nama)}</p>
            {sub.kind === 'ma' ? <MaList list={m?.list || []} /> : <VisitList list={v?.list || []} p0={sub.p} />}
          </>
        ) : (
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
                <SalesRows label="Amount" s={o.amount} money bulan={bulan} />
                <SalesRows label="Unit" s={o.unit} bulan={bulan} />
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
                {!!m.list?.length && (
                  <OpenRow title="Lihat nama MA" sub={m.belum ? `${m.belum} belum dimaintain` : 'Semua sudah dimaintain'} onClick={() => setSub({ kind: 'ma' })} />
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
                  <Stat label="Sudah ditemui" value={angka(v.ditemui)} strong className="text-green-700 dark:text-green-300" />
                  <Stat label="Belum ditemui" value={angka(v.konsumen - v.ditemui)} strong className={v.konsumen - v.ditemui ? 'text-amber-700 dark:text-amber-300' : ''} />
                </div>
                <p className="mt-2 text-xs text-slate-500">Total {v.total} kali visit · ketuk prioritas untuk melihat nama</p>
                {v.list && ([1, 2, 3] as const).map((p) => {
                  const inP = v.list!.filter((k) => k.p === p);
                  if (!inP.length) return null;
                  const met = inP.filter((k) => k.m).length;
                  return <OpenRow key={p} title={`Prioritas ${p} · ${inP.length} konsumen`} sub={`${met} sudah ditemui · ${inP.length - met} belum ditemui`} onClick={() => setSub({ kind: 'visit', p })} />;
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

            <button onClick={onClose} className="mt-6 w-full rounded-2xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700">Tutup</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Panel utama ---------- */
export default function PerformaPanel({ reloadKey = 0 }: { reloadKey?: number }) {
  const [data, setData] = useState<Performa | null>(null);
  const [kosong, setKosong] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sort, setSort] = useState<SortKey>('amount');
  const [open, setOpen] = useState<Orang | null>(null);

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

  const ranked = useMemo(() => {
    const list = [...(data?.orang || [])];
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
        {ranked.map((o, i) => {
          const hasScore = achOf(o, sort) !== null;
          return (
            <li key={o.nama} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
              <button onClick={() => setOpen(o)} className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                <span className={`mt-2 w-5 shrink-0 text-center text-sm font-semibold ${hasScore ? 'text-slate-500' : 'text-slate-300'}`}>{hasScore ? i + 1 : '–'}</span>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1F4E78]/10 text-sm font-semibold text-[#1F4E78] dark:bg-sky-400/15 dark:text-sky-300">
                  {initials(o.nama)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{nama(o.nama)}</p>
                  <p className="truncate text-xs text-slate-500">{o.brand ? nama(o.brand) : 'Tanpa data sales'}</p>
                  {(o.amount || o.unit) && (
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <Metric label="Amount" s={o.amount} money active={sort === 'amount'} />
                      <Metric label="Unit" s={o.unit} active={sort === 'unit'} />
                    </div>
                  )}
                </div>
                <span className="mt-2"><Chev /></span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-1 pt-2 text-xs text-slate-500">Ketuk nama untuk melihat detail, daftar MA, dan konsumen yang dikunjungi.</p>

      {data.aktivitas && <AktivitasCabang a={data.aktivitas} />}

      <p className="px-1 py-4 text-xs text-slate-500">Angka diperbarui otomatis tiap 30 menit dari sheet pantauan cabang.</p>

      {open && (
        <Detail o={open} rank={amountRank.get(open.nama) || 0} total={amountRank.size} bulan={data.bulan} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}
