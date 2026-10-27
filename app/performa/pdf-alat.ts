'use client';
// Alat PDF di HP (tanpa server): pdf.js untuk membaca teks / membuka PDF berpassword, pdf-lib untuk menggabung.
// Keduanya dimuat dari CDN saat pertama dipakai, jadi tidak menambah ukuran aplikasi.
import { barisDariItem } from '../../lib/mutasi';

/* ---------- pdf.js ---------- */
type Viewport = { width: number; height: number };
type PdfPage = {
  getTextContent: () => Promise<{ items: unknown[] }>;
  getViewport: (o: { scale: number }) => Viewport;
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: Viewport }) => { promise: Promise<void> };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage> };
type PdfJs = { GlobalWorkerOptions: { workerSrc: string }; getDocument: (src: { data: Uint8Array; password?: string }) => { promise: Promise<PdfDoc> } };

// Build "legacy" dulu (membawa polyfill untuk WebView/HP lama), cadangan build biasa dari cdnjs
const SUMBER_PDFJS: [string, string][] = [
  ['https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.mjs', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs'],
  ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'],
];
let muatJs: Promise<PdfJs> | null = null;
export function pdfjs(): Promise<PdfJs> {
  if (muatJs) return muatJs;
  // pdf.js 4 memakai Promise.withResolvers; WebView lama belum punya
  const P = Promise as unknown as { withResolvers?: () => unknown };
  if (!P.withResolvers) P.withResolvers = function () { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
  const impor = new Function('u', 'return import(u)') as (u: string) => Promise<PdfJs>;
  const daftar = (globalThis as { __SUMBER_PDFJS?: [string, string][] }).__SUMBER_PDFJS || SUMBER_PDFJS;
  muatJs = (async () => {
    for (const [lib, worker] of daftar) {
      try { const m = await impor(lib); m.GlobalWorkerOptions.workerSrc = worker; return m; } catch { /* coba sumber berikutnya */ }
    }
    muatJs = null;
    throw new Error('Pembaca PDF tidak bisa dimuat. Cek koneksi internet lalu coba lagi.');
  })();
  return muatJs;
}

// Buka PDF; kalau dikunci, minta password (password yang benar dikembalikan supaya tidak ditanya dua kali)
export async function bukaPdf(file: Blob & { name?: string }, password?: string): Promise<{ doc: PdfDoc; password?: string }> {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  let pw = password, salah = false;
  for (;;) {
    try {
      return { doc: await lib.getDocument({ data: data.slice(), password: pw }).promise, password: pw };
    } catch (e) {
      if ((e as Error)?.name !== 'PasswordException') throw e;
      const isi = window.prompt(`${file.name || 'PDF'} dikunci. Masukkan password PDF${salah ? ' (password tadi salah)' : ''}:`);
      if (!isi) throw new Error('PDF dikunci, password tidak diisi.');
      pw = isi; salah = true;
    }
  }
}

// Semua baris teks PDF (untuk dibaca rekap mutasi)
export async function bacaPdf(file: Blob & { name?: string }, password?: string): Promise<{ baris: string[]; password?: string }> {
  const { doc, password: pw } = await bukaPdf(file, password);
  const baris: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) baris.push(...barisDariItem((await (await doc.getPage(p)).getTextContent()).items as never));
  return { baris, password: pw };
}

/* ---------- pdf-lib ---------- */
type PdfLibDoc = {
  getPageIndices: () => number[];
  copyPages: (src: PdfLibDoc, idx: number[]) => Promise<unknown[]>;
  addPage: (p?: unknown) => { drawImage: (img: unknown, o: { x: number; y: number; width: number; height: number }) => void };
  embedJpg: (b: Uint8Array) => Promise<unknown>;
  save: () => Promise<Uint8Array>;
  setTitle: (t: string) => void;
  setProducer: (t: string) => void;
  getPages: () => { getRotation: () => { angle: number }; setRotation: (d: unknown) => void }[];
  getPageCount: () => number;
};
type PdfLib = { PDFDocument: { create: () => Promise<PdfLibDoc>; load: (b: Uint8Array, o?: { ignoreEncryption?: boolean }) => Promise<PdfLibDoc> }; degrees: (n: number) => unknown };
const SUMBER_PDFLIB = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
];
let muatLib: Promise<PdfLib> | null = null;
export function pdfLib(): Promise<PdfLib> {
  const w = globalThis as { PDFLib?: PdfLib; __SUMBER_PDFLIB?: string[] };
  if (w.PDFLib) return Promise.resolve(w.PDFLib);
  if (muatLib) return muatLib;
  const skrip = (src: string) => new Promise<void>((ok, no) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = () => ok(); s.onerror = () => { s.remove(); no(new Error('gagal')); };
    document.head.appendChild(s);
  });
  muatLib = (async () => {
    for (const src of w.__SUMBER_PDFLIB || SUMBER_PDFLIB) {
      try { await skrip(src); if (w.PDFLib) return w.PDFLib; } catch { /* coba sumber berikutnya */ }
    }
    muatLib = null;
    throw new Error('Alat penggabung PDF tidak bisa dimuat. Cek koneksi internet lalu coba lagi.');
  })();
  return muatLib;
}

// Gabungkan beberapa PDF (urutan sesuai daftar) jadi satu. PDF biasa disalin apa adanya (teks tetap bisa dibaca);
// PDF berpassword dibuka dengan pdf.js lalu tiap halamannya dimasukkan sebagai gambar.
export async function gabungPdf(daftar: { file: Blob & { name?: string }; password?: string }[], judul = '', progres?: (s: string) => void): Promise<Uint8Array> {
  const { PDFDocument } = await pdfLib();
  const out = await PDFDocument.create();
  for (const [i, it] of daftar.entries()) {
    progres?.(`Menggabung ${i + 1}/${daftar.length}: ${it.file.name || 'PDF'}…`);
    const bytes = new Uint8Array(await it.file.arrayBuffer());
    let src: PdfLibDoc | null = null;
    try { src = await PDFDocument.load(bytes); } catch (e) {
      if (!/encrypt/i.test(String((e as Error)?.message || e))) throw new Error(`${it.file.name || 'PDF'} tidak bisa dibaca (rusak / bukan PDF).`);
    }
    if (src) {
      for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
      continue;
    }
    // Terkunci: render tiap halaman jadi gambar JPEG
    const { doc } = await bukaPdf(it.file, it.password);
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const ukuran = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 2 });
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      const g = cv.getContext('2d')!;
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/jpeg', 0.85));
      if (!blob) throw new Error('Halaman PDF gagal diubah.');
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      out.addPage([ukuran.width, ukuran.height]).drawImage(img, { x: 0, y: 0, width: ukuran.width, height: ukuran.height });
    }
  }
  if (judul) out.setTitle(judul);
  out.setProducer('Marketing Kendal');
  return out.save();
}

/* ---------- Alat PDF umum ---------- */
export class PdfTerkunci extends Error { constructor(nama: string) { super(`${nama} dikunci password. Buka dulu dengan "Unlock PDF".`); } }

// Muat dengan pdf-lib; PDF berpassword ditolak dengan pesan yang jelas
export async function muatPdfLib(file: Blob & { name?: string }): Promise<PdfLibDoc> {
  const { PDFDocument } = await pdfLib();
  try { return await PDFDocument.load(new Uint8Array(await file.arrayBuffer())); } catch (e) {
    if (/encrypt/i.test(String((e as Error)?.message || e))) throw new PdfTerkunci(file.name || 'PDF');
    throw new Error(`${file.name || 'PDF'} tidak bisa dibaca (rusak / bukan PDF).`);
  }
}

// Satu halaman pdf.js → JPEG (ukuran halaman asli dalam point ikut dikembalikan)
export async function renderJpeg(doc: PdfDoc, n: number, skala = 2, q = 0.85): Promise<{ blob: Blob; w: number; h: number; ptW: number; ptH: number }> {
  const page = await doc.getPage(n);
  const ukuran = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: skala });
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
  const g = cv.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/jpeg', q));
  cv.width = cv.height = 0;
  if (!blob) throw new Error('Halaman PDF gagal diubah.');
  return { blob, w: Math.ceil(vp.width), h: Math.ceil(vp.height), ptW: ukuran.width, ptH: ukuran.height };
}

// Gambar kecil tiap halaman (untuk memilih / memutar)
export async function thumbnail(doc: PdfDoc, n: number, lebar = 160): Promise<string> {
  const page = await doc.getPage(n);
  const k = lebar / page.getViewport({ scale: 1 }).width;
  const vp = page.getViewport({ scale: k });
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
  const g = cv.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  return cv.toDataURL('image/jpeg', 0.7);
}

// Halaman-halaman jadi PDF baru dari gambar (dipakai kompres & buka kunci)
export async function pdfDariRender(doc: PdfDoc, skala: number, q: number, judul = '', progres?: (s: string) => void): Promise<Uint8Array> {
  const { PDFDocument } = await pdfLib();
  const out = await PDFDocument.create();
  for (let n = 1; n <= doc.numPages; n++) {
    progres?.(`Memproses halaman ${n}/${doc.numPages}…`);
    const r = await renderJpeg(doc, n, skala, q);
    const img = await out.embedJpg(new Uint8Array(await r.blob.arrayBuffer()));
    out.addPage([r.ptW, r.ptH]).drawImage(img, { x: 0, y: 0, width: r.ptW, height: r.ptH });
  }
  if (judul) out.setTitle(judul);
  out.setProducer('Marketing Kendal');
  return out.save();
}

// Ambil halaman tertentu (indeks mulai 0) jadi PDF baru
export async function ambilHalaman(file: Blob & { name?: string }, idx: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await pdfLib();
  const src = await muatPdfLib(file);
  const out = await PDFDocument.create();
  for (const p of await out.copyPages(src, idx)) out.addPage(p);
  out.setProducer('Marketing Kendal');
  return out.save();
}

// Putar halaman: putar[i] = derajat tambahan (kelipatan 90) untuk halaman i
export async function putarHalaman(file: Blob & { name?: string }, putar: number[]): Promise<Uint8Array> {
  const { degrees } = await pdfLib();
  const doc = await muatPdfLib(file);
  doc.getPages().forEach((pg, i) => {
    const d = ((putar[i] || 0) % 360 + 360) % 360;
    if (d) pg.setRotation(degrees((pg.getRotation().angle + d) % 360));
  });
  return doc.save();
}
