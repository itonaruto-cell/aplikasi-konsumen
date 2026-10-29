'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  C6, KAT_FOTO, daftarDok, type DokItem, bacaSlik, bandingBaru, ltv, namaFileBanding, otrTaksasi, rapikanBanding, rataMarket, saranReasonMh, saranSwot, teksWaBanding, tglPanjang,
  type Banding, type Cek, type FotoBanding, type KatFoto, type WaBanding,
} from '../../lib/banding-types';
import { GAYA_BANDING, buatFormBanding, susunBanding, type FotoFile } from '../../lib/banding-xlsx';
import PreviewLembar, { ukuranLembar } from './PreviewLembar';
import { useOverlay } from '../overlay';
import { TIPE_XLSX } from '../../lib/xlsx-mini';
import { todayJkt } from '../../lib/performa-calc';
import { AngkaInput, FIELD } from './form';
import { Ico } from './parts';
import { ambilDraf, bacaBuka, hapusDraf, idBandingBaru, lepasBuka, pilihAwal, rapikanDraf, simpanDraf, tandaiBuka } from '../../lib/banding-draf';

type Akun = { email: string; name?: string; role: 'owner' | 'spv' | 'konsumen' | 'tim'; perfName?: string | null };

/* ---------- Foto: diperkecil di HP (dokumen perlu terbaca, jadi mulai 1400 px) ---------- */
const MAKS_B64 = 175_000;
export async function kecilkan(file: File): Promise<{ mime: string; data: string }> {
  const url = URL.createObjectURL(file);
  try {
    let img: CanvasImageSource, w = 0, h = 0;
    try { const bm = await createImageBitmap(file); img = bm; w = bm.width; h = bm.height; } catch {
      const i = await new Promise<HTMLImageElement>((ok, no) => { const x = new Image(); x.onload = () => ok(x); x.onerror = no; x.src = url; });
      img = i; w = i.naturalWidth; h = i.naturalHeight;
    }
    if (!w || !h) throw new Error('rusak');
    for (const [sisi, q] of [[1400, 0.72], [1200, 0.66], [1000, 0.62], [880, 0.55], [720, 0.5], [600, 0.45]] as const) {
      const k = Math.min(1, sisi / Math.max(w, h));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      const g = cv.getContext('2d');
      if (!g) break;
      g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      const d = cv.toDataURL('image/jpeg', q);
      const data = d.slice(d.indexOf(',') + 1);
      if (data.length <= MAKS_B64) return { mime: 'image/jpeg', data };
    }
    throw new Error('besar');
  } finally { URL.revokeObjectURL(url); }
}

async function ambilFoto(f: FotoBanding): Promise<FotoFile | null> {
  try {
    const r = await fetch(`/api/foto/${encodeURIComponent(f.id)}`);
    if (!r.ok) return null;
    const blob = await r.blob();
    const bm = await createImageBitmap(blob);
    return { kat: f.kat, ket: f.ket, data: new Uint8Array(await blob.arrayBuffer()), ext: blob.type === 'image/png' ? 'png' : 'jpeg', w: bm.width, h: bm.height, src: `/api/foto/${encodeURIComponent(f.id)}` };
  } catch { return null; }
}

/* ---------- Bagian kecil ---------- */
const TA = `${FIELD} py-2.5 leading-relaxed`;
export function Bagian({ judul, sub, children, buka = true }: { judul: string; sub?: string; children: ReactNode; buka?: boolean }) {
  const [open, setOpen] = useState(buka);
  return (
    <section className="mt-3 rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">{judul}</span>
          {sub && <span className="block truncate text-[12px] text-neutral-500">{sub}</span>}
        </span>
        <Ico n="down" className={`h-4 w-4 shrink-0 text-neutral-400 transition ${open ? 'rotate-180' : ''}`} sw={2} />
      </button>
      {open && <div className="border-t border-neutral-200 px-4 pb-4 pt-3 dark:border-neutral-800">{children}</div>}
    </section>
  );
}
export function Isian({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="block text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">{label}</span>
      {hint && <span className="block text-[12px] text-neutral-500">{hint}</span>}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
export function Teks({ value, onChange, rows = 4, placeholder, label }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; label: string }) {
  return <textarea aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} className={TA} />;
}
function TigaPilih({ value, onChange, label }: { value: Cek; onChange: (v: Cek) => void; label: string }) {
  const opsi: [Cek, string, string][] = [['valid', 'Valid', 'bg-green-700 text-white'], ['tidak', 'Tidak valid', 'bg-red-700 text-white'], ['', '–', 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900']];
  return (
    <div role="group" aria-label={label} className="flex shrink-0 gap-1">
      {opsi.map(([k, l, on]) => (
        <button key={l} onClick={() => onChange(k)} aria-pressed={value === k}
          className={`min-h-9 rounded-lg px-2.5 text-[12px] font-bold ${value === k ? on : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>{l}</button>
      ))}
    </div>
  );
}

/* ---------- Lampiran foto ---------- */
function FotoKat({ kat, label, foto, onTambah, onUbah, onHapus, sibuk }: {
  kat: KatFoto; label: string; foto: FotoBanding[]; sibuk: boolean;
  onTambah: (kat: KatFoto, files: File[]) => void; onUbah: (id: string, ket: string) => void; onHapus: (id: string) => void;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <p className="text-[13px] font-bold">{label} <span className="font-normal text-neutral-500">· {foto.length} foto</span></p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {foto.map((f, i) => (
          <div key={f.id} className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
            <a href={`/api/foto/${encodeURIComponent(f.id)}`} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-neutral-100 dark:bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/foto/${encodeURIComponent(f.id)}`} alt={f.ket || `${label} ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
            </a>
            <div className="flex items-center gap-1 p-1.5">
              <input value={f.ket} onChange={(e) => onUbah(f.id, e.target.value)} placeholder="Keterangan (mis. KTP)" aria-label={`Keterangan foto ${label} ${i + 1}`}
                className="min-h-9 min-w-0 flex-1 rounded-lg bg-neutral-100 px-2 text-[13px] outline-none dark:bg-neutral-900" />
              <button onClick={() => onHapus(f.id)} aria-label={`Hapus foto ${label} ${i + 1}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-700 dark:text-red-400"><Ico n="x" className="h-4 w-4" sw={2.2} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {([['Galeri', false], ['Kamera', true]] as const).map(([l, cam]) => (
          <label key={l} className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-neutral-300 text-[14px] font-semibold dark:border-neutral-700 ${sibuk ? 'pointer-events-none opacity-50' : ''}`}>
            + {l}
            <input type="file" accept="image/*" multiple={!cam} {...(cam ? { capture: 'environment' as const } : {})} className="sr-only" aria-label={`Tambah foto ${label} dari ${l.toLowerCase()}`}
              onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) onTambah(kat, fs); }} />
          </label>
        ))}
      </div>
    </div>
  );
}

/* ---------- Unduh & pratinjau ---------- */
type Siap = { b: Banding; fotos: FotoFile[] };
async function simpanFile(x: Siap, bagikan: boolean) {
  const bytes = buatFormBanding(x.b, x.fotos);
  const nama = `${namaFileBanding(x.b)}.xlsx`;
  const file = new File([bytes.buffer as ArrayBuffer], nama, { type: TIPE_XLSX });
  if (bagikan && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nama }); return; } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = nama; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function Pratinjau({ siap, onTutup, onUnduh }: { siap: Siap; onTutup: () => void; onUnduh: (bagikan: boolean) => void }) {
  useOverlay(true, onTutup);
  const lembar = susunBanding(siap.b, siap.fotos);
  const [tab, setTab] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [lebarLayar, setLebarLayar] = useState(380);
  useEffect(() => {
    const f = () => setLebarLayar(Math.min(window.innerWidth, 1100));
    f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);
  const l = lembar[Math.min(tab, lembar.length - 1)];
  const { w } = ukuranLembar(l);
  const pas = (lebarLayar - 16) / w;
  const skala = zoom ? Math.max(pas, 0.5) : pas;
  return (
    <div role="dialog" aria-label="Preview Excel" className="fixed inset-0 z-[80] flex flex-col bg-neutral-200 dark:bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-neutral-300 bg-white px-2 pb-2 pt-[calc(env(safe-area-inset-top)+8px)] dark:border-neutral-800 dark:bg-neutral-950">
        <button onClick={onTutup} className="min-h-11 rounded-xl px-3 text-[14px] font-semibold">Tutup</button>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{namaFileBanding(siap.b)}.xlsx</span>
        <button onClick={() => setZoom(!zoom)} aria-pressed={zoom} className="min-h-11 rounded-xl border border-neutral-300 px-3 text-[13px] font-semibold dark:border-neutral-700">{zoom ? 'Pas layar' : 'Perbesar'}</button>
      </div>
      {lembar.length > 1 && (
        <div role="tablist" className="flex gap-1 bg-white px-2 py-1.5 dark:bg-neutral-950">
          {lembar.map((x, i) => <button key={x.nama} role="tab" aria-selected={tab === i} onClick={() => setTab(i)} className={`min-h-9 rounded-lg px-3 text-[13px] font-semibold ${tab === i ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{x.nama}</button>)}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <div className="mx-auto w-fit shadow-lg"><PreviewLembar lembar={l} gaya={GAYA_BANDING} skala={skala} /></div>
        <p className="mt-2 text-center text-[12px] text-neutral-600 dark:text-neutral-400">Tampilan sama dengan file yang diunduh. Ketuk Perbesar untuk membaca tulisan, geser untuk melihat sisi kanan.</p>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-neutral-300 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2.5 dark:border-neutral-800 dark:bg-neutral-950">
        <button onClick={() => onUnduh(false)} className="min-h-12 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white dark:bg-white dark:text-neutral-900">Unduh Excel</button>
        <button onClick={() => onUnduh(true)} className="min-h-12 rounded-2xl bg-[#0F8048] px-4 text-[15px] font-bold text-white">Bagikan</button>
      </div>
    </div>
  );
}

/* ---------- Editor ---------- */
function Editor({ awal, akun, onTutup, onSimpan, lembarAwal = 'form' }: { awal: Banding; akun: Akun; onTutup: () => void; onSimpan: (b: Banding) => void; lembarAwal?: 'form' | 'wa' }) {
  useOverlay(true, onTutup);   // tombol kembali menutup form dulu, baru keluar dari halaman
  // Isian yang belum terkirim (mis. tab dimatikan Android saat pindah ke WA) dipulihkan dari draf di HP
  const [mulai] = useState(() => { const d = ambilDraf(awal.id); return { ...pilihAwal(awal, d), idBaru: d?.idBaru }; });
  const [b, setB] = useState<Banding>(mulai.b);
  const [simpan, setSimpan] = useState<'' | 'menyimpan' | 'tersimpan' | 'gagal'>(awal.id && !mulai.dariDraf ? 'tersimpan' : '');
  const [pesan, setPesan] = useState(mulai.dariDraf ? 'Isian yang belum tersimpan dipulihkan dari HP.' : '');
  const [upload, setUpload] = useState('');
  const [unduh, setUnduh] = useState(false);
  const [pratinjau, setPratinjau] = useState<Siap | null>(null);
  const ubah = useRef(0);
  const kotor = useRef(mulai.dariDraf);
  const terakhir = useRef(b);
  terakhir.current = b;
  const simpanRef = useRef(simpan);
  simpanRef.current = simpan;
  const set = <K extends keyof Banding>(k: K, v: Banding[K]) => { setB((x) => ({ ...x, [k]: v })); ubah.current++; kotor.current = true; setSimpan(''); };
  const setWa = <K extends keyof WaBanding>(k: K, v: WaBanding[K]) => { setB((x) => ({ ...x, wa: { ...x.wa, [k]: v } })); ubah.current++; kotor.current = true; setSimpan(''); };
  const [pesanWa, setPesanWa] = useState('');
  const [lembar, setLembar] = useState<'form' | 'wa'>(lembarAwal);
  const salinWa = async () => {
    try { await navigator.clipboard.writeText(teksWaBanding(terakhir.current)); setPesanWa('Teks tersalin. Tempel di WhatsApp BU Head.'); }
    catch { setPesanWa('Tidak bisa menyalin otomatis. Tekan lama teks di atas untuk menyalin.'); }
  };

  // Form baru langsung punya id dari HP, jadi simpan ulang tidak pernah membuat form dobel
  const idBaru = useRef(mulai.idBaru || idBandingBaru());
  const sudahAda = useRef(!!awal.id);
  const antre = useRef<Promise<unknown>>(Promise.resolve());

  // Draf ke HP setiap ada perubahan; dibuang setelah tersimpan di server
  useEffect(() => {
    if (simpan === 'tersimpan') { hapusDraf(b.id); return; }
    if (kotor.current) simpanDraf(b.id, b, b.id ? undefined : idBaru.current);
  }, [b, simpan]);
  // Tandai form yang sedang terbuka + lembarnya, supaya terbuka lagi kalau halaman dimuat ulang
  useEffect(() => { tandaiBuka(b.id, lembar); }, [b.id, lembar]);
  useEffect(() => () => lepasBuka(), []);

  const kirimSekarang = useCallback(async (keepalive: boolean): Promise<Banding | null> => {
    const data = terakhir.current;
    if (!data.nama.trim() && !data.appNo.trim()) return null;
    setSimpan('menyimpan');
    const n = ubah.current;
    const wasBaru = !data.id;
    try {
      const body = JSON.stringify({ banding: { ...data, id: data.id || idBaru.current }, baru: !sudahAda.current });
      const r = await fetch('/api/banding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: keepalive && body.length < 60_000 });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || 'Gagal menyimpan.');
      const hasil = j.banding as Banding;
      sudahAda.current = true;
      if (wasBaru) hapusDraf('');
      setB((x) => ({ ...x, id: hasil.id, dibuat: hasil.dibuat, diubah: hasil.diubah, oleh: hasil.oleh }));
      if (n === ubah.current) { kotor.current = false; setSimpan('tersimpan'); } else setSimpan('');
      onSimpan(hasil);
      return hasil;
    } catch (e) { setSimpan('gagal'); setPesan((e as Error).message); return null; }
  }, [onSimpan]);
  // Satu per satu, supaya dua simpanan tidak saling mendahului
  const kirim = useCallback((keepalive = false): Promise<Banding | null> => {
    const p = antre.current.then(() => kirimSekarang(keepalive));
    antre.current = p.catch(() => null);
    return p;
  }, [kirimSekarang]);

  // Simpan otomatis 2 detik setelah berhenti mengetik
  useEffect(() => {
    if (simpan !== '') return;
    const t = setTimeout(() => { kirim(); }, 2000);
    return () => clearTimeout(t);
  }, [b, simpan, kirim]);

  // Pindah ke WA/aplikasi lain → simpan saat itu juga (tidak menunggu 2 detik); kembali → coba lagi bila gagal
  useEffect(() => {
    const pergi = () => { if (simpanRef.current === '' || simpanRef.current === 'gagal') kirim(true); };
    const onVis = () => {
      if (document.visibilityState === 'hidden') pergi();
      else if (simpanRef.current === 'gagal') kirim();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', pergi);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', pergi); };
  }, [kirim]);

  const tambahFoto = async (kat: KatFoto, files: File[]) => {
    const baru: FotoBanding[] = [];
    for (const [i, f] of files.entries()) {
      setUpload(`Mengunggah foto ${i + 1}/${files.length}…`);
      try {
        const k = await kecilkan(f);
        const r = await fetch('/api/banding/foto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(k) });
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || 'gagal');
        baru.push({ id: j.id, kat, ket: '' });
      } catch (e) { setPesan(`Foto ${f.name || i + 1} gagal diunggah${(e as Error).message === 'besar' ? ' (terlalu besar)' : ''}.`); }
    }
    setUpload('');
    if (baru.length) set('foto', [...terakhir.current.foto, ...baru]);
  };

  // Simpan dulu, lalu muat foto: dipakai untuk pratinjau dan unduhan (hasilnya sama persis)
  const siapkan = async (): Promise<Siap | null> => {
    setUnduh(true); setPesan('');
    try {
      const tersimpan = (await kirim()) || terakhir.current;
      const fotos = (await Promise.all(tersimpan.foto.map(ambilFoto))).filter((x): x is FotoFile => !!x);
      if (fotos.length < tersimpan.foto.length) setPesan(`${tersimpan.foto.length - fotos.length} foto tidak bisa dimuat dan tidak ikut di Excel.`);
      return { b: tersimpan, fotos };
    } catch { setPesan('Data form belum bisa disiapkan. Coba lagi.'); return null; } finally { setUnduh(false); }
  };
  const unduhExcel = async (bagikan: boolean, siap?: Siap | null) => {
    const x = siap || (await siapkan());
    if (!x) return;
    try { await simpanFile(x, bagikan); } catch { setPesan('Excel gagal dibuat. Coba lagi.'); }
  };
  const bukaPreview = async () => { const x = await siapkan(); if (x) setPratinjau(x); };


  const nSlik = Math.max(0, bacaSlik(b.slik).length - 1);
  const dokList = daftarDok(b);
  const isiCek = dokList.filter((d) => d.cek).length;
  const ubahDok = (list: DokItem[]) => set('dokList', list);
  const status = simpan === 'menyimpan' ? 'Menyimpan…' : simpan === 'tersimpan' ? 'Tersimpan' : simpan === 'gagal' ? 'Gagal tersimpan' : b.nama || b.appNo ? 'Belum tersimpan' : 'Isi nama konsumen dulu';

  return (
    <div className="px-4 pb-40 pt-3">
      <div className="flex items-center gap-2">
        <button onClick={onTutup} className="flex min-h-11 items-center gap-1 rounded-xl pr-3 text-[14px] font-semibold"><Ico n="left" className="h-5 w-5" sw={2} />Daftar banding</button>
        <span role="status" className={`ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold ${simpan === 'gagal' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : simpan === 'tersimpan' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>{status}</span>
      </div>

      <div role="tablist" aria-label="Lembar banding" className="mt-2 grid grid-cols-2 gap-1 rounded-2xl bg-neutral-100 p-1 dark:bg-neutral-900">
        {([['form', 'Form F-761 (Excel)'], ['wa', 'WA BU Head']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={lembar === k} onClick={() => { setLembar(k); window.scrollTo(0, 0); }}
            className={`min-h-11 rounded-xl text-[14px] font-bold ${lembar === k ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white' : 'text-neutral-500'}`}>{l}</button>
        ))}
      </div>

      {lembar === 'form' && (<>
        <Bagian judul="Data aplikasi" sub={[b.nama, b.appNo].filter(Boolean).join(' · ') || 'App No, nama konsumen, BH, tanggal'}>
          <Isian label="App No."><input value={b.appNo} onChange={(e) => set('appNo', e.target.value.toUpperCase())} placeholder="APP0631…" className={`${FIELD} min-h-11 font-mono`} /></Isian>
          <Isian label="Nama konsumen"><input value={b.nama} onChange={(e) => set('nama', e.target.value.toUpperCase())} className={`${FIELD} min-h-11`} /></Isian>
          <Isian label="Brand">
            <div className="flex gap-2">{(['MOBILKU', 'MOTORKU'] as const).map((x) => <button key={x} onClick={() => set('brand', x)} aria-pressed={b.brand === x} className={`min-h-11 flex-1 rounded-xl text-[14px] font-bold ${b.brand === x ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{x}</button>)}</div>
          </Isian>
          <div className="grid grid-cols-2 gap-3">
            <Isian label="Cabang"><input value={b.cabang} onChange={(e) => set('cabang', e.target.value.toUpperCase())} className={`${FIELD} min-h-11`} /></Isian>
            <Isian label="Tanggal banding"><input type="date" value={b.tanggal} onChange={(e) => set('tanggal', e.target.value)} className={`${FIELD} min-h-11`} /></Isian>
          </div>
          <Isian label="Nama Branch Head"><input value={b.bh} onChange={(e) => set('bh', e.target.value.toUpperCase())} className={`${FIELD} min-h-11`} /></Isian>
        </Bagian>

        <Bagian judul="Reason reject" sub={b.rejectCredit ? `${b.rejectCredit.slice(0, 60)}…` : 'Tempel reason reject CAC dari sistem'}>
          <Isian label="Reason reject Credit (CAC)" hint="Tempel apa adanya dari sistem, termasuk profil, Pefindo, dan rekomendasi CAC.">
            <Teks label="Reason reject Credit" value={b.rejectCredit} onChange={(v) => set('rejectCredit', v)} rows={8} />
          </Isian>
          <Isian label="Reason reject Area Credit & AMU Manager (kalau ada)"><Teks label="Reason reject CAM" value={b.rejectCam} onChange={(v) => set('rejectCam', v)} rows={3} /></Isian>
          <Isian label="Reason reject Credit Dept Head (kalau ada)"><Teks label="Reason reject CDH" value={b.rejectCdh} onChange={(v) => set('rejectCdh', v)} rows={3} /></Isian>
        </Bagian>

        <Bagian judul="Checklist dokumen" sub={`${isiCek}/${dokList.length} dicek · nama dokumen bisa diubah`} buka={false}>
          {KAT_FOTO.map(([kat, label]) => (
            <div key={kat} className="mt-3 first:mt-0">
              <p className="text-[12px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
              {dokList.filter((d) => d.grup === kat).map((d) => (
                <div key={d.id} className="border-b border-neutral-100 py-2 dark:border-neutral-900">
                  <div className="flex items-start gap-1">
                    <textarea value={d.label} rows={1} onChange={(e) => ubahDok(dokList.map((x) => (x.id === d.id ? { ...x, label: e.target.value.toUpperCase().replace(/\n/g, ' ') } : x)))}
                      placeholder="Nama dokumen" aria-label={`Nama dokumen ${d.label}`}
                      className="min-h-9 min-w-0 flex-1 resize-none rounded-lg bg-neutral-100 px-2 py-1.5 text-[13px] leading-snug outline-none [field-sizing:content] focus:ring-2 focus:ring-neutral-400 dark:bg-neutral-900" />
                    <button onClick={() => ubahDok(dokList.filter((x) => x.id !== d.id))} aria-label={`Hapus ${d.label || 'dokumen'}`}
                      className="flex h-9 w-8 shrink-0 items-center justify-center text-lg text-neutral-400 active:text-red-600">×</button>
                  </div>
                  <div className="mt-1.5 flex justify-end pr-9">
                    <TigaPilih label={d.label} value={d.cek} onChange={(v) => ubahDok(dokList.map((x) => (x.id === d.id ? { ...x, cek: v } : x)))} />
                  </div>
                </div>
              ))}
              <button onClick={() => ubahDok([...dokList, { id: `d${Date.now().toString(36)}`, label: '', grup: kat, cek: '' }])}
                className="mt-1.5 min-h-10 rounded-lg px-1 text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">+ Tambah dokumen</button>
            </div>
          ))}
        </Bagian>

        <Bagian judul="Analisa 6C + 1EP" sub={`${C6.filter(([k]) => k !== 'tambahan' && b.c6[k].trim()).length}/8 terisi`}>
          {C6.map(([k, label, hint]) => (
            <Isian key={k} label={label} hint={hint}><Teks label={label} value={b.c6[k]} onChange={(v) => set('c6', { ...b.c6, [k]: v })} rows={k === 'capacity' || k === 'eksistensi' ? 4 : 2} /></Isian>
          ))}
        </Bagian>

        <Bagian judul="Analisa SWOT" sub="Satu poin per baris">
          <button onClick={() => set('swot', saranSwot(b.c6))} className="mb-1 min-h-10 rounded-xl bg-neutral-100 px-3 text-[13px] font-semibold dark:bg-neutral-800">Isi otomatis dari analisa 6C</button>
          {([['s', 'S · Strength'], ['w', 'W · Weakness'], ['o', 'O · Opportunity'], ['t', 'T · Threat']] as const).map(([k, l]) => (
            <Isian key={k} label={l}><Teks label={l} value={b.swot[k]} onChange={(v) => set('swot', { ...b.swot, [k]: v })} rows={k === 's' ? 5 : 2} /></Isian>
          ))}
        </Bagian>

        <Bagian judul="Reason banding Marketing Head">
          <button onClick={() => set('reasonMh', saranReasonMh(b.swot))} className="mb-1 min-h-10 rounded-xl bg-neutral-100 px-3 text-[13px] font-semibold dark:bg-neutral-800">Ambil dari poin Strength</button>
          <Teks label="Reason banding Marketing Head" value={b.reasonMh} onChange={(v) => set('reasonMh', v)} rows={7} />
        </Bagian>

        <Bagian judul="Reason approve banding Branch Head" sub="Opsional, bisa diisi BH di G Suite" buka={false}>
          <Teks label="Reason approve banding Branch Head" value={b.reasonBh} onChange={(v) => set('reasonBh', v)} rows={6} placeholder="Approve&#10;1. …" />
        </Bagian>

        <Bagian judul="Lampiran foto" sub={`${b.foto.length} foto · Mandatory, OTS, Tambahan`}>
          {KAT_FOTO.map(([kat, label]) => (
            <FotoKat key={kat} kat={kat} label={label} foto={b.foto.filter((f) => f.kat === kat)} sibuk={!!upload}
              onTambah={tambahFoto}
              onUbah={(id, ket) => set('foto', b.foto.map((f) => (f.id === id ? { ...f, ket } : f)))}
              onHapus={(id) => set('foto', b.foto.filter((f) => f.id !== id))} />
          ))}
          {upload && <p role="status" className="mt-2 text-[13px] font-semibold">{upload}</p>}
        </Bagian>

        <Bagian judul="SLIK / Pefindo (opsional)" sub={nSlik ? `${nSlik} fasilitas · jadi lembar kedua` : 'Tempel tabel dari Excel/Sheets'} buka={false}>
          <p className="text-[12px] text-neutral-500">Blok tabel SLIK di Excel atau Google Sheets (termasuk baris judul kolom), salin, lalu tempel di sini.</p>
          <Teks label="Tabel SLIK" value={b.slik} onChange={(v) => set('slik', v)} rows={5} placeholder="NO	BANK / PEMBERI FASILITAS KREDIT	…" />
        </Bagian>

        <Bagian judul="Lembar persetujuan" sub={[b.pembuat, b.bh, b.buh].filter(Boolean).join(' · ')} buka={false}>
          <div className="grid grid-cols-2 gap-3">
            <Isian label="Dibuat oleh"><input value={b.pembuat} onChange={(e) => set('pembuat', e.target.value)} placeholder={akun.name || ''} className={`${FIELD} min-h-11`} /></Isian>
            <Isian label="Jabatan"><input value={b.jabatan} onChange={(e) => set('jabatan', e.target.value)} className={`${FIELD} min-h-11`} /></Isian>
          </div>
          <Isian label="BU Head (opsional)" hint="Kosongkan kalau banding tidak perlu approval BU Head. Barisnya tidak ikut di Excel."><input value={b.buh} onChange={(e) => set('buh', e.target.value)} className={`${FIELD} min-h-11`} /></Isian>
          <label className="mt-3 flex min-h-11 items-center gap-2 text-[14px]">
            <input type="checkbox" checked={b.status === 'selesai'} onChange={(e) => set('status', e.target.checked ? 'selesai' : 'draft')} className="h-5 w-5 accent-neutral-900" />
            Sudah selesai, status &quot;Submitted&quot;
          </label>
        </Bagian>

      </>)}

      {lembar === 'wa' && (<>
        <section className="mt-3 rounded-2xl bg-neutral-50 p-4 text-[13px] leading-relaxed dark:bg-neutral-900">
          <p className="font-bold">Diambil otomatis dari Form F-761</p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            No APP <b className="text-neutral-900 dark:text-white">{b.appNo || '–'}</b> · Nama <b className="text-neutral-900 dark:text-white">{b.nama || '–'}</b> · Cabang {b.cabang || '–'} · {b.brand === 'MOTORKU' ? 'MotorKu' : 'MobilKu'}
          </p>
          <p className="text-neutral-600 dark:text-neutral-400">Analisa 6C 1EP: {C6.filter(([k]) => k !== 'tambahan' && b.c6[k].trim()).length}/8 terisi{b.rejectCredit.trim() ? ' · reason reject Credit ada' : ''}</p>
          <button onClick={() => { setLembar('form'); window.scrollTo(0, 0); }} className="mt-1 min-h-10 text-[13px] font-semibold underline">Ubah di Form F-761</button>
        </section>
        <Bagian judul="Info & struktur pembiayaan" sub={[b.wa.merk, b.wa.otr ? `OTR ${b.wa.otr.toLocaleString('id-ID')}` : '', ltv(b.wa) && `LTV ${ltv(b.wa)}`].filter(Boolean).join(' · ') || 'Link, tipe konsumen, unit, OTR, PH, LTV, harga market'}>
          <Isian label="Link banding (Google Sheets)"><input value={b.wa.link} onChange={(e) => setWa('link', e.target.value.trim())} placeholder="https://docs.google.com/…" className={`${FIELD} min-h-11`} inputMode="url" /></Isian>
          <div className="mt-3">
            <span className="block text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">Tipe konsumen</span>
            <div className="mt-1 flex gap-2" role="group" aria-label="Tipe konsumen">{(['NC', 'RO'] as const).map((x) => (
              <button key={x} onClick={() => setWa('tipe', b.wa.tipe === x ? '' : x)} aria-pressed={b.wa.tipe === x}
                className={`min-h-11 flex-1 rounded-xl text-[14px] font-bold ${b.wa.tipe === x ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{x === 'NC' ? 'NC (baru)' : 'RO'}</button>
            ))}</div>
          </div>
          <Isian label="Sumber order"><input value={b.wa.sumber} onChange={(e) => setWa('sumber', e.target.value)} placeholder="mis. Channel Mediator (Star Md)" className={`${FIELD} min-h-11`} /></Isian>
          <Isian label="Merk & type"><input value={b.wa.merk} onChange={(e) => setWa('merk', e.target.value)} placeholder="Daihatsu Ayla X 1.0 AT" className={`${FIELD} min-h-11`} /></Isian>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><Isian label="Tahun"><input value={b.wa.tahun} onChange={(e) => setWa('tahun', e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" className={`${FIELD} min-h-11`} /></Isian></div>
            <div><Isian label="BPKB a/n"><input value={b.wa.bpkb} onChange={(e) => setWa('bpkb', e.target.value)} className={`${FIELD} min-h-11`} /></Isian></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><Isian label="OTR"><AngkaInput label="OTR" value={b.wa.otr} onChange={(v) => setWa('otr', v)} className="min-h-11" /></Isian></div>
            <div><Isian label="Harga rekondisi"><AngkaInput label="Harga rekondisi" value={b.wa.rekondisi} onChange={(v) => setWa('rekondisi', v)} className="min-h-11" /></Isian></div>
          </div>
          <p className="mt-1 text-[13px] text-neutral-500">OTR taksasi: <b className="text-neutral-900 dark:text-white">{otrTaksasi(b.wa) ? otrTaksasi(b.wa).toLocaleString('id-ID') : '–'}</b> (OTR − rekondisi)</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><Isian label="PH (pokok hutang)"><AngkaInput label="PH" value={b.wa.ph} onChange={(v) => setWa('ph', v)} className="min-h-11" /></Isian></div>
            <div><Isian label="Pencairan"><AngkaInput label="Pencairan" value={b.wa.pencairan} onChange={(v) => setWa('pencairan', v)} className="min-h-11" /></Isian></div>
            <div><Isian label="Angsuran"><AngkaInput label="Angsuran" value={b.wa.angsuran} onChange={(v) => setWa('angsuran', v)} className="min-h-11" /></Isian></div>
            <div><Isian label="Tenor (bulan)"><AngkaInput label="Tenor" value={b.wa.tenor} onChange={(v) => setWa('tenor', Math.min(240, v))} className="min-h-11" /></Isian></div>
          </div>
          <p className="mt-1 text-[13px] text-neutral-500">LTV: <b className="text-neutral-900 dark:text-white">{ltv(b.wa) || '–'}</b> (PH ÷ OTR taksasi)</p>
          <div className="mt-3">
            <span className="block text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">Harga market (jika NDS)</span>
            {b.wa.market.map((m, i) => (
              <div key={i} className="mt-1.5 flex gap-2">
                <input value={m.sumber} onChange={(e) => setWa('market', b.wa.market.map((x, j) => (j === i ? { ...x, sumber: e.target.value } : x)))} placeholder="OLX" aria-label={`Sumber harga market ${i + 1}`} className={`${FIELD.replace('w-full', '')} min-h-11 w-28 shrink-0`} />
                <AngkaInput label={`Harga market ${i + 1}`} value={m.harga} onChange={(v) => setWa('market', b.wa.market.map((x, j) => (j === i ? { ...x, harga: v } : x)))} lebar="min-w-0 flex-1" className="min-h-11" />
                <button onClick={() => setWa('market', b.wa.market.filter((_, j) => j !== i))} aria-label={`Hapus harga market ${i + 1}`} className="min-h-11 w-10 shrink-0 rounded-xl text-red-700 dark:text-red-400">✕</button>
              </div>
            ))}
            <button onClick={() => setWa('market', [...b.wa.market, { sumber: b.wa.market.length ? '' : 'OLX', harga: 0 }])} className="mt-2 min-h-10 rounded-xl bg-neutral-100 px-3 text-[13px] font-semibold dark:bg-neutral-800">+ Tambah harga market</button>
            {rataMarket(b.wa) > 0 && <p className="mt-1 text-[13px] text-neutral-500">Rata-rata: <b className="text-neutral-900 dark:text-white">{rataMarket(b.wa).toLocaleString('id-ID')}</b></p>}
          </div>
        </Bagian>

        <Bagian judul="Reason & analisa cabang" sub={b.wa.reason ? `${b.wa.reason.split('\n').filter(Boolean).length} reason` : 'Reason singkat, klarifikasi, pekerjaan, rumah, penghasilan, DSR'}>
          <Isian label="Reason credit reject (singkat, satu per baris)" hint="Kosong = pakai reason reject Credit di atas.">
            <Teks label="Reason credit reject singkat" value={b.wa.reason} onChange={(v) => setWa('reason', v)} rows={4} placeholder="Foto usaha tidak representatif&#10;Terdapat tunggakan di pinjaman lain" />
          </Isian>
          <Isian label="Klarifikasi reason credit reject"><Teks label="Klarifikasi reason" value={b.wa.klarifikasi} onChange={(v) => setWa('klarifikasi', v)} rows={7} placeholder="CAC TIDAK REKOMENDASI :&#10;1. … --&#10;Penjelasan…" /></Isian>
          <Isian label="1. Pekerjaan / usaha konsumen"><Teks label="Pekerjaan atau usaha konsumen" value={b.wa.pekerjaan} onChange={(v) => setWa('pekerjaan', v)} rows={3} /></Isian>
          <Isian label="2. Status rumah"><Teks label="Status rumah" value={b.wa.rumah} onChange={(v) => setWa('rumah', v)} rows={2} /></Isian>
          <Isian label="3. Penghasilan"><Teks label="Penghasilan" value={b.wa.penghasilan} onChange={(v) => setWa('penghasilan', v)} rows={3} /></Isian>
          <Isian label="4. DSR & perhitungan singkat"><Teks label="DSR dan perhitungan singkat" value={b.wa.dsr} onChange={(v) => setWa('dsr', v)} rows={4} /></Isian>
        </Bagian>

        <Bagian judul="Rek koran & SLIK" sub={`${b.wa.mutasi.filter((m) => m.bulan || m.kredit).length} bulan mutasi · ${b.wa.kol.filter((k) => k.trim()).length} kol terisi`}>
          <span className="block text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">5. Analisa rek koran</span>
          {b.wa.mutasi.map((m, i) => {
            const ubahM = (k: keyof typeof m, v: string | number) => setWa('mutasi', b.wa.mutasi.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
            return (
              <div key={i} className="mt-2 rounded-xl bg-neutral-50 p-2.5 dark:bg-neutral-900">
                <div className="flex items-center gap-2">
                  <input value={m.bulan} onChange={(e) => ubahM('bulan', e.target.value)} placeholder="Bulan, mis. Juli" aria-label={`Bulan mutasi ${i + 1}`} className={`${FIELD.replace('w-full', '')} min-h-10 min-w-0 flex-1`} />
                  <button onClick={() => setWa('mutasi', b.wa.mutasi.filter((_, j) => j !== i))} aria-label={`Hapus mutasi ${i + 1}`} className="min-h-10 w-10 rounded-xl text-red-700 dark:text-red-400">✕</button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {([['awal', 'Saldo awal'], ['kredit', 'Credit'], ['debit', 'Debit'], ['akhir', 'Saldo akhir']] as const).map(([k, l]) => (
                    <label key={k} className="block"><span className="text-[12px] text-neutral-500">{l}</span>
                      <AngkaInput label={`${l} ${m.bulan || i + 1}`} value={m[k]} onChange={(v) => ubahM(k, v)} className="min-h-10" /></label>
                  ))}
                </div>
              </div>
            );
          })}
          <button onClick={() => setWa('mutasi', [...b.wa.mutasi, { bulan: '', awal: 0, kredit: 0, debit: 0, akhir: 0 }])} className="mt-2 min-h-10 rounded-xl bg-neutral-100 px-3 text-[13px] font-semibold dark:bg-neutral-800">+ Tambah bulan</button>
          <span className="mt-4 block text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">6. Hasil cek SLIK</span>
          <span className="block text-[12px] text-neutral-500">Satu fasilitas per baris: Fincoy / plafon awal / baki debet. Kosong = &quot;kosong&quot;.</span>
          {b.wa.kol.map((k, i) => (
            <Isian key={i} label={`Kol ${i + 1}`}><Teks label={`SLIK Kol ${i + 1}`} value={k} onChange={(v) => setWa('kol', b.wa.kol.map((x, j) => (j === i ? v : x)))} rows={i < 2 ? 3 : 2} placeholder="BTPN Syariah / 10.000.000 / 7.708.090" /></Isian>
          ))}
        </Bagian>

        <Bagian judul="Teks WA ke BU Head" sub="Pratinjau · Analisa 6C 1EP ikut otomatis dari Form F-761">
          <pre aria-label="Teks WA BU Head" className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-100 p-3 text-[12.5px] leading-snug dark:bg-neutral-900">{teksWaBanding(b)}</pre>
          {pesanWa && <p role="status" className="mt-2 text-[13px] text-neutral-600 dark:text-neutral-400">{pesanWa}</p>}
        </Bagian>

      </>)}

      {pesan && <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">{pesan}</p>}

      {lembar === 'form' ? (<>
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 border-t border-neutral-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
          <div className="mx-auto grid max-w-xl grid-cols-[1fr_1fr_auto] gap-2">
            <button onClick={bukaPreview} disabled={unduh || !(b.nama || b.appNo)} className="min-h-12 rounded-2xl border border-neutral-300 text-[15px] font-bold disabled:opacity-40 dark:border-neutral-700">
              {unduh ? 'Menyiapkan…' : 'Preview'}
            </button>
            <button onClick={() => unduhExcel(false)} disabled={unduh || !(b.nama || b.appNo)} aria-label="Unduh Excel F-761" className="min-h-12 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900">
              Unduh Excel
            </button>
            <button onClick={() => unduhExcel(true)} disabled={unduh || !(b.nama || b.appNo)} aria-label="Bagikan Excel" className="min-h-12 rounded-2xl bg-[#0F8048] px-4 text-[15px] font-bold text-white disabled:opacity-40">Bagikan</button>
          </div>
        </div>
      </>) : (<>
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 border-t border-neutral-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
          <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
            <button onClick={salinWa} className="min-h-12 rounded-2xl bg-[#0F8048] text-[15px] font-bold text-white">Salin teks WA</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(teksWaBanding(b))}`} target="_blank" rel="noreferrer"
              className="flex min-h-12 items-center justify-center rounded-2xl bg-neutral-900 text-[15px] font-bold text-white dark:bg-white dark:text-neutral-900">Kirim ke WA</a>
          </div>
        </div>
      </>)}
      {pratinjau && <Pratinjau siap={pratinjau} onTutup={() => setPratinjau(null)} onUnduh={(bg) => unduhExcel(bg, pratinjau)} />}
    </div>
  );
}

/* ---------- Halaman ---------- */
export default function BandingPage({ akun, reloadKey = 0 }: { akun: Akun; reloadKey?: number }) {
  const [list, setList] = useState<Banding[] | null>(null);
  const [err, setErr] = useState('');
  const [buka, setBuka] = useState<Banding | null>(null);
  const [bantuan, setBantuan] = useState(false);

  const muat = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch('/api/banding', { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || 'Gagal memuat.');
      setList((j.list || []).map(rapikanBanding));
    } catch (e) { setErr((e as Error).message); setList([]); }
  }, []);
  useEffect(() => { muat(); }, [muat, reloadKey]);

  // Halaman dimuat ulang (mis. tab dimatikan Android saat pindah ke WA) → buka lagi form yang tadi diisi
  const [lembarAwal, setLembarAwal] = useState<'form' | 'wa'>('form');
  const pulih = useRef(false);
  useEffect(() => {
    if (pulih.current || list === null) return;
    pulih.current = true;
    rapikanDraf();
    const x = bacaBuka();
    if (!x) return;
    const ada = x.id ? list.find((y) => y.id === x.id) : null;
    if (x.id && !ada) { lepasBuka(); return; }
    setLembarAwal(x.lembar === 'wa' ? 'wa' : 'form');
    setBuka(ada || bandingDefault());
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  const simpanLokal = useCallback((b: Banding) => setList((l) => [b, ...(l || []).filter((x) => x.id !== b.id)]), []);
  const hapus = async (b: Banding) => {
    if (!window.confirm(`Hapus form banding ${b.nama || b.appNo}?`)) return;
    const r = await fetch(`/api/banding?id=${encodeURIComponent(b.id)}`, { method: 'DELETE' });
    if (r.ok) setList((l) => (l || []).filter((x) => x.id !== b.id));
  };
  const bandingDefault = () => {
    const contoh = list?.[0];
    return bandingBaru({ tanggal: todayJkt(), bh: contoh?.bh || '', pembuat: contoh?.pembuat || akun.perfName || akun.name || '', jabatan: contoh?.jabatan || 'BMH Mobilku', cabang: contoh?.cabang || 'KENDAL' });
  };
  const baru = () => { setLembarAwal('form'); setBuka(bandingDefault()); };
  const bukaForm = (x: Banding) => { setLembarAwal('form'); setBuka(x); };

  if (buka) return <Editor key={buka.id || 'baru'} awal={buka} akun={akun} lembarAwal={lembarAwal} onTutup={() => { lepasBuka(); setBuka(null); muat(); }} onSimpan={simpanLokal} />;

  return (
    <div className="px-4 pb-10 pt-4">
      <section className="rounded-3xl bg-neutral-900 p-5 text-white">
        <p className="text-[13px] font-bold uppercase tracking-wide text-neutral-400">Form analisa banding · F-761</p>
        <p className="mt-1 text-[15px] leading-snug text-neutral-200">Tulis reason, analisa 6C, SWOT, dan unggah foto dari HP. Hasilnya Excel dengan susunan form kantor, tinggal dibuka di G Suite.</p>
        <button onClick={baru} className="mt-3 min-h-12 w-full rounded-2xl bg-white text-[15px] font-bold text-neutral-900">+ Buat form banding</button>
      </section>
      <button onClick={() => setBantuan(!bantuan)} aria-expanded={bantuan} className="mt-3 min-h-10 text-[13px] font-semibold underline">Cara memindahkan ke G Suite kantor</button>
      {bantuan && (
        <ol className="mt-1 list-decimal space-y-1 rounded-2xl bg-neutral-100 py-3 pl-8 pr-4 text-[13px] leading-snug dark:bg-neutral-900">
          <li>Di form, ketuk <b>Unduh Excel F-761</b> (atau <b>Bagikan</b> ke WA/email sendiri).</li>
          <li>Buka <b>Google Drive akun kantor</b> → <b>+ Baru → Upload file</b> → pilih file Excel tadi.</li>
          <li>Buka filenya → <b>Buka dengan Google Spreadsheet</b> → <b>File → Simpan sebagai Google Spreadsheet</b>.</li>
          <li>Kolom Valid/Tidak Valid berisi TRUE/FALSE. Kalau perlu kotak centang: blok kolomnya → <b>Sisipkan → Kotak centang</b>.</li>
        </ol>
      )}
      <p className="mt-6 text-[15px] font-bold">Form tersimpan</p>
      {err && <p className="mt-2 text-[13px] text-red-700 dark:text-red-300">{err}</p>}
      {list === null ? <p className="mt-2 text-[13px] text-neutral-500">Memuat…</p> : !list.length ? (
        <p className="mt-2 text-[14px] text-neutral-500">Belum ada form banding.</p>
      ) : (
        <ul className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {list.map((b) => (
            <li key={b.id} className="flex items-center border-b border-neutral-200 last:border-0 dark:border-neutral-800">
              <button onClick={() => bukaForm(b)} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center px-4 py-2 text-left active:bg-neutral-50 dark:active:bg-neutral-900">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-bold">{b.nama || '(tanpa nama)'}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${b.status === 'selesai' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'}`}>{b.status === 'selesai' ? 'Submitted' : 'Draft'}</span>
                </span>
                <span className="truncate text-[12px] text-neutral-500">{[b.brand, b.appNo, tglPanjang(b.tanggal), `${b.foto.length} foto`].filter(Boolean).join(' · ')}</span>
              </button>
              <button onClick={() => hapus(b)} aria-label={`Hapus banding ${b.nama}`} className="flex h-12 w-12 shrink-0 items-center justify-center text-neutral-400"><Ico n="x" className="h-4 w-4" sw={2} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
