'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useOverlay } from './overlay';
import { Ico } from './performa/parts';

// Cari Konsumen: database konsumen (khusus owner & peran "konsumen"), gaya sama dengan halaman Performa.
// Nomor HP hanya tampil untuk owner (server juga menyaringnya).

type Row = Record<string, string>;
type Akun = { email: string; role: 'owner' | 'konsumen' | 'tim' };

/* ---------- Ikon tambahan ---------- */
const PATHS: Record<string, ReactNode> = {
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  chat: <path d="M3 20l1.3-3.9A9 8 0 1 1 7.7 19L3 20" />,
  copy: (<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>),
  star: <path d="M12 17.75l-6.17 3.24 1.18-6.87-5-4.86 6.9-1 3.09-6.26 3.09 6.26 6.9 1-5 4.86 1.18 6.87z" />,
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>),
  filter: <path d="M4 4h16v2.2a2 2 0 0 1-.6 1.4L15 12v7l-6 2v-8.5L4.5 7.6A2 2 0 0 1 4 6.2z" />,
  check: <path d="m5 12 5 5L20 7" />,
};
function I({ n, className = 'h-5 w-5', filled = false }: { n: string; className?: string; filled?: boolean }) {
  if (!PATHS[n]) return <Ico n={n} className={className} />;
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[n]}</svg>
  );
}

/* ---------- Alat bantu ---------- */
const pick = (r: Row, ...names: string[]): string => {
  for (const n of names) {
    const key = Object.keys(r).find((k) => k.trim().toUpperCase() === n);
    if (key && r[key]) return String(r[key]).trim();
  }
  return '';
};
const norm = (s: string) => s.toLowerCase().replace(/[\s\-.]/g, '');
const digits = (s: string) => s.replace(/\D/g, '');
const toWa = (hp: string) => {
  const d = digits(hp);
  if (d.startsWith('62')) return d;
  if (d.startsWith('0')) return '62' + d.slice(1);
  if (d.startsWith('8')) return '62' + d;
  return d;
};
const splitPhones = (v: string) =>
  v.split(/\s*[\/,;|]\s*|\s+atau\s+|\s+dan\s+/i).map(digits).filter((d) => d.length >= 8)
    .filter((d, i, a) => a.indexOf(d) === i);
const rupiah = (v: string) => {
  const n = Number(digits(v));
  return n ? 'Rp ' + n.toLocaleString('id-ID') : v || '-';
};
const initials = (n: string) =>
  n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const rowId = (r: Row) => pick(r, 'ORDER_NO', 'ORDER NO') || pick(r, 'NAMA KONSUMEN') + pick(r, 'NOPOL');

/* ---------- Filter ---------- */
type FKey = 'type' | 'produk' | 'kec' | 'kel';
const FILTERS: { key: FKey; label: string; cols: string[] }[] = [
  { key: 'type', label: 'Type unit', cols: ['TYPE UNIT DETAIL', 'TYPE UNIT'] },
  { key: 'produk', label: 'Produk', cols: ['PRODUK'] },
  { key: 'kec', label: 'Kecamatan', cols: ['KECAMATAN'] },
  { key: 'kel', label: 'Kelurahan', cols: ['KELURAHAN'] },
];
const EMPTY_FILTERS: Record<FKey, string[]> = { type: [], produk: [], kec: [], kel: [] };
const fval = (r: Row, k: FKey) => pick(r, ...(FILTERS.find((f) => f.key === k)?.cols ?? []));
const fkey = (v: string) => v.trim().replace(/\s+/g, ' ').toUpperCase();

const readStore = (key: string): string[] => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};
const writeStore = (key: string, v: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* abaikan */ }
};

function Highlight({ text, q }: { text: string; q: string }) {
  const t = text || '';
  const i = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{t}</>;
  return (
    <>
      {t.slice(0, i)}
      <mark className="rounded bg-[#FFF1C7] px-0.5 text-inherit dark:bg-[#3A2F12]">{t.slice(i, i + q.length)}</mark>
      {t.slice(i + q.length)}
    </>
  );
}

/* ---------- Lembar bawah (bottom sheet) bergaya sama dengan Performa ---------- */
function BottomSheet({ onClose, children, z = 'z-40' }: { onClose: () => void; children: ReactNode; z?: string }) {
  useOverlay(true, onClose);
  return (
    <div className={`fixed inset-0 ${z} flex items-end justify-center bg-black/40`} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white pt-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50">
        <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        {children}
      </div>
    </div>
  );
}

export default function CariKonsumen({ me, reloadKey = 0 }: { me: Akun; reloadKey?: number }) {
  const isOwner = me.role === 'owner';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<FKey, string[]>>(EMPTY_FILTERS);
  const [openFilter, setOpenFilter] = useState<FKey | null>(null);
  const [optSearch, setOptSearch] = useState('');
  const [mode, setMode] = useState<'semua' | 'simpan'>('semua');
  const [selected, setSelected] = useState<Row | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [picker, setPicker] = useState<{ kind: 'tel' | 'wa'; phones: string[] } | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/search?q=', { cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/login'; return; }
      const json = await res.json();
      if (Array.isArray(json)) setRows(json);
      else setError(json?.error || 'Data tidak bisa dimuat.');
    } catch {
      setError('Koneksi bermasalah. Periksa internet lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSaved(readStore('ck_saved')); setRecent(readStore('ck_recent')); }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    document.body.style.overflow = selected || openFilter || picker ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selected, openFilter, picker]);

  // Cek apakah satu baris lolos semua filter (kecuali filter `except`)
  const passes = (r: Row, except?: FKey) => {
    if (mode === 'simpan' && !saved.includes(rowId(r))) return false;
    for (const f of FILTERS) {
      if (f.key === except) continue;
      const sel = filters[f.key];
      if (sel.length && !sel.includes(fkey(fval(r, f.key)))) return false;
    }
    const q = norm(query);
    return !q || norm(Object.values(r).join(' ')).includes(q);
  };

  const filtered = useMemo(() => rows.filter((r) => passes(r)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, query, mode, saved, filters]);

  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => FILTERS.forEach((f) => {
      const v = fval(r, f.key);
      if (v && !m.has(f.key + '|' + fkey(v))) m.set(f.key + '|' + fkey(v), v.trim());
    }));
    return m;
  }, [rows]);
  const lab = (k: FKey, v: string) => labelOf.get(k + '|' + v) || v;

  const options = useMemo(() => {
    if (!openFilter) return [];
    const m = new Map<string, number>();
    rows.forEach((r) => {
      if (!passes(r, openFilter)) return;
      const v = fval(r, openFilter);
      if (v) m.set(fkey(v), (m.get(fkey(v)) || 0) + 1);
    });
    filters[openFilter].forEach((k) => { if (!m.has(k)) m.set(k, 0); });
    return Array.from(m, ([key, count]) => ({ key, count, label: lab(openFilter, key) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'id'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFilter, rows, query, mode, saved, filters, labelOf]);

  const visibleOptions = options.filter((o) => !optSearch || norm(o.label).includes(norm(optSearch)));
  const activeCount = FILTERS.reduce((n, f) => n + filters[f.key].length, 0);

  const toggleFilter = (k: FKey, v: string) => {
    setFilters((prev) => {
      const cur = prev[k];
      const next = { ...prev, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
      if (k === 'kec' && next.kec.length) {
        const valid = new Set(rows.filter((r) => next.kec.includes(fkey(fval(r, 'kec')))).map((r) => fkey(fval(r, 'kel'))));
        next.kel = next.kel.filter((x) => valid.has(x));
      }
      return next;
    });
  };

  const shown = filtered.slice(0, 100);

  const openDetail = (r: Row) => {
    setSelected(r);
    const q = query.trim();
    if (q) {
      const next = [q, ...recent.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5);
      setRecent(next);
      writeStore('ck_recent', next);
    }
  };

  const toggleSave = (r: Row) => {
    const id = rowId(r);
    const next = saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    writeStore('ck_saved', next);
    setToast(saved.includes(id) ? 'Dihapus dari disimpan' : 'Disimpan');
  };

  const copyData = async (r: Row) => {
    const text = Object.entries(r).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
    try { await navigator.clipboard.writeText(text); setToast('Data tersalin'); } catch { setToast('Gagal menyalin'); }
  };

  const chip = (on: boolean) => `flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition ${on
    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
    : 'border-neutral-300 dark:border-neutral-700'}`;

  return (
    <div className="pb-6">
      {/* Kotak cari menempel di bawah header */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+57px)] z-20 bg-white/95 px-4 pb-3 pt-3 backdrop-blur dark:bg-neutral-950/95">
        <div className="relative">
          <Ico n="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} inputMode="search" aria-label="Cari konsumen"
            placeholder={isOwner ? 'Nama, nopol, no HP, order no' : 'Nama, nopol, order no'}
            className="h-12 w-full rounded-full bg-neutral-100 pl-12 pr-12 text-base outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-neutral-400 dark:bg-neutral-900" />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Hapus pencarian"
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-neutral-500">
              <Ico n="x" className="h-5 w-5" sw={2} />
            </button>
          )}
        </div>
      </div>

      {/* Semua / Disimpan */}
      <div className="flex items-center justify-between gap-3 px-4">
        <div className="flex gap-0.5 rounded-full bg-neutral-100 p-[3px] dark:bg-neutral-900">
          {([['semua', 'Semua'], ['simpan', `Disimpan · ${saved.length}`]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k}
              className={`min-h-10 whitespace-nowrap rounded-full px-4 text-sm ${mode === k
                ? 'bg-white font-bold shadow-sm dark:bg-neutral-700' : 'font-semibold text-neutral-500 dark:text-neutral-400'}`}>
              {l}
            </button>
          ))}
        </div>
        <span className="text-right text-[13px] text-neutral-500">{loading ? 'Memuat…' : `${filtered.length} dari ${rows.length}`}</span>
      </div>

      {/* Filter */}
      <div className="mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${activeCount ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900'}`}>
          <I n="filter" className="h-4 w-4" />
        </span>
        {FILTERS.map((f) => {
          const sel = filters[f.key];
          const text = sel.length === 0 ? f.label : sel.length === 1 ? lab(f.key, sel[0]) : `${f.label} (${sel.length})`;
          return (
            <button key={f.key} onClick={() => { setOptSearch(''); setOpenFilter(f.key); }} className={chip(sel.length > 0)}>
              <span className="max-w-[150px] truncate">{text}</span>
              <Ico n="down" className="h-4 w-4 shrink-0" sw={2} />
            </button>
          );
        })}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          {FILTERS.flatMap((f) => filters[f.key].map((v) => (
            <button key={f.key + v} onClick={() => toggleFilter(f.key, v)}
              className="flex min-h-9 items-center gap-1 rounded-full bg-neutral-100 pl-3 pr-2 text-[13px] font-semibold dark:bg-neutral-900">
              <span className="max-w-[160px] truncate">{lab(f.key, v)}</span>
              <Ico n="x" className="h-3.5 w-3.5" sw={2.2} />
            </button>
          )))}
          <button onClick={() => setFilters(EMPTY_FILTERS)} className="min-h-9 px-1 text-[13px] font-semibold text-red-700 dark:text-red-400">Reset semua</button>
        </div>
      )}

      {!query && recent.length > 0 && mode === 'semua' && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
          <span className="flex h-9 shrink-0 items-center text-neutral-500"><I n="clock" className="h-4 w-4" /></span>
          {recent.map((r) => (
            <button key={r} onClick={() => setQuery(r)} className="min-h-9 shrink-0 rounded-full border border-neutral-200 px-3 text-[13px] dark:border-neutral-800">{r}</button>
          ))}
        </div>
      )}

      {/* Daftar */}
      <section className="mt-3 border-t border-neutral-200 dark:border-neutral-800">
        {error ? (
          <div className="mx-4 mt-4 rounded-2xl bg-red-50 p-5 text-center dark:bg-red-950/40">
            <p className="font-semibold text-red-800 dark:text-red-300">Data gagal dimuat</p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300/80">{error}</p>
            <button onClick={load} className="mt-4 min-h-11 rounded-full bg-red-700 px-5 text-sm font-semibold text-white">Coba lagi</button>
          </div>
        ) : loading ? (
          <div className="space-y-3 px-4 pt-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-neutral-200/70 dark:bg-neutral-800/70" />)}
          </div>
        ) : shown.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <I n={mode === 'simpan' ? 'star' : 'user'} className="mx-auto h-8 w-8 text-neutral-400" />
            <p className="mt-3 font-semibold">{mode === 'simpan' && !activeCount ? 'Belum ada konsumen disimpan' : 'Konsumen tidak ditemukan'}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {activeCount ? 'Tidak ada yang cocok dengan kombinasi filter ini.'
                : mode === 'simpan' ? 'Ketuk bintang di detail konsumen untuk menyimpannya.' : 'Coba nama lain, nopol, atau order no.'}
            </p>
            {activeCount > 0 && (
              <button onClick={() => setFilters(EMPTY_FILTERS)} className="mt-4 min-h-11 rounded-full border border-neutral-300 px-5 text-sm font-semibold dark:border-neutral-700">Reset filter</button>
            )}
          </div>
        ) : (
          <ul>
            {shown.map((r, i) => {
              const nm = pick(r, 'NAMA KONSUMEN', 'NAMA') || '(tanpa nama)';
              const isSaved = saved.includes(rowId(r));
              return (
                <li key={rowId(r) + i} className="border-b border-neutral-200 dark:border-neutral-800">
                  <button onClick={() => openDetail(r)} className="flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-50 dark:active:bg-neutral-900">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold dark:bg-neutral-800">{initials(nm)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[15px] font-bold"><Highlight text={nm} q={query.trim()} /></span>
                        <span className="shrink-0 font-mono text-[13px] text-neutral-500"><Highlight text={pick(r, 'NOPOL')} q={query.trim()} /></span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-neutral-500">
                        {[pick(r, 'KECAMATAN'), [pick(r, 'BRAND UNIT'), pick(r, 'TYPE UNIT DETAIL')].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {isSaved && <I n="star" filled className="h-4 w-4 shrink-0 text-[#E0A800]" />}
                    <Ico n="right" className="h-4 w-4 shrink-0 text-neutral-400" sw={2} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {filtered.length > shown.length && (
          <p className="px-4 py-4 text-center text-sm text-neutral-500">Menampilkan 100 dari {filtered.length}. Ketik lebih spesifik untuk mempersempit.</p>
        )}
      </section>

      {/* Pilihan filter */}
      {openFilter && (() => {
        const f = FILTERS.find((x) => x.key === openFilter)!;
        const sel = filters[f.key];
        return (
          <BottomSheet onClose={() => setOpenFilter(null)}>
            <div className="flex items-center justify-between px-5">
              <p className="text-lg font-bold">{f.label}</p>
              {sel.length > 0 && (
                <button onClick={() => setFilters((p) => ({ ...p, [f.key]: [] }))} className="min-h-11 text-sm font-semibold text-red-700 dark:text-red-400">Hapus pilihan</button>
              )}
            </div>
            {f.key === 'kel' && filters.kec.length > 0 && <p className="px-5 text-[13px] text-neutral-500">Hanya kelurahan di kecamatan yang dipilih</p>}
            <div className="relative mx-5 mt-2">
              <Ico n="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input value={optSearch} onChange={(e) => setOptSearch(e.target.value)} placeholder={`Cari ${f.label.toLowerCase()}`}
                className="h-11 w-full rounded-full bg-neutral-100 pl-10 pr-3 text-base outline-none focus:ring-2 focus:ring-neutral-400 dark:bg-neutral-800" />
            </div>
            <ul className="mt-2 flex-1 overflow-y-auto overscroll-contain px-2">
              {visibleOptions.length === 0 && <li className="px-3 py-6 text-center text-sm text-neutral-500">Tidak ada pilihan yang cocok</li>}
              {visibleOptions.map((o) => {
                const on = sel.includes(o.key);
                return (
                  <li key={o.key}>
                    <button onClick={() => toggleFilter(f.key, o.key)} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left active:bg-neutral-50 dark:active:bg-neutral-800">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900' : 'border-neutral-400 dark:border-neutral-600'}`}>
                        {on && <I n="check" className="h-3.5 w-3.5" />}
                      </span>
                      <span className="flex-1 text-[15px]"><Highlight text={o.label} q={optSearch.trim()} /></span>
                      <span className={`text-[13px] ${o.count ? 'text-neutral-500' : 'text-red-600'}`}>{o.count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-neutral-200 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 dark:border-neutral-800">
              <button onClick={() => setOpenFilter(null)} className="min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white active:opacity-90 dark:bg-white dark:text-neutral-900">
                Lihat {filtered.length} konsumen
              </button>
            </div>
          </BottomSheet>
        );
      })()}

      {/* Detail konsumen */}
      {selected && (() => {
        const r = selected;
        const nm = pick(r, 'NAMA KONSUMEN', 'NAMA') || '(tanpa nama)';
        const phones = splitPhones(pick(r, 'NO HP', 'NO. HP', 'HP'));
        const hp = phones[0] || '';
        const wa = toWa(hp);
        const maps = pick(r, 'MAPS');
        const mapsUrl = maps ? maps.startsWith('http') ? maps : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(maps)}` : '';
        const isSaved = saved.includes(rowId(r));
        const hidden = ['NAMA KONSUMEN', 'MAPS', 'NO WA', 'ANGSURAN', 'TENOR', 'PRODUK'];
        const action = 'flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-neutral-100 text-[13px] font-semibold active:scale-95 dark:bg-neutral-800';
        return (
          <BottomSheet onClose={() => setSelected(null)}>
            <div className="overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-lg font-bold text-white dark:bg-white dark:text-neutral-900">{initials(nm)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">{nm}</p>
                  {pick(r, 'PRODUK') && <span className="mt-1 inline-block max-w-full truncate rounded-full bg-neutral-100 px-2.5 py-0.5 text-[13px] dark:bg-neutral-800">{pick(r, 'PRODUK')}</span>}
                </div>
                <button onClick={() => toggleSave(r)} aria-label={isSaved ? 'Hapus dari disimpan' : 'Simpan konsumen'}
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${isSaved ? 'text-[#E0A800]' : 'text-neutral-400'}`}>
                  <I n="star" filled={isSaved} className="h-6 w-6" />
                </button>
              </div>

              <div className={`mt-5 grid gap-2 ${isOwner ? 'grid-cols-4' : 'grid-cols-2'}`}>
                {isOwner && (<>
                  {phones.length > 1 ? (
                    <button onClick={() => setPicker({ kind: 'tel', phones })} className={action}><I n="phone" className="h-6 w-6" />Telepon</button>
                  ) : (
                    <a href={hp ? `tel:${hp}` : undefined} className={`${action} ${hp ? '' : 'opacity-40'}`}><I n="phone" className="h-6 w-6" />Telepon</a>
                  )}
                  {phones.length > 1 ? (
                    <button onClick={() => setPicker({ kind: 'wa', phones })} className={action}><I n="chat" className="h-6 w-6 text-green-700 dark:text-green-400" />WhatsApp</button>
                  ) : (
                    <a href={wa ? `https://wa.me/${wa}` : undefined} target="_blank" rel="noreferrer" className={`${action} ${wa ? '' : 'opacity-40'}`}><I n="chat" className="h-6 w-6 text-green-700 dark:text-green-400" />WhatsApp</a>
                  )}
                </>)}
                <a href={mapsUrl || undefined} target="_blank" rel="noreferrer" className={`${action} ${mapsUrl ? '' : 'opacity-40'}`}><Ico n="pin" className="h-6 w-6" />Maps</a>
                <button onClick={() => copyData(r)} className={action}><I n="copy" className="h-6 w-6" />Salin</button>
              </div>

              {isOwner && phones.length > 1 && (
                <div className="mt-4 rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
                  <p className="px-1 pb-2 text-[13px] text-neutral-500">Konsumen ini punya {phones.length} nomor HP</p>
                  {phones.map((p, i) => (
                    <div key={p} className="flex items-center gap-2 border-t border-neutral-200 py-1.5 first:border-0 dark:border-neutral-800">
                      <span className="flex-1 font-mono text-sm">{p}{i === 0 && <span className="ml-2 font-sans text-xs text-neutral-500">utama</span>}</span>
                      <a href={`tel:${p}`} aria-label={`Telepon ${p}`} className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"><I n="phone" className="h-4 w-4" /></a>
                      <a href={`https://wa.me/${toWa(p)}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${p}`} className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"><I n="chat" className="h-4 w-4 text-green-700 dark:text-green-400" /></a>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-neutral-900 p-4 text-white dark:ring-1 dark:ring-neutral-800">
                <div><p className="text-[13px] text-neutral-300">Angsuran</p><p className="text-lg font-bold">{rupiah(pick(r, 'ANGSURAN'))}</p></div>
                <div><p className="text-[13px] text-neutral-300">Tenor</p><p className="text-lg font-bold">{pick(r, 'TENOR') ? `${pick(r, 'TENOR')} bulan` : '-'}</p></div>
              </div>

              <dl className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
                {Object.entries(r).filter(([k, v]) => v && !hidden.includes(k.trim().toUpperCase())).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
                    <dt className="shrink-0 text-neutral-500">{k}</dt>
                    <dd className="break-all text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </BottomSheet>
        );
      })()}

      {picker && (
        <BottomSheet onClose={() => setPicker(null)} z="z-[60]">
          <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            <p className="text-lg font-bold">{picker.kind === 'wa' ? 'Buka WhatsApp ke nomor' : 'Telepon ke nomor'}</p>
            <div className="mt-3 space-y-2">
              {picker.phones.map((p, i) => (
                <a key={p} onClick={() => setPicker(null)} href={picker.kind === 'wa' ? `https://wa.me/${toWa(p)}` : `tel:${p}`}
                  target={picker.kind === 'wa' ? '_blank' : undefined} rel="noreferrer"
                  className="flex min-h-14 items-center gap-3 rounded-2xl bg-neutral-100 px-4 active:scale-[0.99] dark:bg-neutral-800">
                  <I n={picker.kind === 'wa' ? 'chat' : 'phone'} className={`h-5 w-5 ${picker.kind === 'wa' ? 'text-green-700 dark:text-green-400' : ''}`} />
                  <span className="flex-1 font-mono text-base">{p}</span>
                  <span className="text-[13px] text-neutral-500">Nomor {i + 1}</span>
                </a>
              ))}
            </div>
          </div>
        </BottomSheet>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center px-5">
          <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">{toast}</div>
        </div>
      )}
    </div>
  );
}
