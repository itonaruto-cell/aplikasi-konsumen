'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PENGAJUAN, REKOMENDASI, UNSUR, fmtPersen, hitungKapasitas, labaOf, rapikanReport, reportBaru, teksCapacity, teksWa, type Penghasilan, type ReportSurvey } from '../../lib/report-survey';
import { todayJkt } from '../../lib/performa-calc';
import { AngkaInput, FIELD } from './form';
import { Ico } from './parts';
import { useOverlay } from '../overlay';

type Akun = { email: string; name?: string; role: 'owner' | 'spv' | 'konsumen' | 'tim'; perfName?: string | null };
const TA = `${FIELD} py-2.5 leading-relaxed`;
const PROGRAM = ['Normal Kilat', 'RO Super', 'NC Super', 'Take Over Super', 'Pre Approval', 'MotorKu Reguler'];
const STATUS = ['NC', 'RO', 'AO', 'Top Up'];
const tglId = (iso: string) => (iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

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
function Isian({ label, hint, children, grup = false }: { label: string; hint?: string; children: ReactNode; grup?: boolean }) {
  // Pilihan tombol tidak boleh dibungkus <label> (ketukan di label akan menekan tombol pertama)
  const Tag = grup ? 'div' : 'label';
  return (
    <Tag className="mt-3 block first:mt-0">
      <span className="block text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">{label}</span>
      {hint && <span className="block text-[12px] leading-snug text-neutral-500">{hint}</span>}
      <span className="mt-1 block">{children}</span>
    </Tag>
  );
}
function Pilih({ opsi, value, onChange, label }: { opsi: readonly string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {opsi.map((o) => (
        <button key={o} onClick={() => onChange(value === o ? '' : o)} aria-pressed={value === o}
          className={`min-h-9 rounded-full px-3 text-[13px] font-semibold ${value === o ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800'}`}>{o}</button>
      ))}
    </div>
  );
}

function Editor({ awal, onTutup, onSimpan, onBanding }: { awal: ReportSurvey; onTutup: () => void; onSimpan: (r: ReportSurvey) => void; onBanding?: () => void }) {
  useOverlay(true, onTutup);
  const [r, setR] = useState<ReportSurvey>(awal);
  const [simpan, setSimpan] = useState<'' | 'menyimpan' | 'tersimpan' | 'gagal'>(awal.id ? 'tersimpan' : '');
  const [pesan, setPesan] = useState('');
  const [lihat, setLihat] = useState(false);
  const ubah = useRef(0);
  const terakhir = useRef(r);
  terakhir.current = r;
  const set = <K extends keyof ReportSurvey>(k: K, v: ReportSurvey[K]) => { setR((x) => ({ ...x, [k]: v })); ubah.current++; setSimpan(''); };

  const kirim = useCallback(async (data: ReportSurvey): Promise<ReportSurvey | null> => {
    if (!data.nama.trim() && !data.appNo.trim()) return null;
    setSimpan('menyimpan');
    const n = ubah.current;
    try {
      const res = await fetch('/api/report-survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report: data }) });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || 'Gagal menyimpan.');
      const h = j.report as ReportSurvey;
      setR((x) => ({ ...x, id: h.id, dibuat: h.dibuat, diubah: h.diubah, oleh: h.oleh }));
      setSimpan(n === ubah.current ? 'tersimpan' : '');
      onSimpan(h);
      return h;
    } catch (e) { setSimpan('gagal'); setPesan((e as Error).message); return null; }
  }, [onSimpan]);
  useEffect(() => {
    if (simpan !== '') return;
    const t = setTimeout(() => { kirim(terakhir.current); }, 2000);
    return () => clearTimeout(t);
  }, [r, simpan, kirim]);

  const teks = teksWa(r);
  const salin = async () => {
    try { await navigator.clipboard.writeText(teks); setPesan('Teks report tersalin. Tempel di WhatsApp.'); } catch {
      setLihat(true); setPesan('Tidak bisa menyalin otomatis. Tekan lama teks di bawah lalu Salin.');
    }
  };
  const keWa = () => { window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, '_blank', 'noopener'); };
  const jadiBanding = async () => {
    setPesan('');
    try {
      const res = await fetch('/api/banding', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banding: { nama: r.nama.toUpperCase(), appNo: r.appNo, brand: r.brand, tanggal: todayJkt(), c6: { ...r.c6, capacity: teksCapacity(r) } } }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || 'Form banding gagal dibuat.');
      onBanding?.();
    } catch (e) { setPesan((e as Error).message); }
  };

  const kap = hitungKapasitas(r);
  const terisi = UNSUR.filter(([k]) => r.c6[k].trim() || (k === 'capacity' && kap.penghasilan > 0)).length;
  const status = simpan === 'menyimpan' ? 'Menyimpan…' : simpan === 'tersimpan' ? 'Tersimpan' : simpan === 'gagal' ? 'Gagal tersimpan' : r.nama || r.appNo ? 'Belum tersimpan' : 'Isi nama konsumen dulu';
  return (
    <div className="px-4 pb-40 pt-3">
      <div className="flex items-center gap-2">
        <button onClick={onTutup} className="flex min-h-11 items-center gap-1 rounded-xl pr-3 text-[14px] font-semibold"><Ico n="left" className="h-5 w-5" sw={2} />Daftar report</button>
        <span role="status" className={`ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold ${simpan === 'gagal' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : simpan === 'tersimpan' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>{status}</span>
      </div>

      <Bagian judul="Data konsumen" sub={[r.nama, r.appNo, tglId(r.tglSurvey)].filter(Boolean).join(' · ') || 'Nama, App No, tanggal & surveyor'}>
        <Isian label="Nama konsumen"><input value={r.nama} onChange={(e) => set('nama', e.target.value.toUpperCase())} className={`${FIELD} min-h-11`} /></Isian>
        <div className="grid grid-cols-2 gap-3">
          <Isian label="App No. (opsional)"><input value={r.appNo} onChange={(e) => set('appNo', e.target.value.toUpperCase())} className={`${FIELD} min-h-11 font-mono`} /></Isian>
          <Isian label="Tanggal survey"><input type="date" value={r.tglSurvey} onChange={(e) => set('tglSurvey', e.target.value)} className={`${FIELD} min-h-11`} /></Isian>
        </div>
        <Isian label="Surveyor"><input value={r.surveyor} onChange={(e) => set('surveyor', e.target.value)} className={`${FIELD} min-h-11`} /></Isian>
        <Isian grup label="Brand"><Pilih label="Brand" opsi={['MOBILKU', 'MOTORKU']} value={r.brand} onChange={(v) => set('brand', (v || r.brand) as ReportSurvey['brand'])} /></Isian>
        <Isian grup label="Pengajuan"><Pilih label="Pengajuan" opsi={PENGAJUAN} value={r.pengajuan} onChange={(v) => set('pengajuan', v)} /></Isian>
        <Isian grup label="Program"><Pilih label="Program" opsi={PROGRAM} value={r.program} onChange={(v) => set('program', v)} /></Isian>
        <Isian grup label="Status konsumen"><Pilih label="Status konsumen" opsi={STATUS} value={r.status} onChange={(v) => set('status', v)} /></Isian>
        <Isian label="Pekerjaan / usaha"><input value={r.pekerjaan} onChange={(e) => set('pekerjaan', e.target.value)} placeholder="mis. Wiraswasta warung makan" className={`${FIELD} min-h-11`} /></Isian>
        <Isian label="Alamat survey"><input value={r.alamat} onChange={(e) => set('alamat', e.target.value)} placeholder="Desa/kelurahan, kecamatan" className={`${FIELD} min-h-11`} /></Isian>
      </Bagian>

      <Bagian judul="Pengajuan" sub={[r.unit, r.pencairan ? `Rp ${r.pencairan.toLocaleString('id-ID')}` : '', r.tenor ? `${r.tenor} bln` : ''].filter(Boolean).join(' · ') || 'Unit, pencairan, tenor, angsuran'}>
        <Isian label="Unit / jaminan"><input value={r.unit} onChange={(e) => set('unit', e.target.value)} placeholder="mis. Daihatsu Ayla 1.0 AT 2016 a.n. sendiri" className={`${FIELD} min-h-11`} /></Isian>
        <div className="grid grid-cols-2 gap-3">
          <Isian label="Pencairan (Rp)"><AngkaInput label="Pencairan" value={r.pencairan} onChange={(v) => set('pencairan', v)} className="min-h-11" /></Isian>
          <Isian label="Tenor (bulan)"><AngkaInput label="Tenor" value={r.tenor} onChange={(v) => set('tenor', Math.min(120, v))} className="min-h-11" /></Isian>
        </div>
        <Isian label="Angsuran (Rp)"><AngkaInput label="Angsuran" value={r.angsuran} onChange={(v) => set('angsuran', v)} className="min-h-11" /></Isian>
      </Bagian>

      <Bagian judul="Analisa 6C + 1E + 1P" sub={`${terisi}/8 terisi · satu poin per baris`}>
        {UNSUR.map(([k, label, hint]) => k === 'capacity' ? (
          <div key={k} className="mt-3">
            <p className="text-[13px] font-semibold text-neutral-600 dark:text-neutral-300">{label}</p>
            <p className="text-[12px] leading-snug text-neutral-500">Isi omzet × margin kalau usaha, gaji kalau pegawai (tanpa margin), atau keduanya. Ditambah penghasilan tambahan, lalu IIR & DSR dihitung otomatis.</p>
            {([['kons', 'Konsumen'], ['pas', 'Pasangan (kalau ada)']] as const).map(([pk, pl]) => {
              const p = r.kapasitas[pk];
              const ubahP = (x: Partial<Penghasilan>) => set('kapasitas', { ...r.kapasitas, [pk]: { ...p, ...x } });
              return (
                <div key={pk} className="mt-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
                  <p className="text-[13px] font-bold">{pl}</p>
                  <div className="mt-1 grid grid-cols-[1fr_6rem] items-end gap-2">
                    <Isian label="Omzet usaha"><AngkaInput label={`Omzet ${pl}`} value={p.omzet} onChange={(v) => ubahP({ omzet: v })} className="min-h-11" /></Isian>
                    <Isian label="Margin (%)"><AngkaInput label={`Margin ${pl}`} value={p.margin} placeholder="15–100" onChange={(v) => ubahP({ margin: Math.min(100, v) })} className="min-h-11" /></Isian>
                  </div>
                  {p.omzet > 0 && <p className="mt-1 text-[12px] text-neutral-500">Margin ({p.margin || 0}%) = <b className="text-neutral-800 dark:text-neutral-200">{labaOf(p).toLocaleString('id-ID')}</b>{p.margin > 0 && p.margin < 15 ? ' · margin biasanya 15–100%' : ''}</p>}
                  <Isian label="Gaji (pegawai, tanpa margin)"><AngkaInput label={`Gaji ${pl}`} value={p.gaji} onChange={(v) => ubahP({ gaji: v })} className="min-h-11" /></Isian>
                  <div className="grid grid-cols-[1fr_7rem] items-end gap-2">
                    <Isian label="Penghasilan tambahan"><AngkaInput label={`Penghasilan tambahan ${pl}`} value={p.tambahan} onChange={(v) => ubahP({ tambahan: v })} className="min-h-11" /></Isian>
                    <Isian label="Dari"><input value={p.tambahanKet} onChange={(e) => ubahP({ tambahanKet: e.target.value })} placeholder="sawah" aria-label={`Sumber penghasilan tambahan ${pl}`} className={`${FIELD} min-h-11`} /></Isian>
                  </div>
                </div>
              );
            })}
            <div className="mt-3 grid grid-cols-2 items-end gap-2">
              <Isian label="Angsuran tempat lain"><AngkaInput label="Angsuran tempat lain" value={r.kapasitas.angsLain} onChange={(v) => set('kapasitas', { ...r.kapasitas, angsLain: v })} className="min-h-11" /></Isian>
              <Isian label="Angsuran WOM" hint={!r.kapasitas.angsWom && r.angsuran ? 'Ikut angsuran pengajuan' : undefined}><AngkaInput label="Angsuran WOM" value={r.kapasitas.angsWom} placeholder={r.angsuran ? r.angsuran.toLocaleString('id-ID') : '0'} onChange={(v) => set('kapasitas', { ...r.kapasitas, angsWom: v })} className="min-h-11" /></Isian>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center" aria-label="Hasil capacity">
              <div className="rounded-xl bg-neutral-100 px-2 py-2 dark:bg-neutral-900"><p className="text-[11px] text-neutral-500">Total angsuran</p><p className="text-[14px] font-bold">{kap.total.toLocaleString('id-ID')}</p></div>
              <div className="rounded-xl bg-neutral-100 px-2 py-2 dark:bg-neutral-900"><p className="text-[11px] text-neutral-500">IIR</p><p className="text-[14px] font-bold">{fmtPersen(kap.iir)}</p></div>
              <div className="rounded-xl bg-neutral-100 px-2 py-2 dark:bg-neutral-900"><p className="text-[11px] text-neutral-500">DSR</p><p className="text-[14px] font-bold">{fmtPersen(kap.dsr)}</p></div>
            </div>
            <Isian label="Catatan capacity (opsional)" hint="Mis. lama usaha, ramai tidaknya usaha, bukti mutasi/nota.">
              <textarea aria-label="Catatan capacity" value={r.c6.capacity} onChange={(e) => set('c6', { ...r.c6, capacity: e.target.value })} rows={2} className={TA} />
            </Isian>
          </div>
        ) : (
          <Isian key={k} label={label} hint={hint}>
            <textarea aria-label={label} value={r.c6[k]} onChange={(e) => set('c6', { ...r.c6, [k]: e.target.value })} rows={k === 'character' || k === 'eksistensi' ? 4 : 2} className={TA} />
          </Isian>
        ))}
      </Bagian>

      <Bagian judul="Kesimpulan">
        <Pilih label="Rekomendasi" opsi={REKOMENDASI} value={r.rekomendasi} onChange={(v) => set('rekomendasi', v)} />
        <Isian label="Catatan (opsional)"><textarea aria-label="Catatan" value={r.catatan} onChange={(e) => set('catatan', e.target.value)} rows={3} className={TA} /></Isian>
      </Bagian>

      <Bagian judul="Teks untuk WhatsApp" sub="Pratinjau teks yang disalin" buka={lihat}>
        <pre className="whitespace-pre-wrap rounded-xl bg-[#E7FFDB] p-3 font-sans text-[13px] leading-relaxed text-neutral-900 dark:bg-[#0B3B2C] dark:text-neutral-100">{teks}</pre>
        {onBanding && (
          <button onClick={jadiBanding} disabled={!(r.nama || r.appNo)} className="mt-3 min-h-11 w-full rounded-xl border border-neutral-300 text-[14px] font-semibold disabled:opacity-40 dark:border-neutral-700">
            Buat form banding (F-761) dari report ini
          </button>
        )}
      </Bagian>

      {pesan && <p role="status" className="mt-3 rounded-xl bg-neutral-100 px-3 py-2 text-[13px] dark:bg-neutral-900">{pesan}</p>}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 border-t border-neutral-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
          <button onClick={salin} disabled={!(r.nama || r.appNo)} className="min-h-12 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900">Salin teks</button>
          <button onClick={keWa} disabled={!(r.nama || r.appNo)} className="min-h-12 rounded-2xl bg-[#0F8048] text-[15px] font-bold text-white disabled:opacity-40">Kirim ke WA</button>
        </div>
      </div>
    </div>
  );
}

export default function ReportSurveyPage({ akun, reloadKey = 0, onBanding }: { akun: Akun; reloadKey?: number; onBanding?: () => void }) {
  const [list, setList] = useState<ReportSurvey[] | null>(null);
  const [err, setErr] = useState('');
  const [buka, setBuka] = useState<ReportSurvey | null>(null);
  const [cari, setCari] = useState('');

  const muat = useCallback(async () => {
    setErr('');
    try {
      const res = await fetch('/api/report-survey', { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || 'Gagal memuat.');
      setList((j.list || []).map(rapikanReport));
    } catch (e) { setErr((e as Error).message); setList([]); }
  }, []);
  useEffect(() => { muat(); }, [muat, reloadKey]);
  const simpanLokal = useCallback((r: ReportSurvey) => setList((l) => [r, ...(l || []).filter((x) => x.id !== r.id)]), []);
  const hapus = async (r: ReportSurvey) => {
    if (!window.confirm(`Hapus report survey ${r.nama || r.appNo}?`)) return;
    const res = await fetch(`/api/report-survey?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
    if (res.ok) setList((l) => (l || []).filter((x) => x.id !== r.id));
  };

  if (buka) return <Editor key={buka.id || 'baru'} awal={buka} onTutup={() => { setBuka(null); muat(); }} onSimpan={simpanLokal} onBanding={onBanding} />;
  const q = cari.trim().toUpperCase();
  const tampil = (list || []).filter((r) => !q || `${r.nama} ${r.appNo} ${r.surveyor}`.toUpperCase().includes(q));
  return (
    <div className="px-4 pb-10 pt-4">
      <section className="rounded-3xl bg-neutral-900 p-5 text-white">
        <p className="text-[13px] font-bold uppercase tracking-wide text-neutral-400">Report survey · 6C + 1E + 1P</p>
        <p className="mt-1 text-[15px] leading-snug text-neutral-200">Isi hasil survey per unsur 6C + 1E + 1P (Panduan Survey 031), lalu salin teksnya ke grup WA. Semua tim bisa melihat dan melengkapi.</p>
        <button onClick={() => setBuka(reportBaru({ tglSurvey: todayJkt(), surveyor: akun.perfName || akun.name || '' }))} className="mt-3 min-h-12 w-full rounded-2xl bg-white text-[15px] font-bold text-neutral-900">+ Buat report survey</button>
      </section>
      {(list?.length || 0) > 4 && <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama / App No / surveyor" aria-label="Cari report" className={`${FIELD} mt-4 min-h-11`} />}
      <p className="mt-6 text-[15px] font-bold">Report tersimpan</p>
      {err && <p className="mt-2 text-[13px] text-red-700 dark:text-red-300">{err}</p>}
      {list === null ? <p className="mt-2 text-[13px] text-neutral-500">Memuat…</p> : !tampil.length ? (
        <p className="mt-2 text-[14px] text-neutral-500">{list.length ? 'Tidak ada yang cocok.' : 'Belum ada report survey.'}</p>
      ) : (
        <ul className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {tampil.map((r) => (
            <li key={r.id} className="flex items-center border-b border-neutral-200 last:border-0 dark:border-neutral-800">
              <button onClick={() => setBuka(r)} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center px-4 py-2 text-left active:bg-neutral-50 dark:active:bg-neutral-900">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-bold">{r.nama || '(tanpa nama)'}</span>
                  {r.rekomendasi && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${r.rekomendasi === 'Layak' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : r.rekomendasi === 'Tidak layak' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'}`}>{r.rekomendasi}</span>}
                </span>
                <span className="truncate text-[12px] text-neutral-500">{[r.brand === 'MOTORKU' ? 'MotorKu' : 'MobilKu', tglId(r.tglSurvey), r.surveyor, `${UNSUR.filter(([k]) => r.c6[k].trim()).length}/8 unsur`].filter(Boolean).join(' · ')}</span>
              </button>
              <button onClick={() => hapus(r)} aria-label={`Hapus report ${r.nama}`} className="flex h-12 w-12 shrink-0 items-center justify-center text-neutral-400"><Ico n="x" className="h-4 w-4" sw={2} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
