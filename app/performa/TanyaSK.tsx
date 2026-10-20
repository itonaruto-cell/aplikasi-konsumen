'use client';
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
type Akun = { email: string; role: 'owner' | 'konsumen' | 'tim' };
import { Ico } from './parts';

type DokSK = { dok: string; judul: string; keterangan: string; namaFile: string; halaman: number; potongan: number; ukuran: number; diperbarui: string };
type Sumber = { n: number; dok: string; judul: string; hal: number; bagian: string; isi: string };
type Tanya = { q: string; status: 'tunggu' | 'ok' | 'gagal'; jawaban?: string; sumber?: Sumber[]; ai?: boolean; catatan?: string; error?: string };

const CONTOH = [
  'Siapa yang approve pembiayaan mobil eksposur Rp300 jt?',
  'Batas waktu banding berapa hari?',
  'Konsumen pernah kol 5 lebih dari 2 tahun, bagaimana?',
  'Ciri BPKB duplikat apa saja?',
  'Foto survey apa saja yang wajib?',
  'Syarat RO Super MobilKu apa saja?',
];

const tglId = (iso: string) => (iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '');
const mb = (b: number) => (b ? `${(b / 1_048_576).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB` : '');

// Tebal (**x**) dan rujukan [n] di dalam satu baris jawaban
function Baris({ t, onRujuk }: { t: string; onRujuk: (n: number) => void }) {
  const out: ReactNode[] = [];
  t.split(/(\*\*[^*]+\*\*|\[\d{1,2}\](?:\s*\[\d{1,2}\])*)/g).forEach((p, i) => {
    if (!p) return;
    if (p.startsWith('**')) out.push(<b key={i}>{p.slice(2, -2)}</b>);
    else if (/^\[\d/.test(p)) {
      for (const m of p.matchAll(/\[(\d{1,2})\]/g)) {
        const n = Number(m[1]);
        out.push(<button key={`${i}-${n}`} onClick={() => onRujuk(n)} className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-neutral-200 px-1 align-[1px] text-[11px] font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">{n}</button>);
      }
    } else out.push(<Fragment key={i}>{p}</Fragment>);
  });
  return <>{out}</>;
}

function Jawaban({ teks, onRujuk }: { teks: string; onRujuk: (n: number) => void }) {
  const baris = teks.split('\n').map((x) => x.trimEnd());
  const blok: ReactNode[] = [];
  let poin: string[] = [];
  const tutup = () => {
    if (!poin.length) return;
    blok.push(<ul key={blok.length} className="mt-1.5 space-y-1 pl-1">{poin.map((p, i) => <li key={i} className="flex gap-2"><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-neutral-400" /><span><Baris t={p} onRujuk={onRujuk} /></span></li>)}</ul>);
    poin = [];
  };
  for (const b of baris) {
    const m = b.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) { poin.push(m[1]); continue; }
    tutup();
    if (b.trim()) blok.push(<p key={blok.length} className="mt-1.5 first:mt-0"><Baris t={b.replace(/^#+\s*/, '')} onRujuk={onRujuk} /></p>);
  }
  tutup();
  return <div className="text-[15px] leading-relaxed">{blok}</div>;
}

function Kutipan({ s, buka }: { s: Sumber; buka: boolean }) {
  const [open, setOpen] = useState(buka);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (buka) { setOpen(true); ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } }, [buka]);
  return (
    <div ref={ref} className="rounded-xl border border-neutral-200 dark:border-neutral-800">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-2.5 px-3 py-2 text-left">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-neutral-200 px-1 text-[12px] font-bold dark:bg-neutral-800">{s.n}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{s.bagian}</span>
          <span className="block truncate text-[12px] text-neutral-500">{s.judul} · hal. {s.hal}</span>
        </span>
        <Ico n="down" className={`h-4 w-4 shrink-0 text-neutral-400 transition ${open ? 'rotate-180' : ''}`} sw={2} />
      </button>
      {open && (
        <div className="border-t border-neutral-200 px-3 pb-3 pt-2 dark:border-neutral-800">
          <pre className="max-h-80 overflow-auto whitespace-pre font-mono text-[11px] leading-[1.45] text-neutral-700 dark:text-neutral-300">{s.isi}</pre>
          <a href={`/api/sk/berkas/${s.dok}#page=${s.hal}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-10 items-center rounded-lg border border-neutral-300 px-3 text-[13px] font-semibold dark:border-neutral-700">
            Buka PDF hal. {s.hal}
          </a>
        </div>
      )}
    </div>
  );
}

function KartuTanya({ t }: { t: Tanya }) {
  const [rujuk, setRujuk] = useState(0);
  return (
    <div>
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-neutral-900 px-4 py-2.5 text-[15px] text-white dark:bg-white dark:text-neutral-900">{t.q}</div>
      <div className="mt-2 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
        {t.status === 'tunggu' && <p className="animate-pulse text-[15px] text-neutral-500">Mencari di dokumen SK…</p>}
        {t.status === 'gagal' && <p className="text-[15px] text-red-700 dark:text-red-300">{t.error}</p>}
        {t.status === 'ok' && (
          <>
            {t.jawaban ? <Jawaban teks={t.jawaban} onRujuk={(n) => setRujuk(n)} /> : (
              <p className="text-[15px]">{t.catatan || (t.sumber?.length ? 'Bagian SK yang paling sesuai dengan pertanyaan ini:' : '')}</p>
            )}
            {!!t.sumber?.length && (
              <>
                {t.jawaban && <p className="mt-3 text-[12px] font-bold uppercase tracking-wide text-neutral-500">Dasar ketentuan</p>}
                <div className="mt-2 space-y-2">
                  {t.sumber.map((s, i) => <Kutipan key={s.n} s={s} buka={rujuk ? rujuk === s.n : !t.jawaban && i === 0} />)}
                </div>
              </>
            )}
            {t.jawaban && <p className="mt-3 text-[12px] text-neutral-500">Disusun dari ringkasan SK di atas. Untuk keputusan final, cek SK asli atau konfirmasi ke Credit.</p>}
          </>
        )}
      </div>
    </div>
  );
}

// Owner: muat file paket dokumen SK (.json berisi teks + PDF) lalu kirim satu per satu
function Perbarui({ onSelesai }: { onSelesai: () => void }) {
  const [msg, setMsg] = useState('');
  const [jalan, setJalan] = useState(false);
  const pilih = async (f?: File) => {
    if (!f) return;
    setJalan(true); setMsg('Membaca file…');
    try {
      if (!/\.json$/i.test(f.name) && f.type !== 'application/json') throw new Error('Pilih file Paket-SK-Marketing-Kendal.json (bukan PDF).');
      let p: { dokumen?: Record<string, unknown>[] };
      try { p = JSON.parse(await f.text()); } catch { throw new Error('File ini bukan paket dokumen SK.'); }
      const daftar = Array.isArray(p?.dokumen) ? p.dokumen : [];
      if (!daftar.length) throw new Error('File ini bukan paket dokumen SK.');
      for (const [i, d] of daftar.entries()) {
        setMsg(`Mengunggah ${i + 1}/${daftar.length}: ${String(d.judul || d.dok)}…`);
        const r = await fetch('/api/sk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...d, urut: d.urut ?? i + 1 }) });
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || `Gagal mengunggah ${String(d.judul || d.dok)}.`);
      }
      setMsg(`${daftar.length} dokumen SK sudah diperbarui.`);
      onSelesai();
    } catch (e) {
      setMsg((e as Error).message || 'File gagal dibaca.');
    } finally { setJalan(false); }
  };
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
      <p className="text-[13px] font-semibold">Perbarui dokumen SK (owner)</p>
      <p className="mt-0.5 text-[13px] text-neutral-500">Pilih file Paket-SK-Marketing-Kendal.json yang dikirim Claude (cari di folder Download). Dokumen dengan nama sama akan diganti.</p>
      <label className={`mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white dark:bg-white dark:text-neutral-900 ${jalan ? 'pointer-events-none opacity-50' : ''}`}>
        Pilih file paket
        <input type="file" className="sr-only" aria-label="File paket dokumen SK" disabled={jalan} onChange={(e) => { pilih(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      {msg && <p role="status" className="mt-2 text-[13px]">{msg}</p>}
    </div>
  );
}

export default function TanyaSK({ akun, reloadKey = 0 }: { akun: Akun; reloadKey?: number }) {
  const [dok, setDok] = useState<DokSK[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [list, setList] = useState<Tanya[]>([]);
  const akhir = useRef<HTMLDivElement | null>(null);
  const isOwner = akun.role === 'owner';

  const muat = useCallback(async (segar = false) => {
    setErr('');
    try {
      const r = await fetch(`/api/sk${segar ? '?segar=1' : ''}`, { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || 'Dokumen SK gagal dimuat.');
      setDok(j.dok || []);
    } catch (e) { setErr((e as Error).message); setDok([]); }
  }, []);
  useEffect(() => { muat(reloadKey > 0); }, [muat, reloadKey]);

  const kirim = async (teks: string) => {
    const pertanyaan = teks.trim();
    if (pertanyaan.length < 3 || list.some((t) => t.status === 'tunggu')) return;
    const riwayat = list.filter((t) => t.status === 'ok' && t.jawaban).slice(-2).map((t) => ({ q: t.q, a: t.jawaban! }));
    setQ('');
    setList((l) => [...l, { q: pertanyaan, status: 'tunggu' }]);
    setTimeout(() => akhir.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
    let hasil: Tanya;
    try {
      const r = await fetch('/api/sk/tanya', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: pertanyaan, riwayat }) });
      const j = await r.json().catch(() => null);
      hasil = r.ok ? { q: pertanyaan, status: 'ok', jawaban: j.jawaban || '', sumber: j.sumber || [], ai: !!j.ai, catatan: j.catatan }
        : { q: pertanyaan, status: 'gagal', error: j?.error || 'Pertanyaan belum bisa dijawab.' };
    } catch { hasil = { q: pertanyaan, status: 'gagal', error: 'Koneksi bermasalah. Coba lagi.' }; }
    setList((l) => l.map((t, i) => (i === l.length - 1 ? hasil : t)));
  };

  const kosong = dok !== null && !dok.length;
  return (
    <div className="px-4 pb-6 pt-4">
      <section className="rounded-3xl bg-neutral-900 p-5 text-white dark:bg-neutral-900">
        <p className="text-[13px] font-bold uppercase tracking-wide text-neutral-400">Tanya SK</p>
        <p className="mt-1 text-[15px] leading-snug text-neutral-200">Tanyakan masalah approval, deviasi, banding, dokumen kendaraan, survey, atau syarat program MobilKu. Jawaban mengacu ke ringkasan SK di bawah.</p>
        <form onSubmit={(e) => { e.preventDefault(); kirim(q); }} className="mt-3">
          <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2} placeholder="Contoh: siapa yang approve deviasi usia konsumen 65 tahun?"
            aria-label="Pertanyaan" disabled={kosong}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); kirim(q); } }}
            className="w-full resize-none rounded-2xl bg-white px-4 py-3 text-[16px] text-neutral-900 outline-none placeholder:text-neutral-400 disabled:opacity-50" />
          <button type="submit" disabled={kosong || q.trim().length < 3 || list.some((t) => t.status === 'tunggu')}
            className="mt-2 min-h-12 w-full rounded-2xl bg-white text-[15px] font-bold text-neutral-900 disabled:opacity-40">Tanya</button>
        </form>
      </section>

      {!list.length && !kosong && (
        <div className="mt-4">
          <p className="text-[13px] font-semibold text-neutral-500">Contoh pertanyaan</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {CONTOH.map((c) => <button key={c} onClick={() => kirim(c)} className="min-h-10 rounded-full border border-neutral-300 px-3.5 text-left text-[13px] dark:border-neutral-700">{c}</button>)}
          </div>
        </div>
      )}

      {!!list.length && (
        <div className="mt-5 space-y-5">
          {list.map((t, i) => <KartuTanya key={i} t={t} />)}
          <div ref={akhir} />
          <button onClick={() => setList([])} className="min-h-10 text-[13px] font-semibold text-neutral-500">Hapus percakapan</button>
        </div>
      )}

      <p className="mt-8 text-[15px] font-bold">Dokumen SK</p>
      {err && <p className="mt-2 text-[13px] text-red-700 dark:text-red-300">{err}</p>}
      {dok === null ? <p className="mt-2 text-[13px] text-neutral-500">Memuat…</p> : kosong ? (
        <p className="mt-2 text-[14px] text-neutral-500">{isOwner ? 'Dokumen SK belum dimuat. Pilih file paket di bawah.' : 'Dokumen SK belum dimuat oleh owner.'}</p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {dok.map((d) => (
            <a key={d.dok} href={`/api/sk/berkas/${d.dok}`} target="_blank" rel="noreferrer"
              className="flex min-h-16 items-center gap-3 border-b border-neutral-200 px-4 py-2.5 last:border-0 active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[11px] font-black text-red-700 dark:bg-red-950 dark:text-red-300">PDF</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold">{d.judul}</span>
                <span className="line-clamp-2 text-[12px] text-neutral-500">{d.keterangan}</span>
                <span className="block text-[12px] text-neutral-400">{[d.halaman ? `${d.halaman} hal.` : '', mb(d.ukuran), d.diperbarui ? `diperbarui ${tglId(d.diperbarui)}` : ''].filter(Boolean).join(' · ')}</span>
              </span>
              <Ico n="right" className="h-[18px] w-[18px] shrink-0 text-neutral-400" sw={2} />
            </a>
          ))}
        </div>
      )}
      {isOwner && <Perbarui onSelesai={() => muat(true)} />}
    </div>
  );
}
