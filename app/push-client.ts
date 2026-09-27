'use client';
// Nyalakan / matikan notifikasi HP (Web Push) dari halaman.

export type PushState = 'tidak-didukung' | 'belum-siap' | 'mati' | 'aktif' | 'diblokir';

const fromB64u = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function reg() {
  return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'tidak-didukung';
  if (Notification.permission === 'denied') return 'diblokir';
  try {
    const r = await navigator.serviceWorker.getRegistration('/');
    const sub = r ? await r.pushManager.getSubscription() : null;
    return sub && Notification.permission === 'granted' ? 'aktif' : 'mati';
  } catch { return 'mati'; }
}

const why = (step: string, e: unknown) => {
  const err = e as { name?: string; message?: string };
  const name = err?.name || '', msg = err?.message || String(e);
  if (name === 'NotAllowedError') return 'Izin notifikasi ditolak. Buka pengaturan situs di browser, izinkan Notifikasi, lalu coba lagi.';
  if (name === 'AbortError' || /push service/i.test(msg)) {
    return 'Layanan notifikasi di HP ini tidak tersedia. Buka aplikasi lewat Google Chrome (bukan browser bawaan HP), pastikan internet aktif, lalu coba lagi.';
  }
  return `Gagal di langkah "${step}": ${name ? name + ' – ' : ''}${msg}`.slice(0, 220);
};

export async function enablePush(nama: string): Promise<{ ok: boolean; pesan?: string }> {
  if (!pushSupported()) return { ok: false, pesan: 'HP/browser ini belum mendukung notifikasi. Buka lewat Google Chrome. Di iPhone, pasang dulu aplikasinya ke layar utama.' };
  let step = 'ambil kunci';
  try {
    const key = await fetch('/api/push', { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (!key?.siap || !key.publicKey) return { ok: false, pesan: 'Notifikasi belum disiapkan owner (kunci VAPID belum diisi di Vercel).' };
    step = 'minta izin';
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, pesan: 'Izin notifikasi ditolak. Aktifkan lewat pengaturan situs di browser.' };
    step = 'daftar service worker';
    await reg();
    const r = await navigator.serviceWorker.ready;
    step = 'berlangganan';
    const appKey = fromB64u(key.publicKey);
    let sub = await r.pushManager.getSubscription();
    if (sub) {
      // Langganan lama dengan kunci berbeda → buat ulang
      const old = sub.options?.applicationServerKey;
      const same = old && new Uint8Array(old).every((b, i) => b === appKey[i]);
      if (!same) { await sub.unsubscribe().catch(() => {}); sub = null; }
    }
    if (!sub) {
      try {
        sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      } catch (e) {
        if ((e as Error)?.name !== 'InvalidStateError') throw e;
        const lama = await r.pushManager.getSubscription();
        await lama?.unsubscribe().catch(() => {});
        sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      }
    }
    step = 'simpan ke server';
    const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), nama }) });
    if (!res.ok) return { ok: false, pesan: (await res.json().catch(() => null))?.error || `Server menolak (kode ${res.status}).` };
    return { ok: true };
  } catch (e) {
    return { ok: false, pesan: why(step, e) };
  }
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const r = await navigator.serviceWorker.getRegistration('/');
  const sub = r ? await r.pushManager.getSubscription() : null;
  if (!sub) return;
  await fetch('/api/push', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

export async function testPush() {
  const r = await fetch('/api/push', { method: 'PUT' }).then((x) => x.json()).catch(() => null);
  return r as { terkirim?: number; error?: string } | null;
}

// Perbarui nama di langganan (mis. setelah nama di AKSES diisi)
export async function refreshPush(nama: string) {
  if ((await pushState()) === 'aktif') await enablePush(nama).catch(() => {});
}
