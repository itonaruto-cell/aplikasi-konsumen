'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { OverlayCtx } from './overlay';
import type { Orang, Pengumuman, Performa } from '../lib/performa-types';
import { PengumumanForm } from './performa/Pengumuman';
import { refreshPush } from './push-client';
import { brandOf, buildCtx, findMe, keyOf, ranking, stories, streak, type BrandKey, type Story } from '../lib/performa-calc';
import { ThemeToggle } from './theme';
import { Sheet, type View } from './performa/ui';
import { Confetti, Ico, vibrate } from './performa/parts';
import Pantau from './performa/Pantau';
import Wrapped from './performa/Wrapped';
import Juara from './performa/Juara';
import Rute from './performa/Rute';
import Saya from './performa/Saya';
import Sorotan from './performa/Sorotan';
import BahanSurvey from './performa/Bahan';
import Insentif from './performa/Insentif';
import InjectP3 from './performa/Inject';
import Plan from './performa/Plan';
import Kejar from './performa/Kejar';

// Kerangka aplikasi (gaya sosmed): Pantau (pantauan cabang / Mobilku / Motorku), Plan (plan aktivitas harian), Rute,
// Cari (khusus owner/konsumen), Saya.
// Bahan survey, Insentif, dan Inject P3 dibuka dari halaman Saya.
// Data performa boleh dilihat semua akun terdaftar; nomor HP / kontrak / alamat konsumen tidak pernah dikirim ke sini.

type Akun = { email: string; name?: string; role: 'owner' | 'konsumen' | 'tim'; perfName?: string | null };
type Page = 'pantau' | 'plan' | 'juara' | 'rute' | 'cari' | 'saya' | 'aktivitas' | 'bahan' | 'insentif' | 'inject';
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

  const [page, setPage] = useState<Page>('pantau');
  const brand: BrandKey = 'semua';
  const [wrap, setWrap] = useState(false);
  const [rayakan, setRayakan] = useState<string | null>(null);
  const [rute] = useState<{ mode: 'belum' | 'ulang'; brand: BrandKey; n: number }>({ mode: 'belum', brand: 'semua', n: 0 });
  const [stack, setStack] = useState<View[]>([]);
  const [story, setStory] = useState<number | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [pull, setPull] = useState(0);
  const pullStart = useRef<number | null>(null);
  const [pengumuman, setPengumuman] = useState<Pengumuman[]>([]);
  const [pKey, setPKey] = useState(0);
  const [formP, setFormP] = useState(false);
  const [toast, setToast] = useState('');

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

  // Pengumuman owner
  useEffect(() => {
    let alive = true;
    fetch('/api/pengumuman', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { list: [] }))
      .then((j) => { if (alive) setPengumuman(Array.isArray(j?.list) ? j.list : []); }).catch(() => {});
    return () => { alive = false; };
  }, [reloadKey, pKey]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

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
  const me: Orang | null = useMemo(() => (data ? findMe(data, akun.perfName, akun.name, akun.email) : null), [data, akun.perfName, akun.name, akun.email]);
  const storyList = useMemo(() => (c ? stories(c, brand, me) : []), [c, brand, me]);
  // Owner adalah SPV: tidak ikut ditagih plan, bukan pilihan PIC survey, dan tidak punya hitungan insentif perorangan
  const spv = akun.role === 'owner' ? me : null;
  // Pilihan PIC survey di Bahan survey: anggota Mobilku dari pantauan
  const tim = useMemo(() => (data?.orang || []).filter((o) => brandOf(o) === 'mobilku' && o !== spv).map((o) => o.nama), [data, spv]);
  // Yang ditagih plan aktivitas: semua anggota di pantauan (Mobilku dan Motorku), kecuali owner sendiri
  const staf = useMemo(() => (data?.orang || []).filter((o) => o !== spv).map((o) => ({ nama: o.nama, brand: brandOf(o) })), [data, spv]);
  const myStreak = c && me ? streak(c, me.nama) : 0;
  // Simpan nama anggota di langganan notifikasi (supaya pesan pagi/sore sesuai orangnya)
  useEffect(() => { if (me) refreshPush(me.nama).catch(() => {}); }, [me?.nama]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Perayaan: target tembus (sekali per bulan per ukuran) & naik peringkat (sekali per hari) ---------- */
  useEffect(() => {
    if (!c || !me) return;
    const bln = c.today.slice(0, 7);
    const get = (k: string) => { try { return localStorage.getItem(k); } catch { return '1'; } };
    const set = (k: string) => { try { localStorage.setItem(k, '1'); } catch { /* abaikan */ } };
    for (const m of ['amount', 'unit'] as const) {
      const ach = me[m]?.ach;
      const k = `ck_rayakan_${m}_${bln}`;
      if (typeof ach === 'number' && ach >= 1 && !get(k)) {
        set(k); vibrate();
        setRayakan(m === 'amount' ? 'Target amount tembus!' : 'Target unit tembus!');
        const t = setTimeout(() => setRayakan(null), 3800);
        return () => clearTimeout(t);
      }
    }
    const kemarin = data?.riwayat?.kemarin?.rank?.amount;
    if (kemarin?.length) {
      const before = kemarin.indexOf(keyOf(me.nama)) + 1;
      const now = ranking(c, 'amount').find((r) => r.o === me)?.rank || 0;
      const k = `ck_naik_${c.today}`;
      if (before && now && now < before && !get(k)) { set(k); vibrate(); setToast(`Naik ke #${now} amount!`); }
    }
  }, [c, me]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- Tombol kembali Android: tutup panel / sorotan / balik ke Pantau ---------- */
  const push = (v: View) => setStack((s) => [...s, v]);
  const depth = ovN + stack.length + (story !== null ? 1 : 0) + (page !== 'pantau' ? 1 : 0);
  const prevDepth = useRef(0);
  const fromPop = useRef(false);
  const ignorePop = useRef(0);
  const backOne = useRef<() => void>(() => {});
  backOne.current = () => {
    if (overlays.current.length) overlays.current[overlays.current.length - 1]();
    else if (story !== null) setStory(null);
    else if (stack.length) setStack((s) => s.slice(0, -1));
    else if (page !== 'pantau') setPage('pantau');
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
    document.body.style.overflow = stack.length || story !== null || wrap ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [stack.length, story, wrap]);

  const go = (p: Page) => { setPage(p); window.scrollTo({ top: 0 }); };

  /* ---------- Tarik ke bawah untuk muat ulang ---------- */
  const overlay = ovN > 0 || stack.length > 0 || story !== null || wrap;
  const onTouchStart = (e: TouchEvent) => { pullStart.current = !overlay && window.scrollY <= 0 ? e.touches[0].clientY : null; };
  const onTouchMove = (e: TouchEvent) => {
    if (pullStart.current === null) return;
    const dy = e.touches[0].clientY - pullStart.current;
    setPull(dy > 0 ? Math.min(90, dy * 0.45) : 0);
  };
  const onTouchEnd = () => { if (pull >= 64) reload(); setPull(0); pullStart.current = null; };

  const cabang = (data?.cabang || 'kendal').toLowerCase();
  const namaApp = `Marketing ${cabang.replace(/\b\w/g, (h) => h.toUpperCase())}`;
  const TITLE: Record<Page, string> = { pantau: namaApp, plan: 'Plan aktivitas', juara: 'Papan juara', rute: 'Rute visit', cari: 'Cari konsumen', saya: 'Saya', aktivitas: 'Aktivitas tim', bahan: 'Bahan survey', insentif: 'Insentif', inject: 'Inject P3' };

  const NAV: [Page, string, string][] = [
    ['pantau', 'chart', 'Pantau'], ['plan', 'list', 'Plan'], ['rute', 'pin', 'Rute'],
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
          <div className={`flex items-center justify-between gap-2 pl-4 pr-1.5 pt-2 ${page === 'pantau' ? '' : 'border-b border-neutral-200 pb-2 dark:border-neutral-800'}`}>
            <div className="min-w-0">
              {page === 'pantau' ? (
                <h1 className="flex items-center gap-2.5 truncate text-[21px] font-bold tracking-tight">
                  <img src="/icon-192.png" alt="" width={30} height={30} className="h-[30px] w-[30px] shrink-0 rounded-full bg-white" />
                  <span className="truncate">{namaApp}</span>
                </h1>
              ) : (
                <h1 className="truncate text-[22px] font-bold tracking-tight">{TITLE[page]}</h1>
              )}
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
        </header>

        {/* Indikator tarik untuk muat ulang */}
        {pull > 0 && (
          <div className="flex justify-center overflow-hidden" style={{ height: pull }}>
            <span className={`mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-900 ${pull >= 64 ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'}`}>
              <span style={{ transform: `translateX(${Math.round((pull / 90) * 12 - 6)}px)` }} className={pull >= 64 ? 'ck-pop' : ''}>
                <Ico n="car" className="h-5 w-5" sw={2} />
              </span>
            </span>
          </div>
        )}

        {page === 'cari' && cari ? cari(reloadKey) : page === 'aktivitas' && aktivitas ? aktivitas(reloadKey)
          : page === 'bahan' ? <BahanSurvey akun={akun} me={me} tim={tim} reloadKey={reloadKey} onInsentif={() => go('insentif')} />
          : page === 'insentif' ? <Insentif c={c} me={me} akun={akun} reloadKey={reloadKey} onBahan={() => go('bahan')} />
          : page === 'plan' ? <Plan c={c} me={me} akun={akun} tim={tim} staf={staf} cabang={data?.cabang || 'KENDAL'} reloadKey={reloadKey} onInsentif={() => go('insentif')} />
          : page === 'inject' ? <InjectP3 akun={akun} cabang={data?.cabang || 'KENDAL'} reloadKey={reloadKey} />
          : loading && !data ? (
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
            {page === 'pantau' && (
              <Pantau c={c} me={me} akun={akun} push={push}
                pengumuman={pengumuman} isOwner={akun.role === 'owner'} onPengumuman={() => setPKey((k) => k + 1)} buatPengumuman={() => setFormP(true)}
                openWrapped={() => setWrap(true)}
                kejar={(cek) => <Kejar c={c} me={me} spv={spv} isOwner={akun.role === 'owner'} reloadKey={reloadKey} cek={cek} onBahan={() => go('bahan')} />} />
            )}
            {page === 'juara' && <Juara c={c} me={me} push={push} storyList={storyList} seen={(s) => seen.includes(storyKey(s))} openStory={setStory} />}
            {page === 'rute' && <Rute key={`${rute.mode}-${rute.brand}-${rute.n}`} data={data} push={push} mode0={rute.mode} brand0={rute.n ? rute.brand : (me && brandOf(me)) || 'semua'} />}
            {page === 'saya' && <Saya c={c} me={me} akun={akun} push={push} onCari={cari ? () => go('cari') : undefined} onAktivitas={aktivitas ? () => go('aktivitas') : undefined} onWrapped={() => setWrap(true)} onBahan={() => go('bahan')} onInsentif={() => go('insentif')} onInject={() => go('inject')} onJuara={() => go('juara')} onPengumuman={akun.role === 'owner' ? () => setFormP(true) : undefined} />}
          </>
        )}
      </div>

      {/* Navigasi bawah gaya Android */}
      <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))` }}>
          {NAV.map(([k, icon, label]) => {
            const on = k === page || (k === 'saya' && (page === 'aktivitas' || page === 'bahan' || page === 'insentif' || page === 'inject' || page === 'juara'));
            return (
              <button key={k} onClick={() => (k === page ? window.scrollTo({ top: 0, behavior: 'smooth' }) : go(k))}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${on ? 'font-bold text-neutral-900 dark:text-white' : 'font-medium text-neutral-500 dark:text-neutral-400'}`}>
                <span className={`flex h-8 items-center justify-center rounded-full transition ${NAV.length > 5 ? 'w-12' : 'w-14'} ${on ? 'bg-neutral-200/80 dark:bg-neutral-800' : ''}`}>
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

      {formP && (
        <PengumumanForm onClose={() => setFormP(false)}
          onSaved={(n) => { setFormP(false); setPKey((k) => k + 1); setToast(n ? `Pengumuman terkirim ke ${n} HP` : 'Pengumuman disematkan'); }} />
      )}
      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center px-5">
          <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">{toast}</div>
        </div>
      )}

      {wrap && c && <Wrapped c={c} me={me} onClose={() => setWrap(false)} />}

      {rayakan && (
        <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
          <Confetti n={42} />
          <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+84px)] flex justify-center px-5">
            <div className="ck-pop rounded-2xl bg-neutral-900 px-5 py-3 text-center text-white shadow-lg dark:bg-white dark:text-neutral-900">
              <p className="text-lg font-bold">{rayakan}</p>
              <p className="text-[13px] opacity-75">Mantap! Pertahankan sampai akhir bulan.</p>
            </div>
          </div>
        </div>
      )}

      {story !== null && c && storyList.length > 0 && (
        <Sorotan list={storyList} start={Math.min(story, storyList.length - 1)} c={c} onSeen={markSeen}
          onClose={() => setStory(null)} onProfile={(o) => { setStory(null); push({ t: 'orang', o }); }} />
      )}
    </div>
    </OverlayCtx.Provider>
  );
}
