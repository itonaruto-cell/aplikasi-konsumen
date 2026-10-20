'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { keyOf } from '../../lib/performa-calc';
import { STATUS_LABEL, STATUS_PROSPEK, bacaImpor, keWa, rapikanHp, rapikanMaps, type Prospek, type StatusProspek } from '../../lib/prospek-types';
import { FIELD, Lembar } from './form';
import { Ico, Kosong, shortName } from './parts';
import { useOverlay } from '../overlay';
import { KATA_INTI, KATA_KUNCI, WILAYAH, pencarian } from '../../lib/ambil-maps';

// Database prospek: semua akun bisa menambah (manual / impor CSV hasil scrape Google Maps), mengubah, mengatur PIC,
// menelepon / WhatsApp, lalu mencatat hasil follow up dengan foto bukti.

type Akun = { email: string; role: 'owner' | 'konsumen' | 'tim' };
const WARNA: Record<StatusProspek, string> = {
  baru: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  minat: 'bg-[#FFF4E0] text-[#8A4700] dark:bg-[#2A1E0C] dark:text-[#F7C98A]',
  norespon: 'bg-[#E9EEF8] text-[#1B2F5B] dark:bg-[#1B2A4A] dark:text-[#9DB5E8]',
  tidak: 'bg-red-50 text-red-700 dark:bg-red-400/15 dark:text-red-300',
  order: 'bg-green-50 text-green-800 dark:bg-green-400/15 dark:text-green-300',
};
const pilih = (on: boolean) => `min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${on
  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
  : 'border-neutral-300 dark:border-neutral-700'}`;
const pilihK = (on: boolean) => `min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold ${on
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
function FormProspek({ awal, tim, bolehHapus, owner, onClose, onSaved }: { awal: Prospek | null; tim: string[]; bolehHapus: boolean; owner: boolean; onClose: () => void; onSaved: (pesan: string) => void }) {
  const [nama, setNama] = useState(awal?.nama || '');
  const [hp, setHp] = useState(awal?.hp || '');
  const [profesi, setProfesi] = useState(awal?.profesi || '');
  const [alamat, setAlamat] = useState(awal?.alamat || '');
  const [catatan, setCatatan] = useState(awal?.catatan || '');
  const [maps, setMaps] = useState(awal?.maps || '');
  const [privat, setPrivat] = useState(!!awal?.privat);
  const [pic, setPic] = useState(awal?.pic || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const simpan = async () => {
    if (!nama.trim()) { setErr('Nama wajib diisi.'); return; }
    if (!rapikanHp(hp)) { setErr('Nomor HP tidak valid. Contoh: 0812 3456 7890.'); return; }
    if (maps.trim() && !rapikanMaps(maps)) { setErr('Link Google Maps harus diawali https://'); return; }
    setBusy(true); setErr('');
    try {
      const body = awal ? { id: awal.id, nama, hp, profesi, alamat, catatan, maps, pic, ...(owner ? { privat } : {}) } : { items: [{ nama, hp, profesi, alamat, catatan, maps }], pic, sumber: 'Manual' };
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
    const r = await fetch(`/api/prospek?id=${encodeURIComponent(awal.id)}`, { method: 'DELETE' }).catch(() => null);
    setBusy(false);
    if (!r?.ok) { const j = await r?.json().catch(() => null); setErr(j?.error || 'Gagal menghapus.'); return; }
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
        <label className={label}>Link Google Maps<input value={maps} onChange={(e) => setMaps(e.target.value)} inputMode="url" maxLength={300} placeholder="Opsional, https://maps.app.goo.gl/…" className={`${FIELD} mt-1.5 h-12`} /></label>
        <label className={label}>Catatan<input value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={200} placeholder="Opsional, mis. punya 2 mobil" className={`${FIELD} mt-1.5 h-12`} /></label>
        <p className={label}>PIC follow up</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <button onClick={() => setPic('')} aria-pressed={!pic} className={pilih(!pic)}>Belum ada</button>
          {tim.map((t) => <button key={t} onClick={() => setPic(t)} aria-pressed={keyOf(pic) === keyOf(t)} className={pilih(keyOf(pic) === keyOf(t))}>{shortName(t)}</button>)}
        </div>
        {owner && awal && (
          <label className="mt-3 flex min-h-12 items-center gap-3 rounded-2xl border border-neutral-200 px-4 dark:border-neutral-800">
            <span className="min-w-0 flex-1 text-[15px]">Hanya owner & PIC yang melihat<span className="block text-xs text-neutral-500">Matikan untuk membagikan ke semua tim</span></span>
            <input type="checkbox" checked={privat} onChange={(e) => setPrivat(e.target.checked)} className="h-6 w-6 accent-neutral-900" />
          </label>
        )}
        {err && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={simpan} disabled={busy} className="mt-4 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">{busy ? 'Menyimpan…' : 'Simpan'}</button>
        {awal && bolehHapus && <button onClick={hapus} disabled={busy} className="mt-2 min-h-11 w-full text-sm font-semibold text-red-700 dark:text-red-400">Hapus prospek</button>}
      </div>
    </Lembar>
  );
}

/* ---------- Ambil langsung dari Google Maps lewat Apify (owner) ---------- */
const SIMPAN_TOKEN = 'mk.apifyToken', SIMPAN_RUN = 'mk.apifyRun';
const baca = (k: string) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const tulis = (k: string, v: string) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch { /* abaikan */ } };
const AWAL_KEC = ['Batang|Gringsing', 'Batang|Banyuputih', 'Batang|Limpung', 'Batang|Subah', 'Kendal|Weleri', 'Kendal|Kaliwungu'];
type RunSimpan = { runId: string; datasetId: string; privat: boolean; mulai: string };

function AmbilMaps({ onClose, onSaved }: { onClose: () => void; onSaved: (pesan: string) => void }) {
  const [token, setToken] = useState(() => baca(SIMPAN_TOKEN));
  const [kec, setKec] = useState<string[]>(AWAL_KEC);
  const [kata, setKata] = useState<string[]>(KATA_INTI);
  const [maks, setMaks] = useState(10);
  const [privat, setPrivat] = useState(true);
  const [run, setRun] = useState<RunSimpan | null>(() => { try { return JSON.parse(baca(SIMPAN_RUN) || 'null') as RunSimpan | null; } catch { return null; } });
  const [info, setInfo] = useState<{ status: string; jumlah: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pilihan = WILAYAH.flatMap((w) => w.kec.filter((k) => kec.includes(`${w.kab}|${k}`)).map((k) => ({ kab: w.kab, kec: k })));
  const cari = pencarian(kata, pilihan);
  const tog = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const api = useCallback(async (body: object) => {
    const r = await fetch('/api/prospek/maps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token.trim(), ...body }) });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.error || 'Gagal menghubungi Apify.');
    return j;
  }, [token]);
  const ambil = useCallback(async (x: RunSimpan) => {
    setBusy(true); setErr('');
    try {
      const h = await api({ aksi: 'ambil', datasetId: x.datasetId });
      if (!h.items.length) { setErr(`Selesai, tapi tidak ada tempat dengan nomor HP (${h.total} tempat ditemukan).`); tulis(SIMPAN_RUN, ''); return; }
      const r = await fetch('/api/prospek', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: h.items, sumber: 'Google Maps', privat: x.privat }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.error || 'Gagal menyimpan prospek.'); return; }
      tulis(SIMPAN_RUN, ''); setRun(null);
      onSaved(`${j.ditambah} prospek dari Google Maps masuk${j.dobel ? ` · ${j.dobel} sudah ada` : ''}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, [api, onSaved]);
  // Pantau pencarian yang sedang berjalan (juga setelah lembar ini ditutup lalu dibuka lagi)
  useEffect(() => {
    if (!run || !token) return;
    let hidup = true;
    let t: ReturnType<typeof setTimeout> | undefined;
    const cek = async () => {
      try {
        const j = await api({ aksi: 'cek', runId: run.runId });
        if (!hidup) return;
        setInfo({ status: j.status, jumlah: j.jumlah });
        if (j.status === 'SUCCEEDED') { ambil({ ...run, datasetId: j.datasetId || run.datasetId }); return; }
        if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(j.status)) return;
      } catch (e) { if (hidup) setErr((e as Error).message); }
      if (hidup) t = setTimeout(cek, 8000);
    };
    cek();
    return () => { hidup = false; if (t) clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.runId]);
  const mulai = async () => {
    if (!token.trim()) { setErr('Isi token Apify dulu.'); return; }
    if (!cari.length) { setErr('Pilih minimal satu kecamatan dan satu kata kunci.'); return; }
    setBusy(true); setErr('');
    try {
      tulis(SIMPAN_TOKEN, token.trim());
      const j = await api({ aksi: 'mulai', cari, maks });
      const x = { runId: j.runId, datasetId: j.datasetId, privat, mulai: new Date().toISOString() };
      tulis(SIMPAN_RUN, JSON.stringify(x)); setInfo(null); setRun(x);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const berhenti = !!info && ['FAILED', 'ABORTED', 'TIMED-OUT'].includes(info.status);
  const label = 'mt-4 block text-[13px] font-semibold text-neutral-500';
  const kotakErr = err && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>;
  return (
    <Lembar judul="Ambil dari Google Maps" onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        {run ? (
          <div className="py-2">
            <div className="rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900">
              <p className="text-[15px] font-bold">{busy ? 'Menyimpan ke database…' : berhenti ? 'Pencarian berhenti' : 'Sedang mencari di Google Maps…'}</p>
              <p className="mt-1 text-sm text-neutral-500">
                {info ? `${info.jumlah.toLocaleString('id-ID')} tempat terkumpul · ${info.status.toLowerCase()}` : 'Menghubungi Apify…'}
              </p>
              {!berhenti && !busy && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"><div className="h-full w-1/3 animate-pulse rounded-full bg-neutral-900 dark:bg-white" /></div>}
              <p className="mt-3 text-xs text-neutral-500">Biasanya beberapa menit. Lembar ini boleh ditutup; buka lagi nanti, hasilnya otomatis dimasukkan.</p>
            </div>
            {kotakErr}
            {berhenti && (
              <button onClick={() => ambil(run)} disabled={busy} className="mt-3 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">Simpan yang sudah terkumpul</button>
            )}
            <button onClick={() => { tulis(SIMPAN_RUN, ''); setRun(null); setInfo(null); setErr(''); }} className="mt-2 min-h-11 w-full text-sm font-semibold text-neutral-500">Lupakan pencarian ini</button>
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              Mencari tempat usaha di Google Maps memakai akun Apify Anda, lalu memasukkan yang punya nomor HP ke database prospek, lengkap dengan profesi, alamat, dan link maps.
            </p>
            <label className={label}>Token Apify
              <input value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="off" placeholder="apify_api_…" className={`${FIELD} mt-1.5 h-12 font-mono`} />
            </label>
            <p className="mt-1 text-xs text-neutral-500">Ambil di console.apify.com → Settings → API &amp; Integrations → salin Personal API token. Disimpan hanya di HP ini.</p>

            <p className={label}>Wilayah</p>
            {WILAYAH.map((w) => (
              <div key={w.kab} className="mt-2">
                <p className="text-xs font-bold text-neutral-500">{w.kab.toUpperCase()}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {w.kec.map((k) => {
                    const id = `${w.kab}|${k}`, on = kec.includes(id);
                    return <button key={id} onClick={() => setKec(tog(kec, id))} aria-pressed={on} className={pilihK(on)}>{k}</button>;
                  })}
                </div>
              </div>
            ))}
            <p className={label}>Kata kunci</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {KATA_KUNCI.map((k) => <button key={k} onClick={() => setKata(tog(kata, k))} aria-pressed={kata.includes(k)} className={`${pilihK(kata.includes(k))}`}>{k}</button>)}
            </div>
            <p className={label}>Maksimal tempat per pencarian</p>
            <div className="mt-1.5 flex gap-1.5">
              {[5, 10, 15, 20].map((n) => <button key={n} onClick={() => setMaks(n)} aria-pressed={maks === n} className={`${pilihK(maks === n)}`}>{n}</button>)}
            </div>
            <label className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl border border-neutral-200 px-4 dark:border-neutral-800">
              <span className="min-w-0 flex-1 text-[15px]">Hanya owner yang melihat<span className="block text-xs text-neutral-500">Tim baru melihat setelah Anda beri PIC atau bagikan</span></span>
              <input type="checkbox" checked={privat} onChange={(e) => setPrivat(e.target.checked)} className="h-6 w-6 accent-neutral-900" />
            </label>
            <div className="mt-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm dark:bg-neutral-900">
              <b>{cari.length}</b> pencarian × {maks} = maks. <b>±{(cari.length * maks).toLocaleString('id-ID')}</b> tempat
              <p className="mt-1 text-xs text-neutral-500">Kredit gratis Apify ±$5/bulan. Mulai dari sedikit dulu, lalu cek sisa kredit di Apify.</p>
            </div>
            {kotakErr}
            <button onClick={mulai} disabled={busy || !cari.length} className="mt-4 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
              {busy ? 'Memulai…' : 'Mulai cari'}
            </button>
          </>
        )}
      </div>
    </Lembar>
  );
}

/* ---------- Impor CSV / tempel dari Google Sheets ---------- */
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
          Kolom yang dikenali: <b>nama</b> (name/title), <b>no HP</b> (phone), <b>profesi</b> (category), <b>alamat</b> (address), dan <b>link maps</b> (url).
          Tanpa judul kolom, urutannya dianggap nama, no HP, profesi, alamat, link maps.
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
            <p key={b.hp} className="mt-1 truncate text-[13px] text-neutral-500">{b.nama} · {tampilHp(b.hp)}{b.profesi ? ` · ${b.profesi}` : ''}{b.maps ? ' · ada link maps' : ''}</p>
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

/* ---------- Foto bukti ---------- */
// Foto diperkecil di HP (sisi terpanjang maks. 1000 px, JPEG) supaya muat disimpan di tab FOTO (maks. ±130 KB).
const MAKS_B64 = 175_000;
async function kecilkanFoto(file: File): Promise<{ mime: string; data: string; url: string }> {
  const url = URL.createObjectURL(file);
  try {
    // createImageBitmap lebih hemat memori untuk foto kamera besar; <img> sebagai cadangan
    let img: CanvasImageSource, w = 0, h = 0;
    try {
      const bm = await createImageBitmap(file);
      img = bm; w = bm.width; h = bm.height;
    } catch {
      const i = await new Promise<HTMLImageElement>((ok, no) => { const x = new Image(); x.onload = () => ok(x); x.onerror = no; x.src = url; });
      img = i; w = i.naturalWidth; h = i.naturalHeight;
    }
    if (!w || !h) throw new Error('rusak');
    for (const [sisi, q] of [[1000, 0.72], [900, 0.6], [760, 0.55], [640, 0.5], [520, 0.45]] as const) {
      const k = Math.min(1, sisi / Math.max(w, h));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      const g = cv.getContext('2d');
      if (!g) break;
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      const dataUrl = cv.toDataURL('image/jpeg', q);
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
      if (data.length <= MAKS_B64) return { mime: 'image/jpeg', data, url: dataUrl };
    }
    throw new Error('besar');
  } finally { URL.revokeObjectURL(url); }
}

function FotoBukti({ id, nama }: { id: string; nama: string }) {
  const [besar, setBesar] = useState(false);
  const [gagal, setGagal] = useState(false);
  useOverlay(besar, () => setBesar(false));
  if (!id || gagal) return null;
  const src = `/api/foto/${encodeURIComponent(id)}`;
  return (
    <>
      <button onClick={() => setBesar(true)} aria-label={`Lihat foto bukti follow up ${nama}`}
        className="flex items-center gap-1.5 rounded-full bg-green-50 py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-green-800 dark:bg-green-400/15 dark:text-green-300">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" onError={() => setGagal(true)} className="h-6 w-6 rounded-full object-cover" />
        Bukti FU
      </button>
      {besar && (
        <div role="dialog" aria-label={`Foto bukti ${nama}`} className="fixed inset-0 z-[70] flex flex-col bg-black/95" onClick={() => setBesar(false)}>
          <div className="flex justify-end p-2 pt-[calc(env(safe-area-inset-top)+8px)]">
            <button onClick={() => setBesar(false)} aria-label="Tutup foto" className="flex h-12 w-12 items-center justify-center text-white"><Ico n="x" className="h-6 w-6" sw={2} /></button>
          </div>
          <div className="flex flex-1 items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Foto bukti ${nama}`} className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Catat hasil follow up ---------- */
function FollowUp({ p, wajibFoto, onClose, onSaved }: { p: Prospek; wajibFoto: boolean; onClose: () => void; onSaved: (x: Prospek) => void }) {
  const [hasilFu, setHasilFu] = useState<'minat' | 'tidak' | 'norespon' | ''>(p.status === 'order' || p.status === 'minat' ? 'minat' : p.status === 'tidak' || p.status === 'norespon' ? p.status : '');
  const [order, setOrder] = useState(p.status === 'order');
  const status: StatusProspek | '' = hasilFu === 'minat' && order ? 'order' : hasilFu;
  const [hasil, setHasil] = useState(p.hasil);
  const [foto, setFoto] = useState<{ mime: string; data: string; url: string } | null>(null);
  const [olah, setOlah] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pilihFoto = async (f: File | undefined) => {
    if (!f) return;
    setOlah(true); setErr('');
    try { setFoto(await kecilkanFoto(f)); } catch { setErr('Foto ini tidak bisa dibaca HP (mis. format HEIC). Coba screenshot, atau pilih foto lain dari galeri.'); } finally { setOlah(false); }
  };
  const simpan = async () => {
    if (!status) { setErr('Pilih hasil follow up: minat, tidak minat, atau tidak ada respon.'); return; }
    if (wajibFoto && !foto) { setErr('Lampirkan foto bukti dulu: foto saat bertemu atau screenshot chat / riwayat telepon.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/prospek', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, status, hasil, foto: foto ? { mime: foto.mime, data: foto.data } : undefined }) });
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
          {([['minat', 'Minat'], ['tidak', 'Tidak minat'], ['norespon', 'Tidak ada respon']] as const).map(([s, l]) => (
            <button key={s} onClick={() => setHasilFu(s)} aria-pressed={hasilFu === s} className={pilih(hasilFu === s)}>{l}</button>
          ))}
        </div>
        {hasilFu === 'minat' && (
          <label className="mt-2 flex min-h-12 items-center gap-3 rounded-2xl bg-green-50 px-4 text-[15px] font-semibold text-green-900 dark:bg-green-400/15 dark:text-green-200">
            <input type="checkbox" checked={order} onChange={(e) => setOrder(e.target.checked)} className="h-5 w-5 accent-green-700" />
            Jadi order
          </label>
        )}
        <label className="mt-3 block text-[13px] font-semibold text-neutral-500">Catatan
          <textarea value={hasil} onChange={(e) => setHasil(e.target.value)} rows={3} maxLength={300}
            placeholder="mis. Minat mobil bekas, minta dihubungi lagi Senin" className={`${FIELD} mt-1.5 resize-none py-2.5`} />
        </label>
        <p className="mt-3 text-[13px] font-semibold text-neutral-500">Foto bukti follow up{wajibFoto ? ' (wajib)' : ''}</p>
        {foto ? (
          <div className="relative mt-1.5 overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto.url} alt="Pratinjau foto bukti" className="max-h-56 w-full object-contain" />
            <button onClick={() => setFoto(null)} className="absolute right-2 top-2 min-h-9 rounded-full bg-black/70 px-3 text-xs font-semibold text-white">Ganti</button>
          </div>
        ) : (
          olah ? (
            <p className="mt-1.5 flex min-h-14 items-center justify-center rounded-2xl border border-dashed border-neutral-300 text-[15px] font-semibold dark:border-neutral-700">Memproses foto…</p>
          ) : (
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 px-3 text-center text-[15px] font-semibold dark:border-neutral-700">
                <input type="file" accept="image/*" className="sr-only" aria-label="Pilih foto bukti" onChange={(e) => { pilihFoto(e.target.files?.[0]); e.target.value = ''; }} />
                Galeri / screenshot
              </label>
              <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 px-3 text-center text-[15px] font-semibold dark:border-neutral-700">
                <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Ambil foto dengan kamera" onChange={(e) => { pilihFoto(e.target.files?.[0]); e.target.value = ''; }} />
                Kamera
              </label>
            </div>
          )
        )}
        <p className="mt-1.5 text-xs text-neutral-500">Foto saat bertemu, atau screenshot chat WhatsApp / riwayat panggilan.</p>
        {!p.pic && <p className="mt-2 text-[13px] text-neutral-500">Prospek ini belum ada PIC-nya. Setelah disimpan, prospek ini jadi pegangan kamu.</p>}
        {err && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={simpan} disabled={busy || olah} className="mt-4 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">{busy ? 'Menyimpan…' : 'Simpan hasil'}</button>
      </div>
    </Lembar>
  );
}

/* ---------- Jumlah prospek yang dipegang tiap PIC ---------- */
type Pegangan = { pic: string; total: number; baru: number; minat: number; order: number };
function hitungPegangan(list: Prospek[], tim: string[]): Pegangan[] {
  const peta = new Map<string, Pegangan>();
  const ambil = (pic: string) => {
    const k = keyOf(pic);
    if (!peta.has(k)) peta.set(k, { pic, total: 0, baru: 0, minat: 0, order: 0 });
    return peta.get(k)!;
  };
  tim.forEach((t) => ambil(t));
  for (const p of list) {
    if (!p.pic) continue;
    const g = ambil(p.pic);
    g.total++;
    if (p.status === 'baru') g.baru++;
    if (p.status === 'minat' || p.status === 'order') g.minat++;
    if (p.status === 'order') g.order++;
  }
  return [...peta.values()].sort((a, b) => b.total - a.total || a.pic.localeCompare(b.pic));
}

/* ---------- Bagikan banyak prospek ke PIC sekaligus (owner) ---------- */
function BagiPic({ ids, judul, tim, list, onClose, onSaved }: { ids: string[]; judul: string; tim: string[]; list: Prospek[]; onClose: () => void; onSaved: (pesan: string) => void }) {
  const [ke, setKe] = useState<string[]>([]);
  const [lepas, setLepas] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Bagi rata bergiliran; diurutkan per alamat supaya tiap orang dapat campuran wilayah yang mirip
  const urut = useMemo(() => {
    const m = new Map(list.map((p) => [p.id, p]));
    return ids.map((id) => m.get(id)).filter(Boolean).sort((a, b) => (a!.alamat || '').localeCompare(b!.alamat || '')) as Prospek[];
  }, [ids, list]);
  const pembagian = lepas ? urut.map((p) => ({ id: p.id, pic: '' })) : ke.length ? urut.map((p, i) => ({ id: p.id, pic: ke[i % ke.length] })) : [];
  const jumlah = (n: string) => pembagian.filter((x) => x.pic === n).length;
  const simpan = async () => {
    if (!pembagian.length) { setErr('Pilih PIC dulu.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/prospek', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aksi: 'pic', daftar: pembagian }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setErr(j?.error || 'Gagal menyimpan.'); return; }
      onSaved(lepas ? `PIC dilepas dari ${j.diubah} prospek` : ke.length === 1 ? `${j.diubah} prospek untuk ${shortName(ke[0])}` : `${j.diubah} prospek dibagi ke ${ke.map(shortName).join(', ')}`);
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };
  return (
    <Lembar judul="Bagikan ke PIC" onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <p className="rounded-2xl bg-neutral-100 px-4 py-3 text-sm dark:bg-neutral-900"><b>{urut.length}</b> prospek · {judul}</p>
        <p className="mt-4 text-[13px] font-semibold text-neutral-500">Berikan ke (pilih satu atau lebih; lebih dari satu = dibagi rata)</p>
        <p className="mt-1 text-xs text-neutral-500">Pegangan saat ini: {hitungPegangan(list, tim).filter((g) => g.total).map((g) => `${shortName(g.pic)} ${g.total}`).join(' · ') || 'belum ada'}</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {tim.map((t) => {
            const on = !lepas && ke.includes(t);
            return <button key={t} onClick={() => { setLepas(false); setKe(on ? ke.filter((x) => x !== t) : [...ke, t]); }} aria-pressed={on} className={pilih(on)}>{shortName(t)}</button>;
          })}
          <button onClick={() => { setLepas(!lepas); setKe([]); }} aria-pressed={lepas} className={pilih(lepas)}>Lepas PIC</button>
        </div>
        {pembagian.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
            {(lepas ? [['', pembagian.length] as const] : ke.map((n) => [n, jumlah(n)] as const)).map(([n, j]) => {
              const sekarang = n ? (hitungPegangan(list, tim).find((g) => keyOf(g.pic) === keyOf(n))?.total || 0) : 0;
              const sudahPunya = n ? urut.filter((p) => keyOf(p.pic) === keyOf(n)).length : 0;
              return (
                <div key={n || 'lepas'} className="flex min-h-12 items-center justify-between border-b border-neutral-200 px-4 last:border-0 dark:border-neutral-800">
                  <span className="text-[15px] font-semibold">{n ? shortName(n) : 'Tanpa PIC'}</span>
                  <span className="text-right"><b className="text-[15px]">+{j} prospek</b>
                    {n && <span className="block text-xs text-neutral-500">jadi {sekarang - sudahPunya + j} pegangan</span>}</span>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-xs text-neutral-500">Prospek "Hanya owner" ikut terlihat oleh PIC-nya, tapi tetap tersembunyi dari anggota tim lain.</p>
        {err && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={simpan} disabled={busy || !pembagian.length} className="mt-4 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {busy ? 'Menyimpan…' : lepas ? `Lepas PIC ${pembagian.length} prospek` : `Bagikan ${pembagian.length} prospek`}
        </button>
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
  const [ambilMaps, setAmbilMaps] = useState(false);
  const [fu, setFu] = useState<Prospek | null>(null);
  const [pilihMode, setPilihMode] = useState(false);
  const [dipilih, setDipilih] = useState<Set<string>>(new Set());
  const [bagi, setBagi] = useState<{ ids: string[]; judul: string } | null>(null);
  const [menuBagi, setMenuBagi] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2400); return () => clearTimeout(t); }, [toast]);

  const hitung = (s: StatusProspek) => list.filter((p) => p.status === s).length;
  const pics = useMemo(() => [...new Set(list.map((p) => p.pic).filter(Boolean))].sort(), [list]);
  const kata = q.toLowerCase().split(/\s+/).filter(Boolean);
  const tampil = list.filter((p) => (status === 'semua' || p.status === status)
    && (pic === 'semua' || (pic === '' ? !p.pic : keyOf(p.pic) === keyOf(pic)))
    && kata.every((k) => `${p.nama} ${p.profesi} ${p.alamat} ${p.hp}`.toLowerCase().includes(k)));
  const selesai = useCallback((pesan: string) => { setForm(null); setImpor(false); setAmbilMaps(false); setBagi(null); setPilihMode(false); setDipilih(new Set()); setToast(pesan); reload(); }, [reload]);
  const tanpaPic = list.filter((p) => !p.pic);
  const togglePilih = (id: string) => setDipilih((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className={pilihMode ? 'pb-28' : 'pb-8'}>
      <section className="mx-4 mt-3 flex flex-col gap-2 rounded-[22px] bg-neutral-900 p-[18px] text-white dark:ring-1 dark:ring-neutral-800">
        <span className="text-[13px] font-bold tracking-wide text-white/80">DATABASE PROSPEK</span>
        <p className="text-[34px] font-bold leading-none tracking-tight">{loading && !list.length ? '…' : list.length}<span className="ml-2 text-base font-semibold text-white/70">prospek</span></p>
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          {([['baru', 'belum dihubungi'], ['minat', 'minat'], ['order', 'jadi order']] as const).map(([s, l]) => (
            <span key={s} className="rounded-2xl bg-white/10 px-2 py-2"><b className="block text-xl">{s === 'minat' ? hitung('minat') + hitung('order') : hitung(s)}</b><span className="block text-[12px] leading-tight text-white/70">{l}</span></span>
          ))}
        </div>
      </section>

      {isOwner && list.length > 0 && (
        <section className="mx-4 mt-3 overflow-hidden rounded-[20px] border border-neutral-200 dark:border-neutral-800">
          <p className="px-4 pt-3 text-[13px] font-bold tracking-wide text-neutral-500">PEGANGAN TIAP PIC</p>
          {hitungPegangan(list, tim).map((g) => (
            <button key={g.pic} onClick={() => { setPic(g.pic); setStatus('semua'); }} className="flex min-h-12 w-full items-center gap-3 border-b border-neutral-200 px-4 py-2 text-left dark:border-neutral-800">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{shortName(g.pic)}</span>
                <span className="block text-xs text-neutral-500">{g.baru} belum dihubungi · {g.minat} minat{g.order ? ` · ${g.order} order` : ''}</span>
              </span>
              <b className="text-lg">{g.total}</b>
            </button>
          ))}
          <button onClick={() => { setPic(''); setStatus('semua'); }} className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left">
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-neutral-500">Belum ada PIC</span>
            <b className="text-lg text-neutral-500">{tanpaPic.length}</b>
          </button>
        </section>
      )}

      {(
        <div className="mt-3 grid grid-cols-2 gap-2 px-4">
          <button onClick={() => setForm('baru')} className="min-h-12 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white dark:bg-white dark:text-neutral-900">+ Tambah</button>
          <button onClick={() => setImpor(true)} className="min-h-12 rounded-2xl border border-neutral-300 text-[15px] font-semibold dark:border-neutral-700">Impor CSV / Maps</button>
          {isOwner && (
            <button onClick={() => setAmbilMaps(true)} className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#1B2F5B] text-[15px] font-bold text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></svg>
              Ambil dari Google Maps
            </button>
          )}
          {isOwner && (
            <button onClick={() => setMenuBagi(true)} className="col-span-2 min-h-12 rounded-2xl border border-neutral-300 text-[15px] font-semibold dark:border-neutral-700">
              Bagikan ke PIC sekaligus{tanpaPic.length ? ` · ${tanpaPic.length} belum ada PIC` : ''}
            </button>
          )}
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
      {(pics.length > 0 || list.some((p) => !p.pic)) && (
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
          text={list.length ? 'Coba status atau kata kunci lain.' : 'Tambahkan satu per satu atau impor hasil scrape Google Maps.'} />
      ) : (
        <div className="flex flex-col gap-2.5 px-4 pt-3">
          {tampil.slice(0, 150).map((p) => (
            <div key={p.id} className={`rounded-[20px] border px-4 py-3.5 ${pilihMode && dipilih.has(p.id) ? 'border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-900' : 'border-neutral-200 dark:border-neutral-800'}`}>
              <div className="flex items-start justify-between gap-3">
                {pilihMode && (
                  <input type="checkbox" checked={dipilih.has(p.id)} onChange={() => togglePilih(p.id)} aria-label={`Pilih ${p.nama}`} className="mt-0.5 h-6 w-6 shrink-0 accent-neutral-900" />
                )}
                <button onClick={() => (pilihMode ? togglePilih(p.id) : setForm(p))} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[15px] font-bold">{p.nama}</span>
                  <span className="block truncate text-[13px] text-neutral-500">{[p.profesi, p.alamat].filter(Boolean).join(' · ') || tampilHp(p.hp)}</span>
                </button>
                <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${WARNA[p.status]}`}>{STATUS_LABEL[p.status]}</span>
              </div>
              {p.hasil && <p className="mt-1.5 text-sm leading-snug"><span className="text-neutral-500">Hasil: </span>{p.hasil}</p>}
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-semibold">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{p.pic ? `PIC ${shortName(p.pic)}` : 'Belum ada PIC'}</span>
                {isOwner && p.privat && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200">Hanya owner</span>}
                {p.sumber && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{p.sumber}</span>}
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-mono text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{tampilHp(p.hp)}</span>
                {p.maps && (
                  <a href={p.maps} target="_blank" rel="noreferrer" className="rounded-full bg-[#E9EEF8] px-2 py-0.5 text-[#1B2F5B] dark:bg-[#1B2A4A] dark:text-[#9DB5E8]">Buka Maps</a>
                )}
                {p.foto && <FotoBukti id={p.foto} nama={p.nama} />}
              </div>
              {!pilihMode && <div className="mt-2.5 grid grid-cols-3 gap-2">
                <a href={`tel:${p.hp}`} className="flex min-h-11 items-center justify-center rounded-xl bg-neutral-100 text-sm font-semibold dark:bg-neutral-800">Telepon</a>
                <a href={`https://wa.me/${keWa(p.hp)}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-xl bg-[#0F8048] text-sm font-semibold text-white">WhatsApp</a>
                <button onClick={() => setFu(p)} className="min-h-11 rounded-xl border border-neutral-300 text-sm font-semibold dark:border-neutral-700">Catat hasil</button>
              </div>}
            </div>
          ))}
          {tampil.length > 150 && <p className="py-2 text-center text-sm text-neutral-500">Menampilkan 150 dari {tampil.length}. Pakai pencarian untuk mempersempit.</p>}
        </div>
      )}

      {form && <FormProspek awal={form === 'baru' ? null : form} tim={tim} bolehHapus={form !== 'baru' && (isOwner || form.oleh === akun.email.toLowerCase())} owner={isOwner} onClose={() => setForm(null)} onSaved={selesai} />}
      {impor && <Impor tim={tim} onClose={() => setImpor(false)} onSaved={selesai} />}
      {ambilMaps && isOwner && <AmbilMaps onClose={() => setAmbilMaps(false)} onSaved={selesai} />}
      {pilihMode && (
        <div className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 px-4">
          <div className="mx-auto flex max-w-xl items-center gap-2 rounded-2xl bg-neutral-900 p-2 pl-4 text-white shadow-lg dark:bg-white dark:text-neutral-900">
            <span className="min-w-0 flex-1 text-sm font-semibold">{dipilih.size} dipilih</span>
            <button onClick={() => setDipilih(new Set(tampil.map((p) => p.id)))} className="min-h-10 rounded-xl px-2 text-sm font-semibold underline underline-offset-2">Pilih semua ({tampil.length})</button>
            <button onClick={() => { setPilihMode(false); setDipilih(new Set()); }} className="min-h-10 rounded-xl px-2 text-sm font-semibold">Batal</button>
            <button onClick={() => setBagi({ ids: [...dipilih], judul: 'dipilih manual' })} disabled={!dipilih.size}
              className="min-h-10 rounded-xl bg-white px-4 text-sm font-bold text-neutral-900 disabled:opacity-40 dark:bg-neutral-900 dark:text-white">Bagikan</button>
          </div>
        </div>
      )}
      {menuBagi && (
        <Lembar judul="Bagikan ke PIC sekaligus" onClose={() => setMenuBagi(false)}>
          <div className="flex flex-col gap-2 px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            {([
              ['Semua yang belum ada PIC', tanpaPic.map((p) => p.id), 'belum ada PIC'],
              ['Yang tampil sekarang (sesuai filter & pencarian)', tampil.map((p) => p.id), 'sesuai filter'],
            ] as const).map(([l, ids, j]) => (
              <button key={l} disabled={!ids.length} onClick={() => { setMenuBagi(false); setBagi({ ids: [...ids], judul: j }); }}
                className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 text-left text-[15px] font-semibold disabled:opacity-40 dark:border-neutral-800">
                <span>{l}</span><b>{ids.length}</b>
              </button>
            ))}
            <button onClick={() => { setMenuBagi(false); setPilihMode(true); setDipilih(new Set()); }}
              className="flex min-h-14 items-center rounded-2xl border border-neutral-200 px-4 text-left text-[15px] font-semibold dark:border-neutral-800">Pilih sendiri dari daftar…</button>
          </div>
        </Lembar>
      )}
      {bagi && isOwner && <BagiPic ids={bagi.ids} judul={bagi.judul} tim={tim} list={list} onClose={() => setBagi(null)} onSaved={selesai} />}
      {fu && <FollowUp p={fu} wajibFoto={!isOwner} onClose={() => setFu(null)} onSaved={(x) => { setFu(null); setList((l) => l.map((p) => (p.id === x.id ? x : p))); setToast('Hasil follow up tersimpan'); }} />}
      {toast && (
        <div className={`fixed inset-x-0 z-50 flex justify-center px-5 ${pilihMode ? 'bottom-[calc(150px+env(safe-area-inset-bottom))]' : 'bottom-[calc(96px+env(safe-area-inset-bottom))]'}`}>
          <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">{toast}</div>
        </div>
      )}
    </div>
  );
}
