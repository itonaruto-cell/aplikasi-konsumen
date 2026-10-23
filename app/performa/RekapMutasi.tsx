'use client';
// Rekap mutasi rekening: upload PDF e-statement (Mandiri / BCA), ambil total dana masuk (kredit) per bulan
// dari ringkasan bank, lalu salin rekap + rata-rata ke WhatsApp. PDF dibaca di HP ini saja (pdf.js),
// tidak dikirim ke server.
import { useMemo, useState } from 'react';
import { bacaMutasi, barisDariItem, gabungMutasi, labelBulan, pilihAwal, rataRata, ribuan, teksRekap, type HasilMutasi } from '../../lib/mutasi';

/* ---------- pdf.js dari CDN (dimuat saat pertama dipakai) ---------- */
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: Uint8Array; password?: string }) => { promise: Promise<PdfDoc> };
};
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }> };
const SUMBER: [string, string][] = [
  ['https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs', 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'],
  ['https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.min.mjs', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs'],
];
let muat: Promise<PdfJs> | null = null;
function pdfjs(): Promise<PdfJs> {
  if (muat) return muat;
  // pdf.js 4 memakai Promise.withResolvers; WebView lama belum punya
  const P = Promise as unknown as { withResolvers?: () => unknown };
  if (!P.withResolvers) P.withResolvers = function () { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
  const impor = new Function('u', 'return import(u)') as (u: string) => Promise<PdfJs>;
  const daftar = ((globalThis as { __SUMBER_PDFJS?: [string, string][] }).__SUMBER_PDFJS) || SUMBER;
  muat = (async () => {
    for (const [lib, worker] of daftar) {
      try { const m = await impor(lib); m.GlobalWorkerOptions.workerSrc = worker; return m; } catch { /* coba sumber berikutnya */ }
    }
    muat = null;
    throw new Error('Pembaca PDF tidak bisa dimuat. Cek koneksi internet lalu coba lagi.');
  })();
  return muat;
}

async function bacaPdf(file: File): Promise<string[]> {
  const lib = await pdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  let password: string | undefined;
  for (;;) {
    try {
      const doc = await lib.getDocument({ data: data.slice(), password }).promise;
      const baris: string[] = [];
      for (let p = 1; p <= doc.numPages; p++) baris.push(...barisDariItem((await (await doc.getPage(p)).getTextContent()).items as never));
      return baris;
    } catch (e) {
      if ((e as Error)?.name !== 'PasswordException') throw e;
      const pw = window.prompt(`${file.name} dikunci. Masukkan password PDF${password ? ' (password tadi salah)' : ''}:`);
      if (!pw) throw new Error('PDF dikunci, password tidak diisi.');
      password = pw;
    }
  }
}

type Berkas = { id: string; nama: string; status: 'baca' | 'ok' | 'gagal'; pesan?: string; hasil?: HasilMutasi };
const kunci = (h: Pick<HasilMutasi, 'bank' | 'rekening'>) => `${h.bank}|${h.rekening}`;

export default function RekapMutasi() {
  const [berkas, setBerkas] = useState<Berkas[]>([]);
  const [pilih, setPilih] = useState<Record<string, string[]>>({});   // hanya bank yang bulannya diubah manual
  const [pesan, setPesan] = useState('');

  const grup = useMemo(() => gabungMutasi(berkas.filter((b) => b.hasil).map((b) => b.hasil!)), [berkas]);
  // Bulan terpilih: 3 bulan penuh terakhir, sampai bulannya diubah manual
  const dipilihDi = (g: HasilMutasi) => pilih[kunci(g)] ?? pilihAwal(g.bulan);
  const terpilih = grup.map((g) => ({ ...g, bulan: g.bulan.filter((b) => dipilihDi(g).includes(b.bulan)) }));
  const adaIsi = terpilih.some((g) => g.bulan.length);
  const teks = adaIsi ? teksRekap(terpilih) : '';
  const totalAvg = terpilih.reduce((s, g) => s + (g.bulan.length ? rataRata(g.bulan) : 0), 0);

  const tambah = async (files: File[]) => {
    setPesan('');
    const baru = files.map((f, i) => ({ id: `${Date.now()}-${i}`, nama: f.name, status: 'baca' as const }));
    setBerkas((x) => [...x, ...baru]);
    for (const [i, f] of files.entries()) {
      const id = baru[i].id;
      try {
        const h = bacaMutasi(await bacaPdf(f));
        setBerkas((x) => x.map((b) => (b.id !== id ? b : h
          ? { ...b, status: 'ok', hasil: h }
          : { ...b, status: 'gagal', pesan: 'Format belum dikenali. Saat ini bisa e-statement Mandiri & BCA (PDF asli dari bank, bukan foto/scan).' })));
      } catch (e) {
        setBerkas((x) => x.map((b) => (b.id === id ? { ...b, status: 'gagal', pesan: (e as Error)?.message || 'PDF tidak bisa dibaca.' } : b)));
      }
    }
  };
  const ubahBulan = (g: HasilMutasi, bulan: string) => {
    const l = dipilihDi(g);
    setPilih((x) => ({ ...x, [kunci(g)]: l.includes(bulan) ? l.filter((b) => b !== bulan) : [...l, bulan] }));
  };
  const salin = async () => {
    try { await navigator.clipboard.writeText(teks); setPesan('Rekap tersalin. Tempel di WhatsApp.'); } catch { setPesan('Tidak bisa menyalin otomatis di HP ini. Tekan lama teks di atas untuk menyalin.'); }
  };
  const mulaiBaru = () => { setBerkas([]); setPilih({}); setPesan(''); };

  return (
    <div className="px-4 pb-10 pt-4">
      <section className="rounded-3xl bg-neutral-900 p-5 text-white">
        <p className="text-[13px] font-bold uppercase tracking-wide text-neutral-400">Rekap mutasi rekening</p>
        <p className="mt-1 text-[15px] leading-snug text-neutral-200">Upload PDF mutasi rekening (Mandiri / BCA). Total dana masuk per bulan dan rata-ratanya dihitung otomatis, siap disalin ke WA.</p>
        <label className="mt-3 flex min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-white text-[15px] font-bold text-neutral-900">
          + Pilih PDF mutasi
          <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" aria-label="Pilih PDF mutasi rekening"
            onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) tambah(fs); }} />
        </label>
        <p className="mt-2 text-[12px] text-neutral-400">Boleh beberapa file sekaligus (mis. satu bank satu file, atau satu file per bulan). PDF dibaca di HP ini saja, tidak dikirim ke server.</p>
      </section>

      {berkas.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {berkas.map((b) => (
            <li key={b.id} className="rounded-xl bg-neutral-100 px-3 py-2 text-[13px] dark:bg-neutral-900">
              <span className="block truncate font-semibold">{b.nama}</span>
              <span className={`block ${b.status === 'gagal' ? 'text-red-700 dark:text-red-400' : 'text-neutral-500'}`}>
                {b.status === 'baca' ? 'Membaca…' : b.status === 'gagal' ? b.pesan : `${b.hasil!.bank} · ${b.hasil!.bulan.length} bulan terbaca`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {grup.length > 0 && (
        <div className="mt-4 space-y-3">
          {grup.map((g, i) => {
            const k = kunci(g), dipilih = dipilihDi(g);
            const ini = g.bulan.filter((b) => dipilih.includes(b.bulan));
            return (
              <section key={k} className="rounded-3xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[16px] font-bold">{i + 1}. {g.bank}</h3>
                  <span className="text-[12px] text-neutral-500">{g.rekening}</span>
                </div>
                {g.nama && <p className="text-[12px] text-neutral-500">{g.nama}</p>}
                <div className="mt-2 space-y-1.5" role="group" aria-label={`Bulan ${g.bank}`}>
                  {g.bulan.map((b) => {
                    const on = dipilih.includes(b.bulan);
                    return (
                      <button key={b.bulan} onClick={() => ubahBulan(g, b.bulan)} aria-pressed={on}
                        className={`flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-[14px] ${on ? 'border-neutral-900 dark:border-white' : 'border-neutral-200 opacity-60 dark:border-neutral-800'}`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[12px] font-bold ${on ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900' : 'border-neutral-400'}`}>{on ? '✓' : ''}</span>
                        <span className="flex-1">{labelBulan(b.bulan)} {b.bulan.slice(0, 4)}{!b.penuh && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">belum penuh</span>}</span>
                        <span className="whitespace-nowrap font-semibold">Rp {ribuan(b.kredit)}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 flex justify-between text-[14px]"><span className="text-neutral-500">Rata-rata {ini.length} bulan</span><b>Rp {ribuan(rataRata(ini))}</b></p>
              </section>
            );
          })}
          {adaIsi && (
            <>
              <p className="flex justify-between rounded-2xl bg-neutral-900 px-4 py-3 text-[15px] text-white"><span>Total avg (omzet)</span><b>Rp {ribuan(totalAvg)}</b></p>
              <pre aria-label="Teks rekap" className="whitespace-pre-wrap rounded-2xl bg-neutral-100 p-3 text-[13px] leading-snug dark:bg-neutral-900">{teks}</pre>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={salin} className="min-h-12 rounded-2xl bg-[#0F8048] text-[15px] font-bold text-white">Salin untuk WA</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(teks)}`} target="_blank" rel="noreferrer"
                  className="flex min-h-12 items-center justify-center rounded-2xl border border-neutral-300 text-[15px] font-semibold dark:border-neutral-700">Kirim ke WA</a>
              </div>
            </>
          )}
          {pesan && <p role="status" className="text-[13px] text-neutral-600 dark:text-neutral-400">{pesan}</p>}
          <button onClick={mulaiBaru} className="min-h-11 text-[13px] font-semibold text-red-700 underline dark:text-red-400">Mulai rekap baru</button>
        </div>
      )}
    </div>
  );
}
