'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { OverlayCtx } from './overlay';
import type { Orang, Performa } from '../lib/performa-types';
import { brandOf, buildCtx, findMe, stories, streak, type BrandKey, type Story } from '../lib/performa-calc';
import { ThemeToggle } from './theme';
import { Sheet, type View } from './performa/ui';
import { Ico, UnderTabs } from './performa/parts';
import Kabar from './performa/Kabar';
import Juara from './performa/Juara';
import Rute from './performa/Rute';
import Saya from './performa/Saya';
import Sorotan from './performa/Sorotan';

// Kerangka aplikasi (gaya sosmed): Kabar (feed + papan juara + misi), Juara, Rute, Cari (khusus owner/konsumen), Saya.
// Data performa boleh dilihat semua akun terdaftar; nomor HP / kontrak / alamat konsumen tidak pernah dikirim ke sini.

type Akun = { email: string; name?: string; role: 'owner' | 'konsumen' | 'tim'; perfName?: string | null };
type Page = 'kabar' | 'juara' | 'rute' | 'cari' | 'saya' | 'aktivitas';
type Slot = (reloadKey: number) => ReactNode;
const SEEN_KEY = 'ck_story_seen';

const readSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; } };
const storyKey = (s: Story) => `${s.o.nama}|${s.d}`;

export default function PerformaPanel({ me: akun, cari, aktivitas }: { me: Akun; cari?: Slot; aktivitas?: Slot }) {
  const [data, setData] = useState<Performa | null>(null);
  const [kosong, setKosong] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const loadedAt = useRef(0);

  const [page, setPage] = useState<Page>('kabar');
  const [brand, setBrand] = useState<BrandKey>('semua');
  const [rute, setRute] = useState<{ mode: 'belum' | 'ulang'; brand: BrandKey; n: number }>({ mode: 'belum', brand: 'semua', n: 0 });
  const [stack, setStack] = useState<View[]>([]);
  const [story, setStory] = useState<number | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [pull, setPull] = useState(0);
  const pullStart = useRef<number | null>(null);

  // Lembar/panel dari halaman lain (mis. detail di Cari) ikut ditutup tombol kembali Android
  const overlays = useRef<(() => void)[]>([]);
  const [ovN, setOvN] = useState(0);
  const registerOverlay = useCallback((close: () => void) => {
    overlays.current.push(close);
    setOvN((n) => n + 1);
    return () => {
      const i = overlays.current.lastIndexOf(close);
      if (i >= 0) overlays.current.splice(i, 1);
      setOvN((n) => n - 1);
    };
  }, []);

  /* ---------- Muat data ---------- */
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
        else { setKosong(false); setData(json as Performa); loadedAt.current = Date.now(); }
      } catch {
        if (alive) setErr('Koneksi bermasalah. Periksa internet lalu coba lagi.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);
  const reload = () => setReloadKey((k) => k + 1);

  // Balik ke aplikasi setelah >5 menit → muat ulang diam-diam
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > 300_000) reload(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => { setSeen(readSeen()); }, []);
  const markSeen = (s: Story) => setSeen((prev) => {
    const k = storyKey(s);
    if (prev.includes(k)) return prev;
    const next = [...prev, k].slice(-200);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* abaikan */ }
    return next;
  });

  /* ---------- Hitungan ---------- */
  const c = useMemo(() => (data ? buildCtx(data) : null), [data]);
  const me: Orang | null = useMemo(() => (data ? findMe(data, akun.perfName, akun.name) : null), [data, akun.perfName, akun.name]);
  const storyList = useMemo(() => (c ? stories(c, brand, me) : []), [c, brand, me]);
  const myStreak = c && me ? streak(c, me.nama) : 0;

  /* ---------- Tombol kembali Android: tutup panel / sorotan / balik ke Kabar ---------- */
  const push = (v: View) => setStack((s) => [...s, v]);
  const depth = ovN + stack.length + (story !== null ? 1 : 0) + (page !== 'kabar' ? 1 : 0);
  const prevDepth = useRef(0);
  const fromPop = useRef(false);
  const ignorePop = useRef(0);
  const backOne = useRef<() => void>(() => {});
  backOne.current = () => {
    if (overlays.current.length) overlays.current[overlays.current.length - 1]();
    else if (story !== null) setStory(null);
    else if (stack.length) setStack((s) => s.slice(0, -1));
    else if (page !== 'kabar') setPage('kabar');
  };
  useEffect(() => {
    const d = depth - prevDepth.current;
    if (d > 0) for (let i = 0; i < d; i++) window.history.pushState({ perf: true }, '');
    else if (d < 0 && !fromPop.current) { ignorePop.current += 1; window.history.go(d); }
    fromPop.current = false;
    prevDepth.current = depth;
  }, [depth]);
  useEffect(() => {
    const onPop = () => {
      if (ignorePop.current > 0) { ignorePop.current -= 1; return; }
      fromPop.current = true;
      backOne.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.body.style.overflow = stack.length || story !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [stack.length, story]);

  const go = (p: Page) => { setPage(p); window.scrollTo({ top: 0 }); };

  /* ---------- Tarik ke bawah untuk muat ulang ---------- */
  const overlay = ovN > 0 || stack.length > 0 || story !== null;
  const onTouchStart = (e: TouchEvent) => { pullStart.current = !overlay && window.scrollY <= 0 ? e.touches[0].clientY : null; };
  const onTouchMove = (e: TouchEvent) => {
    if (pullStart.current === null) return;
    const dy = e.touches[0].clientY - pullStart.current;
    setPull(dy > 0 ? Math.min(90, dy * 0.45) : 0);
  };
  const onTouchEnd = () => { if (pull >= 64) reload(); setPull(0); pullStart.current = null; };

  const cabang = (data?.cabang || 'kendal').toLowerCase();
  const TITLE: Record<Page, string> = { kabar: `${cabang}.team`, juara: 'Papan juara', rute: 'Rute visit', cari: 'Cari konsumen', saya: 'Saya', aktivitas: 'Aktivitas tim' };

  const NAV: [Page, string, string][] = [
    ['kabar', 'home', 'Kabar'], ['juara', 'trophy', 'Juara'], ['rute', 'pin', 'Rute'],
    ...(cari ? [['cari', 'search', 'Cari'] as [Page, string, string]] : []),
    ['saya', 'user', 'Saya'],
  ];

  return (
    <OverlayCtx.Provider value={registerOverlay}>
    <div className="min-h-dvh bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50"
      style={{ fontFamily: 'var(--font-instrument), system-ui, sans-serif' }}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="mx-auto max-w-xl pb-[calc(84px+env(safe-area-inset-bottom))]">
        {/* Header menempel di atas */}
        <header className="sticky top-0 z-30 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:bg-neutral-950/95">
          <div className={`flex items-center justify-between gap-2 pl-4 pr-1.5 pt-2 ${page === 'kabar' ? '' : 'border-b border-neutral-200 pb-2 dark:border-neutral-800'}`}>
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-bold tracking-tight">{TITLE[page]}</h1>
            </div>
            <div className="flex shrink-0 items-center">
              {myStreak > 1 && (
                <button onClick={() => go('saya')} aria-label={`${myStreak} hari kerja beruntun ada aktivitas`}
                  className="mr-0.5 flex h-9 items-center gap-1 whitespace-nowrap rounded-full bg-[#FFF4E0] px-2.5 text-sm font-bold text-[#8A4700] dark:bg-[#2A1E0C] dark:text-[#F7C98A]">
                  <Ico n="flame" className="h-4 w-4" fill="#F2A33A" sw={1.6} />{myStreak}
                </button>
              )}
              <ThemeToggle className="h-12 w-12" />
              <button onClick={reload} aria-label="Muat ulang" className="flex h-12 w-12 items-center justify-center rounded-full active:scale-95">
                <Ico n="refresh" className={`h-[22px] w-[22px] ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          {page === 'kabar' && (
            <UnderTabs value={brand} onChange={setBrand} options={[['semua', 'Semua'], ['mobilku', 'Mobilku'], ['motorku', 'Motorku']]} />
          )}
        </header>

        {/* Indikator tarik untuk muat ulang */}
        {pull > 0 && (
          <div className="flex justify-center overflow-hidden" style={{ height: pull }}>
            <span className={`mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-900 ${pull >= 64 ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>
              <Ico n="refresh" className="h-5 w-5" sw={2} />
            </span>
          </div>
        )}

        {page === 'cari' && cari ? cari(reloadKey) : page === 'aktivitas' && aktivitas ? aktivitas(reloadKey) : loading && !data ? (
          <div className="space-y-3 px-4 pt-4">
            <div className="flex gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 w-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />)}</div>
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-[20px] bg-neutral-200/70 dark:bg-neutral-800/70" />)}
          </div>
        ) : err && !data ? (
          <div className="mx-4 mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {err}
            <button onClick={reload} className="mt-3 block min-h-11 rounded-full bg-red-700 px-5 font-semibold text-white">Coba lagi</button>
          </div>
        ) : kosong || !data || !c ? (
          <div className="mx-4 mt-4 rounded-2xl border border-neutral-200 p-8 text-center dark:border-neutral-800">
            <p className="font-semibold">Belum ada data performa</p>
            <p className="mt-1 text-sm text-neutral-500">Data muncul setelah Apps Script pantauan cabang mengirim kiriman pertamanya.</p>
          </div>
        ) : (
          <>
            {page === 'kabar' && (
              <Kabar c={c} me={me} brand={brand} push={push}
                storyList={storyList} seen={(s) => seen.includes(storyKey(s))} openStory={setStory}
                goJuara={() => go('juara')}
                goRute={(mode, b) => { setRute((r) => ({ mode, brand: b, n: r.n + 1 })); go('rute'); }} />
            )}
            {page === 'juara' && <Juara c={c} me={me} push={push} />}
            {page === 'rute' && <Rute key={`${rute.mode}-${rute.brand}-${rute.n}`} data={data} push={push} mode0={rute.mode} brand0={rute.n ? rute.brand : (me && brandOf(me)) || 'semua'} />}
            {page === 'saya' && <Saya c={c} me={me} akun={akun} push={push} onCari={cari ? () => go('cari') : undefined} onAktivitas={aktivitas ? () => go('aktivitas') : undefined} />}
          </>
        )}
      </div>

      {/* Navigasi bawah gaya Android */}
      <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))` }}>
          {NAV.map(([k, icon, label]) => {
            const on = k === page || (k === 'saya' && page === 'aktivitas');
            return (
              <button key={k} onClick={() => (on ? window.scrollTo({ top: 0, behavior: 'smooth' }) : go(k))}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${on ? 'font-bold text-neutral-900 dark:text-white' : 'font-medium text-neutral-500 dark:text-neutral-400'}`}>
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${on ? 'bg-neutral-200/80 dark:bg-neutral-800' : ''}`}>
                  <Ico n={icon} className="h-[22px] w-[22px]" sw={on ? 2.2 : 1.9} />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {stack.length > 0 && data && c && (
        <Sheet stack={stack} data={data} push={push}
          pop={() => setStack((s) => s.slice(0, -1))} close={() => setStack([])}
          rankOf={(n) => {
            const r = [...c.sales].filter((o) => typeof o.amount?.ach === 'number').sort((a, b) => (b.amount!.ach as number) - (a.amount!.ach as number));
            return [r.findIndex((o) => o.nama === n) + 1, r.length];
          }} />
      )}

      {story !== null && c && storyList.length > 0 && (
        <Sorotan list={storyList} start={Math.min(story, storyList.length - 1)} c={c} onSeen={markSeen}
          onClose={() => setStory(null)} onProfile={(o) => { setStory(null); push({ t: 'orang', o }); }} />
      )}
    </div>
    </OverlayCtx.Provider>
  );
}
