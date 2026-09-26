'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

type Row = Record<string, string>;

/* ---------- Ikon (tanpa library tambahan) ---------- */
const PATHS: Record<string, ReactNode> = {
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  chat: <path d="M3 20l1.3-3.9A9 8 0 1 1 7.7 19L3 20" />,
  pin: (<><circle cx="12" cy="11" r="3" /><path d="M17.7 16.7 13.4 21a2 2 0 0 1-2.8 0l-4.3-4.3a8 8 0 1 1 11.3 0z" /></>),
  copy: (<><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>),
  star: <path d="M12 17.75l-6.17 3.24 1.18-6.87-5-4.86 6.9-1 3.09-6.26 3.09 6.26 6.9 1-5 4.86 1.18 6.87z" />,
  users: (<><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M21 21v-2a4 4 0 0 0-3-3.9" /></>),
  logout: <path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2M9 12h12l-3-3m0 6 3-3" />,
  refresh: <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></>),
  filter: <path d="M4 4h16v2.2a2 2 0 0 1-.6 1.4L15 12v7l-6 2v-8.5L4.5 7.6A2 2 0 0 1 4 6.2z" />,
  check: <path d="m5 12 5 5L20 7" />,
  down: <path d="m6 9 6 6 6-6" />,
};

function Icon({ name, className = 'h-5 w-5', filled = false }: { name: string; className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
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
      <mark className="rounded bg-amber-200 px-0.5 text-inherit dark:bg-amber-400/30">{t.slice(i, i + q.length)}</mark>
      {t.slice(i + q.length)}
    </>
  );
}

/* ---------- Panel aktivitas tim (khusus owner) ---------- */
type Aktivitas = { email: string; nama: string; role: string; aktif: boolean; online: boolean; pertama: string; terakhir: string; jumlahBuka: number };
const hhmm = (t: string) => t.slice(0, 5);

function TeamPanel() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const [tanggal, setTanggal] = useState(today);
  const [list, setList] = useState<Aktivitas[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = async (tgl: string) => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(`/api/aktivitas?tanggal=${tgl}`, { cache: 'no-store' });
      const json = await res.json();
      if (res.ok) setList(json.list || []); else setErr(json.error || 'Gagal memuat aktivitas.');
    } catch { setErr('Koneksi bermasalah.'); } finally { setLoading(false); }
  };

  useEffect(() => {
    load(tanggal);
    if (tanggal !== today) return;
    const t = setInterval(() => load(tanggal), 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal]);

  const online = list.filter((x) => x.online).length;
  const aktif = list.filter((x) => x.aktif).length;

  return (
    <section className="px-5 pt-4">
      <div className="flex items-center gap-2">
        <input type="date" value={tanggal} max={today} onChange={(e) => e.target.value && setTanggal(e.target.value)}
          className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900" />
        <button onClick={() => load(tanggal)} aria-label="Muat ulang aktivitas"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <Icon name="refresh" className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[['Online', tanggal === today ? online : '-'], ['Aktif', aktif], ['Belum aktif', list.length - aktif]].map(([l, v]) => (
          <div key={l} className="rounded-2xl bg-white px-3 py-3 dark:bg-slate-900">
            <p className="text-xs text-slate-500">{l}</p>
            <p className="text-xl font-semibold">{loading ? '…' : v}</p>
          </div>
        ))}
      </div>

      {err ? (
        <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{err}</p>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {!loading && list.length === 0 && <li className="p-6 text-center text-sm text-slate-500">Belum ada anggota di tab AKSES.</li>}
          {list.map((p) => (
            <li key={p.email} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 dark:border-slate-800">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F4E78]/10 text-sm font-semibold text-[#1F4E78] dark:bg-sky-400/15 dark:text-sky-300">
                  {initials(p.nama || p.email)}
                </div>
                <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900 ${p.online ? 'bg-green-500' : p.aktif ? 'bg-slate-300' : 'bg-transparent'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.nama || p.email}</p>
                <p className="truncate text-xs text-slate-500">
                  {p.aktif ? `Aktif ${hhmm(p.pertama)} – ${hhmm(p.terakhir)} · ${p.jumlahBuka}x buka` : 'Belum membuka aplikasi'}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                p.online ? 'bg-green-50 text-green-700 dark:bg-green-400/15 dark:text-green-300'
                  : p.aktif ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'}`}>
                {p.online ? 'Online' : p.aktif ? `Terakhir ${hhmm(p.terakhir)}` : 'Offline'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 py-4 text-xs text-slate-500">
        Online = aplikasi sedang terbuka di layar (aktif dalam 5 menit terakhir). Jam memakai WIB. Riwayat lengkap ada di tab LOG_AKTIF Google Sheets.
      </p>
    </section>
  );
}

/* ---------- Halaman ---------- */
export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<FKey, string[]>>(EMPTY_FILTERS);
  const [openFilter, setOpenFilter] = useState<FKey | null>(null);
  const [optSearch, setOptSearch] = useState('');
  const [tab, setTab] = useState<'cari' | 'simpan' | 'tim'>('cari');
  const [selected, setSelected] = useState<Row | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [picker, setPicker] = useState<{ kind: 'tel' | 'wa'; phones: string[] } | null>(null);
  const [greeting, setGreeting] = useState('Selamat datang');
  const [me, setMe] = useState<{ email: string; name?: string; role: 'owner' | 'tim' } | null>(null);
  const isOwner = me?.role === 'owner';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [res, meRes] = await Promise.all([fetch('/api/search?q=', { cache: 'no-store' }), fetch('/api/me', { cache: 'no-store' })]);
      if (res.status === 401 || meRes.status === 401) { window.location.href = '/login'; return; }
      if (meRes.ok) setMe(await meRes.json());
      const json = await res.json();
      if (Array.isArray(json)) setRows(json);
      else setError(json?.error || 'Data tidak bisa dimuat.');
    } catch {
      setError('Koneksi bermasalah. Periksa internet lalu coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setSaved(readStore('ck_saved'));
    setRecent(readStore('ck_recent'));
    const h = new Date().getHours();
    setGreeting(h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam');
  }, []);

  // Catat aktivitas: saat aplikasi dibuka & setiap 2 menit selama tampil di layar
  useEffect(() => {
    if (!me) return;
    const ping = (kind: 'buka' | 'aktif') => {
      fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }), keepalive: true })
        .catch(() => {});
    };
    ping('buka');
    const timer = setInterval(() => { if (document.visibilityState === 'visible') ping('aktif'); }, 120_000);
    const onVis = () => { if (document.visibilityState === 'visible') ping('buka'); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); };
  }, [me?.email]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // Cek apakah satu baris lolos semua filter (kecuali filter `except`)
  const passes = (r: Row, except?: FKey) => {
    if (tab === 'simpan' && !saved.includes(rowId(r))) return false;
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
    [rows, query, tab, saved, filters]);

  // Nama asli (huruf besar/kecil) untuk setiap pilihan filter
  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => FILTERS.forEach((f) => {
      const v = fval(r, f.key);
      if (v && !m.has(f.key + '|' + fkey(v))) m.set(f.key + '|' + fkey(v), v.trim());
    }));
    return m;
  }, [rows]);
  const lab = (k: FKey, v: string) => labelOf.get(k + '|' + v) || v;

  // Daftar pilihan untuk filter yang sedang dibuka, lengkap dengan jumlahnya
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
  }, [openFilter, rows, query, tab, saved, filters, labelOf]);

  const visibleOptions = options.filter((o) => !optSearch || norm(o.label).includes(norm(optSearch)));
  const activeCount = FILTERS.reduce((n, f) => n + filters[f.key].length, 0);

  const toggleFilter = (k: FKey, v: string) => {
    setFilters((prev) => {
      const cur = prev[k];
      const next = { ...prev, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
      // Kelurahan yang tidak ada di kecamatan terpilih otomatis dilepas
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
    const text = Object.entries(r)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setToast('Data tersalin');
    } catch {
      setToast('Gagal menyalin');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <header className="rounded-b-3xl bg-[#1F4E78] px-5 pb-5 pt-[calc(env(safe-area-inset-top)+20px)] text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">
                {greeting}{me?.name ? `, ${me.name.split(' ')[0]}` : ''}
                {me && (
                  <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
                    {isOwner ? 'Owner' : 'Tim'}
                  </span>
                )}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">Cari Konsumen</h1>
            </div>
            <div className="flex gap-2">
              <button onClick={load} aria-label="Muat ulang data"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 active:scale-95">
                <Icon name="refresh" className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <a href="/api/auth/logout" aria-label="Keluar" title={me?.email ? `Keluar (${me.email})` : 'Keluar'}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 active:scale-95">
                <Icon name="logout" className="h-5 w-5" />
              </a>
            </div>
          </div>

          {tab !== 'tim' && (<>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs text-white/70">Total konsumen</p>
              <p className="text-xl font-semibold">{loading ? '…' : rows.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-xs text-white/70">{tab === 'simpan' ? 'Disimpan' : 'Hasil pencarian'}</p>
              <p className="text-xl font-semibold">{loading ? '…' : filtered.length}</p>
            </div>
          </div>

          <div className="relative mt-4">
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isOwner ? 'Nama, nopol, no HP, order no' : 'Nama, nopol, order no'}
              inputMode="search"
              className="h-12 w-full rounded-2xl bg-white pl-12 pr-11 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-sky-300 dark:bg-slate-900 dark:text-slate-100"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Hapus pencarian"
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800">
                <Icon name="x" className="h-4 w-4" />
              </button>
            )}
          </div>
          </>)}
        </header>

        {tab === 'tim' && isOwner ? <TeamPanel /> : (<>
        {/* Tombol filter */}
        <div className="flex gap-2 overflow-x-auto px-5 pt-4 [scrollbar-width:none]">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${activeCount ? 'bg-[#1F4E78] text-white' : 'bg-white text-slate-500 dark:bg-slate-900'}`}>
            <Icon name="filter" className="h-4 w-4" />
          </div>
          {FILTERS.map((f) => {
            const sel = filters[f.key];
            const text = sel.length === 0 ? f.label : sel.length === 1 ? lab(f.key, sel[0]) : `${f.label} (${sel.length})`;
            return (
              <button key={f.key} onClick={() => { setOptSearch(''); setOpenFilter(f.key); }}
                className={`flex h-9 shrink-0 items-center gap-1 rounded-full border px-4 text-sm transition ${
                  sel.length
                    ? 'border-[#1F4E78] bg-[#1F4E78] text-white'
                    : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                }`}>
                <span className="max-w-[150px] truncate">{text}</span>
                <Icon name="down" className="h-4 w-4 shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Filter aktif */}
        {activeCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
            {FILTERS.flatMap((f) => filters[f.key].map((v) => (
              <button key={f.key + v} onClick={() => toggleFilter(f.key, v)}
                className="flex items-center gap-1 rounded-full bg-[#1F4E78]/10 py-1 pl-3 pr-2 text-xs text-[#1F4E78] dark:bg-sky-400/15 dark:text-sky-300">
                <span className="max-w-[160px] truncate">{lab(f.key, v)}</span>
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            )))}
            <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-medium text-red-500">Reset semua</button>
          </div>
        )}

        {/* Riwayat pencarian */}
        {!query && recent.length > 0 && tab === 'cari' && (
          <div className="flex flex-wrap items-center gap-2 px-5 pt-3 text-sm text-slate-500">
            <Icon name="clock" className="h-4 w-4" />
            {recent.map((r) => (
              <button key={r} onClick={() => setQuery(r)} className="text-[#1F4E78] underline-offset-2 hover:underline dark:text-sky-300">
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Daftar */}
        <section className="px-5 pt-4">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-900 dark:bg-red-950/40">
              <p className="font-medium text-red-700 dark:text-red-300">Data gagal dimuat</p>
              <p className="mt-1 text-sm text-red-600/80 dark:text-red-300/80">{error}</p>
              <button onClick={load} className="mt-4 rounded-full bg-red-600 px-5 py-2 text-sm font-medium text-white">Coba lagi</button>
            </div>
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800/70" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center dark:bg-slate-900">
              <Icon name={tab === 'simpan' ? 'star' : 'user'} className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 font-medium">{tab === 'simpan' && !activeCount ? 'Belum ada konsumen disimpan' : 'Konsumen tidak ditemukan'}</p>
              <p className="mt-1 text-sm text-slate-500">
                {activeCount ? 'Tidak ada yang cocok dengan kombinasi filter ini.'
                  : tab === 'simpan' ? 'Ketuk bintang di detail konsumen untuk menyimpannya.' : 'Coba nama lain, nopol, atau nomor HP.'}
              </p>
              {activeCount > 0 && (
                <button onClick={() => setFilters(EMPTY_FILTERS)} className="mt-4 rounded-full border border-slate-200 px-5 py-2 text-sm font-medium dark:border-slate-700">
                  Reset filter
                </button>
              )}
            </div>
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {shown.map((r, i) => {
                const nama = pick(r, 'NAMA KONSUMEN', 'NAMA') || '(tanpa nama)';
                const isSaved = saved.includes(rowId(r));
                return (
                  <li key={rowId(r) + i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <button onClick={() => openDetail(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1F4E78]/10 text-sm font-semibold text-[#1F4E78] dark:bg-sky-400/15 dark:text-sky-300">
                        {initials(nama)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-medium"><Highlight text={nama} q={query.trim()} /></p>
                          <span className="shrink-0 font-mono text-xs text-slate-500"><Highlight text={pick(r, 'NOPOL')} q={query.trim()} /></span>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-slate-500">
                          {[pick(r, 'KECAMATAN'), [pick(r, 'BRAND UNIT'), pick(r, 'TYPE UNIT DETAIL')].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {isSaved && <Icon name="star" filled className="h-4 w-4 shrink-0 text-amber-400" />}
                      <Icon name="chevron" className="h-4 w-4 shrink-0 text-slate-300" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {filtered.length > shown.length && (
            <p className="py-4 text-center text-sm text-slate-500">
              Menampilkan 100 dari {filtered.length}. Ketik lebih spesifik untuk mempersempit.
            </p>
          )}
        </section>
        </>)}
      </div>

      {/* Navigasi bawah */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className={`mx-auto grid max-w-xl ${isOwner ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {([['cari', 'search', 'Cari'], ['simpan', 'star', `Disimpan (${saved.length})`], ['tim', 'users', 'Tim']] as const)
            .filter(([key]) => key !== 'tim' || isOwner)
            .map(([key, icon, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex flex-col items-center gap-1 py-3 text-xs ${tab === key ? 'text-[#1F4E78] dark:text-sky-300' : 'text-slate-400'}`}>
              <Icon name={icon} className="h-6 w-6" filled={key === 'simpan' && tab === key} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Panel pilihan filter (bottom sheet) */}
      {openFilter && (() => {
        const f = FILTERS.find((x) => x.key === openFilter)!;
        const sel = filters[f.key];
        return (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={() => setOpenFilter(null)}>
            <div onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-t-3xl bg-white pt-3 dark:bg-slate-900">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
              <div className="flex items-center justify-between px-5">
                <p className="text-lg font-semibold">{f.label}</p>
                {sel.length > 0 && (
                  <button onClick={() => setFilters((p) => ({ ...p, [f.key]: [] }))} className="text-sm font-medium text-red-500">
                    Hapus pilihan
                  </button>
                )}
              </div>
              {f.key === 'kel' && filters.kec.length > 0 && (
                <p className="px-5 pt-1 text-xs text-slate-500">Hanya kelurahan di kecamatan yang dipilih</p>
              )}
              <div className="relative mx-5 mt-3">
                <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={optSearch} onChange={(e) => setOptSearch(e.target.value)}
                  placeholder={`Cari ${f.label.toLowerCase()}`}
                  className="h-11 w-full rounded-xl bg-slate-100 pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-sky-300 dark:bg-slate-800" />
              </div>
              <ul className="mt-2 flex-1 overflow-y-auto px-2">
                {visibleOptions.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-slate-500">Tidak ada pilihan yang cocok</li>
                )}
                {visibleOptions.map((o) => {
                  const on = sel.includes(o.key);
                  return (
                    <li key={o.key}>
                      <button onClick={() => toggleFilter(f.key, o.key)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left active:bg-slate-50 dark:active:bg-slate-800">
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${on ? 'border-[#1F4E78] bg-[#1F4E78] text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                          {on && <Icon name="check" className="h-3.5 w-3.5" />}
                        </span>
                        <span className="flex-1 text-sm"><Highlight text={o.label} q={optSearch.trim()} /></span>
                        <span className={`text-xs ${o.count ? 'text-slate-400' : 'text-red-400'}`}>{o.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-slate-100 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 dark:border-slate-800">
                <button onClick={() => setOpenFilter(null)} className="w-full rounded-2xl bg-[#1F4E78] py-3 text-sm font-semibold text-white active:scale-[0.99]">
                  Lihat {filtered.length} konsumen
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Detail konsumen (bottom sheet) */}
      {selected && (() => {
        const r = selected;
        const nama = pick(r, 'NAMA KONSUMEN', 'NAMA') || '(tanpa nama)';
        const phones = splitPhones(pick(r, 'NO HP', 'NO. HP', 'HP'));
        const hp = phones[0] || '';
        const wa = toWa(hp);
        const maps = pick(r, 'MAPS');
        const mapsUrl = maps
          ? maps.startsWith('http') ? maps : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(maps)}`
          : '';
        const isSaved = saved.includes(rowId(r));
        const hidden = ['NAMA KONSUMEN', 'MAPS', 'NO WA', 'ANGSURAN', 'TENOR', 'PRODUK'];
        const action = 'flex flex-col items-center gap-1.5 rounded-2xl bg-slate-100 py-3 text-xs font-medium active:scale-95 dark:bg-slate-800';

        return (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={() => setSelected(null)}>
            <div onClick={(e) => e.stopPropagation()}
              className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3 dark:bg-slate-900">
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />

              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#1F4E78] text-lg font-semibold text-white">
                  {initials(nama)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{nama}</p>
                  {pick(r, 'PRODUK') && (
                    <span className="mt-1 inline-block max-w-full truncate rounded-full bg-teal-50 px-2.5 py-0.5 text-xs text-teal-700 dark:bg-teal-400/15 dark:text-teal-300">
                      {pick(r, 'PRODUK')}
                    </span>
                  )}
                </div>
                <button onClick={() => toggleSave(r)} aria-label="Simpan konsumen"
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${isSaved ? 'text-amber-400' : 'text-slate-400'}`}>
                  <Icon name="star" filled={isSaved} className="h-6 w-6" />
                </button>
              </div>

              <div className={`mt-5 grid gap-2 ${isOwner ? 'grid-cols-4' : 'grid-cols-2'}`}>
                {isOwner && (<>
                {phones.length > 1 ? (
                  <button onClick={() => setPicker({ kind: 'tel', phones })} className={action}>
                    <Icon name="phone" className="h-6 w-6 text-[#1F4E78] dark:text-sky-300" />Telepon
                  </button>
                ) : (
                  <a href={hp ? `tel:${hp}` : undefined} className={`${action} ${hp ? '' : 'opacity-40'}`}>
                    <Icon name="phone" className="h-6 w-6 text-[#1F4E78] dark:text-sky-300" />Telepon
                  </a>
                )}
                {phones.length > 1 ? (
                  <button onClick={() => setPicker({ kind: 'wa', phones })} className={action}>
                    <Icon name="chat" className="h-6 w-6 text-green-600" />WhatsApp
                  </button>
                ) : (
                  <a href={wa ? `https://wa.me/${wa}` : undefined} target="_blank" rel="noreferrer" className={`${action} ${wa ? '' : 'opacity-40'}`}>
                    <Icon name="chat" className="h-6 w-6 text-green-600" />WhatsApp
                  </a>
                )}
                </>)}
                <a href={mapsUrl || undefined} target="_blank" rel="noreferrer" className={`${action} ${mapsUrl ? '' : 'opacity-40'}`}>
                  <Icon name="pin" className="h-6 w-6 text-red-500" />Maps
                </a>
                <button onClick={() => copyData(r)} className={action}>
                  <Icon name="copy" className="h-6 w-6 text-slate-500" />Salin
                </button>
              </div>

              {isOwner && phones.length > 1 && (
                <div className="mt-4 rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                  <p className="px-1 pb-2 text-xs text-slate-500">Konsumen ini punya {phones.length} nomor HP</p>
                  {phones.map((p, i) => (
                    <div key={p} className="flex items-center gap-2 border-t border-slate-100 py-2 first:border-0 dark:border-slate-800">
                      <span className="flex-1 font-mono text-sm">{p}{i === 0 && <span className="ml-2 font-sans text-xs text-slate-400">utama</span>}</span>
                      <a href={`tel:${p}`} aria-label={`Telepon ${p}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <Icon name="phone" className="h-4 w-4 text-[#1F4E78] dark:text-sky-300" />
                      </a>
                      <a href={`https://wa.me/${toWa(p)}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${p}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <Icon name="chat" className="h-4 w-4 text-green-600" />
                      </a>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[#1F4E78]/5 p-4 dark:bg-sky-400/10">
                <div>
                  <p className="text-xs text-slate-500">Angsuran</p>
                  <p className="text-lg font-semibold">{rupiah(pick(r, 'ANGSURAN'))}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Tenor</p>
                  <p className="text-lg font-semibold">{pick(r, 'TENOR') ? `${pick(r, 'TENOR')} bulan` : '-'}</p>
                </div>
              </div>

              <dl className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {Object.entries(r)
                  .filter(([k, v]) => v && !hidden.includes(k.trim().toUpperCase()))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
                      <dt className="shrink-0 text-slate-500">{k}</dt>
                      <dd className="text-right font-medium break-all">{v}</dd>
                    </div>
                  ))}
              </dl>

              <button onClick={() => setSelected(null)}
                className="mt-5 w-full rounded-2xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700">
                Tutup
              </button>
            </div>
          </div>
        );
      })()}

      {/* Pilih nomor (jika konsumen punya lebih dari 1 nomor) */}
      {picker && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={() => setPicker(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 dark:bg-slate-900">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            <p className="text-lg font-semibold">{picker.kind === 'wa' ? 'Buka WhatsApp ke nomor' : 'Telepon ke nomor'}</p>
            <div className="mt-3 space-y-2">
              {picker.phones.map((p, i) => (
                <a key={p} onClick={() => setPicker(null)}
                  href={picker.kind === 'wa' ? `https://wa.me/${toWa(p)}` : `tel:${p}`}
                  target={picker.kind === 'wa' ? '_blank' : undefined} rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3.5 active:scale-[0.99] dark:bg-slate-800">
                  <Icon name={picker.kind === 'wa' ? 'chat' : 'phone'}
                    className={`h-5 w-5 ${picker.kind === 'wa' ? 'text-green-600' : 'text-[#1F4E78] dark:text-sky-300'}`} />
                  <span className="flex-1 font-mono text-base">{p}</span>
                  <span className="text-xs text-slate-400">Nomor {i + 1}</span>
                </a>
              ))}
            </div>
            <button onClick={() => setPicker(null)} className="mt-4 w-full rounded-2xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Notifikasi kecil */}
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-5">
          <div className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-slate-900">{toast}</div>
        </div>
      )}
    </main>
  );
}
