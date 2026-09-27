'use client';
import { useEffect, useState } from 'react';
import { Ico } from './performa/parts';

// Aktivitas tim (khusus owner): siapa yang membuka aplikasi hari ini / tanggal tertentu.
type Aktivitas = { email: string; nama: string; role: string; aktif: boolean; online: boolean; pertama: string; terakhir: string; jumlahBuka: number };
const hhmm = (t: string) => t.slice(0, 5);
const initials = (n: string) => n.split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

export default function AktivitasTim({ reloadKey = 0 }: { reloadKey?: number }) {
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
  }, [tanggal, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const online = list.filter((x) => x.online).length;
  const aktif = list.filter((x) => x.aktif).length;

  return (
    <section className="px-4 pb-8 pt-3">
      <label className="flex min-h-12 items-center gap-3 rounded-full bg-neutral-100 px-4 dark:bg-neutral-900">
        <span className="text-sm text-neutral-500">Tanggal</span>
        <input type="date" value={tanggal} max={today} onChange={(e) => e.target.value && setTanggal(e.target.value)}
          className="h-12 flex-1 bg-transparent text-[15px] font-semibold outline-none" />
      </label>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {([['Online', tanggal === today ? online : '–'], ['Aktif', aktif], ['Belum aktif', list.length - aktif]] as const).map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-neutral-200 px-3 py-3 dark:border-neutral-800">
            <p className="text-[13px] text-neutral-500">{l}</p>
            <p className="text-2xl font-bold">{loading ? '…' : v}</p>
          </div>
        ))}
      </div>

      {err ? (
        <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-[20px] border border-neutral-200 dark:border-neutral-800">
          {!loading && list.length === 0 && <li className="p-6 text-center text-sm text-neutral-500">Belum ada anggota di tab AKSES.</li>}
          {list.map((p) => (
            <li key={p.email} className="flex min-h-16 items-center gap-3 border-b border-neutral-200 px-4 py-3 last:border-0 dark:border-neutral-800">
              <span className="relative">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold dark:bg-neutral-800">{initials(p.nama || p.email)}</span>
                <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-neutral-950 ${p.online ? 'bg-green-500' : p.aktif ? 'bg-neutral-400' : 'bg-transparent'}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{p.nama || p.email}</span>
                <span className="block truncate text-[13px] text-neutral-500">
                  {p.aktif ? `Aktif ${hhmm(p.pertama)} – ${hhmm(p.terakhir)} · ${p.jumlahBuka}x buka` : 'Belum membuka aplikasi'}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold ${p.online
                ? 'bg-green-50 text-green-800 dark:bg-green-400/15 dark:text-green-300'
                : p.aktif ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                  : 'bg-[#FFF4E0] text-[#8A4700] dark:bg-[#2A1E0C] dark:text-[#F7C98A]'}`}>
                {p.online ? 'Online' : p.aktif ? `Terakhir ${hhmm(p.terakhir)}` : 'Offline'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="flex gap-2 px-1 pt-4 text-[13px] leading-relaxed text-neutral-500">
        <Ico n="users" className="mt-0.5 h-4 w-4 shrink-0" />
        Online = aplikasi sedang terbuka di layar (aktif dalam 5 menit terakhir). Jam memakai WIB. Riwayat lengkap ada di tab LOG_AKTIF Google Sheets.
      </p>
    </section>
  );
}
