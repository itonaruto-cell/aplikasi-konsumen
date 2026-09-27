'use client';
import { useState } from 'react';
import type { Pengumuman } from '../../lib/performa-types';
import type { BrandKey } from '../../lib/performa-calc';
import { useOverlay } from '../overlay';
import { Ico, PillSeg } from './parts';

const BR: Record<string, string> = { semua: 'Semua', mobilku: 'Mobilku', motorku: 'Motorku' };
const tgl = (s: string) => (s ? new Date(s.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '');
const jam = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const akhirBulan = () => {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const [y, m] = t.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/* ---------- Kartu pengumuman disematkan ---------- */
export function PengumumanList({ list, brand, isOwner, onChanged, onCreate }: {
  list: Pengumuman[]; brand: BrandKey; isOwner: boolean; onChanged: () => void; onCreate: () => void;
}) {
  const [busy, setBusy] = useState('');
  const shown = list.filter((p) => brand === 'semua' || p.untuk === 'semua' || p.untuk === brand);
  const hapus = async (id: string) => {
    if (!confirm('Hapus pengumuman ini?')) return;
    setBusy(id);
    await fetch(`/api/pengumuman?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    setBusy('');
    onChanged();
  };
  if (!shown.length && !isOwner) return null;
  return (
    <div className="flex flex-col gap-2.5 px-4 pt-4">
      {shown.map((p) => (
        <article key={p.id} className="rounded-[20px] bg-[#EEF2FF] p-4 text-[#1E2A5A] dark:bg-[#161B33] dark:text-[#DCE3FF]">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1E2A5A] text-white dark:bg-[#DCE3FF] dark:text-[#161B33]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 17v5M9 3h6l-1 7 4 3H6l4-3z" /></svg>
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-semibold">Pengumuman · {jam(p.dibuat)}</span>
            {isOwner && (
              <button onClick={() => hapus(p.id)} disabled={busy === p.id} aria-label="Hapus pengumuman"
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full opacity-70 active:opacity-100">
                <Ico n="x" className="h-5 w-5" sw={2} />
              </button>
            )}
          </div>
          <p className="mt-2 text-base font-bold leading-snug">{p.judul}</p>
          {p.isi && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed opacity-90">{p.isi}</p>}
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-[13px] font-semibold">
            <span className="rounded-full bg-white/80 px-2.5 py-1 dark:bg-white/10">{BR[p.untuk]}</span>
            {p.sampai && <span className="rounded-full bg-white/80 px-2.5 py-1 dark:bg-white/10">Sampai {tgl(p.sampai)}</span>}
          </div>
        </article>
      ))}
      {isOwner && (
        <button onClick={onCreate}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 text-[15px] font-semibold text-neutral-600 active:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:active:bg-neutral-900">
          <span className="text-lg leading-none">+</span> Buat pengumuman
        </button>
      )}
    </div>
  );
}

/* ---------- Form pengumuman (owner) ---------- */
export function PengumumanForm({ onClose, onSaved }: { onClose: () => void; onSaved: (notif: number) => void }) {
  useOverlay(true, onClose);
  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [untuk, setUntuk] = useState<'semua' | 'mobilku' | 'motorku'>('semua');
  const [sampai, setSampai] = useState(akhirBulan());
  const [notif, setNotif] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const kirim = async () => {
    if (!judul.trim()) { setErr('Judul wajib diisi.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/pengumuman', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ judul, isi, untuk, sampai, notif }) });
      const j = await res.json();
      if (!res.ok) { setErr(j?.error || 'Gagal menyimpan.'); return; }
      onSaved(j.notif || 0);
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };

  const field = 'w-full rounded-xl border border-neutral-300 bg-white px-3 text-base outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-950';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold">Buat pengumuman</p>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[13px] dark:bg-neutral-800">Khusus owner</span>
        </div>
        <label className="mt-4 block text-[13px] font-semibold text-neutral-500">Judul
          <input value={judul} onChange={(e) => setJudul(e.target.value)} maxLength={120} placeholder="Mis. Program akhir bulan"
            className={`${field} mt-1.5 h-12`} />
        </label>
        <label className="mt-3 block text-[13px] font-semibold text-neutral-500">Isi
          <textarea value={isi} onChange={(e) => setIsi(e.target.value)} maxLength={1000} rows={4} placeholder="Detail pengumuman (opsional)"
            className={`${field} mt-1.5 resize-none py-2.5`} />
        </label>
        <p className="mt-3 text-[13px] font-semibold text-neutral-500">Untuk</p>
        <div className="mt-1.5"><PillSeg value={untuk} onChange={setUntuk} full options={[['semua', 'Semua'], ['mobilku', 'Mobilku'], ['motorku', 'Motorku']]} /></div>
        <label className="mt-3 flex items-center justify-between gap-3 text-[15px]">Sematkan sampai
          <input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} className={`${field} h-11 w-auto`} />
        </label>
        <label className="mt-3 flex min-h-12 items-center justify-between gap-3 text-[15px]">
          Kirim notifikasi ke HP tim
          <input type="checkbox" checked={notif} onChange={(e) => setNotif(e.target.checked)} className="h-6 w-6 accent-neutral-900 dark:accent-white" />
        </label>
        {err && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={kirim} disabled={busy}
          className="mt-4 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">
          {busy ? 'Mengirim…' : 'Kirim pengumuman'}
        </button>
      </div>
    </div>
  );
}
