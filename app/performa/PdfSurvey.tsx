'use client';
// PDF berkas survey per kategori: foto dikumpulkan per kategori di HP, lalu dijadikan PDF (satu foto per halaman)
// dan dibagikan sekaligus ke WhatsApp. Foto disimpan di HP ini saja (IndexedDB), tidak diunggah ke server,
// jadi tetap ada walau aplikasi ditutup, sampai dihapus dengan "Mulai survey baru".
import { useCallback, useEffect, useRef, useState } from 'react';
import { bagiPdf, buatPdfFoto } from '../../lib/pdf-foto';
import { FIELD } from './form';
import { Ico } from './parts';

export const KATEGORI_PDF: { k: string; nama: string; isi: string }[] = [
  { k: 'mandatory', nama: 'MANDATORY', isi: 'KTP, KK, NPWP' },
  { k: 'absah', nama: 'ABSAH', isi: 'Cek absah: KTP, STNK, BPKB, faktur' },
  { k: 'dokkend', nama: 'DOKUMEN KENDARAAN', isi: 'STNK, BPKB, faktur, kwitansi jual beli, KIR, dsb.' },
  { k: 'fotokend', nama: 'FOTO KENDARAAN', isi: 'Foto unit detail & unit dengan surveyor' },
  { k: 'rumah', nama: 'DOK RUMAH', isi: 'Rekening listrik, web PLN, nota bayar listrik, PBB, dsb.' },
  { k: 'kerja', nama: 'DOK PEKERJAAN', isi: 'Karyawan: slip gaji, ID card, mutasi rekening, dsb.' },
  { k: 'usaha', nama: 'DOK USAHA', isi: 'Wiraswasta: SKU, NIB, izin usaha, nota, mutasi rekening' },
  { k: 'fotousaha', nama: 'FOTO USAHA', isi: 'Foto detail usaha & dengan surveyor' },
  { k: 'survey', nama: 'FOTO SURVEY', isi: 'TTD konsumen & pasangan, foto rumah, cek lingkungan dengan tetangga, dsb.' },
  { k: 'tambahan', nama: 'DOKUMEN TAMBAHAN', isi: 'Foto OTS, form OTS, surat yang diperlukan, foto tambahan, dsb.' },
  { k: 'print', nama: 'PDF PRINT', isi: 'Screenshot Sakpole, SS m-banking, STNK, KTP, KK' },
];

type Foto = { id: string; kat: string; blob: Blob; w: number; h: number; urut: number };
type Info = { nama: string; kualitas: 'normal' | 'hemat' };

/* ---------- Penyimpanan di HP (IndexedDB) ---------- */
const DB = 'mk-pdf-survey';
function bukaDb(): Promise<IDBDatabase> {
  return new Promise((ok, no) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('foto', { keyPath: 'id' }); r.result.createObjectStore('info'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
}
async function db<T>(store: string, mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const d = await bukaDb();
  return new Promise((ok, no) => {
    const tx = d.transaction(store, mode);
    const req = f(tx.objectStore(store));
    tx.oncomplete = () => { ok(req ? req.result : undefined); d.close(); };
    tx.onerror = () => { no(tx.error); d.close(); };
  });
}

/* ---------- Foto → JPEG ---------- */
async function keJpeg(file: File, sisi: number, q: number): Promise<{ blob: Blob; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    let img: CanvasImageSource, w = 0, h = 0;
    try { const bm = await createImageBitmap(file); img = bm; w = bm.width; h = bm.height; } catch {
      const i = await new Promise<HTMLImageElement>((ok, no) => { const x = new Image(); x.onload = () => ok(x); x.onerror = no; x.src = url; });
      img = i; w = i.naturalWidth; h = i.naturalHeight;
    }
    if (!w || !h) throw new Error('rusak');
    const k = Math.min(1, sisi / Math.max(w, h));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
    const g = cv.getContext('2d')!;
    g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/jpeg', q));
    if (!blob) throw new Error('gagal');
    return { blob, w: cv.width, h: cv.height };
  } finally { URL.revokeObjectURL(url); }
}

const namaFile = (kat: string, nama: string, bagian = '') => `${kat}${nama.trim() ? ` - ${nama.trim().toUpperCase()}` : ''}${bagian}.pdf`.replace(/[\\/:*?"<>|]+/g, ' ');
const mb = (n: number) => `${(n / 1_048_576).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;

// Satu kategori bisa jadi beberapa PDF kalau totalnya lebih dari 10 MB (foto tidak dikecilkan)
async function pdfKategori(kat: { nama: string }, foto: Foto[], nama: string): Promise<File[]> {
  const jpeg = await Promise.all(foto.map(async (f) => new Uint8Array(await f.blob.arrayBuffer())));
  const grup = bagiPdf(jpeg.map((x) => x.length));
  return grup.map((idx, g) => {
    const hal = idx.map((i) => ({ jpeg: jpeg[i], w: foto[i].w, h: foto[i].h, catatan: `${kat.nama} - ${nama.trim().toUpperCase() || 'KONSUMEN'} - ${i + 1}/${foto.length}` }));
    const bagian = grup.length > 1 ? ` (${g + 1} dari ${grup.length})` : '';
    const bytes = buatPdfFoto(hal, `${kat.nama} ${nama}${bagian}`);
    return new File([bytes.buffer as ArrayBuffer], namaFile(kat.nama, nama, bagian), { type: 'application/pdf' });
  });
}
async function kirimFile(files: File[]) {
  if (navigator.canShare?.({ files })) {
    try { await navigator.share({ files }); return; } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
  }
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
    await new Promise((r) => setTimeout(r, 400));
  }
}

function Thumb({ f, i, n, kat, onGeser, onPindah, onHapus }: {
  f: Foto; i: number; n: number; kat: string;
  onGeser: (d: -1 | 1) => void; onPindah: (k: string) => void; onHapus: () => void;
}) {
  const [url, setUrl] = useState('');
  useEffect(() => { const u = URL.createObjectURL(f.blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [f.blob]);
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="relative aspect-[4/3] bg-neutral-100 dark:bg-neutral-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt={`${kat} ${i + 1}`} className="h-full w-full object-cover" />}
        <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 text-[11px] font-bold text-white">{i + 1}</span>
      </div>
      <div className="flex items-center justify-between gap-0.5 p-1">
        <button onClick={() => onGeser(-1)} disabled={i === 0} aria-label={`Geser foto ${i + 1} ke kiri`} className="flex h-9 w-8 items-center justify-center rounded-lg disabled:opacity-25"><Ico n="left" className="h-4 w-4" sw={2.2} /></button>
        <select value="" onChange={(e) => e.target.value && onPindah(e.target.value)} aria-label={`Pindahkan foto ${i + 1} ke kategori lain`}
          className="h-9 min-w-0 flex-1 rounded-lg bg-neutral-100 px-1 text-[11px] dark:bg-neutral-900">
          <option value="">Pindah…</option>
          {KATEGORI_PDF.filter((x) => x.nama !== kat).map((x) => <option key={x.k} value={x.k}>{x.nama}</option>)}
        </select>
        <button onClick={() => onGeser(1)} disabled={i === n - 1} aria-label={`Geser foto ${i + 1} ke kanan`} className="flex h-9 w-8 items-center justify-center rounded-lg disabled:opacity-25"><Ico n="right" className="h-4 w-4" sw={2.2} /></button>
        <button onClick={onHapus} aria-label={`Hapus foto ${i + 1}`} className="flex h-9 w-8 items-center justify-center rounded-lg text-red-700 dark:text-red-400"><Ico n="x" className="h-4 w-4" sw={2.2} /></button>
      </div>
    </div>
  );
}

export default function PdfSurvey() {
  const [foto, setFoto] = useState<Foto[] | null>(null);
  const [info, setInfo] = useState<Info>({ nama: '', kualitas: 'normal' });
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState('');
  const [buka, setBuka] = useState<string | null>(null);
  const infoRef = useRef(info);
  infoRef.current = info;

  useEffect(() => {
    (async () => {
      try {
        const [list, inf] = await Promise.all([db<Foto[]>('foto', 'readonly', (s) => s.getAll()), db<Info>('info', 'readonly', (s) => s.get('info'))]);
        setFoto((list || []).sort((a, b) => a.urut - b.urut));
        if (inf) setInfo({ nama: inf.nama || '', kualitas: inf.kualitas === 'hemat' ? 'hemat' : 'normal' });
      } catch { setFoto([]); setPesan('Penyimpanan di HP tidak tersedia. Foto tetap bisa dijadikan PDF, tapi hilang kalau aplikasi ditutup.'); }
    })();
  }, []);
  const simpanInfo = useCallback((x: Info) => { setInfo(x); db('info', 'readwrite', (s) => s.put(x, 'info')).catch(() => {}); }, []);
  const simpanFoto = (list: Foto[]) => Promise.all(list.map((f) => db('foto', 'readwrite', (s) => s.put(f)))).catch(() => {});

  const tambah = async (kat: string, files: File[]) => {
    const [sisi, q] = infoRef.current.kualitas === 'hemat' ? [1280, 0.7] : [1700, 0.8];
    const baru: Foto[] = [];
    let urut = Date.now();
    for (const [i, f] of files.entries()) {
      setSibuk(`Memproses foto ${i + 1}/${files.length}…`);
      try { const j = await keJpeg(f, sisi, q); baru.push({ id: `${urut}-${Math.random().toString(36).slice(2, 8)}`, kat, urut: urut++, ...j }); } catch { setPesan(`Foto ${f.name || i + 1} tidak bisa dibaca.`); }
    }
    setSibuk('');
    await simpanFoto(baru);
    setFoto((x) => [...(x || []), ...baru]);
  };
  const ubah = async (list: Foto[]) => { await simpanFoto(list); setFoto((x) => { const m = new Map(list.map((f) => [f.id, f])); return (x || []).map((f) => m.get(f.id) || f).sort((a, b) => a.urut - b.urut); }); };
  const hapus = async (id: string) => { await db('foto', 'readwrite', (s) => s.delete(id)).catch(() => {}); setFoto((x) => (x || []).filter((f) => f.id !== id)); };
  const geser = (kat: string, i: number, d: -1 | 1) => {
    const l = (foto || []).filter((f) => f.kat === kat);
    const a = l[i], b = l[i + d];
    if (a && b) ubah([{ ...a, urut: b.urut }, { ...b, urut: a.urut }]);
  };
  const mulaiBaru = async () => {
    if (!window.confirm('Hapus semua foto & nama konsumen di halaman ini untuk survey baru?')) return;
    await db('foto', 'readwrite', (s) => s.clear()).catch(() => {});
    setFoto([]); simpanInfo({ ...info, nama: '' }); setPesan('');
  };

  const perKat = (k: string) => (foto || []).filter((f) => f.kat === k);
  const terisi = KATEGORI_PDF.filter((k) => perKat(k.k).length);
  const buatDanKirim = async (kats: typeof KATEGORI_PDF) => {
    if (!kats.length) return;
    setPesan('');
    try {
      const files: File[] = [];
      for (const [i, k] of kats.entries()) { setSibuk(`Membuat PDF ${i + 1}/${kats.length}: ${k.nama}…`); files.push(...(await pdfKategori(k, perKat(k.k), info.nama))); }
      setSibuk('');
      await kirimFile(files);
      setPesan(`${files.length} PDF siap: ${files.map((f) => `${f.name} (${mb(f.size)})`).join(', ')}`);
    } catch { setSibuk(''); setPesan('PDF gagal dibuat. Coba lagi.'); }
  };

  if (foto === null) return <p className="px-4 pt-6 text-[14px] text-neutral-500">Memuat…</p>;
  return (
    <div className="px-4 pb-40 pt-4">
      <section className="rounded-3xl bg-neutral-900 p-5 text-white">
        <p className="text-[13px] font-bold uppercase tracking-wide text-neutral-400">PDF berkas survey</p>
        <p className="mt-1 text-[15px] leading-snug text-neutral-200">Masukkan foto per kategori, lalu jadikan PDF (satu foto per halaman) dan bagikan sekaligus ke WhatsApp.</p>
        <input value={info.nama} onChange={(e) => simpanInfo({ ...info, nama: e.target.value.toUpperCase() })} placeholder="Nama konsumen (untuk nama file)" aria-label="Nama konsumen"
          className="mt-3 min-h-12 w-full rounded-2xl bg-white px-4 text-[16px] text-neutral-900 outline-none placeholder:text-neutral-400" />
        <div className="mt-2 flex items-center gap-2 text-[13px] text-neutral-300">
          <span>Kualitas foto:</span>
          {(['normal', 'hemat'] as const).map((q) => (
            <button key={q} onClick={() => simpanInfo({ ...info, kualitas: q })} aria-pressed={info.kualitas === q}
              className={`min-h-9 rounded-full px-3 font-semibold ${info.kualitas === q ? 'bg-white text-neutral-900' : 'bg-white/10'}`}>{q === 'normal' ? 'Jelas' : 'Hemat kuota'}</button>
          ))}
        </div>
      </section>
      <p className="mt-2 text-[12px] text-neutral-500">Foto tersimpan di HP ini saja (tidak diunggah) sampai diketuk &quot;Mulai survey baru&quot;.</p>

      <div className="mt-3 space-y-2.5">
        {KATEGORI_PDF.map((k) => {
          const l = perKat(k.k);
          const open = buka === k.k;
          return (
            <section key={k.k} className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
              <button onClick={() => setBuka(open ? '' : k.k)} aria-expanded={open} className="flex min-h-16 w-full items-center gap-3 px-4 text-left">
                <span className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-[14px] font-bold ${l.length ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800'}`}>{l.length}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{k.nama}</span>
                  <span className="block truncate text-[12px] text-neutral-500">{k.isi}</span>
                </span>
                <Ico n="down" className={`h-4 w-4 shrink-0 text-neutral-400 transition ${open ? 'rotate-180' : ''}`} sw={2} />
              </button>
              {open && (
                <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
                  {l.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3">
                      {l.map((f, i) => (
                        <Thumb key={f.id} f={f} i={i} n={l.length} kat={k.nama} onGeser={(d) => geser(k.k, i, d)}
                          onPindah={(kat) => ubah([{ ...f, kat, urut: Date.now() }])} onHapus={() => hapus(f.id)} />
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    {([['Galeri', false], ['Kamera', true]] as const).map(([lbl, cam]) => (
                      <label key={lbl} className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-neutral-300 text-[14px] font-semibold dark:border-neutral-700 ${sibuk ? 'pointer-events-none opacity-50' : ''}`}>
                        + {lbl}
                        <input type="file" accept="image/*" multiple={!cam} {...(cam ? { capture: 'environment' as const } : {})} className="sr-only" aria-label={`Tambah foto ${k.nama} dari ${lbl.toLowerCase()}`}
                          onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) tambah(k.k, fs); }} />
                      </label>
                    ))}
                    {l.length > 0 && <button onClick={() => buatDanKirim([k])} disabled={!!sibuk} className="min-h-11 rounded-xl bg-neutral-900 px-4 text-[14px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900">PDF</button>}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {(sibuk || pesan) && <p role="status" className="mt-3 rounded-xl bg-neutral-100 px-3 py-2 text-[13px] leading-snug dark:bg-neutral-900">{sibuk || pesan}</p>}
      {foto.length > 0 && <button onClick={mulaiBaru} className="mt-4 min-h-11 text-[13px] font-semibold text-red-700 underline dark:text-red-400">Mulai survey baru (hapus semua foto)</button>}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 border-t border-neutral-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <button onClick={() => buatDanKirim(terisi)} disabled={!terisi.length || !!sibuk}
          className="mx-auto block min-h-12 w-full max-w-xl rounded-2xl bg-[#0F8048] text-[15px] font-bold text-white disabled:opacity-40">
          {terisi.length ? `Buat & bagikan ${terisi.length} PDF (${foto.length} foto)` : 'Tambahkan foto dulu'}
        </button>
      </div>
    </div>
  );
}
