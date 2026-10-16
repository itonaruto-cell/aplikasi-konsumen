'use client';
import { useCallback, useEffect, useState } from 'react';
import { Kosong } from './parts';

// Owner: perbarui database konsumen (Sheet1) dari tab KA, SALES, dan MAPS di file database.
// Pratinjau dulu, baru tulis. Hanya menambah kontrak baru dan mengisi sel yang masih kosong.

type Ringkas = {
  tab: { ka: string[]; sales: string[]; maps: string | null };
  baru: { total: number; mobil: number; motor: number; contoh: { nama: string; kontrak: string; jenis: string; sumber: string[] }[] };
  isi: { maps: number; alamat: number; lengkapi: number };
  maps: { cocok: number; sudahAda: number; tidakKetemu: string[]; jumlahTidakKetemu: number; ragu: string[] };
};
const tc = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function Angka({ v, l }: { v: number; l: string }) {
  return <span className="flex flex-col rounded-2xl bg-neutral-100 p-3 dark:bg-neutral-900"><b className="text-2xl leading-tight">{v.toLocaleString('id-ID')}</b><span className="text-xs text-neutral-500">{l}</span></span>;
}
function Daftar({ judul, items, sisa }: { judul: string; items: string[]; sisa?: number }) {
  const [buka, setBuka] = useState(false);
  if (!items.length) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setBuka(!buka)} className="min-h-11 text-sm font-semibold text-neutral-600 underline underline-offset-2 dark:text-neutral-300">{buka ? 'Sembunyikan' : 'Lihat'} {judul}</button>
      {buka && <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{items.map(tc).join(', ')}{sisa && sisa > items.length ? `, dan ${sisa - items.length} lainnya` : ''}</p>}
    </div>
  );
}

export default function Sinkron() {
  const [motor, setMotor] = useState(false);
  const [data, setData] = useState<Ringkas | null>(null);
  const [hasil, setHasil] = useState<Ringkas | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const muat = useCallback(async (m: boolean) => {
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/konsumen/sinkron?motor=${m ? 1 : 0}`, { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.error || 'Gagal membaca file database.'); setData(null); } else setData(j);
    } catch { setErr('Koneksi bermasalah.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { muat(motor); }, [muat, motor]);

  const terapkan = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/konsumen/sinkron', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motor }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.error || 'Gagal menulis.'); return; }
      setHasil(j);
      muat(motor);
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };

  const d = data;
  const totalIsi = d ? d.isi.maps + d.isi.alamat + d.isi.lengkapi : 0;
  const adaKerja = !!d && (d.baru.total > 0 || totalIsi > 0);
  return (
    <div className="px-4 pb-10 pt-3">
      <p className="text-[13px] leading-snug text-neutral-500">
        Membaca tab KA, SALES, dan MAPS di file database, lalu menambahkan kontrak yang belum ada di Sheet1 dan mengisi kolom MAPS / ALAMAT
        yang masih kosong. Isi yang sudah ada tidak diubah.
      </p>

      {hasil && (
        <div className="mt-3 rounded-2xl bg-green-50 p-4 text-sm text-green-900 dark:bg-green-400/15 dark:text-green-200">
          <b>Sheet1 sudah diperbarui.</b> {hasil.baru.total} konsumen baru, {hasil.isi.maps} maps, {hasil.isi.alamat} alamat, dan {hasil.isi.lengkapi} kolom kosong lainnya terisi.
          Cari konsumen langsung memakai data ini.
        </div>
      )}
      {err && <p className="mt-3 rounded-2xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}

      <label className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl border border-neutral-200 px-4 dark:border-neutral-800">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Ikutkan konsumen motor</span>
          <span className="block text-[13px] text-neutral-500">Sheet1 saat ini berisi konsumen Mobilku</span>
        </span>
        <input type="checkbox" checked={motor} onChange={(e) => { setMotor(e.target.checked); setHasil(null); }} className="h-6 w-6 accent-neutral-900" />
      </label>

      {loading && !d ? (
        <div className="mt-4 space-y-3">{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-[20px] bg-neutral-200/70 dark:bg-neutral-800/70" />)}</div>
      ) : d && (
        <div className={loading ? 'opacity-60' : ''}>
          <p className="mt-5 text-[13px] text-neutral-500">
            Tab terbaca: {[...d.tab.ka, ...d.tab.sales, d.tab.maps].filter(Boolean).join(' · ') || 'tidak ada tab KA / SALES / MAPS'}
          </p>
          <p className="mt-3 text-[15px] font-bold">Konsumen baru</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Angka v={d.baru.total} l="kontrak baru" />
            <Angka v={d.baru.mobil} l="mobil" />
            <Angka v={d.baru.motor} l={motor ? 'motor' : 'motor (tidak ikut)'} />
          </div>
          {d.baru.contoh.length > 0 && (
            <ul className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
              {d.baru.contoh.slice(0, 8).map((b) => (
                <li key={b.kontrak} className="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-2.5 text-sm last:border-0 dark:border-neutral-800">
                  <span className="min-w-0 truncate font-semibold">{tc(b.nama)}</span>
                  <span className="shrink-0 font-mono text-xs text-neutral-500">{b.kontrak}</span>
                </li>
              ))}
              {d.baru.total > 8 && <li className="px-4 py-2 text-xs text-neutral-500">dan {d.baru.total - 8} lainnya</li>}
            </ul>
          )}

          <p className="mt-5 text-[15px] font-bold">Maps & alamat</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Angka v={d.isi.maps} l="link maps diisi" />
            <Angka v={d.isi.alamat} l="alamat diisi" />
            <Angka v={d.isi.lengkapi} l="kolom lain dilengkapi" />
          </div>
          <p className="mt-2 text-[13px] text-neutral-500">
            Dari tab MAPS: {d.maps.cocok} nama terisi, {d.maps.sudahAda} sudah punya data, {d.maps.jumlahTidakKetemu} nama tidak ada di Sheet1, {d.maps.ragu.length} nama dipakai lebih dari satu konsumen (dilewati).
          </p>
          <Daftar judul="nama yang tidak ketemu" items={d.maps.tidakKetemu} sisa={d.maps.jumlahTidakKetemu} />
          <Daftar judul="nama yang dilewati (lebih dari satu konsumen)" items={d.maps.ragu} />

          {adaKerja ? (
            <button onClick={terapkan} disabled={busy || loading}
              className="mt-6 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
              {busy ? 'Menulis ke Sheet1…' : `Masukkan ke Sheet1 (${d.baru.total} baru · ${totalIsi} sel)`}
            </button>
          ) : (
            <Kosong art="bendera" title="Sheet1 sudah lengkap" text="Tidak ada kontrak baru atau maps yang perlu diisi." />
          )}
        </div>
      )}
    </div>
  );
}
