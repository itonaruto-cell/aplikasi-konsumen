'use client';
import { lazy, Suspense, useEffect, useState } from 'react';
import PerformaPanel from './PerformaPanel';
import { KUNCI_AKUN, bacaCache, hapusCache, mulaiAmbilPerforma, simpanCache } from '../lib/cache-hp';

// Dimuat terpisah saat dibuka pertama kali (tidak memperlambat pembukaan aplikasi)
const CariKonsumen = lazy(() => import('./CariKonsumen'));
const AktivitasTim = lazy(() => import('./AktivitasTim'));
const Memuat = () => <p className="px-4 pt-6 text-[14px] text-neutral-500">Memuat…</p>;

// Satu aplikasi untuk semua anggota. Layar pertama selalu Performa (Kabar).
// - owner    : Performa + Cari konsumen (dengan nomor HP) + Aktivitas tim
// - konsumen : Performa + Cari konsumen (tanpa nomor HP)
// - tim      : Performa saja
type Akun = { email: string; name?: string; role: 'owner' | 'spv' | 'konsumen' | 'tim'; perfName?: string | null };

export default function Home() {
  const [me, setMe] = useState<Akun | null>(null);
  const [error, setError] = useState('');
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let alive = true;
    // Akun terakhir langsung dipakai supaya layar tidak menunggu; tetap dicek ulang ke server
    if (tries === 0) { mulaiAmbilPerforma(); const c = bacaCache<Akun>(KUNCI_AKUN); if (c) setMe(c); }
    (async () => {
      setError('');
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (res.status === 401) { hapusCache(); window.location.href = '/login'; return; }
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) { hapusCache(); setMe(null); setError(json?.error || 'Akun ini tidak bisa dipakai.'); }
        else {
          const baru = json as Akun;
          // Akun berbeda dari simpanan (ganti akun): data performa simpanan ikut dibuang
          setMe((lama) => { if (lama && lama.email !== baru.email) hapusCache(); return lama && JSON.stringify(lama) === JSON.stringify(baru) ? lama : baru; });
          simpanCache(KUNCI_AKUN, baru);
        }
      } catch {
        if (alive) setError('Koneksi bermasalah. Periksa internet lalu coba lagi.');
      }
    })();
    return () => { alive = false; };
  }, [tries]);

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
  }, [me?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sebelum peran akun diketahui: layar muat netral (tidak pernah menampilkan Cari konsumen dulu)
  if (!me) {
    return (
      <main className="flex min-h-dvh flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50"
        style={{ fontFamily: 'var(--font-instrument), system-ui, sans-serif' }}>
        <div className="mx-auto w-full max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+14px)]">
          <p className="flex items-center gap-2.5 text-[21px] font-bold tracking-tight">
            <img src="/icon-192.png" alt="" width={30} height={30} className="h-[30px] w-[30px] shrink-0 rounded-full bg-white" />
            Marketing Kendal
          </p>
          {error ? (
            <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
              {error}
              <div className="mt-3 flex gap-2">
                <button onClick={() => setTries((n) => n + 1)} className="min-h-11 rounded-full bg-red-700 px-5 font-semibold text-white">Coba lagi</button>
                <a href="/api/auth/logout" className="flex min-h-11 items-center rounded-full border border-red-300 px-5 font-semibold dark:border-red-800">Ganti akun</a>
              </div>
            </div>
          ) : (
            <div aria-label="Memuat" className="mt-5 space-y-3">
              <div className="flex gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 w-16 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />)}</div>
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-[20px] bg-neutral-200/70 dark:bg-neutral-800/70" />)}
            </div>
          )}
        </div>
      </main>
    );
  }

  const canKonsumen = me.role === 'owner' || me.role === 'spv' || me.role === 'konsumen';
  return (
    <PerformaPanel me={me}
      cari={canKonsumen ? (reloadKey) => <Suspense fallback={<Memuat />}><CariKonsumen me={me} reloadKey={reloadKey} /></Suspense> : undefined}
      aktivitas={me.role === 'owner' ? (reloadKey) => <Suspense fallback={<Memuat />}><AktivitasTim reloadKey={reloadKey} /></Suspense> : undefined} />
  );
}
