'use client';
// Form Entertain Marketing Agent (F-384) + Konfirmasi Saldo AOP + FPD: diisi sekali di aplikasi,
// hasilnya tiga file Excel dengan format template kantor. Data yang sama otomatis dipakai di ketiganya.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PRODUK, namaFileAop, namaFileEnt, namaFileFpd, nomorFpd, nomorIM, pembayaranFpd, perjamuanKosong, periodeDari, rapikanEntertain, sisaAop, sisaDana, tglPanjang, totalEnt,
  type Approver, type Entertain, type FotoEnt, type Perjamuan,
} from '../../lib/entertain-types';
import { buatBerkasEntertain, type FotoData } from '../../lib/entertain-xlsx';
import { useOverlay } from '../overlay';
import { KUNCI_SURAT_BUKA } from '../../lib/surat-buka';
import { AngkaInput, FIELD, rupiah } from './form';
import { Ico } from './parts';
import { Bagian, Isian, kecilkan } from './Banding';

const TIPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DRAF = 'ent-draf:';
const baca = <T,>(k: string): T | null => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) as T : null; } catch { return null; } };
const tulis = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } };
const buang = (k: string) => { try { localStorage.removeItem(k); } catch { /* abaikan */ } };
export const bacaDrafEnt = (id: string) => baca<{ t: number; e: Entertain }>(DRAF + id)?.e || null;
export const idEntBaru = () => `ent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`;

const urlFoto = (id: string) => `/api/foto/${encodeURIComponent(id)}`;
async function ambilFoto(f: FotoEnt): Promise<FotoData | null> {
  try {
    const r = await fetch(urlFoto(f.id));
    if (!r.ok) return null;
    const blob = await r.blob();
    const bm = await createImageBitmap(blob);
    return { data: new Uint8Array(await blob.arrayBuffer()), ext: blob.type === 'image/png' ? 'png' : 'jpeg', w: bm.width, h: bm.height };
  } catch { return null; }
}
async function ambilTemplate(path: string) {
  const r = await fetch(path, { cache: 'force-cache' });
  if (!r.ok) throw new Error('Template Excel tidak bisa dimuat.');
  return r.arrayBuffer();
}

const input = `${FIELD} min-h-11`;
const kecil = 'min-h-10 w-full rounded-lg border border-neutral-300 bg-white px-2 text-[14px] outline-none focus:ring-2 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-950';

export function EditorEntertain({ awal, onTutup, onSimpan }: { awal: Entertain; onTutup: () => void; onSimpan: (e: Entertain) => void }) {
  useOverlay(true, onTutup);
  const [mulai] = useState(() => {
    const d = baca<{ t: number; e: Entertain }>(DRAF + awal.id);
    const pakai = !!d?.e && (d.e.diubah || '') === (awal.diubah || '') && Date.now() - d.t < 7 * 86_400_000;
    return { e: pakai ? rapikanEntertain(d!.e) : awal, dariDraf: pakai };
  });
  const [e, setE] = useState<Entertain>(mulai.e);
  const [simpan, setSimpan] = useState<'' | 'menyimpan' | 'tersimpan' | 'gagal'>(awal.diubah && !mulai.dariDraf ? 'tersimpan' : '');
  const [pesan, setPesan] = useState(mulai.dariDraf ? 'Isian yang belum tersimpan dipulihkan dari HP.' : '');
  const [upload, setUpload] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const ubahN = useRef(0), kotor = useRef(mulai.dariDraf), terakhir = useRef(e), simpanRef = useRef(simpan);
  terakhir.current = e; simpanRef.current = simpan;
  const antre = useRef<Promise<unknown>>(Promise.resolve());

  const ganti = (f: (x: Entertain) => Entertain) => { setE(f); ubahN.current++; kotor.current = true; setSimpan(''); };
  const set = <K extends keyof Entertain>(k: K, v: Entertain[K]) => ganti((x) => ({ ...x, [k]: v }));
  const setAop = (k: keyof Entertain['aop'], v: unknown) => ganti((x) => ({ ...x, aop: { ...x.aop, [k]: v } }));
  const setFpd = (k: keyof Entertain['fpd'], v: unknown) => ganti((x) => ({ ...x, fpd: { ...x.fpd, [k]: v } }));
  const setPj = (i: number, f: (p: Perjamuan) => Perjamuan) => ganti((x) => ({ ...x, perjamuan: x.perjamuan.map((p, j) => (j === i ? f(p) : p)) }));

  // Penanda form terbuka: aplikasi dimuat ulang (Android mematikan tab di latar) → langsung kembali ke form ini
  useEffect(() => { tulis(KUNCI_SURAT_BUKA, { id: e.id, t: Date.now() }); return () => buang(KUNCI_SURAT_BUKA); }, [e.id]);
  useEffect(() => {
    if (simpan === 'tersimpan') { buang(DRAF + e.id); return; }
    if (kotor.current) tulis(DRAF + e.id, { t: Date.now(), e });
  }, [e, simpan]);

  const kirimSekarang = useCallback(async (keepalive: boolean): Promise<Entertain | null> => {
    const data = terakhir.current;
    setSimpan('menyimpan');
    const n = ubahN.current;
    try {
      const body = JSON.stringify({ entertain: data });
      const r = await fetch('/api/entertain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: keepalive && body.length < 60_000 });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || 'Gagal menyimpan.');
      const hasil = rapikanEntertain(j.entertain);
      setE((x) => ({ ...x, dibuat: hasil.dibuat, diubah: hasil.diubah, oleh: hasil.oleh }));
      if (n === ubahN.current) { kotor.current = false; setSimpan('tersimpan'); } else setSimpan('');
      onSimpan(hasil);
      return hasil;
    } catch (err) { setSimpan('gagal'); setPesan((err as Error).message); return null; }
  }, [onSimpan]);
  const kirim = useCallback((keepalive = false) => {
    const p = antre.current.then(() => kirimSekarang(keepalive));
    antre.current = p.catch(() => null);
    return p;
  }, [kirimSekarang]);
  useEffect(() => {
    if (simpan !== '') return;
    const x = setTimeout(() => { kirim(); }, 2000);
    return () => clearTimeout(x);
  }, [e, simpan, kirim]);
  useEffect(() => {
    const pergi = () => { if (simpanRef.current === '' || simpanRef.current === 'gagal') kirim(true); };
    const onVis = () => { if (document.visibilityState === 'hidden') pergi(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', pergi);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', pergi); };
  }, [kirim]);

  const tambahFoto = async (jenis: 'nota' | 'dokumentasi', files: File[]) => {
    const baru: FotoEnt[] = [];
    for (const [i, f] of files.entries()) {
      setUpload(`Mengunggah foto ${i + 1}/${files.length}…`);
      try {
        const k = await kecilkan(f);
        const r = await fetch('/api/banding/foto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(k) });
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || 'gagal');
        baru.push({ id: j.id, ket: '' });
      } catch { setPesan(`Foto ${f.name || i + 1} gagal diunggah.`); }
    }
    setUpload('');
    if (baru.length) ganti((x) => ({ ...x, foto: { ...x.foto, [jenis]: [...x.foto[jenis], ...baru] } }));
  };

  const unduh = async (bagikan: boolean) => {
    setSibuk(true); setPesan('');
    try {
      await kirim();
      const x = terakhir.current;
      const [nota, dok] = await Promise.all([Promise.all(x.foto.nota.map(ambilFoto)), Promise.all(x.foto.dokumentasi.map(ambilFoto))]);
      const ok = <T,>(a: (T | null)[]) => a.filter((y): y is T => !!y);
      const gagal = nota.length + dok.length - ok(nota).length - ok(dok).length;
      if (gagal) setPesan(`${gagal} foto tidak bisa dimuat dan tidak ikut di file.`);
      const hasil = await buatBerkasEntertain(x, { nota: ok(nota), dokumentasi: ok(dok) }, ambilTemplate);
      const files = hasil.map((h) => new File([h.data.buffer as ArrayBuffer], h.nama, { type: TIPE_XLSX }));
      if (bagikan && navigator.canShare?.({ files })) {
        try { await navigator.share({ files, title: namaFileEnt(x) }); return; } catch (err) { if ((err as Error)?.name === 'AbortError') return; }
      }
      for (const f of files) {
        const url = URL.createObjectURL(f);
        const a = document.createElement('a');
        a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (err) { setPesan((err as Error).message || 'File gagal dibuat.'); } finally { setSibuk(false); }
  };

  const total = totalEnt(e);
  const baris = (label: string, nilai: string, onChange: (v: string) => void, ph = '') => (
    <Isian label={label}><input value={nilai} onChange={(ev) => onChange(ev.target.value)} placeholder={ph} aria-label={label} className={input} /></Isian>
  );
  const uang = (label: string, nilai: number, onChange: (v: number) => void, hint?: string) => (
    <Isian label={label} hint={hint}><AngkaInput value={nilai} onChange={onChange} label={label} className="min-h-11" /></Isian>
  );
  const tanggal = (label: string, nilai: string, onChange: (v: string) => void) => (
    <Isian label={label}><input type="date" value={nilai} onChange={(ev) => onChange(ev.target.value)} aria-label={label} className={input} /></Isian>
  );
  const daftarApprover = (judul: string, list: Approver[], onChange: (l: Approver[]) => void, adaStatus = true) => (
    <div className="mt-4 first:mt-0">
      <p className="text-[13px] font-bold text-neutral-600 dark:text-neutral-300">{judul}</p>
      {list.map((a, i) => (
        <div key={i} className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-neutral-50 p-2 dark:bg-neutral-900">
          <input value={a.nama} onChange={(ev) => onChange(list.map((y, j) => (j === i ? { ...y, nama: ev.target.value } : y)))} placeholder="Nama" aria-label={`${judul} ${i + 1} nama`} className={kecil} />
          <input value={a.jabatan} onChange={(ev) => onChange(list.map((y, j) => (j === i ? { ...y, jabatan: ev.target.value } : y)))} placeholder="Jabatan" aria-label={`${judul} ${i + 1} jabatan`} className={kecil} />
          {adaStatus && <input value={a.status} onChange={(ev) => onChange(list.map((y, j) => (j === i ? { ...y, status: ev.target.value } : y)))} placeholder="Status (kosong = diisi nanti)" aria-label={`${judul} ${i + 1} status`} className={kecil} />}
          {adaStatus && <input type="date" value={a.tgl} onChange={(ev) => onChange(list.map((y, j) => (j === i ? { ...y, tgl: ev.target.value } : y)))} aria-label={`${judul} ${i + 1} tanggal`} className={kecil} />}
        </div>
      ))}
    </div>
  );
  const fotoBagian = (jenis: 'nota' | 'dokumentasi', judul: string) => (
    <div className="mt-4 first:mt-0">
      <p className="text-[14px] font-bold">{judul}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {e.foto[jenis].map((f, i) => (
          <div key={f.id} className="relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urlFoto(f.id)} alt={`${judul} ${i + 1}`} className="aspect-[3/4] w-full bg-neutral-100 object-contain dark:bg-neutral-900" loading="lazy" />
            <button onClick={() => ganti((x) => ({ ...x, foto: { ...x.foto, [jenis]: x.foto[jenis].filter((y) => y.id !== f.id) } }))} aria-label={`Hapus ${judul} ${i + 1}`}
              className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"><Ico n="x" className="h-4 w-4" sw={2.2} /></button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {([['Galeri', false], ['Kamera', true]] as const).map(([lb, cam]) => (
          <label key={lb} className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-neutral-300 text-[14px] font-semibold dark:border-neutral-700 ${upload ? 'pointer-events-none opacity-50' : ''}`}>
            + {lb}
            <input type="file" accept="image/*" multiple={!cam} {...(cam ? { capture: 'environment' as const } : {})} className="sr-only" aria-label={`Tambah ${judul.toLowerCase()} dari ${lb.toLowerCase()}`}
              onChange={(ev) => { const fs = [...(ev.target.files || [])]; ev.target.value = ''; if (fs.length) tambahFoto(jenis, fs); }} />
          </label>
        ))}
      </div>
    </div>
  );

  const status = simpan === 'menyimpan' ? 'Menyimpan…' : simpan === 'tersimpan' ? 'Tersimpan' : simpan === 'gagal' ? 'Gagal tersimpan' : '';
  return (
    <div className="px-4 pb-44 pt-3">
      <div className="flex items-center justify-between">
        <button onClick={onTutup} className="-ml-1 flex min-h-11 items-center gap-1 text-[15px] font-semibold"><Ico n="left" className="h-4 w-4" sw={2.2} />Daftar surat</button>
        <span role="status" className={`text-[12px] font-semibold ${simpan === 'gagal' ? 'text-red-700 dark:text-red-400' : 'text-neutral-500'}`}>{status}</span>
      </div>
      <section className="mt-2 rounded-3xl bg-neutral-900 p-4 text-white">
        <p className="text-[12px] font-bold uppercase tracking-wide text-neutral-400">Form entertain · F-384 + Saldo AOP + FPD</p>
        <p className="mt-1 text-[22px] font-bold">{rupiah(total)}</p>
        <p className="text-[13px] text-neutral-300">{nomorIM(e)} · {periodeDari(e.tanggal) || 'periode belum diisi'}</p>
      </section>

      <Bagian judul="Pengajuan" sub={`${nomorIM(e)} · ${tglPanjang(e.tanggal) || 'tanggal belum diisi'}`}>
        <div className="grid grid-cols-2 gap-2">
          {baris('No urut IM', e.noUrut, (v) => set('noUrut', v.replace(/[^\dA-Za-z]/g, '').slice(0, 8)), '325')}
          {baris('Kode', e.kode, (v) => set('kode', v.toUpperCase()), 'MKT-KENDAL')}
        </div>
        {tanggal('Tanggal pengajuan', e.tanggal, (v) => ganti((x) => {
          // tanggal "Submitted" pengaju, Prepared by AOP, dan FPD ikut berubah kalau sebelumnya sama dengan tanggal pengajuan
          const ikut = (t: string) => (!t || t === x.tanggal ? v : t);
          return {
            ...x, tanggal: v,
            approval: x.approval.map((a, i) => (i === 0 ? { ...a, tgl: ikut(a.tgl) } : a)),
            aop: { ...x.aop, disiapkan: x.aop.disiapkan.map((a, i) => (i === 0 ? { ...a, tgl: ikut(a.tgl) } : a)) },
            fpd: { ...x.fpd, dibuat: { ...x.fpd.dibuat, tgl: ikut(x.fpd.dibuat.tgl) } },
          };
        }))}
        <div className="grid grid-cols-2 gap-2">
          {baris('Pengaju', e.pengaju.nama, (v) => set('pengaju', { ...e.pengaju, nama: v }))}
          {baris('Jabatan pengaju', e.pengaju.jabatan, (v) => set('pengaju', { ...e.pengaju, jabatan: v }))}
        </div>
        {baris('Cabang', e.cabang, (v) => set('cabang', v.toUpperCase()))}
      </Bagian>

      <Bagian judul="Detail perjamuan" sub={`${e.perjamuan.length} perjamuan · ${rupiah(total)}`}>
        {e.perjamuan.map((p, i) => (
          <div key={i} className="mt-4 rounded-2xl border border-neutral-200 p-3 first:mt-0 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-bold">Perjamuan {i + 1}</p>
              {e.perjamuan.length > 1 && <button onClick={() => set('perjamuan', e.perjamuan.filter((_, j) => j !== i))} aria-label={`Hapus perjamuan ${i + 1}`} className="flex h-10 w-10 items-center justify-center text-red-700 dark:text-red-400"><Ico n="x" className="h-4 w-4" sw={2.2} /></button>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tanggal('Tanggal', p.tgl, (v) => setPj(i, (x) => ({ ...x, tgl: v })))}
              {uang('Nominal', p.nominal, (v) => setPj(i, (x) => ({ ...x, nominal: v })))}
            </div>
            <div role="group" aria-label={`Produk perjamuan ${i + 1}`} className="mt-3 flex flex-wrap gap-1.5">
              {PRODUK.map((pr) => <button key={pr} onClick={() => setPj(i, (x) => ({ ...x, produk: pr }))} aria-pressed={p.produk === pr} className={`min-h-9 rounded-full px-3 text-[13px] font-semibold ${p.produk === pr ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{pr}</button>)}
            </div>
            {baris('Nama tempat perjamuan', p.tempat, (v) => setPj(i, (x) => ({ ...x, tempat: v })), 'Kampoeng Rasa')}
            <p className="mt-3 text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">Yang menjamu (internal WOM)</p>
            {p.menjamu.map((m, k) => (
              <div key={k} className="mt-1.5 flex gap-1.5">
                <input value={m.nama} onChange={(ev) => setPj(i, (x) => ({ ...x, menjamu: x.menjamu.map((y, j) => (j === k ? { ...y, nama: ev.target.value } : y)) }))} placeholder="Nama" aria-label={`Menjamu ${k + 1} nama`} className={kecil} />
                <input value={m.jabatan} onChange={(ev) => setPj(i, (x) => ({ ...x, menjamu: x.menjamu.map((y, j) => (j === k ? { ...y, jabatan: ev.target.value } : y)) }))} placeholder="Jabatan" aria-label={`Menjamu ${k + 1} jabatan`} className={kecil} />
                <button onClick={() => setPj(i, (x) => ({ ...x, menjamu: x.menjamu.filter((_, j) => j !== k) }))} aria-label={`Hapus menjamu ${k + 1}`} className="flex h-10 w-9 shrink-0 items-center justify-center text-neutral-400"><Ico n="x" className="h-4 w-4" sw={2} /></button>
              </div>
            ))}
            <button onClick={() => setPj(i, (x) => ({ ...x, menjamu: [...x.menjamu, { nama: '', jabatan: '' }] }))} className="mt-1.5 min-h-10 text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">+ Tambah yang menjamu</button>
            <Isian label="Nama yang dijamu" hint="Satu nama per baris, nomor otomatis"><textarea value={p.dijamu} onChange={(ev) => setPj(i, (x) => ({ ...x, dijamu: ev.target.value }))} rows={4} aria-label="Nama yang dijamu" className={`${FIELD} py-2`} /></Isian>
            <Isian label="Jabatan yang dijamu" hint="Satu per baris"><textarea value={p.jabatanDijamu} onChange={(ev) => setPj(i, (x) => ({ ...x, jabatanDijamu: ev.target.value }))} rows={3} aria-label="Jabatan yang dijamu" className={`${FIELD} py-2`} /></Isian>
            <Isian label="Nama perusahaan / agent yang dijamu" hint="Satu per baris"><textarea value={p.perusahaan} onChange={(ev) => setPj(i, (x) => ({ ...x, perusahaan: ev.target.value }))} rows={3} aria-label="Nama perusahaan yang dijamu" className={`${FIELD} py-2`} /></Isian>
          </div>
        ))}
        {e.perjamuan.length < 6 && <button onClick={() => set('perjamuan', [...e.perjamuan, perjamuanKosong(e.perjamuan[e.perjamuan.length - 1]?.tgl || '')])} className="mt-3 min-h-11 w-full rounded-xl bg-neutral-100 text-[14px] font-semibold dark:bg-neutral-800">+ Tambah perjamuan</button>}
      </Bagian>

      <Bagian judul="Data MA yang dijamu" sub={`${e.ma.length} MA · plan & historis kontribusi`} buka={false}>
        {e.ma.map((m, i) => (
          <div key={i} className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-neutral-50 p-2 first:mt-0 dark:bg-neutral-900">
            <input value={m.nama} onChange={(ev) => set('ma', e.ma.map((y, j) => (j === i ? { ...y, nama: ev.target.value } : y)))} placeholder="Nama MA" aria-label={`MA ${i + 1} nama`} className={kecil} />
            <input value={m.plan} onChange={(ev) => set('ma', e.ma.map((y, j) => (j === i ? { ...y, plan: ev.target.value } : y)))} placeholder="Plan kontribusi" aria-label={`MA ${i + 1} plan kontribusi`} className={kecil} />
            <input value={m.fincoy} onChange={(ev) => set('ma', e.ma.map((y, j) => (j === i ? { ...y, fincoy: ev.target.value } : y)))} placeholder="Kontribusi di fincoy lain" aria-label={`MA ${i + 1} kontribusi fincoy lain`} className={kecil} />
            <div className="flex gap-1">
              <input value={m.historis} onChange={(ev) => set('ma', e.ma.map((y, j) => (j === i ? { ...y, historis: ev.target.value } : y)))} placeholder="Historis di WOM" aria-label={`MA ${i + 1} historis kontribusi`} className={kecil} />
              <button onClick={() => set('ma', e.ma.filter((_, j) => j !== i))} aria-label={`Hapus MA ${i + 1}`} className="flex h-10 w-8 shrink-0 items-center justify-center text-neutral-400"><Ico n="x" className="h-4 w-4" sw={2} /></button>
            </div>
          </div>
        ))}
        <div className="mt-2 flex gap-2">
          <button onClick={() => set('ma', [...e.ma, { nama: '', plan: '', fincoy: '', historis: '' }])} className="min-h-11 flex-1 rounded-xl bg-neutral-100 text-[14px] font-semibold dark:bg-neutral-800">+ Tambah MA</button>
          <button onClick={() => {
            const ada = new Set(e.ma.map((m) => m.nama.trim().toUpperCase()));
            const nama = e.perjamuan.flatMap((p) => p.dijamu.split('\n')).map((x) => x.trim()).filter((x) => x && !ada.has(x.toUpperCase()));
            set('ma', [...e.ma, ...nama.map((n) => ({ nama: n, plan: '', fincoy: '', historis: '' }))]);
          }} className="min-h-11 flex-1 rounded-xl border border-neutral-300 text-[14px] font-semibold dark:border-neutral-700">Ambil dari yang dijamu</button>
        </div>
      </Bagian>

      <Bagian judul="Approval F-384" sub={e.approval.map((a) => a.nama.split(' ')[0]).join(' · ')} buka={false}>
        {daftarApprover('Approved by', e.approval, (l) => set('approval', l))}
        <p className="mt-2 text-[12px] text-neutral-500">Status & tanggal atasan biasanya dikosongkan, diisi saat approval di G Suite.</p>
      </Bagian>

      <Bagian judul="Rekening transfer" sub={`${e.rekening.bank} ${e.rekening.nomor} · ${e.rekening.nama}`} buka={false}>
        {baris('Nama rekening', e.rekening.nama, (v) => set('rekening', { ...e.rekening, nama: v }))}
        <div className="grid grid-cols-2 gap-2">
          {baris('Nomor rekening', e.rekening.nomor, (v) => set('rekening', { ...e.rekening, nomor: v.replace(/[^\d-]/g, '') }))}
          {baris('Bank', e.rekening.bank, (v) => set('rekening', { ...e.rekening, bank: v }))}
        </div>
        {baris('Cabang bank (untuk FPD)', e.rekening.cabangBank, (v) => set('rekening', { ...e.rekening, cabangBank: v }))}
      </Bagian>

      <Bagian judul="Saldo AOP (isi manual)" sub={`Sisa AOP ${rupiah(sisaAop(e))} · sisa dana ${rupiah(sisaDana(e))}`}>
        {baris('Perihal', e.aop.perihal, (v) => setAop('perihal', v))}
        {baris('Beban biaya', e.aop.beban, (v) => setAop('beban', v))}
        <p className="mt-4 text-[13px] font-bold">Data saldo AOP · COA By. Entertain Marketing 52001201</p>
        <div className="grid grid-cols-2 gap-2">
          {uang('AOP Januari–Desember', e.aop.aopTahun, (v) => setAop('aopTahun', v))}
          {uang('AOP deviasi', e.aop.aopDeviasi, (v) => setAop('aopDeviasi', v))}
          {uang('AOP sudah terpakai', e.aop.aopTerpakai, (v) => setAop('aopTerpakai', v))}
          {uang('Permohonan dalam proses', e.aop.aopProses, (v) => setAop('aopProses', v))}
        </div>
        <p className="mt-2 rounded-xl bg-neutral-100 px-3 py-2 text-[14px] dark:bg-neutral-900">Sisa AOP <b>{rupiah(sisaAop(e))}</b></p>
        <p className="mt-4 text-[13px] font-bold">Data saldo anggaran (dana anggaran + tambahan + deviasi)</p>
        <div className="grid grid-cols-2 gap-2">
          {uang('Dana anggaran', e.aop.danaAnggaran, (v) => setAop('danaAnggaran', v))}
          {uang('Dana anggaran terpakai', e.aop.danaTerpakai, (v) => setAop('danaTerpakai', v))}
          {uang('Permohonan dalam proses', e.aop.danaProses, (v) => setAop('danaProses', v))}
          <Isian label="Permohonan saat ini"><span className="flex min-h-11 items-center rounded-xl bg-neutral-100 px-3 text-base dark:bg-neutral-900">{rupiah(total)}</span></Isian>
        </div>
        <p className={`mt-2 rounded-xl px-3 py-2 text-[14px] ${sisaDana(e) < 0 ? 'bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300' : 'bg-neutral-100 dark:bg-neutral-900'}`}>Sisa dana anggaran <b>{rupiah(sisaDana(e))}</b>{sisaDana(e) < 0 ? ' · melebihi anggaran' : ''}</p>
        {daftarApprover('Prepared by', e.aop.disiapkan, (l) => setAop('disiapkan', l))}
      </Bagian>

      <Bagian judul="FPD (F-109)" sub={`${nomorFpd(e)} · ${rupiah(total)}`} buka={false}>
        {baris('Nomor FPD', e.fpd.nomor, (v) => setFpd('nomor', v), nomorIM(e))}
        {baris('Dari', e.fpd.dari, (v) => setFpd('dari', v))}
        {baris('Lokasi', e.fpd.lokasi, (v) => setFpd('lokasi', v))}
        {baris('Pembayaran', e.fpd.pembayaran, (v) => setFpd('pembayaran', v), pembayaranFpd({ ...e, fpd: { ...e.fpd, pembayaran: '' } }))}
        <div className="grid grid-cols-2 gap-2">
          {uang('Total anggaran', e.fpd.totalAnggaran, (v) => setFpd('totalAnggaran', v))}
          {uang('Permohonan dalam proses', e.fpd.proses, (v) => setFpd('proses', v))}
        </div>
        <p className="mt-4 text-[13px] font-bold">Dibuat oleh</p>
        <div className="grid grid-cols-2 gap-2">
          {baris('Nama', e.fpd.dibuat.nama, (v) => setFpd('dibuat', { ...e.fpd.dibuat, nama: v }))}
          {baris('Jabatan', e.fpd.dibuat.jabatan, (v) => setFpd('dibuat', { ...e.fpd.dibuat, jabatan: v }))}
          {baris('Telp', e.fpd.dibuat.telp, (v) => setFpd('dibuat', { ...e.fpd.dibuat, telp: v }))}
          {tanggal('Tanggal', e.fpd.dibuat.tgl, (v) => setFpd('dibuat', { ...e.fpd.dibuat, tgl: v }))}
        </div>
        {baris('Email', e.fpd.dibuat.email, (v) => setFpd('dibuat', { ...e.fpd.dibuat, email: v }))}
        <div className="grid grid-cols-2 gap-2">
          {baris('Diperiksa oleh', e.fpd.diperiksa.nama, (v) => setFpd('diperiksa', { ...e.fpd.diperiksa, nama: v }))}
          {baris('Jabatan', e.fpd.diperiksa.jabatan, (v) => setFpd('diperiksa', { ...e.fpd.diperiksa, jabatan: v }))}
        </div>
        {daftarApprover('Disetujui oleh', e.fpd.disetujui.map((o) => ({ ...o, status: '', tgl: '' })), (l) => setFpd('disetujui', l.map(({ nama, jabatan }) => ({ nama, jabatan }))), false)}
      </Bagian>

      <Bagian judul="Foto" sub={`${e.foto.nota.length} nota · ${e.foto.dokumentasi.length} dokumentasi`}>
        {fotoBagian('nota', 'Nota / kwitansi')}
        {fotoBagian('dokumentasi', 'Dokumentasi')}
        {upload && <p role="status" className="mt-2 text-[13px] font-semibold">{upload}</p>}
      </Bagian>

      <Bagian judul="Link antar file (opsional)" sub="Link Google Sheet AOP & FPD di form entertain" buka={false}>
        <p className="text-[12px] text-neutral-500">Form entertain menyebut nama file AOP & FPD. Kalau keduanya sudah diunggah ke G Suite, tempel link-nya supaya nama file di form entertain bisa diklik.</p>
        {baris(`Link ${namaFileAop(e)}`, e.link.aop, (v) => set('link', { ...e.link, aop: v.trim() }), 'https://docs.google.com/spreadsheets/…')}
        {baris(`Link ${namaFileFpd(e)}`, e.link.fpd, (v) => set('link', { ...e.link, fpd: v.trim() }), 'https://docs.google.com/spreadsheets/…')}
      </Bagian>

      {pesan && <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">{pesan}</p>}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 border-t border-neutral-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto] gap-2">
          <button onClick={() => unduh(false)} disabled={sibuk || !total} className="min-h-12 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900">{sibuk ? 'Menyiapkan…' : 'Unduh 3 file Excel'}</button>
          <button onClick={() => unduh(true)} disabled={sibuk || !total} aria-label="Bagikan 3 file Excel" className="min-h-12 rounded-2xl bg-[#0F8048] px-4 text-[15px] font-bold text-white disabled:opacity-40">Bagikan</button>
        </div>
      </div>
    </div>
  );
}
