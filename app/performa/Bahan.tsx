'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Orang } from '../../lib/performa-types';
import { keyOf } from '../../lib/performa-calc';
import { SUMBER, type Bahan, type StatusBahan, type Sumber } from '../../lib/bahan-types';
import { useOverlay } from '../overlay';
import { rp } from './ui';
import { Ico, Kosong, shortName } from './parts';
import { AngkaInput, FIELD } from './form';

// Bahan survey: konsumen yang rencana disurvey / habis disurvey, per staff.
// Tiap bahan punya PIC survey. Staff melihat bahan yang ia buat atau yang PIC-nya dia; owner melihat semua
// dan bisa menyaring per PIC.

type Akun = { email: string; name?: string; role: 'owner' | 'konsumen' | 'tim' };

/* ---------- Muat daftar (dipakai juga halaman Insentif) ---------- */
export function useBahan(reloadKey = 0) {
  const [list, setList] = useState<Bahan[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = await fetch('/api/bahan', { cache: 'no-store' });
        if (res.status === 401) { window.location.href = '/login'; return; }
        const json = await res.json();
        if (!alive) return;
        if (res.ok && Array.isArray(json?.list)) setList(json.list as Bahan[]);
        else setErr(json?.error || 'Bahan survey gagal dimuat.');
      } catch {
        if (alive) setErr('Koneksi bermasalah. Periksa internet lalu coba lagi.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  return { list, loading, err, reload };
}

const sumberLabel = (b: Pick<Bahan, 'sumber' | 'ket'>) =>
  b.sumber === 'Lainnya' ? b.ket || 'Lainnya' : b.sumber === 'Agent' && b.ket ? `Agent · ${b.ket}` : b.sumber;
const STATUS_LABEL: Record<StatusBahan, string> = { aktif: 'Aktif', cair: 'Sudah cair', batal: 'Batal' };
const picKey = (b: Pick<Bahan, 'pic'>) => keyOf(b.pic);

/* ---------- Form tambah / ubah ---------- */
function BahanForm({ awal, tim, picAwal, onClose, onSaved }: {
  awal: Bahan | null; tim: string[]; picAwal: string; onClose: () => void; onSaved: (pesan: string) => void;
}) {
  useOverlay(true, onClose);
  const [konsumen, setKonsumen] = useState(awal?.konsumen || '');
  const [nominal, setNominal] = useState(awal?.nominal || 0);
  const [sumber, setSumber] = useState<Sumber>(awal?.sumber || 'Agent');
  const [ket, setKet] = useState(awal?.ket || '');
  const [step, setStep] = useState(awal?.step || '');
  const [pic, setPic] = useState(awal ? awal.pic : picAwal);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const simpan = async (status: StatusBahan, pesan: string) => {
    if (!konsumen.trim()) { setErr('Nama konsumen wajib diisi.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/bahan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: awal?.id, konsumen, nominal, sumber, ket, step, pic, status }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j?.error || 'Gagal menyimpan.'); return; }
      onSaved(pesan);
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };
  const hapus = async () => {
    if (!awal || !confirm('Hapus bahan ini?')) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/bahan?id=${encodeURIComponent(awal.id)}`, { method: 'DELETE' });
      if (!res.ok) { setErr((await res.json())?.error || 'Gagal menghapus.'); return; }
      onSaved('Bahan dihapus');
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };

  const perluKet = sumber === 'Agent' || sumber === 'Lainnya';
  // Pilihan PIC: anggota tim dari pantauan, ditambah PIC lama kalau namanya tidak ada di daftar
  const pilihanPic = pic && !tim.some((t) => keyOf(t) === keyOf(pic)) ? [...tim, pic] : tim;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-50">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold">{awal ? 'Ubah bahan survey' : 'Tambah bahan survey'}</p>
          <button onClick={onClose} className="-mr-2 flex min-h-11 items-center px-2 text-[15px] text-neutral-500">Tutup</button>
        </div>

        <label className="mt-3 block text-[13px] font-semibold text-neutral-500">Nama konsumen
          <input value={konsumen} onChange={(e) => setKonsumen(e.target.value)} maxLength={80} placeholder="Nama sesuai KTP"
            className={`${FIELD} mt-1.5 h-12`} />
        </label>
        <label className="mt-3 block text-[13px] font-semibold text-neutral-500">Nominal pencairan (Rp)
          <AngkaInput value={nominal} onChange={setNominal} placeholder="mis. 150.000.000" className="mt-1.5 h-12" />
        </label>

        <p className="mt-3 text-[13px] font-semibold text-neutral-500">PIC survey</p>
        {pilihanPic.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-2">
            {pilihanPic.map((x) => {
              const on = keyOf(x) === keyOf(pic);
              return (
                <button key={x} onClick={() => setPic(on ? '' : x)} aria-pressed={on}
                  className={`min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${on
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                    : 'border-neutral-300 dark:border-neutral-700'}`}>
                  {shortName(x)}
                </button>
              );
            })}
          </div>
        ) : (
          <input value={pic} onChange={(e) => setPic(e.target.value)} maxLength={80} aria-label="PIC survey"
            placeholder="Nama PIC survey" className={`${FIELD} mt-1.5 h-12`} />
        )}

        <p className="mt-3 text-[13px] font-semibold text-neutral-500">Sumber order</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {SUMBER.map((x) => (
            <button key={x} onClick={() => setSumber(x)} aria-pressed={sumber === x}
              className={`min-h-10 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${sumber === x
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                : 'border-neutral-300 dark:border-neutral-700'}`}>
              {x}
            </button>
          ))}
        </div>
        {perluKet && (
          <input value={ket} onChange={(e) => setKet(e.target.value)} maxLength={80}
            aria-label={sumber === 'Agent' ? 'Nama agent' : 'Sumber order lain'}
            placeholder={sumber === 'Agent' ? 'Nama agent' : 'Tulis sumber order'}
            className={`${FIELD} mt-2 h-12`} />
        )}

        <label className="mt-3 block text-[13px] font-semibold text-neutral-500">Step sekarang
          <textarea value={step} onChange={(e) => setStep(e.target.value)} maxLength={300} rows={3}
            placeholder="mis. Rencana survey besok jam 10 pagi" className={`${FIELD} mt-1.5 resize-none py-2.5`} />
        </label>

        {err && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={() => simpan(awal?.status === 'aktif' || !awal ? 'aktif' : awal.status, 'Bahan tersimpan')} disabled={busy}
          className="mt-4 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
        {awal && (
          <div className="mt-2 flex flex-wrap gap-2">
            {awal.status === 'aktif' ? (
              <>
                <button onClick={() => simpan('cair', 'Ditandai sudah cair')} disabled={busy}
                  className="min-h-11 flex-1 rounded-full border border-green-600 px-4 text-sm font-semibold text-green-700 disabled:opacity-60 dark:border-green-500 dark:text-green-300">Sudah cair</button>
                <button onClick={() => simpan('batal', 'Ditandai batal')} disabled={busy}
                  className="min-h-11 flex-1 rounded-full border border-neutral-300 px-4 text-sm font-semibold disabled:opacity-60 dark:border-neutral-700">Batal survey</button>
              </>
            ) : (
              <button onClick={() => simpan('aktif', 'Dikembalikan ke aktif')} disabled={busy}
                className="min-h-11 flex-1 rounded-full border border-neutral-300 px-4 text-sm font-semibold disabled:opacity-60 dark:border-neutral-700">Kembalikan ke aktif</button>
            )}
            <button onClick={hapus} disabled={busy}
              className="min-h-11 rounded-full px-4 text-sm font-semibold text-red-700 disabled:opacity-60 dark:text-red-400">Hapus</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Kartu satu bahan ---------- */
function BahanCard({ b, onClick }: { b: Bahan; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex w-full flex-col gap-2 rounded-[20px] border border-neutral-200 px-4 py-3.5 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[15px] font-bold">{b.konsumen}</span>
        <span className="shrink-0 whitespace-nowrap text-[15px] font-bold">{b.nominal ? rp(b.nominal) : '–'}</span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{sumberLabel(b)}</span>
        {b.pic
          ? <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">PIC {shortName(b.pic)}</span>
          : <span className="rounded-full bg-[#FFF4E0] px-2 py-0.5 text-xs font-semibold text-[#8A4700] dark:bg-[#2A1E0C] dark:text-[#F7C98A]">PIC belum diisi</span>}
        {b.status !== 'aktif' && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.status === 'cair'
            ? 'bg-green-50 text-green-700 dark:bg-green-400/15 dark:text-green-300'
            : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>{STATUS_LABEL[b.status]}</span>
        )}
      </span>
      <span className="text-sm leading-snug"><span className="text-neutral-500">Step: </span>{b.step || 'belum diisi'}</span>
    </button>
  );
}

/* ---------- Halaman ---------- */
export default function BahanSurvey({ akun, me, tim = [], reloadKey = 0, onInsentif }: {
  akun: Akun; me: Orang | null; tim?: string[]; reloadKey?: number; onInsentif: () => void;
}) {
  const { list, loading, err, reload } = useBahan(reloadKey);
  const isOwner = akun.role === 'owner';
  const [siapa, setSiapa] = useState('semua');
  const [form, setForm] = useState<Bahan | 'baru' | null>(null);
  const [lama, setLama] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const staff = useMemo(() => {
    const m = new Map<string, { key: string; nama: string; n: number }>();
    list.filter((b) => b.status === 'aktif').forEach((b) => {
      const key = picKey(b);
      const x = m.get(key) || { key, nama: b.pic || 'Tanpa PIC', n: 0 };
      x.n++; m.set(key, x);
    });
    return [...m.values()].sort((a, b) => a.nama.localeCompare(b.nama));
  }, [list]);
  const mine = list.filter((b) => !isOwner || siapa === 'semua' || picKey(b) === siapa);
  const aktif = mine.filter((b) => b.status === 'aktif');
  const selesai = mine.filter((b) => b.status !== 'aktif');
  const total = aktif.reduce((s, b) => s + b.nominal, 0);
  const judul = isOwner && siapa !== 'semua' ? shortName(staff.find((s) => s.key === siapa)?.nama || '').toUpperCase() : isOwner ? 'SEMUA PIC' : 'KAMU';
  // PIC bawaan saat menambah: diri sendiri kalau ia anggota tim
  const picAwal = me && tim.some((t) => keyOf(t) === keyOf(me.nama)) ? me.nama : '';

  return (
    <div className="pb-8">
      <section className="mx-4 mt-3 flex flex-col gap-2.5 rounded-[22px] bg-neutral-900 p-[18px] text-white dark:ring-1 dark:ring-neutral-800">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-bold tracking-wide text-white/80">BAHAN SURVEY · {judul}</span>
          <span className="whitespace-nowrap rounded-full bg-[#F5C451] px-2.5 py-1 text-xs font-bold text-[#3A2A00]">{loading && !list.length ? '…' : `${aktif.length} bahan`}</span>
        </div>
        <p className="text-[32px] font-bold leading-none tracking-tight">{rp(total)}</p>
        <button onClick={onInsentif} className="flex min-h-11 items-center justify-between gap-2 border-t border-white/15 pt-2.5 text-left text-[13px]">
          <span>Kalau semua cair, lihat simulasi insentif</span>
          <Ico n="right" className="h-[18px] w-[18px]" sw={2} />
        </button>
      </section>

      {isOwner && staff.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {[{ key: 'semua', nama: 'Semua', n: list.filter((b) => b.status === 'aktif').length }, ...staff].map((s) => (
            <button key={s.key} onClick={() => setSiapa(s.key)} aria-pressed={siapa === s.key}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${siapa === s.key
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                : 'border-neutral-300 dark:border-neutral-700'}`}>
              {s.key === 'semua' ? 'Semua' : s.key ? shortName(s.nama) : s.nama} · {s.n}
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
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-[20px] bg-neutral-200/70 dark:bg-neutral-800/70" />)}
        </div>
      ) : !err && (
        <>
          <div className="flex items-baseline justify-between gap-3 px-4 pb-2.5 pt-6">
            <h2 className="text-[17px] font-bold tracking-tight">Rencana dan habis survey</h2>
            {aktif.length > 0 && <span className="text-[13px] text-neutral-500">ketuk untuk ubah</span>}
          </div>
          {aktif.length === 0 ? (
            <Kosong art="bendera" title="Belum ada bahan survey"
              text="Catat konsumen yang rencana disurvey atau habis disurvey, supaya progresnya kelihatan dan ikut dihitung di simulasi insentif." />
          ) : (
            <div className="flex flex-col gap-2.5 px-4">
              {aktif.map((b) => <BahanCard key={b.id} b={b} onClick={() => setForm(b)} />)}
            </div>
          )}

          <div className="px-4 pt-3">
            <button onClick={() => setForm('baru')}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 text-[15px] font-semibold text-neutral-600 active:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:active:bg-neutral-900">
              <span className="text-lg leading-none">+</span> Tambah bahan survey
            </button>
          </div>

          {selesai.length > 0 && (
            <div className="px-4 pt-4">
              <button onClick={() => setLama((v) => !v)} aria-expanded={lama}
                className="flex min-h-11 w-full items-center justify-between gap-2 text-[15px] font-semibold text-neutral-600 dark:text-neutral-300">
                Sudah cair atau batal ({selesai.length})
                <Ico n={lama ? 'up' : 'down'} className="h-[18px] w-[18px] text-neutral-500" sw={2} />
              </button>
              {lama && (
                <div className="mt-2 flex flex-col gap-2.5">
                  {selesai.map((b) => <BahanCard key={b.id} b={b} onClick={() => setForm(b)} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {form && (
        <BahanForm awal={form === 'baru' ? null : form} tim={tim} picAwal={picAwal} onClose={() => setForm(null)}
          onSaved={(pesan) => { setForm(null); setToast(pesan); reload(); }} />
      )}
      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center px-5">
          <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">{toast}</div>
        </div>
      )}
    </div>
  );
}
