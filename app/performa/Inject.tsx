'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KET_BAWAAN, KOLOM_HO, barisHO, bulanLabel, kurang, type Calon, type Inject } from '../../lib/inject-types';
import { buatXlsx, TIPE_XLSX } from '../../lib/xlsx-mini';
import { useOverlay } from '../overlay';
import { Ico, Kosong, shareText, shortName } from './parts';
import { FIELD } from './form';

// Inject P3: staff memilih konsumen dari database (Cari konsumen) untuk diajukan,
// owner mengunduh daftarnya (Excel, format HO) atau membagikannya.

type Akun = { email: string; name?: string; role: 'owner' | 'konsumen' | 'tim' };
type Manual = { nama: string; kontrak: string; cust: string; kecamatan: string };
const MANUAL_KOSONG: Manual = { nama: '', kontrak: '', cust: '', kecamatan: '' };
const kunciCalon = (c: Calon) => c.kontrak || `${c.nama}|${c.cust}`;
const CHIP = 'rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300';
const CHIP_AMBER = 'rounded-full bg-[#FFF4E0] px-2 py-0.5 text-xs font-semibold text-[#8A4700] dark:bg-[#2A1E0C] dark:text-[#F7C98A]';
const LABEL = 'mt-3 block text-[13px] font-semibold text-neutral-500';

function useInject(reloadKey = 0) {
  const [list, setList] = useState<Inject[]>([]);
  const [bulanIni, setBulanIni] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = await fetch('/api/inject', { cache: 'no-store' });
        if (res.status === 401) { window.location.href = '/login'; return; }
        const json = await res.json();
        if (!alive) return;
        if (res.ok && Array.isArray(json?.list)) { setList(json.list as Inject[]); setBulanIni(String(json.bulanIni || '')); }
        else setErr(json?.error || 'Daftar Inject P3 gagal dimuat.');
      } catch {
        if (alive) setErr('Koneksi bermasalah. Periksa internet lalu coba lagi.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  return { list, bulanIni, loading, err, reload };
}

function Lembar({ judul, onClose, children }: { judul: string; onClose: () => void; children: ReactNode }) {
  useOverlay(true, onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white pt-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50">
        <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <div className="flex shrink-0 items-center justify-between px-5">
          <p className="text-lg font-bold">{judul}</p>
          <button onClick={onClose} className="-mr-2 flex min-h-11 items-center px-2 text-[15px] text-neutral-500">Tutup</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Ajukan: cari di database konsumen, pilih, kirim ---------- */
function AjukanSheet({ cabang, sudah, onClose, onSaved }: {
  cabang: string; sudah: Map<string, string>; onClose: () => void; onSaved: (pesan: string) => void;
}) {
  const [mode, setMode] = useState<'cari' | 'manual'>('cari');
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<Calon[]>([]);
  const [lebih, setLebih] = useState(false);
  const [mencari, setMencari] = useState(false);
  const [errCari, setErrCari] = useState('');
  const [pilih, setPilih] = useState<Map<string, Calon>>(new Map());
  const [manual, setManual] = useState<Manual>(MANUAL_KOSONG);
  const [ket, setKet] = useState(KET_BAWAAN);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const urut = useRef(0);

  const cukup = q.replace(/\s/g, '').length >= 3;
  useEffect(() => {
    if (!cukup) { setHasil([]); setLebih(false); setErrCari(''); setMencari(false); return; }
    const no = ++urut.current;
    setMencari(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/inject/cari?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' });
        const j = await res.json();
        if (no !== urut.current) return;
        if (res.ok && Array.isArray(j?.list)) { setHasil(j.list as Calon[]); setLebih(!!j.lebih); setErrCari(''); }
        else { setHasil([]); setErrCari(j?.error || 'Pencarian gagal.'); }
      } catch {
        if (no === urut.current) { setHasil([]); setErrCari('Koneksi bermasalah.'); }
      } finally {
        if (no === urut.current) setMencari(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, cukup]);

  const toggle = (c: Calon) => setPilih((prev) => {
    const next = new Map(prev);
    const k = kunciCalon(c);
    if (next.has(k)) next.delete(k); else next.set(k, c);
    return next;
  });

  const kirim = async () => {
    const items = mode === 'manual'
      ? [{ konsumen: manual.nama, kontrak: manual.kontrak, cust: manual.cust, kecamatan: manual.kecamatan, sumber: 'manual' }]
      : [...pilih.values()].map((c) => ({ konsumen: c.nama, kontrak: c.kontrak, cust: c.cust, kecamatan: c.kecamatan, sumber: 'database' }));
    if (mode === 'manual' && !manual.nama.trim()) { setErr('Nama konsumen wajib diisi.'); return; }
    if (!items.length) { setErr('Pilih konsumen dulu.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/inject', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, ket, cabang }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j?.error || 'Gagal menyimpan.'); return; }
      const lewat: { konsumen: string; oleh: string }[] = Array.isArray(j?.dilewati) ? j.dilewati : [];
      if (!j?.ditambah && lewat.length) { setErr(`Sudah diajukan ${shortName(lewat[0].oleh)} bulan ini.`); return; }
      onSaved(`${j.ditambah} konsumen diajukan${lewat.length ? `, ${lewat.length} sudah ada` : ''}`);
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };

  const jumlah = mode === 'manual' ? 1 : pilih.size;
  return (
    <Lembar judul="Ajukan Inject P3" onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
        {mode === 'cari' ? (
          <>
            <label className="mt-2 flex h-12 items-center gap-2 rounded-xl bg-neutral-100 px-3 dark:bg-neutral-800">
              <Ico n="search" className="h-5 w-5 shrink-0 text-neutral-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus inputMode="search" autoComplete="off" maxLength={60}
                aria-label="Cari konsumen" placeholder="Nama, no kontrak, atau cust no"
                className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400" />
              {q && <button onClick={() => setQ('')} aria-label="Hapus pencarian" className="flex h-9 w-9 items-center justify-center text-neutral-500"><Ico n="x" className="h-4 w-4" sw={2.2} /></button>}
            </label>

            {!cukup ? (
              <p className="px-1 py-6 text-center text-sm leading-relaxed text-neutral-500">
                Ketik minimal 3 huruf. Data diambil dari database Cari konsumen, jadi nomor kontrak dan cust no terisi otomatis.
              </p>
            ) : errCari ? (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{errCari}</p>
            ) : mencari && !hasil.length ? (
              <div className="mt-3 space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-neutral-200/70 dark:bg-neutral-800/70" />)}</div>
            ) : !hasil.length ? (
              <p className="px-1 py-6 text-center text-sm leading-relaxed text-neutral-500">Tidak ada konsumen yang cocok di database.</p>
            ) : (
              <ul className={`mt-2 transition-opacity ${mencari ? 'opacity-50' : ''}`}>
                {hasil.map((c) => {
                  const k = kunciCalon(c);
                  const on = pilih.has(k);
                  const oleh = c.kontrak ? sudah.get(c.kontrak) : undefined;
                  return (
                    <li key={k} className="border-b border-neutral-200 last:border-0 dark:border-neutral-800">
                      <button onClick={() => toggle(c)} disabled={!!oleh} aria-pressed={on}
                        className="flex min-h-16 w-full items-center gap-3 py-2.5 text-left disabled:opacity-55">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on
                          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                          : 'border-neutral-300 dark:border-neutral-600'}`}>
                          {on && <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-bold">{c.nama}</span>
                          <span className="block truncate text-[13px] text-neutral-500">
                            {c.kontrak || 'No kontrak kosong'}{c.kecamatan ? ` · ${c.kecamatan}` : ''}
                          </span>
                          {c.unit && <span className="block truncate text-[13px] text-neutral-500">{c.unit}</span>}
                        </span>
                        {oleh && <span className={`${CHIP} shrink-0`}>Sudah · {shortName(oleh)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {lebih && <p className="py-2 text-center text-[13px] text-neutral-500">Masih ada hasil lain. Ketik lebih lengkap supaya lebih tepat.</p>}
            <button onClick={() => { setMode('manual'); setErr(''); setManual({ ...MANUAL_KOSONG, nama: q.trim().toUpperCase() }); }}
              className="mt-1 flex min-h-11 w-full items-center justify-center text-sm font-semibold text-neutral-600 underline underline-offset-4 dark:text-neutral-300">
              Tidak ketemu? Isi manual
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 rounded-xl bg-neutral-100 p-3 text-[13px] leading-relaxed text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              Untuk konsumen yang belum ada di database. Pastikan nomor kontrak dan cust no sesuai, karena dipakai HO.
            </p>
            <label className={LABEL}>Nama konsumen
              <input value={manual.nama} onChange={(e) => setManual({ ...manual, nama: e.target.value })} maxLength={80} className={`${FIELD} mt-1.5 h-12`} />
            </label>
            <label className={LABEL}>No kontrak
              <input value={manual.kontrak} onChange={(e) => setManual({ ...manual, kontrak: e.target.value })} maxLength={30} inputMode="numeric" placeholder="16 digit" className={`${FIELD} mt-1.5 h-12`} />
            </label>
            <label className={LABEL}>Cust no
              <input value={manual.cust} onChange={(e) => setManual({ ...manual, cust: e.target.value })} maxLength={30} placeholder="CUS…" className={`${FIELD} mt-1.5 h-12`} />
            </label>
            <label className={LABEL}>Kecamatan
              <input value={manual.kecamatan} onChange={(e) => setManual({ ...manual, kecamatan: e.target.value })} maxLength={40} className={`${FIELD} mt-1.5 h-12`} />
            </label>
            <button onClick={() => { setMode('cari'); setErr(''); }}
              className="mt-2 flex min-h-11 w-full items-center justify-center text-sm font-semibold text-neutral-600 underline underline-offset-4 dark:text-neutral-300">
              Kembali cari di database
            </button>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-200 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 dark:border-neutral-800">
        <label className="block text-[13px] font-semibold text-neutral-500">Keterangan
          <input value={ket} onChange={(e) => setKet(e.target.value)} maxLength={60} className={`${FIELD} mt-1.5 h-11`} />
        </label>
        {err && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={kirim} disabled={busy || jumlah === 0}
          className="mt-3 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {busy ? 'Menyimpan…' : jumlah ? `Ajukan ${jumlah} konsumen` : 'Pilih konsumen dulu'}
        </button>
      </div>
    </Lembar>
  );
}

/* ---------- Ubah / hapus satu pengajuan ---------- */
function UbahSheet({ awal, onClose, onSaved }: { awal: Inject; onClose: () => void; onSaved: (pesan: string) => void }) {
  const [f, setF] = useState({ konsumen: awal.konsumen, kontrak: awal.kontrak, cust: awal.cust, kecamatan: awal.kecamatan, ket: awal.ket });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const simpan = async () => {
    if (!f.konsumen.trim()) { setErr('Nama konsumen wajib diisi.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/inject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: awal.id, ...f }) });
      const j = await res.json();
      if (!res.ok) { setErr(j?.error || 'Gagal menyimpan.'); return; }
      onSaved('Pengajuan tersimpan');
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };
  const hapus = async () => {
    if (!confirm(`Hapus ${awal.konsumen} dari daftar Inject P3?`)) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/inject?id=${encodeURIComponent(awal.id)}`, { method: 'DELETE' });
      if (!res.ok) { setErr((await res.json())?.error || 'Gagal menghapus.'); return; }
      onSaved('Pengajuan dihapus');
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };
  return (
    <Lembar judul="Ubah pengajuan" onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <label className="mt-1 block text-[13px] font-semibold text-neutral-500">Nama konsumen
          <input value={f.konsumen} onChange={(e) => setF({ ...f, konsumen: e.target.value })} maxLength={80} className={`${FIELD} mt-1.5 h-12`} />
        </label>
        <label className={LABEL}>No kontrak
          <input value={f.kontrak} onChange={(e) => setF({ ...f, kontrak: e.target.value })} maxLength={30} inputMode="numeric" className={`${FIELD} mt-1.5 h-12`} />
        </label>
        <label className={LABEL}>Cust no
          <input value={f.cust} onChange={(e) => setF({ ...f, cust: e.target.value })} maxLength={30} className={`${FIELD} mt-1.5 h-12`} />
        </label>
        <label className={LABEL}>Kecamatan
          <input value={f.kecamatan} onChange={(e) => setF({ ...f, kecamatan: e.target.value })} maxLength={40} className={`${FIELD} mt-1.5 h-12`} />
        </label>
        <label className={LABEL}>Keterangan
          <input value={f.ket} onChange={(e) => setF({ ...f, ket: e.target.value })} maxLength={60} className={`${FIELD} mt-1.5 h-12`} />
        </label>
        {err && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={simpan} disabled={busy}
          className="mt-4 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
        <button onClick={hapus} disabled={busy}
          className="mt-1 min-h-11 w-full rounded-full text-sm font-semibold text-red-700 disabled:opacity-60 dark:text-red-400">Hapus dari daftar</button>
      </div>
    </Lembar>
  );
}

/* ---------- Halaman ---------- */
export default function InjectP3({ akun, cabang = 'KENDAL', reloadKey = 0 }: { akun: Akun; cabang?: string; reloadKey?: number }) {
  const { list, bulanIni, loading, err, reload } = useInject(reloadKey);
  const isOwner = akun.role === 'owner';
  const [bulan, setBulan] = useState('');
  const [ajukan, setAjukan] = useState(false);
  const [ubah, setUbah] = useState<Inject | null>(null);
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const aktif = bulan || bulanIni;
  const daftarBulan = useMemo(() => [...new Set([bulanIni, ...list.map((x) => x.bulan)].filter(Boolean))].sort().reverse(), [list, bulanIni]);
  // Urutan unduhan: yang lebih dulu diajukan di atas
  const rows = useMemo(() => list.filter((x) => x.bulan === aktif).sort((a, b) => a.dibuat.localeCompare(b.dibuat)), [list, aktif]);
  const tampil = useMemo(() => [...rows].reverse(), [rows]);
  const perlu = rows.filter((x) => kurang(x).length > 0).length;
  const sudah = useMemo(() => new Map(list.filter((x) => x.bulan === bulanIni && x.kontrak).map((x) => [x.kontrak, x.oleh])), [list, bulanIni]);
  const label = aktif ? bulanLabel(aktif) : '';
  const namaFile = `INJECT P3 ${label.toUpperCase()} - ${cabang.toUpperCase()}`;

  const teksDaftar = () => [
    `INJECT P3 ${label.toUpperCase()} · ${cabang.toUpperCase()} (${rows.length} konsumen)`,
    KOLOM_HO.join(' / '),
    ...rows.map((x, i) => `${i + 1}. ${barisHO(x).map((v) => v || '-').join(' / ')}`),
  ].join('\n');
  const fileExcel = () => {
    const bytes = buatXlsx([[...KOLOM_HO], ...rows.map(barisHO)], 'INJECT P3', [16, 34, 22, 24, 20, 16]);
    return new File([bytes.buffer as ArrayBuffer], `${namaFile}.xlsx`, { type: TIPE_XLSX });
  };
  const unduh = () => {
    const url = URL.createObjectURL(fileExcel());
    const a = document.createElement('a');
    a.href = url; a.download = `${namaFile}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setToast('Excel diunduh');
  };
  const bagikan = async () => {
    try {
      const file = fileExcel();
      if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: namaFile }); return; }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
    shareText(teksDaftar());
  };

  return (
    <div className="pb-8">
      <section className="mx-4 mt-3 flex flex-col gap-2.5 rounded-[22px] bg-neutral-900 p-[18px] text-white dark:ring-1 dark:ring-neutral-800">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-bold tracking-wide text-white/80">INJECT P3 · {label.toUpperCase() || '…'}</span>
          {perlu > 0 && <span className="whitespace-nowrap rounded-full bg-[#F5C451] px-2.5 py-1 text-xs font-bold text-[#3A2A00]">{perlu} perlu dilengkapi</span>}
        </div>
        <p className="text-[32px] font-bold leading-none tracking-tight">{loading && !list.length ? '…' : `${rows.length} konsumen`}</p>
        {isOwner ? (
          <div className="flex gap-2 border-t border-white/15 pt-3">
            <button onClick={unduh} disabled={!rows.length}
              className="min-h-11 flex-1 rounded-full bg-white px-4 text-sm font-bold text-neutral-900 disabled:opacity-40">Unduh Excel</button>
            <button onClick={bagikan} disabled={!rows.length}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/30 px-4 text-sm font-bold disabled:opacity-40">
              <Ico n="share" className="h-[18px] w-[18px]" sw={2} />Bagikan
            </button>
          </div>
        ) : (
          <p className="border-t border-white/15 pt-2.5 text-[13px] leading-snug text-white/80">Pilih konsumen yang mau di-inject. Daftar ini diunduh owner untuk dikirim ke HO.</p>
        )}
      </section>

      {daftarBulan.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {daftarBulan.map((b) => (
            <button key={b} onClick={() => setBulan(b)} aria-pressed={b === aktif}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${b === aktif
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                : 'border-neutral-300 dark:border-neutral-700'}`}>
              {bulanLabel(b)}
            </button>
          ))}
        </div>
      )}

      {err && (
        <div className="mx-4 mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {err}
          <button onClick={reload} className="mt-3 block min-h-11 rounded-full bg-red-700 px-5 font-semibold text-white">Coba lagi</button>
        </div>
      )}

      {loading && !list.length ? (
        <div className="space-y-3 px-4 pt-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-[20px] bg-neutral-200/70 dark:bg-neutral-800/70" />)}
        </div>
      ) : !err && (
        <>
          {aktif === bulanIni && (
            <div className="px-4 pt-4">
              <button onClick={() => setAjukan(true)}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white active:scale-[0.99] dark:bg-white dark:text-neutral-900">
                <span className="text-lg leading-none">+</span> Ajukan konsumen
              </button>
            </div>
          )}

          <div className="flex items-baseline justify-between gap-3 px-4 pb-2.5 pt-6">
            <h2 className="text-[17px] font-bold tracking-tight">Daftar diajukan</h2>
            {rows.length > 0 && <span className="text-[13px] text-neutral-500">terbaru di atas</span>}
          </div>
          {rows.length === 0 ? (
            <Kosong art="bendera" title="Belum ada yang diajukan"
              text={aktif === bulanIni ? 'Cari konsumen dari database, centang, lalu ajukan. Nomor kontrak dan cust no terisi otomatis.' : 'Tidak ada pengajuan di bulan ini.'} />
          ) : (
            <div className="flex flex-col gap-2.5 px-4">
              {tampil.map((x) => {
                const k = kurang(x);
                const boleh = isOwner || x.punyaku;
                return (
                  <button key={x.id} onClick={() => boleh && setUbah(x)} aria-disabled={!boleh}
                    className={`flex w-full flex-col gap-1.5 rounded-[20px] border border-neutral-200 px-4 py-3.5 text-left dark:border-neutral-800 ${boleh ? 'active:bg-neutral-50 dark:active:bg-neutral-900' : 'cursor-default'}`}>
                    <span className="truncate text-[15px] font-bold">{x.konsumen}</span>
                    <span className="break-all text-[13px] text-neutral-500">{x.kontrak || 'No kontrak kosong'} · {x.cust || 'cust no kosong'}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {x.kecamatan && <span className={CHIP}>{x.kecamatan}</span>}
                      <span className={CHIP}>{x.punyaku ? 'Kamu' : shortName(x.oleh)}</span>
                      {x.ket !== KET_BAWAAN && <span className={CHIP}>{x.ket}</span>}
                      {x.sumber === 'manual' && <span className={CHIP}>Isi manual</span>}
                      {k.length > 0 && <span className={CHIP_AMBER}>{k.join(', ')} kosong</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {ajukan && (
        <AjukanSheet cabang={cabang} sudah={sudah} onClose={() => setAjukan(false)}
          onSaved={(pesan) => { setAjukan(false); setBulan(''); setToast(pesan); reload(); }} />
      )}
      {ubah && <UbahSheet awal={ubah} onClose={() => setUbah(null)} onSaved={(pesan) => { setUbah(null); setToast(pesan); reload(); }} />}
      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center px-5">
          <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">{toast}</div>
        </div>
      )}
    </div>
  );
}
