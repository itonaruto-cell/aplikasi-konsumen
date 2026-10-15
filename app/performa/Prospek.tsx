'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { keyOf } from '../../lib/performa-calc';
import { STATUS_LABEL, STATUS_PROSPEK, bacaImpor, keWa, rapikanHp, type Prospek, type StatusProspek } from '../../lib/prospek-types';
import { FIELD, Lembar } from './form';
import { Ico, Kosong, shortName } from './parts';

// Database prospek: owner menambah (manual / impor CSV hasil scrape Google Maps) dan mengatur PIC;
// CMO menelepon / WhatsApp lalu mencatat hasil follow up.

type Akun = { email: string; role: 'owner' | 'konsumen' | 'tim' };
const WARNA: Record<StatusProspek, string> = {
  baru: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  dihubungi: 'bg-[#E9EEF8] text-[#1B2F5B] dark:bg-[#1B2A4A] dark:text-[#9DB5E8]',
  tertarik: 'bg-[#FFF4E0] text-[#8A4700] dark:bg-[#2A1E0C] dark:text-[#F7C98A]',
  tidak: 'bg-red-50 text-red-700 dark:bg-red-400/15 dark:text-red-300',
  order: 'bg-green-50 text-green-800 dark:bg-green-400/15 dark:text-green-300',
};
const pilih = (on: boolean) => `min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${on
  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
  : 'border-neutral-300 dark:border-neutral-700'}`;
const tampilHp = (hp: string) => hp.replace(/^(\d{4})(\d{4})(\d+)$/, '$1 $2 $3');

function useProspek(reloadKey: number) {
  const [list, setList] = useState<Prospek[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setErr('');
    fetch('/api/prospek', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => null);
      if (!alive) return;
      if (r.ok && Array.isArray(j?.list)) setList(j.list); else setErr(j?.error || 'Database prospek gagal dimuat.');
    }).catch(() => { if (alive) setErr('Koneksi bermasalah. Periksa internet lalu coba lagi.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reloadKey, n]);
  return { list, setList, loading, err, reload: useCallback(() => setN((x) => x + 1), []) };
}

/* ---------- Tambah / ubah satu prospek (owner) ---------- */
function FormProspek({ awal, tim, onClose, onSaved }: { awal: Prospek | null; tim: string[]; onClose: () => void; onSaved: (pesan: string) => void }) {
  const [nama, setNama] = useState(awal?.nama || '');
  const [hp, setHp] = useState(awal?.hp || '');
  const [profesi, setProfesi] = useState(awal?.profesi || '');
  const [alamat, setAlamat] = useState(awal?.alamat || '');
  const [catatan, setCatatan] = useState(awal?.catatan || '');
  const [pic, setPic] = useState(awal?.pic || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const simpan = async () => {
    if (!nama.trim()) { setErr('Nama wajib diisi.'); return; }
    if (!rapikanHp(hp)) { setErr('Nomor HP tidak valid. Contoh: 0812 3456 7890.'); return; }
    setBusy(true); setErr('');
    try {
      const body = awal ? { id: awal.id, nama, hp, profesi, alamat, catatan, pic } : { items: [{ nama, hp, profesi, alamat, catatan }], pic, sumber: 'Manual' };
      const r = await fetch('/api/prospek', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.error || 'Gagal menyimpan.'); return; }
      if (!awal && j?.dobel) { setErr('Nomor HP ini sudah ada di database prospek.'); return; }
      onSaved(awal ? 'Prospek diperbarui' : 'Prospek ditambahkan');
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };
  const hapus = async () => {
    if (!awal || !confirm('Hapus prospek ini?')) return;
    setBusy(true);
    await fetch(`/api/prospek?id=${encodeURIComponent(awal.id)}`, { method: 'DELETE' }).catch(() => {});
    setBusy(false);
    onSaved('Prospek dihapus');
  };
  const label = 'mt-3 block text-[13px] font-semibold text-neutral-500';
  return (
    <Lembar judul={awal ? 'Ubah prospek' : 'Tambah prospek'} onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <label className={label}>Nama<input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={100} className={`${FIELD} mt-1.5 h-12`} /></label>
        <label className={label}>No HP<input value={hp} onChange={(e) => setHp(e.target.value)} inputMode="tel" maxLength={20} placeholder="0812 3456 7890" className={`${FIELD} mt-1.5 h-12`} /></label>
        <label className={label}>Profesi<input value={profesi} onChange={(e) => setProfesi(e.target.value)} maxLength={80} placeholder="mis. Pedagang, guru, bengkel" className={`${FIELD} mt-1.5 h-12`} /></label>
        <label className={label}>Alamat / kecamatan<input value={alamat} onChange={(e) => setAlamat(e.target.value)} maxLength={160} placeholder="Opsional" className={`${FIELD} mt-1.5 h-12`} /></label>
        <label className={label}>Catatan<input value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={200} placeholder="Opsional, mis. punya 2 mobil" className={`${FIELD} mt-1.5 h-12`} /></label>
        <p className={label}>PIC follow up</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button onClick={() => setPic('')} aria-pressed={!pic} className={pilih(!pic)}>Belum ada</button>
          {tim.map((t) => <button key={t} onClick={() => setPic(t)} aria-pressed={keyOf(pic) === keyOf(t)} className={pilih(keyOf(pic) === keyOf(t))}>{shortName(t)}</button>)}
        </div>
        {err && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={simpan} disabled={busy} className="mt-4 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">{busy ? 'Menyimpan…' : 'Simpan'}</button>
        {awal && <button onClick={hapus} disabled={busy} className="mt-2 min-h-11 w-full text-sm font-semibold text-red-700 dark:text-red-400">Hapus prospek</button>}
      </div>
    </Lembar>
  );
}

/* ---------- Impor CSV / tempel dari Google Sheets (owner) ---------- */
function Impor({ tim, onClose, onSaved }: { tim: string[]; onClose: () => void; onSaved: (pesan: string) => void }) {
  const [isi, setIsi] = useState('');
  const [sumber, setSumber] = useState('Google Maps');
  const [pic, setPic] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const hasil = useMemo(() => bacaImpor(isi), [isi]);
  const bacaFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setIsi(String(r.result || ''));
    r.readAsText(f);
  };
  const simpan = async () => {
    if (!hasil.baris.length) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/prospek', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: hasil.baris, sumber, pic }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.error || 'Gagal menyimpan.'); return; }
      onSaved(`${j.ditambah} prospek masuk${j.dobel ? ` · ${j.dobel} nomor sudah ada` : ''}`);
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };
  return (
    <Lembar judul="Impor prospek" onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Pilih file CSV hasil scrape Google Maps, atau salin kolom dari Google Sheets / Excel lalu tempel di bawah.
          Kolom yang dikenali: <b>nama</b> (name/title), <b>no HP</b> (phone), <b>profesi</b> (category), dan <b>alamat</b> (address).
          Tanpa judul kolom, urutannya dianggap nama, no HP, profesi, alamat.
        </p>
        <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 text-[15px] font-semibold dark:border-neutral-700">
          <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => bacaFile(e.target.files?.[0])} />
          Pilih file CSV
        </label>
        <textarea value={isi} onChange={(e) => setIsi(e.target.value)} rows={6} aria-label="Data prospek"
          placeholder={'name,phone,category,address\nBengkel Jaya,0812 3456 7890,Bengkel,Kendal'}
          className={`${FIELD} mt-3 resize-none py-2.5 font-mono text-sm`} />
        <div className="mt-3 rounded-2xl bg-neutral-100 px-4 py-3 text-sm dark:bg-neutral-900">
          <b>{hasil.baris.length}</b> prospek siap masuk{hasil.tanpaHp ? <> · <span className="text-[#8A4700] dark:text-[#F7C98A]">{hasil.tanpaHp} dilewati karena tanpa no HP</span></> : null}
          {hasil.baris.slice(0, 3).map((b) => (
            <p key={b.hp} className="mt-1 truncate text-[13px] text-neutral-500">{b.nama} · {tampilHp(b.hp)}{b.profesi ? ` · ${b.profesi}` : ''}</p>
          ))}
          <p className="mt-1 text-[13px] text-neutral-500">Nomor yang sudah ada di database tidak dimasukkan dua kali.</p>
        </div>
        <label className="mt-3 block text-[13px] font-semibold text-neutral-500">Sumber
          <input value={sumber} onChange={(e) => setSumber(e.target.value)} maxLength={40} className={`${FIELD} mt-1.5 h-12`} />
        </label>
        <p className="mt-3 text-[13px] font-semibold text-neutral-500">PIC follow up untuk semua</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button onClick={() => setPic('')} aria-pressed={!pic} className={pilih(!pic)}>Belum ada</button>
          {tim.map((t) => <button key={t} onClick={() => setPic(t)} aria-pressed={keyOf(pic) === keyOf(t)} className={pilih(keyOf(pic) === keyOf(t))}>{shortName(t)}</button>)}
        </div>
        {err && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={simpan} disabled={busy || !hasil.baris.length} className="mt-4 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {busy ? 'Menyimpan…' : `Masukkan ${hasil.baris.length} prospek`}
        </button>
      </div>
    </Lembar>
  );
}

/* ---------- Catat hasil follow up ---------- */
function FollowUp({ p, onClose, onSaved }: { p: Prospek; onClose: () => void; onSaved: (x: Prospek) => void }) {
  const [status, setStatus] = useState<StatusProspek>(p.status === 'baru' ? 'dihubungi' : p.status);
  const [hasil, setHasil] = useState(p.hasil);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const simpan = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/prospek', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, status, hasil }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.error || 'Gagal menyimpan.'); return; }
      onSaved(j.prospek);
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };
  return (
    <Lembar judul={`Follow up · ${p.nama}`} onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <p className="text-[13px] font-semibold text-neutral-500">Hasil</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {STATUS_PROSPEK.filter((s) => s !== 'baru').map((s) => <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={pilih(status === s)}>{STATUS_LABEL[s]}</button>)}
        </div>
        <label className="mt-3 block text-[13px] font-semibold text-neutral-500">Catatan
          <textarea value={hasil} onChange={(e) => setHasil(e.target.value)} rows={3} maxLength={300}
            placeholder="mis. Minat mobil bekas, minta dihubungi lagi Senin" className={`${FIELD} mt-1.5 resize-none py-2.5`} />
        </label>
        {!p.pic && <p className="mt-2 text-[13px] text-neutral-500">Prospek ini belum ada PIC-nya. Setelah disimpan, prospek ini jadi pegangan kamu.</p>}
        {err && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={simpan} disabled={busy} className="mt-4 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">{busy ? 'Menyimpan…' : 'Simpan hasil'}</button>
      </div>
    </Lembar>
  );
}

/* ---------- Halaman ---------- */
export default function ProspekPage({ akun, tim = [], reloadKey = 0 }: { akun: Akun; tim?: string[]; reloadKey?: number }) {
  const isOwner = akun.role === 'owner';
  const { list, setList, loading, err, reload } = useProspek(reloadKey);
  const [status, setStatus] = useState<StatusProspek | 'semua'>('semua');
  const [pic, setPic] = useState('semua');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Prospek | 'baru' | null>(null);
  const [impor, setImpor] = useState(false);
  const [fu, setFu] = useState<Prospek | null>(null);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); }, [toast]);

  const hitung = (s: StatusProspek) => list.filter((p) => p.status === s).length;
  const pics = useMemo(() => [...new Set(list.map((p) => p.pic).filter(Boolean))].sort(), [list]);
  const kata = q.toLowerCase().split(/\s+/).filter(Boolean);
  const tampil = list.filter((p) => (status === 'semua' || p.status === status)
    && (pic === 'semua' || (pic === '' ? !p.pic : keyOf(p.pic) === keyOf(pic)))
    && kata.every((k) => `${p.nama} ${p.profesi} ${p.alamat} ${p.hp}`.toLowerCase().includes(k)));
  const selesai = (pesan: string) => { setForm(null); setImpor(false); setToast(pesan); reload(); };

  return (
    <div className="pb-8">
      <section className="mx-4 mt-3 flex flex-col gap-2 rounded-[22px] bg-neutral-900 p-[18px] text-white dark:ring-1 dark:ring-neutral-800">
        <span className="text-[13px] font-bold tracking-wide text-white/80">DATABASE PROSPEK{isOwner ? '' : ' · UNTUK KAMU'}</span>
        <p className="text-[34px] font-bold leading-none tracking-tight">{loading && !list.length ? '…' : list.length}<span className="ml-2 text-base font-semibold text-white/70">prospek</span></p>
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          {([['baru', 'belum dihubungi'], ['tertarik', 'tertarik'], ['order', 'jadi order']] as const).map(([s, l]) => (
            <span key={s} className="rounded-2xl bg-white/10 px-2 py-2"><b className="block text-xl">{hitung(s)}</b><span className="block text-[12px] leading-tight text-white/70">{l}</span></span>
          ))}
        </div>
      </section>

      {isOwner && (
        <div className="mt-3 grid grid-cols-2 gap-2 px-4">
          <button onClick={() => setForm('baru')} className="min-h-12 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white dark:bg-white dark:text-neutral-900">+ Tambah</button>
          <button onClick={() => setImpor(true)} className="min-h-12 rounded-2xl border border-neutral-300 text-[15px] font-semibold dark:border-neutral-700">Impor CSV / Maps</button>
        </div>
      )}

      <div className="relative mx-4 mt-3">
        <Ico n="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" aria-label="Cari prospek" placeholder="Nama, profesi, alamat, no HP"
          className="h-12 w-full rounded-full bg-neutral-100 pl-12 pr-4 text-base outline-none placeholder:text-neutral-500 focus:ring-2 focus:ring-neutral-400 dark:bg-neutral-900" />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <button onClick={() => setStatus('semua')} aria-pressed={status === 'semua'} className={pilih(status === 'semua')}>Semua · {list.length}</button>
        {STATUS_PROSPEK.map((s) => <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={pilih(status === s)}>{STATUS_LABEL[s]} · {hitung(s)}</button>)}
      </div>
      {isOwner && (pics.length > 0 || list.some((p) => !p.pic)) && (
        <div className="mt-2 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          <button onClick={() => setPic('semua')} aria-pressed={pic === 'semua'} className={pilih(pic === 'semua')}>Semua PIC</button>
          <button onClick={() => setPic('')} aria-pressed={pic === ''} className={pilih(pic === '')}>Belum ada PIC</button>
          {pics.map((x) => <button key={x} onClick={() => setPic(x)} aria-pressed={pic === x} className={pilih(pic === x)}>{shortName(x)}</button>)}
        </div>
      )}

      {err ? (
        <div className="mx-4 mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {err}<button onClick={reload} className="mt-3 block min-h-11 rounded-full bg-red-700 px-5 font-semibold text-white">Coba lagi</button>
        </div>
      ) : loading && !list.length ? (
        <div className="space-y-3 px-4 pt-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-[20px] bg-neutral-200/70 dark:bg-neutral-800/70" />)}</div>
      ) : tampil.length === 0 ? (
        <Kosong art="bendera" title={list.length ? 'Tidak ada yang cocok' : 'Belum ada prospek'}
          text={list.length ? 'Coba status atau kata kunci lain.' : isOwner ? 'Tambahkan satu per satu atau impor hasil scrape Google Maps.' : 'Owner belum membagikan prospek untuk di-follow up.'} />
      ) : (
        <div className="flex flex-col gap-2.5 px-4 pt-3">
          {tampil.slice(0, 150).map((p) => (
            <div key={p.id} className="rounded-[20px] border border-neutral-200 px-4 py-3.5 dark:border-neutral-800">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => (isOwner ? setForm(p) : setFu(p))} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[15px] font-bold">{p.nama}</span>
                  <span className="block truncate text-[13px] text-neutral-500">{[p.profesi, p.alamat].filter(Boolean).join(' · ') || tampilHp(p.hp)}</span>
                </button>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${WARNA[p.status]}`}>{STATUS_LABEL[p.status]}</span>
              </div>
              {p.hasil && <p className="mt-1.5 text-sm leading-snug"><span className="text-neutral-500">Hasil: </span>{p.hasil}</p>}
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-semibold">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{p.pic ? `PIC ${shortName(p.pic)}` : 'Belum ada PIC'}</span>
                {p.sumber && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{p.sumber}</span>}
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{tampilHp(p.hp)}</span>
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <a href={`tel:${p.hp}`} className="flex min-h-11 items-center justify-center rounded-xl bg-neutral-100 text-sm font-semibold dark:bg-neutral-800">Telepon</a>
                <a href={`https://wa.me/${keWa(p.hp)}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-xl bg-[#0F8048] text-sm font-semibold text-white">WhatsApp</a>
                <button onClick={() => setFu(p)} className="min-h-11 rounded-xl border border-neutral-300 text-sm font-semibold dark:border-neutral-700">Catat hasil</button>
              </div>
            </div>
          ))}
          {tampil.length > 150 && <p className="py-2 text-center text-sm text-neutral-500">Menampilkan 150 dari {tampil.length}. Pakai pencarian untuk mempersempit.</p>}
        </div>
      )}

      {form && <FormProspek awal={form === 'baru' ? null : form} tim={tim} onClose={() => setForm(null)} onSaved={selesai} />}
      {impor && <Impor tim={tim} onClose={() => setImpor(false)} onSaved={selesai} />}
      {fu && <FollowUp p={fu} onClose={() => setFu(null)} onSaved={(x) => { setFu(null); setList((l) => l.map((p) => (p.id === x.id ? x : p))); setToast('Hasil follow up tersimpan'); }} />}
      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center px-5">
          <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">{toast}</div>
        </div>
      )}
    </div>
  );
}
