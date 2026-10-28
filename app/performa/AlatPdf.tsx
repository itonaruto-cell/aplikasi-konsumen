'use client';
// Alat PDF serba guna, semuanya diproses di HP (file konsumen tidak diunggah ke mana pun):
// JPG → PDF, gabung, PDF → JPG, pisah, putar, kompres, buka password.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { buatPdfFoto } from '../../lib/pdf-foto';
import { ambilHalaman, bukaPdf, gabungPdf, muatPdfLib, PdfTerkunci, pdfDariRender, putarHalaman, renderJpeg, thumbnail } from './pdf-alat';
import { keJpeg, kirimFile } from './PdfSurvey';
import { FIELD } from './form';
import { Ico } from './parts';
import { useOverlay } from '../overlay';

type Alat = 'jpg2pdf' | 'gabung' | 'pdf2jpg' | 'pisah' | 'putar' | 'kompres' | 'buka';
const ALAT: { k: Alat; judul: string; sub: string; ikon: string; warna: string }[] = [
  { k: 'jpg2pdf', judul: 'JPG ke PDF', sub: 'Foto jadi 1 PDF', ikon: '🖼️', warna: 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200' },
  { k: 'gabung', judul: 'Gabung PDF', sub: 'Beberapa PDF jadi 1', ikon: '🗂️', warna: 'bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200' },
  { k: 'pdf2jpg', judul: 'PDF ke JPG', sub: 'Halaman jadi foto', ikon: '📷', warna: 'bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200' },
  { k: 'pisah', judul: 'Pisah PDF', sub: 'Ambil halaman tertentu', ikon: '✂️', warna: 'bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200' },
  { k: 'putar', judul: 'Putar PDF', sub: 'Halaman miring / terbalik', ikon: '🔄', warna: 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200' },
  { k: 'kompres', judul: 'Kecilkan PDF', sub: 'Ukuran file lebih kecil', ikon: '🗜️', warna: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' },
  { k: 'buka', judul: 'Buka password', sub: 'Hapus password PDF', ikon: '🔓', warna: 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200' },
];

const mb = (n: number) => (n < 1_048_576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1_048_576).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`);
const dasar = (nama: string) => nama.replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'PDF';
const filePdf = (bytes: Uint8Array, nama: string) => new File([bytes.buffer as ArrayBuffer], `${nama}.pdf`, { type: 'application/pdf' });
const pesanError = (e: unknown) => (e instanceof PdfTerkunci ? e.message : (e as Error)?.message || 'Gagal memproses PDF. Coba lagi.');

/* ---------- Bagian bersama ---------- */
function Kotak({ children }: { children: ReactNode }) {
  return <section className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">{children}</section>;
}
function PilihFile({ label, accept, multiple, onPilih, sibuk, aria }: { label: string; accept: string; multiple?: boolean; onPilih: (f: File[]) => void; sibuk?: boolean; aria: string }) {
  return (
    <label className={`inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 text-[14px] font-semibold dark:border-neutral-700 ${sibuk ? 'pointer-events-none opacity-50' : ''}`}>
      {label}
      <input type="file" accept={accept} multiple={multiple} className="sr-only" aria-label={aria}
        onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) onPilih(fs); }} />
    </label>
  );
}
function Status({ sibuk, pesan }: { sibuk: string; pesan: string }) {
  if (!sibuk && !pesan) return null;
  return <p role="status" className="mt-3 rounded-xl bg-neutral-100 px-3 py-2 text-[13px] leading-snug dark:bg-neutral-900">{sibuk || pesan}</p>;
}
function Tombol({ children, onClick, disabled, utama = true }: { children: ReactNode; onClick: () => void; disabled?: boolean; utama?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`mt-3 min-h-12 w-full rounded-xl px-3 text-[15px] font-bold disabled:opacity-40 ${utama ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'border border-neutral-300 dark:border-neutral-700'}`}>{children}</button>
  );
}
function Urutan<T extends { id: string }>({ list, setList, label, sibuk }: { list: T[]; setList: (f: (x: T[]) => T[]) => void; label: (it: T) => ReactNode; sibuk: boolean }) {
  const geser = (i: number, d: -1 | 1) => setList((x) => { const y = [...x]; const j = i + d; if (j < 0 || j >= y.length) return x; [y[i], y[j]] = [y[j], y[i]]; return y; });
  return (
    <ol className="mt-3 space-y-1.5">
      {list.map((it, i) => (
        <li key={it.id} className="flex items-center gap-2 rounded-xl bg-neutral-100 px-2 py-1.5 dark:bg-neutral-900">
          <span className="w-5 shrink-0 text-center text-[12px] font-bold text-neutral-500">{i + 1}</span>
          <span className="min-w-0 flex-1">{label(it)}</span>
          <button onClick={() => geser(i, -1)} disabled={i === 0 || sibuk} aria-label={`Naikkan nomor ${i + 1}`} className="h-9 w-8 rounded-lg text-[16px] disabled:opacity-25">↑</button>
          <button onClick={() => geser(i, 1)} disabled={i === list.length - 1 || sibuk} aria-label={`Turunkan nomor ${i + 1}`} className="h-9 w-8 rounded-lg text-[16px] disabled:opacity-25">↓</button>
          <button onClick={() => setList((x) => x.filter((y) => y.id !== it.id))} disabled={sibuk} aria-label={`Hapus nomor ${i + 1}`} className="h-9 w-8 rounded-lg text-[15px] text-red-700 disabled:opacity-25 dark:text-red-400">✕</button>
        </li>
      ))}
    </ol>
  );
}
const idAcak = (i: number) => `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`;

/* ---------- PDF yang dibuka + gambar kecil halamannya ---------- */
type Dibuka = { file: File; doc: Awaited<ReturnType<typeof bukaPdf>>['doc']; password?: string };
function useBukaPdf() {
  const [pdf, setPdf] = useState<Dibuka | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState('');
  const versi = useRef(0);
  const buka = async (file: File) => {
    setPesan(''); setSibuk(`Membuka ${file.name}…`);
    const v = ++versi.current;
    try {
      const r = await bukaPdf(file);
      setPdf({ file, doc: r.doc, password: r.password }); setThumbs([]); setSibuk('');
      for (let n = 1; n <= r.doc.numPages && v === versi.current; n++) {
        const t = await thumbnail(r.doc, n).catch(() => '');
        if (v === versi.current) setThumbs((x) => [...x, t]);
      }
    } catch (e) { setSibuk(''); setPesan(pesanError(e)); }
  };
  const tutup = () => { versi.current++; setPdf(null); setThumbs([]); setPesan(''); };
  return { pdf, thumbs, buka, tutup, sibuk, setSibuk, pesan, setPesan };
}
function InfoPdf({ pdf, onGanti }: { pdf: Dibuka; onGanti: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 dark:bg-neutral-900">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold">{pdf.file.name}</span>
        <span className="block text-[12px] text-neutral-500">{pdf.doc.numPages} halaman · {mb(pdf.file.size)}{pdf.password ? ' · berpassword' : ''}</span>
      </span>
      <button onClick={onGanti} className="min-h-9 rounded-lg px-2 text-[13px] font-semibold underline">Ganti</button>
    </div>
  );
}
function Halaman({ thumbs, n, pilih, onTap, putar, label }: { thumbs: string[]; n: number; pilih?: Set<number>; onTap: (i: number) => void; putar?: number[]; label: (i: number) => string }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {Array.from({ length: n }, (_, i) => {
        const on = pilih?.has(i);
        return (
          <button key={i} onClick={() => onTap(i)} aria-pressed={pilih ? on : undefined} aria-label={label(i)}
            className={`relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg border-2 bg-neutral-100 dark:bg-neutral-900 ${on ? 'border-neutral-900 dark:border-white' : 'border-transparent'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {thumbs[i] ? <img src={thumbs[i]} alt="" className="max-h-full max-w-full transition-transform" style={{ transform: putar?.[i] ? `rotate(${putar[i]}deg)` : undefined }} />
              : <span className="text-[11px] text-neutral-400">…</span>}
            <span className={`absolute left-1 top-1 rounded-md px-1.5 text-[11px] font-bold ${on ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-black/55 text-white'}`}>{i + 1}{on ? ' ✓' : ''}</span>
            {putar && <span className="absolute bottom-1 right-1 rounded-md bg-black/55 px-1.5 text-[12px] text-white">↻{putar[i] ? ` ${putar[i]}°` : ''}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- 1. JPG → PDF ---------- */
type Foto = { id: string; nama: string; blob: Blob; w: number; h: number; url: string };
function JpgKePdf() {
  const [list, setList] = useState<Foto[]>([]);
  const [nama, setNama] = useState('');
  const [hemat, setHemat] = useState(false);
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState('');
  const semua = useRef<Foto[]>([]);
  semua.current = list;
  useEffect(() => () => semua.current.forEach((f) => URL.revokeObjectURL(f.url)), []);
  const tambah = async (files: File[]) => {
    setPesan('');
    const baru: Foto[] = [];
    for (const [i, f] of files.entries()) {
      setSibuk(`Menyiapkan foto ${i + 1}/${files.length}…`);
      try { const j = await keJpeg(f, hemat ? 1280 : 1700, hemat ? 0.7 : 0.8); baru.push({ id: idAcak(i), nama: f.name, ...j, url: URL.createObjectURL(j.blob) }); }
      catch { setPesan(`${f.name} tidak bisa dibaca.`); }
    }
    setSibuk(''); setList((x) => [...x, ...baru]);
  };
  const buat = async () => {
    setPesan(''); setSibuk('Membuat PDF…');
    try {
      const hal = await Promise.all(list.map(async (f) => ({ jpeg: new Uint8Array(await f.blob.arrayBuffer()), w: f.w, h: f.h })));
      const judul = nama.trim() || `Foto ${new Date().toLocaleDateString('id-ID').replace(/\//g, '-')}`;
      const file = filePdf(buatPdfFoto(hal, judul), dasar(judul));
      setSibuk(''); await kirimFile([file]);
      setPesan(`PDF siap: ${file.name} (${mb(file.size)}, ${list.length} halaman).`);
    } catch (e) { setSibuk(''); setPesan(pesanError(e)); }
  };
  return (
    <Kotak>
      <div className="flex gap-2">
        <div className="flex-1"><PilihFile label="+ Galeri" accept="image/*" multiple onPilih={tambah} sibuk={!!sibuk} aria="Pilih foto dari galeri" /></div>
        <label className={`inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 text-[14px] font-semibold dark:border-neutral-700 ${sibuk ? 'pointer-events-none opacity-50' : ''}`}>
          + Kamera
          <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label="Ambil foto dengan kamera"
            onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) tambah(fs); }} />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[13px]">
        <span className="text-neutral-500">Kualitas</span>
        {([[false, 'Jelas'], [true, 'Hemat kuota']] as const).map(([v, l]) => (
          <button key={l} onClick={() => setHemat(v)} aria-pressed={hemat === v} className={`min-h-9 rounded-full px-3 font-semibold ${hemat === v ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{l}</button>
        ))}
      </div>
      {list.length > 0 && (<>
        <Urutan list={list} setList={setList} sibuk={!!sibuk} label={(f) => (
          <span className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
            <span className="truncate text-[13px]">{f.nama}</span>
          </span>
        )} />
        <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama file (opsional)" aria-label="Nama file PDF" className={`${FIELD} mt-3 min-h-11`} />
        <Tombol onClick={buat} disabled={!!sibuk}>Buat PDF ({list.length} foto)</Tombol>
      </>)}
      <Status sibuk={sibuk} pesan={pesan} />
    </Kotak>
  );
}

/* ---------- 2. Gabung PDF ---------- */
type ItemPdf = { id: string; file: File };
function GabungPdf() {
  const [list, setList] = useState<ItemPdf[]>([]);
  const [nama, setNama] = useState('');
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState('');
  const gabung = async () => {
    setPesan('');
    try {
      const judul = nama.trim() || `${dasar(list[0].file.name)} - gabungan`;
      const file = filePdf(await gabungPdf(list.map((x) => ({ file: x.file })), judul, setSibuk), dasar(judul));
      setSibuk(''); await kirimFile([file]);
      setPesan(`PDF gabungan siap: ${file.name} (${mb(file.size)}).`);
    } catch (e) { setSibuk(''); setPesan(pesanError(e)); }
  };
  return (
    <Kotak>
      <PilihFile label="+ Pilih PDF" accept="application/pdf,.pdf" multiple onPilih={(fs) => setList((x) => [...x, ...fs.map((file, i) => ({ id: idAcak(i), file }))])} sibuk={!!sibuk} aria="Pilih PDF untuk digabung" />
      <p className="mt-2 text-[12px] text-neutral-500">Urutan PDF di hasil = urutan daftar. PDF berpassword akan ditanya password-nya.</p>
      {list.length > 0 && <Urutan list={list} setList={setList} sibuk={!!sibuk} label={(it) => (<><span className="block truncate text-[13px] font-semibold">{it.file.name}</span><span className="block text-[12px] text-neutral-500">{mb(it.file.size)}</span></>)} />}
      {list.length > 1 && (<>
        <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama file (opsional)" aria-label="Nama file gabungan" className={`${FIELD} mt-3 min-h-11`} />
        <Tombol onClick={gabung} disabled={!!sibuk}>Gabung {list.length} PDF jadi 1</Tombol>
      </>)}
      <Status sibuk={sibuk} pesan={pesan} />
    </Kotak>
  );
}

/* ---------- 3–5. Alat dengan pilihan halaman ---------- */
function PdfKeJpg() {
  const b = useBukaPdf();
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  useEffect(() => { setPilih(new Set(Array.from({ length: b.pdf?.doc.numPages || 0 }, (_, i) => i))); }, [b.pdf]);
  const tap = (i: number) => setPilih((s) => { const t = new Set(s); if (t.has(i)) t.delete(i); else t.add(i); return t; });
  const simpan = async () => {
    if (!b.pdf) return;
    b.setPesan('');
    try {
      const idx = [...pilih].sort((x, y) => x - y);
      const files: File[] = [];
      for (const [k, i] of idx.entries()) {
        b.setSibuk(`Mengubah halaman ${k + 1}/${idx.length}…`);
        const r = await renderJpeg(b.pdf.doc, i + 1, 2, 0.88);
        files.push(new File([r.blob], `${dasar(b.pdf.file.name)} - hal ${i + 1}.jpg`, { type: 'image/jpeg' }));
      }
      b.setSibuk(''); await kirimFile(files);
      b.setPesan(`${files.length} gambar siap.`);
    } catch (e) { b.setSibuk(''); b.setPesan(pesanError(e)); }
  };
  return (
    <Kotak>
      {!b.pdf ? <PilihFile label="+ Pilih PDF" accept="application/pdf,.pdf" onPilih={(f) => b.buka(f[0])} sibuk={!!b.sibuk} aria="Pilih PDF untuk dijadikan JPG" /> : (<>
        <InfoPdf pdf={b.pdf} onGanti={b.tutup} />
        <p className="mt-2 text-[12px] text-neutral-500">Ketuk halaman untuk memilih / batal memilih.</p>
        <Halaman thumbs={b.thumbs} n={b.pdf.doc.numPages} pilih={pilih} onTap={tap} label={(i) => `Halaman ${i + 1}`} />
        <Tombol onClick={simpan} disabled={!!b.sibuk || !pilih.size}>Simpan {pilih.size} halaman jadi JPG</Tombol>
      </>)}
      <Status sibuk={b.sibuk} pesan={b.pesan} />
    </Kotak>
  );
}

function PisahPdf() {
  const b = useBukaPdf();
  const [pilih, setPilih] = useState<Set<number>>(new Set());
  useEffect(() => { setPilih(new Set()); }, [b.pdf]);
  const tap = (i: number) => setPilih((s) => { const t = new Set(s); if (t.has(i)) t.delete(i); else t.add(i); return t; });
  const rentang = (idx: number[]) => idx.reduce<string[]>((a, i, k) => {
    if (k && idx[k - 1] === i - 1) { a[a.length - 1] = `${a[a.length - 1].split('-')[0]}-${i + 1}`; return a; }
    return [...a, String(i + 1)];
  }, []).join(',');
  const ambil = async () => {
    if (!b.pdf) return;
    b.setPesan(''); b.setSibuk('Membuat PDF…');
    try {
      const idx = [...pilih].sort((x, y) => x - y);
      const file = filePdf(await ambilHalaman(b.pdf.file, idx), `${dasar(b.pdf.file.name)} - hal ${rentang(idx)}`);
      b.setSibuk(''); await kirimFile([file]);
      b.setPesan(`PDF siap: ${file.name} (${idx.length} halaman).`);
    } catch (e) { b.setSibuk(''); b.setPesan(pesanError(e)); }
  };
  const perHalaman = async () => {
    if (!b.pdf) return;
    b.setPesan('');
    try {
      const n = b.pdf.doc.numPages, files: File[] = [];
      for (let i = 0; i < n; i++) {
        b.setSibuk(`Memisah halaman ${i + 1}/${n}…`);
        files.push(filePdf(await ambilHalaman(b.pdf.file, [i]), `${dasar(b.pdf.file.name)} - hal ${i + 1}`));
      }
      b.setSibuk(''); await kirimFile(files);
      b.setPesan(`${files.length} PDF siap (1 halaman per file).`);
    } catch (e) { b.setSibuk(''); b.setPesan(pesanError(e)); }
  };
  return (
    <Kotak>
      {!b.pdf ? <PilihFile label="+ Pilih PDF" accept="application/pdf,.pdf" onPilih={(f) => b.buka(f[0])} sibuk={!!b.sibuk} aria="Pilih PDF untuk dipisah" /> : (<>
        <InfoPdf pdf={b.pdf} onGanti={b.tutup} />
        <p className="mt-2 text-[12px] text-neutral-500">Ketuk halaman yang mau diambil.</p>
        <Halaman thumbs={b.thumbs} n={b.pdf.doc.numPages} pilih={pilih} onTap={tap} label={(i) => `Halaman ${i + 1}`} />
        <Tombol onClick={ambil} disabled={!!b.sibuk || !pilih.size}>{pilih.size ? `Ambil halaman ${rentang([...pilih].sort((x, y) => x - y))} jadi 1 PDF` : 'Pilih halaman dulu'}</Tombol>
        {b.pdf.doc.numPages > 1 && <Tombol utama={false} onClick={perHalaman} disabled={!!b.sibuk}>Pisah semua: {b.pdf.doc.numPages} PDF, 1 halaman per file</Tombol>}
      </>)}
      <Status sibuk={b.sibuk} pesan={b.pesan} />
    </Kotak>
  );
}

function PutarPdf() {
  const b = useBukaPdf();
  const [putar, setPutar] = useState<number[]>([]);
  useEffect(() => { setPutar(Array.from({ length: b.pdf?.doc.numPages || 0 }, () => 0)); }, [b.pdf]);
  const tap = (i: number) => setPutar((p) => p.map((d, j) => (j === i ? (d + 90) % 360 : d)));
  const simpan = async () => {
    if (!b.pdf) return;
    b.setPesan(''); b.setSibuk('Menyimpan…');
    try {
      const file = filePdf(await putarHalaman(b.pdf.file, putar), `${dasar(b.pdf.file.name)} - diputar`);
      b.setSibuk(''); await kirimFile([file]);
      b.setPesan(`PDF siap: ${file.name}.`);
    } catch (e) { b.setSibuk(''); b.setPesan(pesanError(e)); }
  };
  const ada = putar.some(Boolean);
  return (
    <Kotak>
      {!b.pdf ? <PilihFile label="+ Pilih PDF" accept="application/pdf,.pdf" onPilih={(f) => b.buka(f[0])} sibuk={!!b.sibuk} aria="Pilih PDF untuk diputar" /> : (<>
        <InfoPdf pdf={b.pdf} onGanti={b.tutup} />
        <p className="mt-2 text-[12px] text-neutral-500">Ketuk halaman untuk memutar 90° searah jarum jam.</p>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setPutar((p) => p.map((d) => (d + 90) % 360))} className="min-h-10 flex-1 rounded-xl bg-neutral-100 text-[13px] font-semibold dark:bg-neutral-800">↻ Putar semua</button>
          <button onClick={() => setPutar((p) => p.map(() => 0))} disabled={!ada} className="min-h-10 flex-1 rounded-xl bg-neutral-100 text-[13px] font-semibold disabled:opacity-40 dark:bg-neutral-800">Kembalikan</button>
        </div>
        <Halaman thumbs={b.thumbs} n={b.pdf.doc.numPages} putar={putar} onTap={tap} label={(i) => `Putar halaman ${i + 1}`} />
        <Tombol onClick={simpan} disabled={!!b.sibuk || !ada}>Simpan PDF</Tombol>
      </>)}
      <Status sibuk={b.sibuk} pesan={b.pesan} />
    </Kotak>
  );
}

/* ---------- 6. Kecilkan ---------- */
const TINGKAT = [
  { k: 'sedang', l: 'Sedang', sub: 'Tetap jelas dibaca', skala: 1.6, q: 0.62 },
  { k: 'kecil', l: 'Kecil sekali', sub: 'Untuk batas unggah ketat', skala: 1.2, q: 0.45 },
] as const;
function KompresPdf() {
  const b = useBukaPdf();
  const [tk, setTk] = useState<(typeof TINGKAT)[number]['k']>('sedang');
  const proses = async () => {
    if (!b.pdf) return;
    b.setPesan('');
    try {
      const t = TINGKAT.find((x) => x.k === tk)!;
      const bytes = await pdfDariRender(b.pdf.doc, t.skala, t.q, dasar(b.pdf.file.name), b.setSibuk);
      b.setSibuk('');
      if (bytes.length >= b.pdf.file.size * 0.95) { b.setPesan(`PDF ini sudah kecil (${mb(b.pdf.file.size)}); hasil kompres tidak lebih kecil, jadi tidak disimpan.${tk === 'sedang' ? ' Coba pilihan "Kecil sekali".' : ''}`); return; }
      const file = filePdf(bytes, `${dasar(b.pdf.file.name)} - kecil`);
      await kirimFile([file]);
      b.setPesan(`Selesai: ${mb(b.pdf.file.size)} → ${mb(file.size)} (${Math.round((1 - file.size / b.pdf.file.size) * 100)}% lebih kecil).`);
    } catch (e) { b.setSibuk(''); b.setPesan(pesanError(e)); }
  };
  return (
    <Kotak>
      {!b.pdf ? <PilihFile label="+ Pilih PDF" accept="application/pdf,.pdf" onPilih={(f) => b.buka(f[0])} sibuk={!!b.sibuk} aria="Pilih PDF untuk dikecilkan" /> : (<>
        <InfoPdf pdf={b.pdf} onGanti={b.tutup} />
        <div role="group" aria-label="Tingkat kompres" className="mt-3 grid grid-cols-2 gap-2">
          {TINGKAT.map((t) => (
            <button key={t.k} onClick={() => setTk(t.k)} aria-pressed={tk === t.k}
              className={`min-h-14 rounded-xl px-2 text-left ${tk === t.k ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
              <span className="block text-[14px] font-bold">{t.l}</span><span className="block text-[12px] opacity-75">{t.sub}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12px] leading-snug text-neutral-500">Halaman disimpan ulang sebagai gambar, jadi tulisan di hasil tidak bisa diblok/disalin. Cocok untuk scan & foto dokumen.</p>
        <Tombol onClick={proses} disabled={!!b.sibuk}>Kecilkan PDF</Tombol>
      </>)}
      <Status sibuk={b.sibuk} pesan={b.pesan} />
    </Kotak>
  );
}

/* ---------- 7. Buka password ---------- */
function BukaPassword() {
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState('');
  const proses = async (file: File) => {
    setPesan(''); setSibuk(`Memeriksa ${file.name}…`);
    try {
      try { await muatPdfLib(file); setSibuk(''); setPesan(`${file.name} tidak dikunci password, jadi tidak perlu dibuka.`); return; }
      catch (e) { if (!(e instanceof PdfTerkunci)) throw e; }
      setSibuk('');
      const { doc } = await bukaPdf(file);
      const bytes = await pdfDariRender(doc, 2, 0.85, dasar(file.name), setSibuk);
      const hasil = filePdf(bytes, `${dasar(file.name)} - tanpa password`);
      setSibuk(''); await kirimFile([hasil]);
      setPesan(`PDF tanpa password siap: ${hasil.name} (${mb(hasil.size)}).`);
    } catch (e) { setSibuk(''); setPesan(pesanError(e)); }
  };
  return (
    <Kotak>
      <PilihFile label="+ Pilih PDF berpassword" accept="application/pdf,.pdf" onPilih={(f) => proses(f[0])} sibuk={!!sibuk} aria="Pilih PDF berpassword" />
      <p className="mt-2 text-[12px] leading-snug text-neutral-500">Password-nya harus diketahui (mis. e-statement bank: biasanya tanggal lahir). Hasilnya PDF tanpa password dengan tampilan sama; tulisan jadi gambar.</p>
      <Status sibuk={sibuk} pesan={pesan} />
    </Kotak>
  );
}

/* ---------- Halaman ---------- */
export default function AlatPdf() {
  const [alat, setAlat] = useState<Alat | null>(null);
  useOverlay(alat !== null, () => setAlat(null));   // tombol kembali: dari alat → daftar alat dulu
  const a = ALAT.find((x) => x.k === alat);
  if (a) return (
    <div className="px-4 pb-10 pt-3">
      <button onClick={() => setAlat(null)} className="flex min-h-11 items-center gap-1 rounded-xl pr-3 text-[14px] font-semibold"><Ico n="left" className="h-5 w-5" sw={2} />Semua alat PDF</button>
      <h2 className="mt-1 text-[20px] font-bold tracking-tight">{a.ikon} {a.judul}</h2>
      {a.k === 'jpg2pdf' ? <JpgKePdf /> : a.k === 'gabung' ? <GabungPdf /> : a.k === 'pdf2jpg' ? <PdfKeJpg /> : a.k === 'pisah' ? <PisahPdf />
        : a.k === 'putar' ? <PutarPdf /> : a.k === 'kompres' ? <KompresPdf /> : <BukaPassword />}
    </div>
  );
  return (
    <div className="px-4 pb-10 pt-4">
      <section className="rounded-3xl bg-neutral-900 p-5 text-white">
        <p className="text-[13px] font-bold uppercase tracking-wide text-neutral-400">Alat PDF</p>
        <p className="mt-1 text-[15px] leading-snug text-neutral-200">Semua diproses di HP ini. File konsumen tidak diunggah ke mana pun.</p>
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {ALAT.map((x) => (
          <button key={x.k} onClick={() => setAlat(x.k)} className={`flex min-h-28 flex-col items-start justify-between rounded-2xl p-4 text-left ${x.warna}`}>
            <span className="text-[28px] leading-none" aria-hidden>{x.ikon}</span>
            <span><span className="block text-[15px] font-bold">{x.judul}</span><span className="block text-[12px] opacity-80">{x.sub}</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}
