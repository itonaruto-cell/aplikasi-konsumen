'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Orang, Performa, Sales } from '../lib/performa-types';

/* ---------- Format ---------- */
const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const cf = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const angka = (v?: number | null) => (isNum(v) ? nf.format(v) : '–');
const rp = (v?: number | null) => (isNum(v) ? 'Rp ' + cf.format(v) : '–');
const persen = (v?: number | null) => (isNum(v) ? nf.format(Math.round(v * 100)) + '%' : '–');
const selisih = (v: number | null | undefined, money = false) =>
  isNum(v) ? (v > 0 ? '+' : '') + (money ? cf.format(v) : nf.format(v)) : '–';
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
const tanggal = (s: string | null) => {
  if (!s) return '';
  const d = new Date(s.slice(0, 10) + 'T00:00:00');
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

function Bar({ ach }: { ach?: number | null }) {
  const w = isNum(ach) ? Math.max(0, Math.min(100, ach * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div className={`h-full rounded-full ${BAR[tone(ach)]}`} style={{ width: `${w}%` }} />
    </div>
  );
}

/* ---------- Urutan peringkat ---------- */
type SortKey = 'amount' | 'unit' | 'oi' | 'visit';
const SORTS: { key: SortKey; label: string }[] = [
  { key: 'amount', label: 'Amount' },
  { key: 'unit', label: 'Unit' },
  { key: 'oi', label: 'Order in' },
  { key: 'visit', label: 'Visit' },
];
const score = (o: Orang, k: SortKey): number | null => {
  if (k === 'amount') return o.amount?.ach ?? null;
  if (k === 'unit') return o.unit?.ach ?? null;
  if (k === 'oi') return o.oi?.ach ?? o.oi?.total ?? null;
  return o.visit?.konsumen ?? null;
};
const headline = (o: Orang, k: SortKey) => {
  if (score(o, k) === null) return { big: '–', small: 'Belum ada data untuk urutan ini', ach: null };
  if (k === 'amount') return { big: persen(o.amount?.ach), small: `${rp(o.amount?.ini)} / ${rp(o.amount?.target)}`, ach: o.amount?.ach };
  if (k === 'unit') return { big: persen(o.unit?.ach), small: `${angka(o.unit?.ini)} / ${angka(o.unit?.target)} unit`, ach: o.unit?.ach };
  if (k === 'oi') return { big: persen(o.oi?.ach), small: `${angka(o.oi?.total)} / ${angka(o.oi?.target)} OI`, ach: o.oi?.ach };
  return { big: angka(o.visit?.konsumen ?? null), small: `konsumen · ${angka(o.visit?.ditemui ?? null)} ditemui`, ach: null };
};

/* ---------- Detail satu orang ---------- */
function SalesRows({ label, s, money, bulan }: { label: string; s?: Sales; money?: boolean; bulan: Performa['bulan'] }) {
  const f = money ? rp : angka;
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
        vs {bulan.lalu}: <span className={isNum(s?.diffLalu) && s!.diffLalu! < 0 ? 'text-red-600 dark:text-red-300' : 'text-green-700 dark:text-green-300'}>{money && isNum(s?.diffLalu) ? (s!.diffLalu! > 0 ? '+Rp ' : s!.diffLalu! < 0 ? '−Rp ' : 'Rp ') + cf.format(Math.abs(s!.diffLalu!)) : selisih(s?.diffLalu)}</span>
        {' · '}{isNum(s?.diffTarget) && s!.diffTarget! < 0
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

function Detail({ o, rank, total, bulan, onClose }: { o: Orang; rank: number; total: number; bulan: Performa['bulan']; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3 dark:bg-slate-900">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
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

        {o.oi && (
          <section className="mt-5">
            <p className="text-sm font-semibold text-slate-500">Order in</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Stat label="Total OI" value={`${angka(o.oi.total)} / ${angka(o.oi.target)}`} strong />
              <Stat label="Pencapaian" value={persen(o.oi.ach)} strong className={TEXT[tone(o.oi.ach)]} />
              <Stat label="Success rate" value={persen(o.oi.successRate)} strong />
              <Stat label="Golive" value={angka(o.oi.golive)} className={o.oi.golive ? 'text-green-700 dark:text-green-300' : ''} />
              <Stat label="Pending" value={angka(o.oi.pending)} />
              <Stat label="PO pending" value={angka(o.oi.poPending)} />
              <Stat label="Reject" value={angka(o.oi.reject)} className={o.oi.reject ? 'text-red-600 dark:text-red-300' : ''} />
              <Stat label="Cancel" value={angka(o.oi.cancel)} />
            </div>
          </section>
        )}

        {o.approval && (
          <section className="mt-5">
            <p className="text-sm font-semibold text-slate-500">Hasil pengajuan</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <Stat label="Approve" value={angka(o.approval.approve)} />
              <Stat label="Banding" value={angka(o.approval.banding)} />
              <Stat label="Reject" value={angka(o.approval.reject)} />
              <Stat label="Cancel" value={angka(o.approval.cancel)} />
            </div>
          </section>
        )}

        {o.visit && (
          <section className="mt-5">
            <p className="text-sm font-semibold text-slate-500">Visit konsumen prioritas</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Stat label="Konsumen dikunjungi" value={angka(o.visit.konsumen)} strong />
              <Stat label="Sudah ditemui" value={angka(o.visit.ditemui)} strong className="text-green-700 dark:text-green-300" />
              <Stat label="Total visit" value={angka(o.visit.total)} strong />
              <Stat label="Prioritas 1" value={angka(o.visit.p1)} />
              <Stat label="Prioritas 2" value={angka(o.visit.p2)} />
              <Stat label="Prioritas 3" value={angka(o.visit.p3)} />
            </div>
          </section>
        )}

        {o.maintain && (
          <section className="mt-5">
            <p className="text-sm font-semibold text-slate-500">Maintain MA</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Stat label="MA dipegang" value={angka(o.maintain.ma)} strong />
              <Stat label="Sudah dimaintain" value={angka(o.maintain.sudah)} strong className="text-green-700 dark:text-green-300" />
              <Stat label="Belum" value={angka(o.maintain.belum)} strong className={o.maintain.belum ? 'text-red-600 dark:text-red-300' : ''} />
              <Stat label="Minimal 2X" value={angka(o.maintain.x2)} />
              <Stat label="Minimal 3X" value={angka(o.maintain.x3)} />
              <Stat label="Minimal 4X" value={angka(o.maintain.x4)} />
            </div>
          </section>
        )}

        <button onClick={onClose} className="mt-6 w-full rounded-2xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700">Tutup</button>
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
      const sa = score(a, sort), sb = score(b, sort);
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

      {/* Ringkasan cabang */}
      <div className="mt-3 rounded-2xl bg-white p-4 dark:bg-slate-900">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">Pencapaian cabang · {data.bulan.ini}</p>
          <p className={`text-2xl font-semibold ${TEXT[tone(t.amount?.ach)]}`}>{persen(t.amount?.ach)}</p>
        </div>
        <p className="text-xs text-slate-500">Amount {rp(t.amount?.ini)} dari {rp(t.amount?.target)}</p>
        <div className="mt-2"><Bar ach={t.amount?.ach} /></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div><p className="text-xs text-slate-500">Unit</p><p className="font-semibold">{angka(t.unit?.ini)}<span className="text-slate-400">/{angka(t.unit?.target)}</span></p></div>
          <div><p className="text-xs text-slate-500">Order in</p><p className="font-semibold">{angka(t.oi?.total)}<span className="text-slate-400">/{angka(t.oi?.target)}</span></p></div>
          <div><p className="text-xs text-slate-500">Success rate</p><p className="font-semibold">{persen(t.oi?.successRate)}</p></div>
        </div>
      </div>

      {/* Urutkan */}
      <div className="mt-4 flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
        <span className="shrink-0 text-xs text-slate-500">Peringkat</span>
        {SORTS.map((s) => (
          <button key={s.key} onClick={() => setSort(s.key)} aria-pressed={sort === s.key}
            className={`h-9 shrink-0 rounded-full border px-4 text-sm transition ${sort === s.key
              ? 'border-[#1F4E78] bg-[#1F4E78] text-white'
              : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Daftar anggota */}
      <ul className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {ranked.map((o, i) => {
          const h = headline(o, sort);
          const hasScore = score(o, sort) !== null;
          return (
            <li key={o.nama} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
              <button onClick={() => setOpen(o)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                <span className={`w-5 shrink-0 text-center text-sm font-semibold ${hasScore ? 'text-slate-500' : 'text-slate-300'}`}>{hasScore ? i + 1 : '–'}</span>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1F4E78]/10 text-sm font-semibold text-[#1F4E78] dark:bg-sky-400/15 dark:text-sky-300">
                  {initials(o.nama)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">{nama(o.nama)}</p>
                    <p className={`shrink-0 font-semibold ${sort === 'visit' ? '' : TEXT[tone(h.ach)]}`}>{h.big}</p>
                  </div>
                  <p className="truncate text-xs text-slate-500">{[o.brand && nama(o.brand), h.small].filter(Boolean).join(' · ')}</p>
                  {sort !== 'visit' && hasScore && <div className="mt-1.5"><Bar ach={h.ach} /></div>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-1 py-4 text-xs text-slate-500">Ketuk nama untuk melihat detail. Angka diperbarui otomatis tiap 30 menit dari sheet pantauan cabang.</p>

      {open && (
        <Detail o={open} rank={amountRank.get(open.nama) || 0} total={amountRank.size} bulan={data.bulan} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}
