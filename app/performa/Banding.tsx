'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  C6, DOK_CEK, KAT_FOTO, bacaSlik, bandingBaru, namaFileBanding, saranReasonMh, saranSwot, tglPanjang,
  type Banding, type Cek, type FotoBanding, type KatFoto,
} from '../../lib/banding-types';
import { buatFormBanding, type FotoFile } from '../../lib/banding-xlsx';
import { TIPE_XLSX } from '../../lib/xlsx-mini';
import { todayJkt } from '../../lib/performa-calc';
import { FIELD } from './form';
import { Ico } from './parts';

type Akun = { email: string; name?: string; role: 'owner' | 'konsumen' | 'tim'; perfName?: string | null };

/* ---------- Foto: diperkecil di HP (dokumen perlu terbaca, jadi mulai 1400 px) ---------- */
const MAKS_B64 = 175_000;
async function kecilkan(file: File): Promise<{ mime: string; data: string }> {
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
    return { kat: f.kat, ket: f.ket, data: new Uint8Array(await blob.arrayBuffer()), ext: blob.type === 'image/png' ? 'png' : 'jpeg', w: bm.width, h: bm.height };
  } catch { return null; }
}

/* ---------- Bagian kecil ---------- */
const TA = `${FIELD} py-2.5 leading-relaxed`;
function Bagian({ judul, sub, children, buka = true }: { judul: string; sub?: string; children: ReactNode; buka?: boolean }) {
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
function Isian({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="block text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">{label}</span>
      {hint && <span className="block text-[12px] text-neutral-500">{hint}</span>}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
function Teks({ value, onChange, rows = 4, placeholder, label }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; label: string }) {
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

/* ---------- Editor ---------- */
function Editor({ awal, akun, onTutup, onSimpan }: { awal: Banding; akun: Akun; onTutup: () => void; onSimpan: (b: Banding) => void }) {
  const [b, setB] = useState<Banding>(awal);
  const [simpan, setSimpan] = useState<'' | 'menyimpan' | 'tersimpan' | 'gagal'>(awal.id ? 'tersimpan' : '');
  const [pesan, setPesan] = useState('');
  const [upload, setUpload] = useState('');
  const [unduh, setUnduh] = useState(false);
  const ubah = useRef(0);
  const terakhir = useRef(b);
  terakhir.current = b;
  const set = <K extends keyof Banding>(k: K, v: Banding[K]) => { setB((x) => ({ ...x, [k]: v })); ubah.current++; setSimpan(''); };

  const kirim = useCallback(async (data: Banding): Promise<Banding | null> => {
    if (!data.nama.trim() && !data.appNo.trim()) return null;
    setSimpan('menyimpan');
    const n = ubah.current;
    try {
      const r = await fetch('/api/banding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ banding: data }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || 'Gagal menyimpan.');
      const hasil = j.banding as Banding;
      setB((x) => ({ ...x, id: hasil.id, dibuat: hasil.dibuat, diubah: hasil.diubah, oleh: hasil.oleh }));
      if (n === ubah.current) setSimpan('tersimpan'); else setSimpan('');
      onSimpan(hasil);
      return hasil;
    } catch (e) { setSimpan('gagal'); setPesan((e as Error).message); return null; }
  }, [onSimpan]);

  // Simpan otomatis 2 detik setelah berhenti mengetik
  useEffect(() => {
    if (simpan !== '') return;
    const t = setTimeout(() => { kirim(terakhir.current); }, 2000);
    return () => clearTimeout(t);
  }, [b, simpan, kirim]);

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

  const unduhExcel = async (bagikan: boolean) => {
    setUnduh(true); setPesan('');
    try {
      const tersimpan = (await kirim(terakhir.current)) || terakhir.current;
      const fotos = (await Promise.all(tersimpan.foto.map(ambilFoto))).filter((x): x is FotoFile => !!x);
      if (fotos.length < tersimpan.foto.length) setPesan(`${tersimpan.foto.length - fotos.length} foto tidak bisa dimuat dan tidak ikut di Excel.`);
      const bytes = buatFormBanding(tersimpan, fotos);
      const nama = `${namaFileBanding(tersimpan)}.xlsx`;
      const file = new File([bytes.buffer as ArrayBuffer], nama, { type: TIPE_XLSX });
      if (bagikan && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: nama }); return; } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
      }
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = nama; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch { setPesan('Excel gagal dibuat. Coba lagi.'); } finally { setUnduh(false); }
  };

  const nSlik = Math.max(0, bacaSlik(b.slik).length - 1);
  const isiCek = DOK_CEK.filter((d) => b.dok[d.k]).length;
  const status = simpan === 'menyimpan' ? 'Menyimpan…' : simpan === 'tersimpan' ? 'Tersimpan' : simpan === 'gagal' ? 'Gagal tersimpan' : b.nama || b.appNo ? 'Belum tersimpan' : 'Isi nama konsumen dulu';

  return (
    <div className="px-4 pb-40 pt-3">
      <div className="flex items-center gap-2">
        <button onClick={onTutup} className="flex min-h-11 items-center gap-1 rounded-xl pr-3 text-[14px] font-semibold"><Ico n="left" className="h-5 w-5" sw={2} />Daftar banding</button>
        <span role="status" className={`ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold ${simpan === 'gagal' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : simpan === 'tersimpan' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>{status}</span>
      </div>

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

      <Bagian judul="Checklist dokumen" sub={`${isiCek}/${DOK_CEK.length} dicek · dokumen yang diupload saat banding`} buka={false}>
        {KAT_FOTO.map(([kat, label]) => (
          <div key={kat} className="mt-3 first:mt-0">
            <p className="text-[12px] font-bold uppercase tracking-wide text-neutral-500">{label}</p>
            {DOK_CEK.filter((d) => d.grup === kat).map((d) => (
              <div key={d.k} className="flex min-h-12 items-center gap-2 border-b border-neutral-100 dark:border-neutral-900">
                <span className="min-w-0 flex-1 text-[13px]">{d.label}</span>
                <TigaPilih label={d.label} value={b.dok[d.k] || ''} onChange={(v) => set('dok', { ...b.dok, [d.k]: v })} />
              </div>
            ))}
            {kat === 'tambahan' && (
              <div className="flex min-h-12 items-center gap-2">
                <input value={b.dokLain} onChange={(e) => set('dokLain', e.target.value.toUpperCase())} placeholder="Dokumen lain (opsional)" aria-label="Dokumen tambahan lain" className="min-h-9 min-w-0 flex-1 rounded-lg bg-neutral-100 px-2 text-[13px] outline-none dark:bg-neutral-900" />
                <TigaPilih label="Dokumen lain" value={b.dokLainCek} onChange={(v) => set('dokLainCek', v)} />
              </div>
            )}
          </div>
        ))}
      </Bagian>

      <Bagian judul="Analisa 6C + 1EP" sub={`${C6.filter(([k]) => b.c6[k].trim()).length}/8 terisi`}>
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
        <Isian label="BU Head"><input value={b.buh} onChange={(e) => set('buh', e.target.value)} className={`${FIELD} min-h-11`} /></Isian>
        <label className="mt-3 flex min-h-11 items-center gap-2 text-[14px]">
          <input type="checkbox" checked={b.status === 'selesai'} onChange={(e) => set('status', e.target.checked ? 'selesai' : 'draft')} className="h-5 w-5 accent-neutral-900" />
          Sudah selesai, status &quot;Submitted&quot;
        </label>
      </Bagian>

      {pesan && <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">{pesan}</p>}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 border-t border-neutral-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto] gap-2">
          <button onClick={() => unduhExcel(false)} disabled={unduh || !(b.nama || b.appNo)} className="min-h-12 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900">
            {unduh ? 'Menyiapkan Excel…' : 'Unduh Excel F-761'}
          </button>
          <button onClick={() => unduhExcel(true)} disabled={unduh || !(b.nama || b.appNo)} aria-label="Bagikan Excel" className="min-h-12 rounded-2xl bg-[#0F8048] px-4 text-[15px] font-bold text-white disabled:opacity-40">Bagikan</button>
        </div>
      </div>
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
      setList(j.list || []);
    } catch (e) { setErr((e as Error).message); setList([]); }
  }, []);
  useEffect(() => { muat(); }, [muat, reloadKey]);

  const simpanLokal = useCallback((b: Banding) => setList((l) => [b, ...(l || []).filter((x) => x.id !== b.id)]), []);
  const hapus = async (b: Banding) => {
    if (!window.confirm(`Hapus form banding ${b.nama || b.appNo}?`)) return;
    const r = await fetch(`/api/banding?id=${encodeURIComponent(b.id)}`, { method: 'DELETE' });
    if (r.ok) setList((l) => (l || []).filter((x) => x.id !== b.id));
  };
  const baru = () => {
    const contoh = list?.[0];
    setBuka(bandingBaru({ tanggal: todayJkt(), bh: contoh?.bh || '', buh: contoh?.buh || '', pembuat: contoh?.pembuat || akun.perfName || akun.name || '', jabatan: contoh?.jabatan || 'BMH Mobilku', cabang: contoh?.cabang || 'KENDAL' }));
  };

  if (buka) return <Editor key={buka.id || 'baru'} awal={buka} akun={akun} onTutup={() => { setBuka(null); muat(); }} onSimpan={simpanLokal} />;

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
              <button onClick={() => setBuka(b)} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center px-4 py-2 text-left active:bg-neutral-50 dark:active:bg-neutral-900">
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
