'use client';
import { useEffect, useRef, useState } from 'react';
import type { Orang } from '../../lib/performa-types';
import type { Ctx } from '../../lib/performa-calc';
import { gambarAchievement, gambarAktivitas, gambarBahan, gambarFollowUp, gambarProyeksi, gambarSore, gambarFuKons, pakaiFont, tinggiAchievement, tinggiAktivitas, tinggiBahan, tinggiFollowUp, tinggiProyeksi, type DataSore, type DataFuKons } from './laporan-gambar';
import { keyOf } from '../../lib/performa-calc';
const day10 = (s: string) => String(s || '').slice(0, 10);
import type { PlanItem } from '../../lib/plan-types';
import { FU_TARGET_HARIAN } from '../../lib/prospek-types';
import { samaOrang } from '../../lib/sales-brand';
import { peranDari } from '../../lib/posisi-isi';
import type { Bahan } from '../../lib/bahan-types';
import { ambilBahanProyeksi, hitungSemua, type DataProyeksi, type Mode } from './proyeksi-data';
import type { LaporanFU } from '../../lib/prospek-types';
import { todayJkt } from '../../lib/performa-calc';
import { useOverlay } from '../overlay';
import { PillSeg } from './parts';

// Laporan bergambar: achievement (cabang, Mobilku, Motorku) dan aktivitas CMO & MAO.
// Gambar dibuat di HP dari data pantauan terakhir, bisa diunduh (PNG), dibagikan, atau dibuka layar penuh
// supaya gampang di-screenshot.

export type Jenis = 'sore' | 'fukons' | 'achievement' | 'aktivitas' | 'fu' | 'proyeksi' | 'bahan';
const JUDUL: Record<Jenis, string> = { sore: 'Report Sore', fukons: 'FU Konsumen Plan', achievement: 'Achievement', aktivitas: 'Aktivitas CMO & MAO', fu: 'Follow Up Prospek', proyeksi: 'Proyeksi Sales', bahan: 'Bahan Survey & Proses' };
const kemarin = (tgl: string) => { const d = new Date(tgl + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

const muatGambar = (src: string) => new Promise<HTMLImageElement | null>((ok) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => ok(null);
  img.src = src;
});

// Data report sore satu PIC: plan hari ini, follow up prospek, bahan, dan angka pantauan
async function dataSore(c: Ctx, pic: string, tgl: string): Promise<DataSore> {
  const ambil = async (url: string) => { const r = await fetch(url, { cache: 'no-store' }); const j = await r.json().catch(() => null); if (!r.ok) throw new Error(j?.error || 'Data gagal dimuat.'); return j; };
  const [pj, fj, bj] = await Promise.all([ambil(`/api/plan?tgl=${tgl}`), ambil(`/api/prospek/laporan?tgl=${tgl}`).catch(() => null), ambil('/api/bahan')]);
  const milik = (n: string) => !!n && samaOrang(n, pic);
  const fu = fj as LaporanFU | null;
  const bahan = ((bj?.list || []) as Bahan[]).filter((b) => milik(b.pic || b.nama));
  const bulan = tgl.slice(0, 7);
  return {
    tgl, nama: pic, peran: peranDari(pic),
    o: (c.data.orang || []).find((o) => samaOrang(o.nama, pic)) || null,
    plan: ((pj?.list || []) as PlanItem[]).filter((p) => !p.spv && milik(p.nama) && !p.id.startsWith('wajib:'))
      .sort((a, b) => a.dibuat.localeCompare(b.dibuat)),
    fu: fu?.orang.find((x) => milik(x.nama)) || null, fuTarget: fu?.target || FU_TARGET_HARIAN,
    minat: (fu?.minat || []).filter((m) => milik(m.oleh)),
    bahan: bahan.filter((b) => b.status === 'aktif'),
    cairBulan: bahan.filter((b) => b.status === 'cair' && (b.diubah || '').slice(0, 7) === bulan),
  };
}

// Konsumen yang di-plan pagi (visit) + hasil follow up-nya, dicocokkan dengan catatan visit di pantauan
async function dataFuKons(c: Ctx, pic: string, tgl: string): Promise<DataFuKons> {
  const r = await fetch(`/api/plan?tgl=${tgl}`, { cache: 'no-store' });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error || 'Plan gagal dimuat.');
  const plan = ((j?.list || []) as PlanItem[]).filter((p) => !p.spv && p.jenis === 'visit' && samaOrang(p.nama, pic)).sort((a, b) => a.dibuat.localeCompare(b.dibuat));
  const semua = [...(c.data.aktivitas?.konsumen?.mobilku || []), ...(c.data.aktivitas?.konsumen?.motorku || [])];
  const kunci = (s: string) => keyOf(s).replace(/[^A-Z ]/g, '').replace(/^(BAPAK|BPK|PAK|IBU|BU|SDR|SDRI)\s+/, '').trim();
  return {
    tgl, nama: pic, peran: peranDari(pic),
    baris: plan.map((p) => {
      const k = semua.find((x) => kunci(x.n) && kunci(x.n) === kunci(p.siapa));
      const rows = (k?.v || []).filter((v) => day10(v.tgl) === tgl && (!v.pic || samaOrang(v.pic, pic)));
      return { p, prioritas: k?.p || null, visit: rows[rows.length - 1] || null };
    }),
  };
}

async function buatGambar(jenis: Jenis, c: Ctx, spv: Orang | null, tgl: string, mode: Mode, pic = ''): Promise<Blob | null> {
  const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-instrument').trim();
  if (fam) {
    pakaiFont(`${fam}, system-ui, sans-serif`);
    try { await Promise.all([400, 600, 700].map((w) => document.fonts.load(`${w} 40px ${fam}`))); } catch { /* pakai font cadangan */ }
  }
  const logo = await muatGambar('/icon-192.png');
  let fu: LaporanFU | null = null;
  if (jenis === 'fu') {
    const r = await fetch(`/api/prospek/laporan?tgl=${tgl}`, { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.total) throw new Error(j?.error || 'Laporan follow up gagal dimuat.');
    fu = j as LaporanFU;
  }
  let pro: DataProyeksi | null = null;
  if (jenis === 'proyeksi') pro = hitungSemua(c, await ambilBahanProyeksi(), mode);
  let bahan: Bahan[] | null = null;
  if (jenis === 'bahan') {
    const r = await fetch('/api/bahan', { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(j?.list)) throw new Error(j?.error || 'Bahan survey gagal dimuat.');
    bahan = j.list as Bahan[];
  }
  if (jenis === 'sore' || jenis === 'fukons') {
    if (!pic) throw new Error('Pilih PIC dulu.');
    // Digambar di kanvas tinggi, lalu dipotong sesuai isi
    const tmp = document.createElement('canvas');
    tmp.width = 1080; tmp.height = 9000;
    const tg = tmp.getContext('2d');
    if (!tg) return null;
    const h = Math.min(9000, jenis === 'sore' ? gambarSore(tg, c, await dataSore(c, pic, tgl), logo) : gambarFuKons(tg, c, await dataFuKons(c, pic, tgl), logo));
    const cv = document.createElement('canvas');
    cv.width = 1080; cv.height = h;
    cv.getContext('2d')?.drawImage(tmp, 0, 0, 1080, h, 0, 0, 1080, h);
    return new Promise((ok) => cv.toBlob((b) => ok(b), 'image/png'));
  }
  const cv = document.createElement('canvas');
  cv.width = 1080;
  cv.height = fu ? tinggiFollowUp(fu) : pro ? tinggiProyeksi(pro) : bahan ? tinggiBahan(bahan) : jenis === 'achievement' ? tinggiAchievement(c, spv) : tinggiAktivitas(c, spv);
  const g = cv.getContext('2d');
  if (!g) return null;
  if (fu) gambarFollowUp(g, fu, String(c.data.cabang || 'Kendal'), logo, (c.data.orang || []).filter((o) => o !== spv && (o.visit || o.maintain)).length);
  else if (pro) gambarProyeksi(g, c, pro, mode, logo);
  else if (bahan) gambarBahan(g, c, bahan, logo);
  else if (jenis === 'achievement') gambarAchievement(g, c, spv, logo);
  else gambarAktivitas(g, c, spv, logo);
  return new Promise((ok) => cv.toBlob((b) => ok(b), 'image/png'));
}

function LayarPenuh({ url, onClose }: { url: string; onClose: () => void }) {
  useOverlay(true, onClose);
  const [petunjuk, setPetunjuk] = useState(true);
  useEffect(() => { const t = setTimeout(() => setPetunjuk(false), 2500); return () => clearTimeout(t); }, []);
  return (
    <button onClick={onClose} aria-label="Tutup layar penuh"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#F4F2EE] p-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Laporan" className="max-h-full max-w-full object-contain" />
      {petunjuk && (
        <span className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom)+24px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900/85 px-4 py-2 text-sm font-semibold text-white">
          Siap di-screenshot · ketuk untuk menutup
        </span>
      )}
    </button>
  );
}

export default function Laporan({ c, spv, awal = 'achievement', tim = [], aku = '', semua = false }: { c: Ctx; spv: Orang | null; awal?: Jenis; tim?: string[]; aku?: string; semua?: boolean }) {
  const [jenis, setJenis] = useState<Jenis>(awal);
  // Report sore: owner/SPV memilih PIC; staff langsung dirinya sendiri
  const pilihanPic = semua ? tim : tim.filter((n) => aku && samaOrang(n, aku)).concat(tim.some((n) => aku && samaOrang(n, aku)) || !aku ? [] : [aku]);
  const [pic, setPic] = useState(() => (awal === 'fukons' && pilihanPic.find((n) => /NAUFAL/i.test(n))) || pilihanPic[0] || aku || '');
  const [tgl, setTgl] = useState(() => todayJkt());
  const [mode, setMode] = useState<Mode>('maksimal');
  const [gambar, setGambar] = useState<{ jenis: Jenis; tgl: string; mode: Mode; url: string; blob: Blob; pic: string } | null>(null);
  const [err, setErr] = useState('');
  const [penuh, setPenuh] = useState(false);
  const [toast, setToast] = useState('');
  const urlLama = useRef('');

  useEffect(() => {
    let alive = true;
    setErr('');
    buatGambar(jenis, c, spv, tgl, mode, pic).then((blob) => {
      if (!alive) return;
      if (!blob) { setErr('Gambar tidak bisa dibuat di HP ini.'); return; }
      const url = URL.createObjectURL(blob);
      if (urlLama.current) URL.revokeObjectURL(urlLama.current);
      urlLama.current = url;
      setGambar({ jenis, tgl, mode, url, blob, pic });
    }).catch((e) => { if (alive) setErr((e as Error)?.message && (jenis === 'fu' || jenis === 'proyeksi' || jenis === 'bahan' || jenis === 'sore' || jenis === 'fukons') ? (e as Error).message : 'Gambar tidak bisa dibuat. Coba muat ulang.'); });
    return () => { alive = false; };
  }, [jenis, c, spv, tgl, mode, pic]);
  useEffect(() => () => { if (urlLama.current) URL.revokeObjectURL(urlLama.current); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2200); return () => clearTimeout(t); }, [toast]);

  const siap = gambar && gambar.jenis === jenis && ((jenis !== 'fu' && jenis !== 'sore' && jenis !== 'fukons') || gambar.tgl === tgl) && (jenis !== 'proyeksi' || gambar.mode === mode) && ((jenis !== 'sore' && jenis !== 'fukons') || gambar.pic === pic) ? gambar : null;
  const namaFile = `Laporan ${JUDUL[jenis]}${jenis === 'sore' || jenis === 'fukons' ? ` ${pic.split(' ').find((w) => !/^(MUHAMMAD|MUHAMAD|MOCH|MOH|M)$/i.test(w)) || pic}` : ''} ${String(c.data.cabang || 'Kendal')} ${jenis === 'fu' || jenis === 'sore' || jenis === 'fukons' ? tgl : c.today}.png`.replace(/[^\w\s.&-]/g, '').replace(/\s+/g, '-');
  const bisaBagikan = typeof navigator !== 'undefined' && !!navigator.canShare && !!siap
    && navigator.canShare({ files: [new File([siap.blob], namaFile, { type: 'image/png' })] });
  const bagikan = async () => {
    if (!siap) return;
    try {
      await navigator.share({ files: [new File([siap.blob], namaFile, { type: 'image/png' })], title: `Laporan ${JUDUL[jenis]}` });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setToast('Gagal membagikan. Pakai Unduh gambar.');
    }
  };

  return (
    <div className="pb-8">
      <div className="px-4 pt-3">
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
          <PillSeg value={jenis} rapat onChange={(v) => setJenis(v)} options={[['sore', 'Report sore'], ['fukons', 'FU konsumen'], ['achievement', 'Achievement'], ['aktivitas', 'Aktivitas'], ['fu', 'Follow up'], ['proyeksi', 'Proyeksi'], ['bahan', 'Bahan']]} />
        </div>
        {(jenis === 'sore' || jenis === 'fukons') && pilihanPic.length > 1 && (
          <div className="-mx-4 mt-2 overflow-x-auto px-4 [scrollbar-width:none]">
            <PillSeg value={pic} rapat onChange={(v) => setPic(v)} options={pilihanPic.map((n) => [n, n.split(/\s+/).find((w) => !/^(MUHAMMAD|MUHAMAD|MOCH|MOH|M)$/i.test(w))?.replace(/^\w/, (h) => h.toUpperCase()).replace(/\B\w+/, (x) => x.toLowerCase()) || n] as [string, string])} />
          </div>
        )}
        {jenis === 'proyeksi' && (
          <div className="mt-2">
            <PillSeg value={mode} onChange={(v) => setMode(v)} options={[['maksimal', '+ Diproses + Bahan survey'], ['realistis', '+ Diproses saja']]} />
          </div>
        )}
        {(jenis === 'fu' || jenis === 'sore' || jenis === 'fukons') && (
          <div className="mt-2">
            <PillSeg value={tgl === todayJkt() ? 'ini' : 'kemarin'} onChange={(v) => setTgl(v === 'ini' ? todayJkt() : kemarin(todayJkt()))}
              options={[['ini', 'Hari ini'], ['kemarin', 'Kemarin']]} />
          </div>
        )}
      </div>
      <p className="px-4 pt-3 text-[13px] leading-snug text-neutral-500">
        {jenis === 'fukons'
          ? 'Konsumen yang di-plan pagi (visit) dan hasil follow up-nya: minat, bertemu, tidak bertemu, tidak minat, atau belum di-FU. Hasil diambil dari Plan, dilengkapi catatan visit di pantauan.'
          : jenis === 'sore'
          ? 'Report sore per PIC: achievement, plan & realisasi hari ini, hasil follow up prospek, dan update bahan. Lengkapi hasil di Plan & step di Bahan survey dulu, lalu bagikan ke grup.'
          : jenis === 'achievement'
          ? 'Cabang, Mobilku, dan Motorku beserta pencapaian tiap PIC. Dibuat dari data pantauan terakhir.'
          : jenis === 'bahan'
            ? 'Bahan yang sedang diproses dan yang belum disurvey, per PIC survey: konsumen, nominal, kendaraan, sumber, dan step terakhir.'
            : jenis === 'proyeksi'
            ? 'Proyeksi = tercapai + bahan yang masih berjalan (menu Bahan survey), dibanding target dan bulan lalu, per brand dan per orang.'
            : jenis === 'aktivitas'
            ? 'Visit konsumen prioritas P1–P3, maintain MA, rekrut, dan regist per orang. Dibuat dari data pantauan terakhir.'
            : 'Prospek yang di-follow up: minat (termasuk order), tidak minat, dan tidak ada respon, per orang. Dari catatan "Catat hasil" di Database prospek.'}
      </p>

      <div className="mx-4 mt-3 overflow-hidden rounded-[20px] border border-neutral-200 bg-[#F4F2EE] dark:border-neutral-800">
        {err ? (
          <p className="p-6 text-center text-sm text-red-700 dark:text-red-400">{err}</p>
        ) : siap ? (
          <button onClick={() => setPenuh(true)} aria-label="Buka layar penuh" className="block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={siap.url} alt={`Laporan ${JUDUL[jenis]}`} className="block w-full" />
          </button>
        ) : (
          <div aria-label="Membuat gambar" className="aspect-[1080/1600] w-full animate-pulse bg-neutral-200/70 dark:bg-neutral-800/70" />
        )}
      </div>

      <div className="mt-3 grid gap-2 px-4">
        <a href={siap?.url} download={namaFile} aria-disabled={!siap}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white dark:bg-white dark:text-neutral-900 ${siap ? '' : 'pointer-events-none opacity-50'}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 20h14" /></svg>
          Unduh gambar
        </a>
        <div className={`grid gap-2 ${bisaBagikan ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {bisaBagikan && (
            <button onClick={bagikan} className="min-h-12 rounded-2xl bg-[#0F8048] text-[15px] font-bold text-white">Bagikan (WhatsApp)</button>
          )}
          <button onClick={() => setPenuh(true)} disabled={!siap}
            className="min-h-12 rounded-2xl border border-neutral-300 text-[15px] font-semibold disabled:opacity-50 dark:border-neutral-700">
            Layar penuh untuk screenshot
          </button>
        </div>
      </div>

      {penuh && siap && <LayarPenuh url={siap.url} onClose={() => setPenuh(false)} />}
      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex justify-center px-5">
          <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">{toast}</div>
        </div>
      )}
    </div>
  );
}
