'use client';
// Target maintain MA: tiap MA diberi warna (Kuning 4x · Orange 3x · Hijau 2x · Biru 1x · Putih tidak perlu),
// dibandingkan dengan maintain yang sudah tercatat, lalu kekurangannya dibagi ke sisa hari kerja.
// Owner & SPV mengatur target; semua akun bisa melihat dan membagikan report gambarnya.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Orang } from '../../lib/performa-types';
import { brandOf, type Ctx } from '../../lib/performa-calc';
import { LEVEL, hariKerjaDari, hitungTarget, jadwalSaran, levelDari, rapikanTarget, type BarisMa, type BrandMa, type Level, type TargetMa } from '../../lib/maintain-target';
import { Kosong, PillSeg } from './parts';
import { Lembar } from './form';
import { nama, tanggal } from './ui';
import { gambarMaintainMa, pakaiFont, tinggiMaintainMa } from './laporan-gambar';

type Akun = { email: string; role: string };
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const hariLabel = (d: string) => `${HARI[new Date(d + 'T00:00:00Z').getUTCDay()]}, ${tanggal(d, true)}`;
const NAMA_SKIP = /^(MUHAMMAD|MUHAMAD|MOHAMMAD|MOH\.?|MOCH\.?|M\.?)$/i;
const pendek = (n: string) => { const w = String(n || '').trim().split(/\s+/); return nama(w.find((s) => !NAMA_SKIP.test(s)) || w[0] || ''); };

export default function TargetMaintain({ c, me, akun }: { c: Ctx; me: Orang | null; akun: Akun }) {
  const [brand, setBrand] = useState<BrandMa>(me && brandOf(me) === 'motorku' ? 'motorku' : 'mobilku');
  const [t, setT] = useState<TargetMa | null>(null);
  const [err, setErr] = useState('');
  const [pilih, setPilih] = useState<BarisMa | 'semua' | null>(null);
  const [simpan, setSimpan] = useState(false);
  const [ket, setKet] = useState('');
  const [gambar, setGambar] = useState<{ url: string; blob: Blob } | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let hidup = true;
    fetch('/api/maintain-target', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => null);
      if (!hidup) return;
      if (!r.ok) { setErr(j?.error || 'Target maintain belum bisa dibaca.'); return; }
      setT(rapikanTarget(j));
    }).catch(() => hidup && setErr('Target maintain belum bisa dibaca. Cek koneksi.'));
    return () => { hidup = false; };
  }, []);
  useEffect(() => { if (t) setKet(t.ket[brand]); }, [t, brand]);
  useEffect(() => { if (!toast) return; const x = setTimeout(() => setToast(''), 2200); return () => clearTimeout(x); }, [toast]);

  const list = useMemo(() => c.data.aktivitas?.ma?.[brand] || [], [c.data, brand]);
  const h = useMemo(() => hitungTarget(list, t?.target[brand] || {}), [list, t, brand]);
  const hari = useMemo(() => hariKerjaDari(c.today), [c.today]);
  const perHari = hari.length ? Math.ceil(h.kurang / hari.length) : h.kurang;
  const jadwal = useMemo(() => jadwalSaran(h.baris, hari), [h, hari]);
  const boleh = !!t?.bolehUbah;

  const kirim = async (ubah: { nama: string; target: number | null }[], ketBaru?: string) => {
    if (!t) return;
    const lama = t;
    // Langsung tampil, lalu disimpan; kalau gagal dikembalikan
    const baru: TargetMa = { ...t, target: { ...t.target, [brand]: { ...t.target[brand] } }, ket: { ...t.ket } };
    for (const u of ubah) {
      const k = u.nama.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (u.target === null) delete baru.target[brand][k]; else baru.target[brand][k] = u.target;
    }
    if (typeof ketBaru === 'string') baru.ket[brand] = ketBaru;
    setT(baru); setSimpan(true);
    try {
      const r = await fetch('/api/maintain-target', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brand, ubah, ket: ketBaru }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || 'Gagal menyimpan.');
      setT(rapikanTarget(j));
    } catch (e) {
      setT(lama); setToast((e as Error).message || 'Gagal menyimpan. Coba lagi.');
    } finally { setSimpan(false); }
  };
  const atur = (lv: Level | null) => {
    if (!pilih) return;
    const sasaran = pilih === 'semua' ? h.belum : [pilih];
    kirim(sasaran.map((b) => ({ nama: b.m.n, target: lv ? lv.target : null })));
    setPilih(null);
  };

  const buatReport = async () => {
    try {
      const fam = getComputedStyle(document.documentElement).getPropertyValue('--font-instrument').trim();
      if (fam) { pakaiFont(`${fam}, system-ui, sans-serif`); try { await Promise.all([400, 700].map((w) => document.fonts.load(`${w} 40px ${fam}`))); } catch { /* font cadangan */ } }
      const d = { brand, ket: t?.ket[brand] || ket, per: c.data.updated || c.today, hasil: h, sisaHari: hari.length, perHari };
      const cv = document.createElement('canvas');
      cv.width = 1080; cv.height = tinggiMaintainMa(d);
      const g = cv.getContext('2d');
      if (!g) throw new Error();
      gambarMaintainMa(g, d);
      const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/png'));
      if (!blob) throw new Error();
      if (gambar) URL.revokeObjectURL(gambar.url);
      setGambar({ url: URL.createObjectURL(blob), blob });
    } catch { setToast('Gambar tidak bisa dibuat di HP ini.'); }
  };
  const namaFile = `Report-Maintain-MA-${brand === 'mobilku' ? 'Mobilku' : 'Motorku'}-${c.today}.png`;
  const bagikan = async () => {
    if (!gambar) return;
    const f = new File([gambar.blob], namaFile, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: 'Report maintain MA' });
      else { const a = document.createElement('a'); a.href = gambar.url; a.download = namaFile; a.click(); }
    } catch (e) { if ((e as Error)?.name !== 'AbortError') setToast('Gagal membagikan. Coba Unduh.'); }
  };

  const status = (b: BarisMa) => b.target === null || b.target === 0
    ? <span className="w-12 text-right text-neutral-400">—</span>
    : b.capai ? <span className="w-12 text-right font-bold text-green-700 dark:text-green-400">✓ OK</span>
      : <span className="w-12 text-right font-bold text-red-700 dark:text-red-400">-{b.kurang}</span>;
  const nilai = (b: BarisMa) => (b.target === null || b.target === 0 ? `${b.f}x` : `${b.f}/${b.target}`);
  const baris = (b: BarisMa, i: number) => {
    const isi = (
      <>
        <span className="w-6 shrink-0 text-[13px] text-neutral-400">{i + 1}.</span>
        <span className="min-w-0 flex-1 truncate text-[15px]">{nama(b.m.n)}</span>
        <span className="w-12 text-right text-[15px] font-bold tabular-nums">{nilai(b)}</span>
        <span className="text-[15px] tabular-nums">{status(b)}</span>
      </>
    );
    return boleh
      ? <button key={b.kunci} onClick={() => setPilih(b)} className="flex min-h-12 w-full items-center gap-2 border-t border-neutral-100 px-4 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">{isi}</button>
      : <div key={b.kunci} className="flex min-h-12 items-center gap-2 border-t border-neutral-100 px-4 dark:border-neutral-800">{isi}</div>;
  };
  const grup = (id: string, judul: string, bg: string, fg: string, list: BarisMa[], aksi?: ReactNode) => (
    <section key={id} className="mt-3 overflow-hidden rounded-[20px] border border-neutral-200 dark:border-neutral-800">
      <div className="flex min-h-12 items-center justify-between gap-2 px-4" style={{ background: bg, color: fg }}>
        <span className="text-[15px] font-bold">{judul}</span>{aksi}
      </div>
      <div className="flex items-center justify-end gap-2 px-4 pb-1 pt-2 text-[12px] text-neutral-500"><span className="w-12 text-right">Maintain</span><span className="w-12 text-right">Status</span></div>
      {list.map((b, i) => baris(b, i))}
    </section>
  );

  return (
    <div className="px-4 pb-10 pt-4">
      <div className="flex items-center justify-between gap-3">
        <PillSeg value={brand} onChange={setBrand} options={[['mobilku', 'Mobilku'], ['motorku', 'Motorku']]} />
        {simpan && <span className="text-[13px] text-neutral-500">Menyimpan…</span>}
      </div>
      <p className="mt-2 text-[13px] text-neutral-500">
        Maintain tercatat per {tanggal(c.data.updated || c.today)} · {boleh ? 'ketuk nama MA untuk mengatur targetnya' : 'target diatur owner/SPV'}
      </p>

      {err && <p className="mt-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{err}</p>}

      {!list.length ? (
        <Kosong title="Daftar MA belum ada" text="Daftar MA muncul setelah tab AKTIVITAS MAINTAIN di pantauan terkirim." />
      ) : (<>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([['MA wajib', String(h.wajib), 'text-[#10294A] dark:text-[#AFC3EC]'], ['Sudah capai', String(h.capai), 'text-green-700 dark:text-green-400'], ['Kurang maintain', `${h.kurang}x`, 'text-red-700 dark:text-red-400']] as const).map(([l, v, w]) => (
            <div key={l} className="rounded-2xl border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-[12px] text-neutral-500">{l}</p>
              <p className={`mt-0.5 text-2xl font-bold tabular-nums ${w}`}>{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-2xl bg-[#10294A] p-4 text-white">
          <p className="text-[13px] text-white/70">Sisa hari kerja (Senin–Sabtu)</p>
          {hari.length ? (
            <p className="mt-0.5 text-[15px]"><b className="text-xl">{hari.length} hari</b> · perlu <b className="text-xl">±{perHari}</b> maintain per hari</p>
          ) : <p className="mt-0.5 text-[15px] font-bold">Hari kerja bulan ini sudah habis</p>}
          {h.kurang > 0 && hari.length > 0 && <p className="mt-1 text-[13px] text-white/70">Total {h.kurang} maintain lagi dari {h.wajib - h.capai} MA yang belum capai target.</p>}
        </div>

        {h.grup.map((g) => grup(g.level.id, `${g.level.label} — ${g.level.wajib}`, g.level.bg, g.level.fg, g.baris))}
        {h.belum.length > 0 && grup('belum', `Belum ditarget · ${h.belum.length} MA`, '#E4E4E7', '#1A1A1A', h.belum,
          boleh ? <button onClick={() => setPilih('semua')} className="min-h-9 rounded-full bg-white px-3 text-[13px] font-bold text-neutral-900">Atur semua</button> : undefined)}

        {jadwal.some((d) => d.ma.length) && (
          <details className="group mt-5 rounded-[20px] border border-neutral-200 dark:border-neutral-800">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4">
              <span>
                <span className="block text-[15px] font-bold">Saran jadwal maintain</span>
                <span className="block text-[12px] text-neutral-500">Kekurangan tiap MA disebar ke {hari.length} hari kerja tersisa</span>
              </span>
              <span className="text-neutral-400 transition group-open:rotate-180">▾</span>
            </summary>
            <div className="space-y-2 px-4 pb-4">
              {jadwal.filter((d) => d.ma.length).map((d) => (
                <div key={d.tgl} className={`rounded-2xl p-3 ${d.tgl === c.today ? 'bg-[#E8EEF9] dark:bg-[#16223D]' : 'bg-neutral-50 dark:bg-neutral-900'}`}>
                  <p className="text-[13px] font-bold">{d.tgl === c.today ? 'Hari ini · ' : ''}{hariLabel(d.tgl)} <span className="font-semibold text-neutral-500">· {d.ma.length} MA</span></p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {d.ma.map((b) => {
                      const lv = levelDari(b.target || 0);
                      return (
                        <span key={b.kunci} className="flex min-h-8 items-center gap-1.5 rounded-full bg-white px-2.5 text-[13px] font-semibold dark:bg-neutral-800">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: lv.bg }} />{pendek(b.m.n)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {boleh && (
          <label className="mt-5 block">
            <span className="text-[13px] font-semibold text-neutral-500">Keterangan di report</span>
            <input value={ket} onChange={(e) => setKet(e.target.value)} maxLength={80} data-boleh-muat
              onBlur={() => { if (t && ket.trim() && ket.trim() !== t.ket[brand]) kirim([], ket.trim()); }}
              className="mt-1 min-h-12 w-full rounded-2xl border border-neutral-200 bg-transparent px-4 text-[15px] outline-none focus:border-neutral-400 dark:border-neutral-800" />
          </label>
        )}
        <button onClick={buatReport} className="mt-4 min-h-12 w-full rounded-full bg-neutral-900 text-[15px] font-bold text-white active:opacity-80 dark:bg-white dark:text-neutral-900">
          Buat report gambar
        </button>
      </>)}

      {pilih && (
        <Lembar judul={pilih === 'semua' ? `Target untuk ${h.belum.length} MA yang belum ditarget` : nama(pilih.m.n)} onClose={() => setPilih(null)}>
          <div className="overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-2">
            {pilih !== 'semua' && <p className="text-sm text-neutral-500">Sudah dimaintain {pilih.f}x bulan ini{pilih.m.job ? ` · ${nama(pilih.m.job)}` : ''}</p>}
            <div className="mt-3 space-y-2">
              {LEVEL.map((lv) => {
                const aktif = pilih !== 'semua' && pilih.target !== null && levelDari(pilih.target).id === lv.id;
                return (
                  <button key={lv.id} onClick={() => atur(lv)} aria-pressed={aktif}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left ${aktif ? 'border-neutral-900 dark:border-white' : 'border-neutral-200 dark:border-neutral-800'}`}>
                    <span className="h-7 w-7 shrink-0 rounded-full border border-black/10" style={{ background: lv.bg }} />
                    <span className="flex-1"><span className="block text-[15px] font-bold">{lv.label}</span><span className="block text-[13px] text-neutral-500">{lv.wajib}</span></span>
                    {aktif && <span className="text-[13px] font-bold">Dipilih</span>}
                  </button>
                );
              })}
              {pilih !== 'semua' && pilih.target !== null && (
                <button onClick={() => atur(null)} className="min-h-12 w-full rounded-2xl text-[15px] font-semibold text-red-700 dark:text-red-400">Hapus target</button>
              )}
            </div>
          </div>
        </Lembar>
      )}

      {gambar && (
        <Lembar judul="Report maintain MA" onClose={() => setGambar(null)}>
          <div className="overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gambar.url} alt="Report maintain MA" className="w-full rounded-2xl border border-neutral-200 dark:border-neutral-800" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={bagikan} className="min-h-12 rounded-full bg-neutral-900 text-[15px] font-bold text-white dark:bg-white dark:text-neutral-900">Bagikan</button>
              <a href={gambar.url} download={namaFile} className="flex min-h-12 items-center justify-center rounded-full border border-neutral-200 text-[15px] font-semibold dark:border-neutral-800">Unduh</a>
            </div>
          </div>
        </Lembar>
      )}

      {toast && <div className="fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-[80] -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white">{toast}</div>}
    </div>
  );
}
