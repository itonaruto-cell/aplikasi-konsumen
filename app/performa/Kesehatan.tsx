'use client';
import type { Performa } from '../../lib/performa-types';
import { periksaData, type Tingkat } from '../../lib/kesehatan-data';

const GAYA: Record<Tingkat, { dot: string; label: string; chip: string }> = {
  bahaya: { dot: 'bg-red-600', label: 'Perlu diperbaiki', chip: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' },
  waspada: { dot: 'bg-amber-500', label: 'Perlu dicek', chip: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' },
  aman: { dot: 'bg-green-600', label: 'Aman', chip: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
};

// Ringkas untuk dipasang di atas laporan (owner): hanya muncul kalau ada yang perlu dicek
export function PeringatanData({ data, onBuka }: { data: Performa; onBuka: () => void }) {
  const cek = periksaData(data).filter((x) => x.tingkat !== 'aman');
  if (!cek.length) return null;
  const bahaya = cek.some((x) => x.tingkat === 'bahaya');
  return (
    <button onClick={onBuka} className={`mb-3 flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left ${bahaya ? 'bg-red-50 text-red-900 dark:bg-red-950/60 dark:text-red-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'}`}>
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${bahaya ? 'bg-red-600' : 'bg-amber-500'}`} />
      <span className="min-w-0 flex-1 text-[14px] leading-snug">
        <b>Cek data sebelum dibagikan.</b> {cek.slice(0, 2).map((x) => x.judul).join(', ')}{cek.length > 2 ? ` +${cek.length - 2} lagi` : ''}.
        <span className="mt-0.5 block font-semibold underline">Lihat kesehatan data</span>
      </span>
    </button>
  );
}

export default function Kesehatan({ data }: { data: Performa | null }) {
  const cek = periksaData(data);
  const n = (t: Tingkat) => cek.filter((x) => x.tingkat === t).length;
  return (
    <div className="px-4 pb-10 pt-4">
      <div className="grid grid-cols-3 gap-2">
        {(['bahaya', 'waspada', 'aman'] as Tingkat[]).map((t) => (
          <div key={t} className="rounded-2xl border border-neutral-200 px-3 py-3 dark:border-neutral-800">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-500"><span className={`h-2 w-2 rounded-full ${GAYA[t].dot}`} />{GAYA[t].label}</span>
            <span className="mt-1 block text-[26px] font-bold leading-none">{n(t)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-neutral-500">Diperiksa dari kiriman pantauan terakhir. Setelah sheet diperbaiki, hasilnya ikut berubah di kiriman 30 menit berikutnya.</p>
      <div className="mt-4 space-y-2.5">
        {cek.map((x) => (
          <section key={x.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[15px] font-bold">{x.judul}</h3>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${GAYA[x.tingkat].chip}`}>{GAYA[x.tingkat].label}</span>
            </div>
            <p className="mt-1 text-[14px] leading-relaxed text-neutral-700 dark:text-neutral-300">{x.isi}</p>
            {x.saran && <p className="mt-2 rounded-xl bg-neutral-100 px-3 py-2 text-[13px] leading-relaxed dark:bg-neutral-900"><b>Perbaikan:</b> {x.saran}</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
