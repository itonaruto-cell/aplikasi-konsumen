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
  refresh: <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></>),
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
const rupiah = (v: string) => {
  const n = Number(digits(v));
  return n ? 'Rp ' + n.toLocaleString('id-ID') : v || '-';
};
const initials = (n: string) =>
  n.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
const rowId = (r: Row) => pick(r, 'ORDER_NO', 'ORDER NO') || pick(r, 'NAMA KONSUMEN') + pick(r, 'NOPOL');

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

/* ---------- Halaman ---------- */
export default function Home() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [area, setArea] = useState('Semua');
  const [tab, setTab] = useState<'cari' | 'simpan'>('cari');
  const [selected, setSelected] = useState<Row | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [toast, setToast] = useState('');
  const [greeting, setGreeting] = useState('Selamat datang');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/search?q=');
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const areas = useMemo(() => {
    const set = new Set(rows.map((r) => pick(r, 'KECAMATAN')).filter(Boolean));
    return ['Semua', ...Array.from(set).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = norm(query);
    return rows.filter((r) => {
      if (tab === 'simpan' && !saved.includes(rowId(r))) return false;
      if (area !== 'Semua' && pick(r, 'KECAMATAN') !== area) return false;
      if (!q) return true;
      return norm(Object.values(r).join(' ')).includes(q);
    });
  }, [rows, query, area, tab, saved]);

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
              <p className="text-sm text-white/70">{greeting}</p>
              <h1 className="text-2xl font-semibold tracking-tight">Cari Konsumen</h1>
            </div>
            <button onClick={load} aria-label="Muat ulang data"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 active:scale-95">
              <Icon name="refresh" className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

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
              placeholder="Nama, nopol, no HP, order no"
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
        </header>

        {/* Filter kecamatan */}
        <div className="flex gap-2 overflow-x-auto px-5 pt-4 [scrollbar-width:none]">
          {areas.map((a) => (
            <button key={a} onClick={() => setArea(a)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
                area === a
                  ? 'border-[#1F4E78] bg-[#1F4E78] text-white'
                  : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
              }`}>
              {a}
            </button>
          ))}
        </div>

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
              <p className="mt-3 font-medium">{tab === 'simpan' ? 'Belum ada konsumen disimpan' : 'Konsumen tidak ditemukan'}</p>
              <p className="mt-1 text-sm text-slate-500">
                {tab === 'simpan' ? 'Ketuk bintang di detail konsumen untuk menyimpannya.' : 'Coba nama lain, nopol, atau nomor HP.'}
              </p>
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
      </div>

      {/* Navigasi bawah */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto grid max-w-xl grid-cols-2">
          {([['cari', 'search', 'Cari'], ['simpan', 'star', `Disimpan (${saved.length})`]] as const).map(([key, icon, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex flex-col items-center gap-1 py-3 text-xs ${tab === key ? 'text-[#1F4E78] dark:text-sky-300' : 'text-slate-400'}`}>
              <Icon name={icon} className="h-6 w-6" filled={key === 'simpan' && tab === key} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Detail konsumen (bottom sheet) */}
      {selected && (() => {
        const r = selected;
        const nama = pick(r, 'NAMA KONSUMEN', 'NAMA') || '(tanpa nama)';
        const hp = pick(r, 'NO HP', 'NO. HP', 'HP');
        const wa = pick(r, 'NO WA') || toWa(hp);
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

              <div className="mt-5 grid grid-cols-4 gap-2">
                <a href={hp ? `tel:${digits(hp)}` : undefined} className={`${action} ${hp ? '' : 'opacity-40'}`}>
                  <Icon name="phone" className="h-6 w-6 text-[#1F4E78] dark:text-sky-300" />Telepon
                </a>
                <a href={wa ? `https://wa.me/${wa}` : undefined} target="_blank" rel="noreferrer" className={`${action} ${wa ? '' : 'opacity-40'}`}>
                  <Icon name="chat" className="h-6 w-6 text-green-600" />WhatsApp
                </a>
                <a href={mapsUrl || undefined} target="_blank" rel="noreferrer" className={`${action} ${mapsUrl ? '' : 'opacity-40'}`}>
                  <Icon name="pin" className="h-6 w-6 text-red-500" />Maps
                </a>
                <button onClick={() => copyData(r)} className={action}>
                  <Icon name="copy" className="h-6 w-6 text-slate-500" />Salin
                </button>
              </div>

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

      {/* Notifikasi kecil */}
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-5">
          <div className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-slate-900">{toast}</div>
        </div>
      )}
    </main>
  );
}
