'use client';
// Surat IM / Berita Acara dari template SK: isi baku tetap, yang diubah hanya kop, baris "Dibuat oleh",
// data konsumen, dan foto lampiran. Hasilnya file Word (.docx) dengan susunan format kantor.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  PEMBUAT, PENYETUJU, TEMPLATE_SURAT, namaFileSurat, noUrutBerikut, nomorSurat, perihalSurat, rapikanSurat, suratBaru, templateSurat,
  type FotoSurat, type Surat,
} from '../../lib/surat-types';
import { TIPE_DOCX, buatDocxSurat, tglPendek, type FotoDocx } from '../../lib/surat-docx';
import { todayJkt } from '../../lib/performa-calc';
import { useOverlay } from '../overlay';
import { FIELD } from './form';
import { Ico } from './parts';
import { Bagian, Isian, kecilkan } from './Banding';

type Akun = { email: string; name?: string; role: 'owner' | 'spv' | 'konsumen' | 'tim'; perfName?: string | null };

/* ---------- Draf di HP & form yang sedang terbuka (supaya tidak hilang saat pindah ke WA) ---------- */
const DRAF = 'surat-draf:', BUKA = 'surat-buka';
const baca = <T,>(k: string): T | null => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) as T : null; } catch { return null; } };
const tulis = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* abaikan */ } };
const buang = (k: string) => { try { localStorage.removeItem(k); } catch { /* abaikan */ } };
export const suratTerbuka = () => { const x = baca<{ id: string; t: number }>(BUKA); return x && Date.now() - x.t < 12 * 3_600_000 ? x : null; };
const idSuratBaru = () => `srt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10).padEnd(8, '0')}`;

/* ---------- Foto ---------- */
const urlFoto = (id: string) => `/api/foto/${encodeURIComponent(id)}`;
async function ambilFoto(f: FotoSurat, lampiran: number): Promise<FotoDocx | null> {
  try {
    const r = await fetch(urlFoto(f.id));
    if (!r.ok) return null;
    const blob = await r.blob();
    const bm = await createImageBitmap(blob);
    return { data: new Uint8Array(await blob.arrayBuffer()), ext: blob.type === 'image/png' ? 'png' : 'jpeg', w: bm.width, h: bm.height, ket: f.ket, lampiran };
  } catch { return null; }
}

async function simpanFile(s: Surat, fotos: FotoDocx[], bagikan: boolean) {
  const nama = `${namaFileSurat(s)}.docx`;
  const bytes = buatDocxSurat(s, fotos);
  const file = new File([bytes.buffer as ArrayBuffer], nama, { type: TIPE_DOCX });
  if (bagikan && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nama }); return; } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = nama; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ---------- Pratinjau: kertas Letter, susunan sama dengan file Word ---------- */
function Kertas({ children }: { children: ReactNode }) {
  return <div className="mx-auto mb-3 w-full max-w-[640px] bg-white px-[7%] py-[8%] min-h-[420px] text-[10.5px] leading-[1.45] text-black shadow-lg" style={{ fontFamily: '"Arial Narrow", "Arial", sans-serif' }}>{children}</div>;
}
function Daftar({ huruf, judul, isi }: { huruf: string; judul: string; isi: string[] }) {
  return (
    <div className="mt-3 pl-[5%]">
      <p className="font-bold">{huruf}.&nbsp;&nbsp;{judul}</p>
      <ol className="mt-0.5 list-decimal pl-[6%] text-justify">{isi.map((t) => <li key={t}>{t}</li>)}</ol>
    </div>
  );
}
function Pratinjau({ s, onTutup, onUnduh, sibuk }: { s: Surat; onTutup: () => void; onUnduh: (bagikan: boolean) => void; sibuk: boolean }) {
  useOverlay(true, onTutup);
  const t = templateSurat(s.template);
  const td = 'border border-black px-1 py-0.5 align-middle';
  const nSetuju = PENYETUJU.filter((p) => p.peran === 'Disetujui oleh').length;
  return (
    <div role="dialog" aria-label="Preview surat" className="fixed inset-0 z-[80] flex flex-col bg-neutral-200 dark:bg-neutral-900">
      <div className="flex items-center gap-2 border-b border-neutral-300 bg-white px-2 pb-2 pt-[calc(env(safe-area-inset-top)+8px)] dark:border-neutral-800 dark:bg-neutral-950">
        <button onClick={onTutup} className="min-h-11 rounded-xl px-3 text-[14px] font-semibold">Tutup</button>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{namaFileSurat(s)}.docx</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <Kertas>
          <div className="text-center font-bold"><p>{s.judul}</p><p>{perihalSurat(s)}</p><p>{nomorSurat(s)}</p></div>
          <table className="mt-3 w-full table-fixed border-collapse text-[9.5px]">
            <colgroup>{[14, 15, 15, 14, 19, 23].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
            <tbody>
              <tr>{['', 'Nama', 'Jabatan', 'Approval', 'Tanggal', 'Ket'].map((x, i) => <td key={i} className={`${td} ${i ? 'text-center' : ''}`}>{x}</td>)}</tr>
              <tr>{[PEMBUAT.peran, PEMBUAT.nama, PEMBUAT.jabatan, s.approval, tglPendek(s.tglApproval), s.ket].map((x, i) => <td key={i} className={td}>{x}</td>)}</tr>
              {PENYETUJU.map((p, i) => {
                const awalGrup = PENYETUJU[i - 1]?.peran !== p.peran;
                return (
                  <tr key={p.nama}>
                    {awalGrup && <td className={td} rowSpan={p.peran === 'Disetujui oleh' ? nSetuju : 1}>{p.peran}</td>}
                    <td className={td}>{p.nama}</td><td className={td}>{p.jabatan}</td><td className={td} /><td className={td} /><td className={td} />
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Daftar huruf="A" judul="LATAR BELAKANG" isi={t.latar} />
          <Daftar huruf="B" judul="TUJUAN" isi={t.tujuan} />
          <Daftar huruf="C" judul="PENGAJUAN" isi={t.pengajuan} />
        </Kertas>
        <Kertas>
          <p className="font-bold">D. DATA KONSUMEN</p>
          <table className="mt-1.5 ml-[3%]"><tbody>
            {t.data.map((d, i) => <tr key={d.k}><td className="w-6 align-top">{i ? '' : '1.'}</td><td className="w-[150px] align-top">{d.label}</td><td className="w-4 align-top">:</td><td className="align-top">{s.data[d.k]}</td></tr>)}
          </tbody></table>
        </Kertas>
        <Kertas>
          <p className="font-bold">E. LAMPIRAN</p>
          {s.lampiran.map((l, li) => (
            <div key={li} className="mt-2 pl-[5%]">
              <p className="font-bold">{li + 1}.&nbsp;&nbsp;{l.judul || `Lampiran ${li + 1}`}</p>
              {l.foto.map((f) => (
                <figure key={f.id} className="mt-2 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urlFoto(f.id)} alt={f.ket || l.judul} className="mx-auto max-h-[300px] max-w-full" />
                  {f.ket && <figcaption className="mt-0.5 text-[9.5px] italic">{f.ket}</figcaption>}
                </figure>
              ))}
            </div>
          ))}
        </Kertas>
        <p className="text-center text-[12px] text-neutral-600 dark:text-neutral-400">Gambaran isi file. Di Word, foto diatur dua per halaman.</p>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 border-t border-neutral-300 bg-white px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2.5 dark:border-neutral-800 dark:bg-neutral-950">
        <button onClick={() => onUnduh(false)} disabled={sibuk} className="min-h-12 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900">{sibuk ? 'Menyiapkan…' : 'Unduh Word'}</button>
        <button onClick={() => onUnduh(true)} disabled={sibuk} className="min-h-12 rounded-2xl bg-[#0F8048] px-4 text-[15px] font-bold text-white disabled:opacity-40">Bagikan</button>
      </div>
    </div>
  );
}

/* ---------- Editor ---------- */
function Editor({ awal, onTutup, onSimpan }: { awal: Surat; onTutup: () => void; onSimpan: (s: Surat) => void }) {
  useOverlay(true, onTutup);
  const [mulai] = useState(() => {
    const d = baca<{ t: number; s: Surat }>(DRAF + awal.id);
    const pakai = !!d?.s && d.s.id === awal.id && (d.s.diubah || '') === (awal.diubah || '') && Date.now() - d.t < 7 * 86_400_000;
    return { s: pakai ? rapikanSurat(d!.s) : awal, dariDraf: pakai };
  });
  const [s, setS] = useState<Surat>(mulai.s);
  const [simpan, setSimpan] = useState<'' | 'menyimpan' | 'tersimpan' | 'gagal'>(awal.diubah && !mulai.dariDraf ? 'tersimpan' : '');
  const [pesan, setPesan] = useState(mulai.dariDraf ? 'Isian yang belum tersimpan dipulihkan dari HP.' : '');
  const [upload, setUpload] = useState('');
  const [unduh, setUnduh] = useState(false);
  const [lihat, setLihat] = useState(false);
  const ubah = useRef(0);
  const kotor = useRef(mulai.dariDraf);
  const terakhir = useRef(s);
  terakhir.current = s;
  const simpanRef = useRef(simpan);
  simpanRef.current = simpan;
  const antre = useRef<Promise<unknown>>(Promise.resolve());
  const t = templateSurat(s.template);

  const ganti = (f: (x: Surat) => Surat) => { setS(f); ubah.current++; kotor.current = true; setSimpan(''); };
  const set = <K extends keyof Surat>(k: K, v: Surat[K]) => ganti((x) => ({ ...x, [k]: v }));
  const setData = (k: string, v: string) => ganti((x) => ({ ...x, data: { ...x.data, [k]: v } }));

  useEffect(() => {
    if (simpan === 'tersimpan') { buang(DRAF + s.id); return; }
    if (kotor.current) tulis(DRAF + s.id, { t: Date.now(), s });
  }, [s, simpan]);
  useEffect(() => { tulis(BUKA, { id: s.id, t: Date.now() }); return () => buang(BUKA); }, [s.id]);

  const kirimSekarang = useCallback(async (keepalive: boolean): Promise<Surat | null> => {
    const data = terakhir.current;
    if (!data.data.nama?.trim() && !data.data.app?.trim()) return null;
    setSimpan('menyimpan');
    const n = ubah.current;
    try {
      const body = JSON.stringify({ surat: data });
      const r = await fetch('/api/surat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: keepalive && body.length < 60_000 });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || 'Gagal menyimpan.');
      const hasil = rapikanSurat(j.surat);
      setS((x) => ({ ...x, dibuat: hasil.dibuat, diubah: hasil.diubah, oleh: hasil.oleh }));
      if (n === ubah.current) { kotor.current = false; setSimpan('tersimpan'); } else setSimpan('');
      onSimpan(hasil);
      return hasil;
    } catch (e) { setSimpan('gagal'); setPesan((e as Error).message); return null; }
  }, [onSimpan]);
  const kirim = useCallback((keepalive = false): Promise<Surat | null> => {
    const p = antre.current.then(() => kirimSekarang(keepalive));
    antre.current = p.catch(() => null);
    return p;
  }, [kirimSekarang]);

  useEffect(() => {
    if (simpan !== '') return;
    const x = setTimeout(() => { kirim(); }, 2000);
    return () => clearTimeout(x);
  }, [s, simpan, kirim]);
  useEffect(() => {
    const pergi = () => { if (simpanRef.current === '' || simpanRef.current === 'gagal') kirim(true); };
    const onVis = () => { if (document.visibilityState === 'hidden') pergi(); else if (simpanRef.current === 'gagal') kirim(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', pergi);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', pergi); };
  }, [kirim]);

  const tambahFoto = async (li: number, files: File[]) => {
    const baru: FotoSurat[] = [];
    for (const [i, f] of files.entries()) {
      setUpload(`Mengunggah foto ${i + 1}/${files.length}…`);
      try {
        const k = await kecilkan(f);
        const r = await fetch('/api/banding/foto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(k) });
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || 'gagal');
        baru.push({ id: j.id, ket: '' });
      } catch (e) { setPesan(`Foto ${f.name || i + 1} gagal diunggah${(e as Error).message === 'besar' ? ' (terlalu besar)' : ''}.`); }
    }
    setUpload('');
    if (baru.length) ganti((x) => ({ ...x, lampiran: x.lampiran.map((l, j) => (j === li ? { ...l, foto: [...l.foto, ...baru] } : l)) }));
  };
  const ubahLamp = (li: number, f: (l: Surat['lampiran'][number]) => Surat['lampiran'][number]) =>
    ganti((x) => ({ ...x, lampiran: x.lampiran.map((l, j) => (j === li ? f(l) : l)) }));

  const unduhWord = async (bagikan: boolean) => {
    setUnduh(true); setPesan('');
    try {
      await kirim();
      const x = terakhir.current;
      const semua = x.lampiran.flatMap((l, li) => l.foto.map((f) => ambilFoto(f, li)));
      const fotos = (await Promise.all(semua)).filter((f): f is FotoDocx => !!f);
      if (fotos.length < semua.length) setPesan(`${semua.length - fotos.length} foto tidak bisa dimuat dan tidak ikut di file.`);
      await simpanFile(x, fotos, bagikan);
    } catch { setPesan('File Word gagal dibuat. Coba lagi.'); } finally { setUnduh(false); }
  };

  const adaNama = !!(s.data.nama?.trim() || s.data.app?.trim());
  const nFoto = s.lampiran.reduce((a, l) => a + l.foto.length, 0);
  const status = simpan === 'menyimpan' ? 'Menyimpan…' : simpan === 'tersimpan' ? 'Tersimpan' : simpan === 'gagal' ? 'Gagal tersimpan' : adaNama ? 'Belum tersimpan' : 'Isi nama konsumen dulu';
  const input = `${FIELD} min-h-11`;

  return (
    <div className="px-4 pb-40 pt-3">
      <div className="flex items-center gap-2">
        <button onClick={onTutup} className="flex min-h-11 items-center gap-1 rounded-xl pr-3 text-[14px] font-semibold"><Ico n="left" className="h-5 w-5" sw={2} />Daftar surat</button>
        <span role="status" className={`ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold ${simpan === 'gagal' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : simpan === 'tersimpan' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>{status}</span>
      </div>
      <p className="mt-1 text-[13px] text-neutral-500">{t.nama} · {t.sk}</p>

      <Bagian judul="Kop surat" sub={`${perihalSurat(s)} · ${nomorSurat(s)}`}>
        <Isian label="Judul"><input value={s.judul} onChange={(e) => set('judul', e.target.value.toUpperCase())} className={input} /></Isian>
        <Isian label="Perihal" hint={s.perihalOtomatis ? 'Otomatis mengikuti nama konsumen. Ketik untuk mengubah sendiri.' : undefined}>
          <input value={perihalSurat(s)} onChange={(e) => ganti((x) => ({ ...x, perihal: e.target.value, perihalOtomatis: false }))} aria-label="Perihal surat" className={input} />
        </Isian>
        {!s.perihalOtomatis && <button onClick={() => ganti((x) => ({ ...x, perihal: '', perihalOtomatis: true }))} className="mt-1 min-h-10 text-[13px] font-semibold underline">Ikuti nama konsumen lagi</button>}
        <div className="mt-3 grid grid-cols-[5.5rem_1fr] gap-3">
          <Isian label="No. urut"><input value={s.noUrut} onChange={(e) => set('noUrut', e.target.value.replace(/[^0-9A-Za-z.-]/g, ''))} inputMode="numeric" placeholder="308" className={input} /></Isian>
          <Isian label="Kode"><input value={s.kode} onChange={(e) => set('kode', e.target.value.toUpperCase())} className={input} /></Isian>
        </div>
        <Isian label="Tanggal surat" hint="Bulan (romawi) dan tahun nomor surat diambil dari tanggal ini."><input type="date" value={s.tanggal} onChange={(e) => set('tanggal', e.target.value)} className={input} /></Isian>
        <p className="mt-3 rounded-xl bg-neutral-100 px-3 py-2 text-center text-[13px] font-bold dark:bg-neutral-900" aria-label="Nomor surat">{nomorSurat(s)}</p>
      </Bagian>

      <Bagian judul="Dibuat oleh" sub={`${PEMBUAT.nama} · ${PEMBUAT.jabatan} · ${s.approval || '–'}`}>
        <div className="flex flex-wrap gap-2">
          {['Submitted', ''].map((v) => (
            <button key={v || 'kosong'} onClick={() => set('approval', v)} aria-pressed={s.approval === v} className={`min-h-10 rounded-full px-4 text-[13px] font-bold ${s.approval === v ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{v || 'Kosong'}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Isian label="Tanggal"><input type="date" value={s.tglApproval} onChange={(e) => set('tglApproval', e.target.value)} className={input} /></Isian>
          <Isian label="Ket"><input value={s.ket} onChange={(e) => set('ket', e.target.value)} className={input} /></Isian>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-neutral-500">Baris lain tetap kosong untuk diisi masing-masing: {PENYETUJU.map((p) => `${p.nama} (${p.jabatan})`).join(', ')}.</p>
      </Bagian>

      <Bagian judul="Isi dari SK (tetap)" sub="Latar belakang, tujuan, pengajuan" buka={false}>
        {([['A. Latar belakang', t.latar], ['B. Tujuan', t.tujuan], ['C. Pengajuan', t.pengajuan]] as const).map(([j, isi]) => (
          <div key={j} className="mt-3 first:mt-0 text-[13px] leading-relaxed">
            <p className="font-bold">{j}</p>
            <ol className="list-decimal pl-5 text-neutral-700 dark:text-neutral-300">{isi.map((x) => <li key={x}>{x}</li>)}</ol>
          </div>
        ))}
      </Bagian>

      <Bagian judul="Data konsumen" sub={[s.data.nama, s.data.app].filter(Boolean).join(' · ') || `${t.data.length} isian`}>
        {t.data.map((d) => (
          <Isian key={d.k} label={d.label}>
            <input value={s.data[d.k] || ''} onChange={(e) => setData(d.k, d.besar ? e.target.value.toUpperCase() : e.target.value)} placeholder={d.ph}
              list={d.saran ? `saran-${d.k}` : undefined} className={`${input} ${d.k === 'app' || d.k === 'rangka' || d.k === 'mesin' ? 'font-mono' : ''}`} />
            {d.saran && <datalist id={`saran-${d.k}`}>{d.saran.map((x) => <option key={x} value={x} />)}</datalist>}
          </Isian>
        ))}
      </Bagian>

      <Bagian judul="Lampiran" sub={`${nFoto} foto`}>
        {s.lampiran.map((l, li) => {
          const tetap = li < t.lampiran.length;
          return (
            <div key={li} className="mt-5 first:mt-0">
              {tetap ? <p className="text-[14px] font-bold">{li + 1}. {l.judul}</p> : (
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold">{li + 1}.</span>
                  <input value={l.judul} onChange={(e) => ubahLamp(li, (x) => ({ ...x, judul: e.target.value }))} placeholder="Judul lampiran, mis. Foto STNK asli" aria-label={`Judul lampiran ${li + 1}`} className={`${input} flex-1`} />
                  <button onClick={() => ganti((x) => ({ ...x, lampiran: x.lampiran.filter((_, j) => j !== li) }))} aria-label={`Hapus lampiran ${li + 1}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-700 dark:text-red-400"><Ico n="x" className="h-4 w-4" sw={2.2} /></button>
                </div>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2">
                {l.foto.map((f, i) => (
                  <div key={f.id} className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
                    <a href={urlFoto(f.id)} target="_blank" rel="noreferrer" className="block aspect-[3/4] bg-neutral-100 dark:bg-neutral-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urlFoto(f.id)} alt={f.ket || `Foto lampiran ${li + 1}.${i + 1}`} className="h-full w-full object-contain" loading="lazy" />
                    </a>
                    <div className="flex items-center gap-1 p-1.5">
                      <input value={f.ket} onChange={(e) => ubahLamp(li, (x) => ({ ...x, foto: x.foto.map((y) => (y.id === f.id ? { ...y, ket: e.target.value } : y)) }))} placeholder="Keterangan (opsional)" aria-label={`Keterangan foto lampiran ${li + 1}.${i + 1}`}
                        className="min-h-9 min-w-0 flex-1 rounded-lg bg-neutral-100 px-2 text-[13px] outline-none dark:bg-neutral-900" />
                      <button onClick={() => ubahLamp(li, (x) => ({ ...x, foto: x.foto.filter((y) => y.id !== f.id) }))} aria-label={`Hapus foto lampiran ${li + 1}.${i + 1}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-700 dark:text-red-400"><Ico n="x" className="h-4 w-4" sw={2.2} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                {([['Galeri', false], ['Kamera', true]] as const).map(([lb, cam]) => (
                  <label key={lb} className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-neutral-300 text-[14px] font-semibold dark:border-neutral-700 ${upload ? 'pointer-events-none opacity-50' : ''}`}>
                    + {lb}
                    <input type="file" accept="image/*" multiple={!cam} {...(cam ? { capture: 'environment' as const } : {})} className="sr-only" aria-label={`Tambah foto lampiran ${li + 1} dari ${lb.toLowerCase()}`}
                      onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) tambahFoto(li, fs); }} />
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        {upload && <p role="status" className="mt-2 text-[13px] font-semibold">{upload}</p>}
        <button onClick={() => ganti((x) => ({ ...x, lampiran: [...x.lampiran, { judul: '', foto: [] }] }))} className="mt-4 min-h-11 w-full rounded-xl bg-neutral-100 text-[14px] font-semibold dark:bg-neutral-800">+ Tambah poin lampiran</button>
      </Bagian>

      {pesan && <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">{pesan}</p>}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 border-t border-neutral-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto grid max-w-xl grid-cols-[1fr_1fr_auto] gap-2">
          <button onClick={() => setLihat(true)} disabled={!adaNama} className="min-h-12 rounded-2xl border border-neutral-300 text-[15px] font-bold disabled:opacity-40 dark:border-neutral-700">Preview</button>
          <button onClick={() => unduhWord(false)} disabled={unduh || !adaNama} className="min-h-12 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900">{unduh ? 'Menyiapkan…' : 'Unduh Word'}</button>
          <button onClick={() => unduhWord(true)} disabled={unduh || !adaNama} aria-label="Bagikan Word" className="min-h-12 rounded-2xl bg-[#0F8048] px-4 text-[15px] font-bold text-white disabled:opacity-40">Bagikan</button>
        </div>
      </div>
      {lihat && <Pratinjau s={s} sibuk={unduh} onTutup={() => setLihat(false)} onUnduh={(bg) => unduhWord(bg)} />}
    </div>
  );
}

/* ---------- Halaman ---------- */
export default function SuratPage({ akun, reloadKey = 0 }: { akun: Akun; reloadKey?: number }) {
  void akun;
  const [list, setList] = useState<Surat[] | null>(null);
  const [err, setErr] = useState('');
  const [buka, setBuka] = useState<Surat | null>(null);

  const muat = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch('/api/surat', { cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || 'Gagal memuat.');
      setList((j.list || []).map(rapikanSurat));
    } catch (e) { setErr((e as Error).message); setList([]); }
  }, []);
  useEffect(() => { muat(); }, [muat, reloadKey]);

  // Halaman dimuat ulang saat surat masih terbuka → buka lagi (termasuk draf yang belum sampai server)
  const pulih = useRef(false);
  useEffect(() => {
    if (pulih.current || list === null) return;
    pulih.current = true;
    const x = suratTerbuka();
    if (!x) return;
    const ada = list.find((y) => y.id === x.id);
    const draf = baca<{ s: Surat }>(DRAF + x.id);
    if (ada) setBuka(ada); else if (draf?.s) setBuka(rapikanSurat({ ...draf.s, diubah: '' })); else buang(BUKA);
  }, [list]);

  const simpanLokal = useCallback((s: Surat) => setList((l) => [s, ...(l || []).filter((x) => x.id !== s.id)]), []);
  const hapus = async (s: Surat) => {
    if (!window.confirm(`Hapus surat ${perihalSurat(s)}?`)) return;
    const r = await fetch(`/api/surat?id=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
    if (r.ok) setList((l) => (l || []).filter((x) => x.id !== s.id));
  };
  const baru = (template: string) => {
    const contoh = list?.find((x) => x.template === template);
    setBuka(suratBaru(template, { id: idSuratBaru(), tanggal: todayJkt(), noUrut: noUrutBerikut(list || []), kode: contoh?.kode || 'MKT-KENDAL' }));
  };

  if (buka) return <Editor key={buka.id} awal={buka} onTutup={() => { buang(BUKA); setBuka(null); muat(); }} onSimpan={simpanLokal} />;

  return (
    <div className="px-4 pb-10 pt-4">
      <section className="rounded-3xl bg-neutral-900 p-5 text-white">
        <p className="text-[13px] font-bold uppercase tracking-wide text-neutral-400">Surat IM · Berita acara</p>
        <p className="mt-1 text-[15px] leading-snug text-neutral-200">Pilih template SK, isi data konsumen & foto lampiran. Isi SK tetap, hasilnya file Word siap kirim.</p>
      </section>
      <p className="mt-6 text-[15px] font-bold">Buat surat baru</p>
      <ul className="mt-2 space-y-2">
        {TEMPLATE_SURAT.map((t) => (
          <li key={t.id}>
            <button onClick={() => baru(t.id)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-[20px] font-bold dark:bg-neutral-800">+</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold">{t.nama}</span>
                <span className="block text-[12px] text-neutral-500">{t.ringkas}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-neutral-500">Template SK lain akan ditambahkan di sini.</p>

      <p className="mt-6 text-[15px] font-bold">Surat tersimpan</p>
      {err && <p className="mt-2 text-[13px] text-red-700 dark:text-red-300">{err}</p>}
      {list === null ? <p className="mt-2 text-[13px] text-neutral-500">Memuat…</p> : !list.length ? (
        <p className="mt-2 text-[14px] text-neutral-500">Belum ada surat.</p>
      ) : (
        <ul className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {list.map((s) => (
            <li key={s.id} className="flex items-center border-b border-neutral-200 last:border-0 dark:border-neutral-800">
              <button onClick={() => setBuka(s)} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center px-4 py-2 text-left active:bg-neutral-50 dark:active:bg-neutral-900">
                <span className="truncate text-[15px] font-bold">{s.data.nama || '(tanpa nama)'}</span>
                <span className="truncate text-[12px] text-neutral-500">{[templateSurat(s.template).nama, nomorSurat(s), `${s.lampiran.reduce((a, l) => a + l.foto.length, 0)} foto`].join(' · ')}</span>
              </button>
              <button onClick={() => hapus(s)} aria-label={`Hapus surat ${s.data.nama}`} className="flex h-12 w-12 shrink-0 items-center justify-center text-neutral-400"><Ico n="x" className="h-4 w-4" sw={2} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
