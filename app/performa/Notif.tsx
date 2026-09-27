'use client';
import { useEffect, useState } from 'react';
import { disablePush, enablePush, pushState, testPush, type PushState } from '../push-client';
import { Ico } from './parts';

const DISMISS = 'ck_notif_tawar';
const BELL = <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />;

function useNotif(nama: string) {
  const [st, setSt] = useState<PushState | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { pushState().then(setSt); }, []);
  const on = async () => {
    setBusy(true); setMsg('');
    const r = await enablePush(nama).catch(() => ({ ok: false, pesan: 'Gagal menyalakan notifikasi.' }));
    setSt(await pushState());
    setMsg(r.ok ? 'Notifikasi aktif.' : r.pesan || '');
    setBusy(false);
  };
  const off = async () => { setBusy(true); await disablePush(); setSt(await pushState()); setMsg('Notifikasi dimatikan di HP ini.'); setBusy(false); };
  const tes = async () => {
    setBusy(true);
    const r = await testPush();
    setMsg(r?.terkirim ? 'Notifikasi uji terkirim, cek bilah notifikasi.' : r?.error || 'Notifikasi uji belum terkirim.');
    setBusy(false);
  };
  return { st, msg, busy, on, off, tes };
}

/* Kartu ajakan di Kabar (muncul sekali sampai ditutup) */
export function NotifPrompt({ nama }: { nama: string }) {
  const n = useNotif(nama);
  const [hide, setHide] = useState(true);
  useEffect(() => { try { setHide(localStorage.getItem(DISMISS) === '1'); } catch { setHide(false); } }, []);
  if (hide || n.st !== 'mati') return n.msg && !hide ? <p className="mx-4 mt-3 text-[13px] text-neutral-500">{n.msg}</p> : null;
  const tutup = () => { try { localStorage.setItem(DISMISS, '1'); } catch { /* abaikan */ } setHide(true); };
  return (
    <div className="mx-4 mt-4 flex items-start gap-3 rounded-[20px] border border-neutral-200 p-4 dark:border-neutral-800">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{BELL}</svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">Nyalakan notifikasi</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">Misi pagi, rekap sore, kabar saat kamu naik atau disalip, dan pengumuman.</p>
        {n.msg && <p className="mt-1.5 text-[13px] text-red-700 dark:text-red-400">{n.msg}</p>}
        <div className="mt-2.5 flex gap-2">
          <button onClick={n.on} disabled={n.busy} className="min-h-10 rounded-full bg-neutral-900 px-4 text-sm font-bold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">Nyalakan</button>
          <button onClick={tutup} className="min-h-10 rounded-full px-3 text-sm font-semibold text-neutral-500">Nanti saja</button>
        </div>
      </div>
    </div>
  );
}

/* Baris pengaturan di Saya */
export function NotifSetting({ nama }: { nama: string }) {
  const n = useNotif(nama);
  const label: Record<PushState, string> = {
    'tidak-didukung': 'Tidak didukung di browser ini', 'belum-siap': 'Belum siap', mati: 'Mati', aktif: 'Aktif di HP ini', diblokir: 'Diblokir di pengaturan browser',
  };
  return (
    <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <div className="flex min-h-11 items-center gap-3">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{BELL}</svg>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px]">Notifikasi HP</span>
          <span className="block text-[13px] text-neutral-500">{n.st ? label[n.st] : '…'}</span>
        </span>
        {n.st === 'aktif' ? (
          <button onClick={n.off} disabled={n.busy} className="min-h-10 rounded-full border border-neutral-300 px-4 text-sm font-semibold dark:border-neutral-700">Matikan</button>
        ) : n.st === 'mati' ? (
          <button onClick={n.on} disabled={n.busy} className="min-h-10 rounded-full bg-neutral-900 px-4 text-sm font-bold text-white dark:bg-white dark:text-neutral-900">Nyalakan</button>
        ) : null}
      </div>
      {n.st === 'aktif' && (
        <button onClick={n.tes} disabled={n.busy} className="ml-8 mt-1 flex min-h-10 items-center gap-1 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
          Kirim notifikasi uji <Ico n="right" className="h-4 w-4" sw={2} />
        </button>
      )}
      {n.msg && <p className="ml-8 mt-1 text-[13px] text-neutral-500">{n.msg}</p>}
    </div>
  );
}
