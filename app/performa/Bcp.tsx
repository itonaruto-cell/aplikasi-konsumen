'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  JENIS_APLIKASI, JENIS_CAIR, JENIS_KONSUMEN, KEPEMILIKAN, TUJUAN, bawaanMao, bcpBaru, bcpDariReport, bersihOf, cariReportBcp,
  noteDariReport, omzetBulanOf, rapikanBcp, ringkasBcp, teksBcp, type Bcp, type PhBcp,
} from '../../lib/bcp-types';
import { rapikanReport, type ReportSurvey } from '../../lib/report-survey';
import { AngkaInput, FIELD } from './form';
import { Bagian, Isian, Pilih } from './bagian';
import { Ico } from './parts';
import { KUNCI_BUKA_BCP, daftarBcp, simpanBcpDariReport } from './bcp-dari-report';
import { useOverlay } from '../overlay';

type Akun = { email: string; name?: string; role: 'owner' | 'spv' | 'konsumen' | 'tim'; perfName?: string | null };
const TA = `${FIELD} py-2.5 leading-relaxed`;
const IN = `${FIELD} min-h-11`;
const PROFESI = ['Wiraswasta', 'Pedagang', 'Karyawan swasta', 'PNS', 'Petani', 'Sopir'];
const HUBUNGAN = ['Saudara kandung', 'Orang tua', 'Anak', 'Ipar', 'Paman / bibi'];
const rb = (n: number) => n.toLocaleString('id-ID');
const tglId = (iso: string) => (iso ? new Date(iso.length > 10 ? iso : iso + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '');

// Ketik bebas, dengan pilihan cepat di bawahnya
function Ketik({ value, onChange, opsi, label, placeholder }: { value: string; onChange: (v: string) => void; opsi: readonly string[]; label: string; placeholder?: string }) {
  return (
    <>
      <input value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} placeholder={placeholder} className={IN} />
      <div className="mt-1.5"><Pilih label={`Pilihan ${label.toLowerCase()}`} opsi={opsi} value={value} onChange={onChange} /></div>
    </>
  );
}

function Penghasilan({ judul, p, onChange }: { judul: string; p: PhBcp; onChange: (x: Partial<PhBcp>) => void }) {
  const dihitung = !!(p.omzetHari && p.hariKerja);
  return (
    <>
      <div className="grid grid-cols-[1fr_6.5rem] items-end gap-2">
        <Isian label="Omzet per hari"><AngkaInput label={`Omzet per hari ${judul}`} value={p.omzetHari} onChange={(v) => onChange({ omzetHari: v })} className="min-h-11" /></Isian>
        <Isian label="Hari kerja"><AngkaInput label={`Jumlah hari kerja ${judul}`} value={p.hariKerja} placeholder="26" onChange={(v) => onChange({ hariKerja: Math.min(31, v) })} className="min-h-11" /></Isian>
      </div>
      <div className="grid grid-cols-[1fr_6.5rem] items-end gap-2">
        <Isian label="Omset per bulan" hint={dihitung ? 'Omzet per hari × hari kerja' : undefined}>
          {dihitung
            ? <p className="flex min-h-11 items-center rounded-xl bg-neutral-100 px-3 text-base font-semibold dark:bg-neutral-900">{rb(omzetBulanOf(p))}</p>
            : <AngkaInput label={`Omset per bulan ${judul}`} value={p.omzetBulan} onChange={(v) => onChange({ omzetBulan: v })} className="min-h-11" />}
        </Isian>
        <Isian label="Margin (%)"><AngkaInput label={`Margin ${judul}`} value={p.margin} placeholder="15–100" onChange={(v) => onChange({ margin: Math.min(100, v) })} className="min-h-11" /></Isian>
      </div>
      <Isian label="Gaji (kalau pegawai, tanpa margin)"><AngkaInput label={`Gaji ${judul}`} value={p.gaji} onChange={(v) => onChange({ gaji: v })} className="min-h-11" /></Isian>
      <p className="mt-2 rounded-xl bg-neutral-100 px-3 py-2 text-[13px] dark:bg-neutral-900">Penghasilan bersih <b className="float-right text-[14px]">{bersihOf(p) ? `Rp ${rb(bersihOf(p))}` : '-'}</b></p>
      <div className="grid grid-cols-[1fr_7rem] items-end gap-2">
        <Isian label="Penghasilan tambahan"><AngkaInput label={`Penghasilan tambahan ${judul}`} value={p.tambahan} onChange={(v) => onChange({ tambahan: v })} className="min-h-11" /></Isian>
        <Isian label="Dari"><input value={p.tambahanKet} onChange={(e) => onChange({ tambahanKet: e.target.value })} placeholder="sawah" aria-label={`Sumber penghasilan tambahan ${judul}`} className={IN} /></Isian>
      </div>
    </>
  );
}

function Editor({ awal, reports, onTutup, onSimpan }: { awal: Bcp; reports: ReportSurvey[]; onTutup: () => void; onSimpan: (b: Bcp) => void }) {
  useOverlay(true, onTutup);
  const [b, setB] = useState<Bcp>(awal);
  const [simpan, setSimpan] = useState<'' | 'menyimpan' | 'tersimpan' | 'gagal'>(awal.id ? 'tersimpan' : '');
  const [pesan, setPesan] = useState('');
  const [lihat, setLihat] = useState(false);
  const ubah = useRef(0);
  const terakhir = useRef(b);
  terakhir.current = b;
  const set = <K extends keyof Bcp>(k: K, v: Bcp[K]) => { setB((x) => ({ ...x, [k]: v })); ubah.current++; setSimpan(''); };
  const setPh = (k: 'pem' | 'pas', v: Partial<PhBcp>) => { setB((x) => ({ ...x, [k]: { ...x[k], ...v } })); ubah.current++; setSimpan(''); };

  const kirim = useCallback(async (data: Bcp) => {
    if (!data.nama.trim()) return;
    setSimpan('menyimpan');
    const n = ubah.current;
    try {
      const res = await fetch('/api/bcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bcp: data }) });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || 'Gagal menyimpan.');
      const h = rapikanBcp(j.bcp);
      setB((x) => ({ ...x, id: h.id, dibuat: h.dibuat, diubah: h.diubah, oleh: h.oleh, email: h.email }));
      setSimpan(n === ubah.current ? 'tersimpan' : '');
      onSimpan(h);
    } catch (e) { setSimpan('gagal'); setPesan((e as Error).message); }
  }, [onSimpan]);
  useEffect(() => {
    if (simpan !== '') return;
    const t = setTimeout(() => { kirim(terakhir.current); }, 2000);
    return () => clearTimeout(t);
  }, [b, simpan, kirim]);

  // Report survey 6C 1EP dengan nama konsumen yang sama: isian kosong diisi otomatis saat dibuka
  const report = useMemo(() => cariReportBcp(b, reports), [b.nama, b.reportId, reports]); // eslint-disable-line react-hooks/exhaustive-deps
  const pakaiReport = (timpa: boolean, otomatis = false) => {
    const r = cariReportBcp(terakhir.current, reports);
    if (!r) return;
    const h = bcpDariReport(terakhir.current, r, timpa);
    if (!h.n) { if (!otomatis) setPesan('Isian sudah sama dengan report 6C 1EP.'); return; }
    setB(h.b); ubah.current++; setSimpan('');
    setPesan(otomatis ? `Terhubung dengan report 6C 1EP: ${h.n} isian kosong terisi otomatis.` : `${h.n} isian diambil dari report 6C 1EP.`);
  };
  const sudahOto = useRef(false);
  useEffect(() => {
    if (sudahOto.current || !reports.length || !b.nama.trim()) return;
    sudahOto.current = true;
    pakaiReport(false, true);
  }, [reports]); // eslint-disable-line react-hooks/exhaustive-deps

  const teks = teksBcp(b);
  const salin = async () => {
    try { await navigator.clipboard.writeText(teks); setPesan('Format BCP tersalin. Tempel di WhatsApp.'); } catch {
      setLihat(true); setPesan('Tidak bisa menyalin otomatis. Tekan lama teks di bawah lalu Salin.');
    }
  };
  const keWa = () => { window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, '_blank', 'noopener'); };
  const noteReport = report ? noteDariReport(report) : '';
  const status = simpan === 'menyimpan' ? 'Menyimpan…' : simpan === 'tersimpan' ? 'Tersimpan' : simpan === 'gagal' ? 'Gagal tersimpan' : b.nama ? 'Belum tersimpan' : 'Isi nama konsumen dulu';
  const ringkasPh = (p: PhBcp) => (bersihOf(p) ? `Bersih Rp ${rb(bersihOf(p))}` : '');

  return (
    <div className="px-4 pb-40 pt-3">
      <div className="flex items-center gap-2">
        <button onClick={onTutup} className="flex min-h-11 items-center gap-1 rounded-xl pr-3 text-[14px] font-semibold"><Ico n="left" className="h-5 w-5" sw={2} />Daftar BCP</button>
        <span role="status" className={`ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold ${simpan === 'gagal' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : simpan === 'tersimpan' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>{status}</span>
      </div>

      {report && (
        <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/40">
          <p className="text-[13px] font-bold text-blue-900 dark:text-blue-200">Terhubung dengan report 6C 1EP</p>
          <p className="mt-0.5 text-[13px] leading-snug text-blue-900/80 dark:text-blue-200/80">{[report.nama, report.tglSurvey && tglId(report.tglSurvey), report.surveyor, report.rekomendasi].filter(Boolean).join(' · ')}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button onClick={() => pakaiReport(false)} className="min-h-10 rounded-xl bg-white text-[13px] font-semibold text-blue-900 dark:bg-blue-900 dark:text-white">Isi yang kosong</button>
            <button onClick={() => { if (window.confirm('Timpa data konsumen, penghasilan, pembiayaan & Note MAO dengan isi report terbaru?')) pakaiReport(true); }} className="min-h-10 rounded-xl border border-blue-300 text-[13px] font-semibold text-blue-900 dark:border-blue-800 dark:text-blue-200">Timpa dari report</button>
          </div>
        </div>
      )}

      <Bagian judul="Data konsumen" sub={[b.nama, b.pekerjaan].filter(Boolean).join(' · ') || 'Nama, pekerjaan, alamat domisili, profesi'}>
        <Isian label="Nama"><input value={b.nama} onChange={(e) => set('nama', e.target.value.toUpperCase())} className={IN} /></Isian>
        <Isian label="Pekerjaan"><input value={b.pekerjaan} onChange={(e) => set('pekerjaan', e.target.value)} placeholder="mis. Pedagang sembako" className={IN} /></Isian>
        <Isian label="Alamat domisili"><textarea value={b.alamat} onChange={(e) => set('alamat', e.target.value)} rows={2} className={TA} /></Isian>
        <Isian grup label="Profesi"><Ketik label="Profesi" value={b.profesi} onChange={(v) => set('profesi', v)} opsi={PROFESI} /></Isian>
      </Bagian>

      <Bagian judul="Data pasangan" sub={[b.pasNama, b.pasPekerjaan].filter(Boolean).join(' · ') || 'Kosongkan kalau belum menikah'} buka={false}>
        <Isian label="Nama"><input value={b.pasNama} onChange={(e) => set('pasNama', e.target.value.toUpperCase())} className={IN} /></Isian>
        <Isian label="Pekerjaan"><input value={b.pasPekerjaan} onChange={(e) => set('pasPekerjaan', e.target.value)} className={IN} /></Isian>
        <Isian label="Alamat domisili"><textarea value={b.pasAlamat} onChange={(e) => set('pasAlamat', e.target.value)} rows={2} className={TA} /></Isian>
        {b.alamat.trim() && b.pasAlamat !== b.alamat && <button onClick={() => set('pasAlamat', b.alamat)} className="mt-2 min-h-10 rounded-xl bg-neutral-100 px-3 text-[13px] font-semibold dark:bg-neutral-800">Sama dengan alamat konsumen</button>}
      </Bagian>

      <Bagian judul="Penghasilan pemohon" sub={[ringkasPh(b.pem), b.hpPemohon].filter(Boolean).join(' · ') || 'Omzet, hari kerja, margin, no HP'}>
        <Penghasilan judul="pemohon" p={b.pem} onChange={(v) => setPh('pem', v)} />
        <Isian label="No HP pemohon"><input value={b.hpPemohon} onChange={(e) => set('hpPemohon', e.target.value.replace(/[^\d+ -]/g, ''))} inputMode="tel" className={IN} /></Isian>
      </Bagian>

      <Bagian judul="Penghasilan pasangan" sub={[ringkasPh(b.pas), b.pengeluaran ? `Pengeluaran Rp ${rb(b.pengeluaran)}` : ''].filter(Boolean).join(' · ') || 'Penghasilan pasangan, pengeluaran, no telp'} buka={false}>
        <Penghasilan judul="pasangan" p={b.pas} onChange={(v) => setPh('pas', v)} />
        <Isian label="Pengeluaran pemohon (per bulan)"><AngkaInput label="Pengeluaran pemohon" value={b.pengeluaran} onChange={(v) => set('pengeluaran', v)} className="min-h-11" /></Isian>
        <Isian label="No telp pasangan"><input value={b.hpPasangan} onChange={(e) => set('hpPasangan', e.target.value.replace(/[^\d+ -]/g, ''))} inputMode="tel" className={IN} /></Isian>
      </Bagian>

      <Bagian judul="Rumah & emergency contact" sub={[b.rumah, b.econtNama && `Econt ${b.econtNama}`].filter(Boolean).join(' · ') || 'Kepemilikan rumah, kontak darurat'}>
        <Isian grup label="Kepemilikan rumah"><Ketik label="Kepemilikan rumah" value={b.rumah} onChange={(v) => set('rumah', v)} opsi={KEPEMILIKAN} /></Isian>
        <Isian label="Nama econt"><input value={b.econtNama} onChange={(e) => set('econtNama', e.target.value.toUpperCase())} className={IN} /></Isian>
        <Isian label="Alamat econt"><textarea value={b.econtAlamat} onChange={(e) => set('econtAlamat', e.target.value)} rows={2} className={TA} /></Isian>
        <Isian grup label="Hubungan dengan econt"><Ketik label="Hubungan dengan econt" value={b.econtHubungan} onChange={(v) => set('econtHubungan', v)} opsi={HUBUNGAN} /></Isian>
        <Isian label="No telp econt"><input value={b.econtTelp} onChange={(e) => set('econtTelp', e.target.value.replace(/[^\d+ -]/g, ''))} inputMode="tel" className={IN} /></Isian>
      </Bagian>

      <Bagian judul="Struktur pembiayaan" sub={ringkasBcp(b) || 'Unit, OTR, pencairan, tenor, angsuran'}>
        <div className="grid grid-cols-[1fr_6.5rem] items-end gap-2">
          <Isian label="Type unit"><input value={b.unit} onChange={(e) => set('unit', e.target.value)} placeholder="mis. Daihatsu Ayla 1.0 AT" className={IN} /></Isian>
          <Isian label="Tahun"><input value={b.tahun} onChange={(e) => set('tahun', e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="2016" className={IN} /></Isian>
        </div>
        <Isian label="Nama STNK"><input value={b.stnk} onChange={(e) => set('stnk', e.target.value.toUpperCase())} className={IN} /></Isian>
        {b.nama.trim() && !b.stnk.trim() && <button onClick={() => set('stnk', b.nama)} className="mt-1.5 min-h-9 rounded-full bg-neutral-100 px-3 text-[13px] font-semibold dark:bg-neutral-800">a.n. konsumen sendiri</button>}
        <div className="grid grid-cols-2 gap-2">
          <Isian label="OTR (Rp)"><AngkaInput label="OTR" value={b.otr} onChange={(v) => set('otr', v)} className="min-h-11" /></Isian>
          <Isian label="Pencairan (Rp)"><AngkaInput label="Pencairan" value={b.pencairan} onChange={(v) => set('pencairan', v)} className="min-h-11" /></Isian>
          <Isian label="Tenor (bulan)"><AngkaInput label="Tenor" value={b.tenor} onChange={(v) => set('tenor', Math.min(120, v))} className="min-h-11" /></Isian>
          <Isian label="Angsuran (Rp)"><AngkaInput label="Angsuran" value={b.angsuran} onChange={(v) => set('angsuran', v)} className="min-h-11" /></Isian>
        </div>
        <Isian label="POT"><input value={b.pot} onChange={(e) => set('pot', e.target.value)} className={IN} /></Isian>
        <Isian grup label="Jenis konsumen"><Pilih label="Jenis konsumen" opsi={JENIS_KONSUMEN} value={b.jenisKonsumen} onChange={(v) => set('jenisKonsumen', v)} /></Isian>
        <Isian grup label="Jenis aplikasi"><Pilih label="Jenis aplikasi" opsi={JENIS_APLIKASI} value={b.jenisAplikasi} onChange={(v) => set('jenisAplikasi', v)} /></Isian>
      </Bagian>

      <Bagian judul="MAO & sumber order" sub={[b.mao, b.soa].filter(Boolean).join(' · ') || 'Nama & NIK MAO, SOA, referensi'} buka={!b.mao || !b.nikMao}>
        <div className="grid grid-cols-2 gap-2">
          <Isian label="Nama MAO"><input value={b.mao} onChange={(e) => set('mao', e.target.value.toUpperCase())} className={IN} /></Isian>
          <Isian label="NIK MAO"><input value={b.nikMao} onChange={(e) => set('nikMao', e.target.value)} inputMode="numeric" className={`${IN} font-mono`} /></Isian>
        </div>
        <Isian label="Sumber order / SOA"><input value={b.soa} onChange={(e) => set('soa', e.target.value)} className={IN} /></Isian>
        {([['1', 'ref1', 'idRef1', 'grup1'], ['2', 'ref2', 'idRef2', 'grup2']] as const).map(([no, kr, ki, kg]) => (
          <div key={no} className="mt-3 rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
            <p className="text-[13px] font-bold">REF {no}</p>
            <Isian label="Nama referensi"><input value={b[kr]} onChange={(e) => set(kr, e.target.value.toUpperCase())} className={IN} /></Isian>
            <div className="grid grid-cols-2 gap-2">
              <Isian label="ID REF"><input value={b[ki]} onChange={(e) => set(ki, e.target.value)} className={`${IN} font-mono`} /></Isian>
              <Isian label="REF GROUP"><input value={b[kg]} onChange={(e) => set(kg, e.target.value)} className={IN} /></Isian>
            </div>
          </div>
        ))}
      </Bagian>

      <Bagian judul="Pencairan & rekening" sub={[b.jenisCair, b.bank].filter(Boolean).join(' · ') || 'Jenis pencairan, bank, no rek'}>
        <Isian grup label="Jenis pencairan"><Ketik label="Jenis pencairan" value={b.jenisCair} onChange={(v) => set('jenisCair', v)} opsi={JENIS_CAIR} /></Isian>
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <Isian label="Nama bank"><input value={b.bank} onChange={(e) => set('bank', e.target.value.toUpperCase())} placeholder="BRI" className={IN} /></Isian>
          <Isian label="No rek"><input value={b.noRek} onChange={(e) => set('noRek', e.target.value.replace(/[^\d -]/g, ''))} inputMode="numeric" className={`${IN} font-mono`} /></Isian>
        </div>
        <Isian label="Nama rekening"><input value={b.namaRek} onChange={(e) => set('namaRek', e.target.value.toUpperCase())} className={IN} /></Isian>
        {b.nama.trim() && !b.namaRek.trim() && <button onClick={() => set('namaRek', b.nama)} className="mt-1.5 min-h-9 rounded-full bg-neutral-100 px-3 text-[13px] font-semibold dark:bg-neutral-800">a.n. konsumen sendiri</button>}
      </Bagian>

      <Bagian judul="Tujuan dana & Note MAO" sub={[b.tujuan, b.note.trim() ? 'note terisi' : 'note belum diisi'].filter(Boolean).join(' · ')}>
        <Isian grup label="Tujuan penggunaan dana"><Ketik label="Tujuan penggunaan dana" value={b.tujuan} onChange={(v) => set('tujuan', v.toUpperCase())} opsi={TUJUAN} /></Isian>
        <Isian label="Note MAO" hint="Kekuatan (strength) konsumen dari analisa 6C 1EP, satu poin per baris.">
          <textarea aria-label="Note MAO" value={b.note} onChange={(e) => set('note', e.target.value)} rows={7} className={TA} />
        </Isian>
        {noteReport && b.note !== noteReport && (
          <button onClick={() => { if (!b.note.trim() || window.confirm('Ganti Note MAO dengan kekuatan konsumen dari report 6C 1EP?')) set('note', noteReport); }}
            className="mt-2 min-h-11 w-full rounded-xl border border-blue-300 text-[13px] font-semibold text-blue-900 dark:border-blue-800 dark:text-blue-200">Isi dari kekuatan 6C 1EP</button>
        )}
        {!report && <p className="mt-2 text-[12px] text-neutral-500">Belum ada report 6C 1EP dengan nama ini. Buat report survey-nya dulu supaya Note MAO bisa terisi otomatis.</p>}
      </Bagian>

      <Bagian judul="Link" sub={[b.linkBa && 'BA BCP', b.linkFolder && 'folder'].filter(Boolean).join(' · ') || 'Link BA BCP & folder'}>
        <Isian label="Link BA BCP"><input value={b.linkBa} onChange={(e) => set('linkBa', e.target.value.trim())} type="url" inputMode="url" placeholder="https://" className={IN} /></Isian>
        <Isian label="Link folder"><input value={b.linkFolder} onChange={(e) => set('linkFolder', e.target.value.trim())} type="url" inputMode="url" placeholder="https://drive.google.com/…" className={IN} /></Isian>
      </Bagian>

      <Bagian judul="Teks untuk WhatsApp" sub="Pratinjau teks yang disalin" buka={lihat}>
        <pre className="whitespace-pre-wrap rounded-xl bg-[#E7FFDB] p-3 font-sans text-[13px] leading-relaxed text-neutral-900 dark:bg-[#0B3B2C] dark:text-neutral-100">{teks}</pre>
      </Bagian>

      {pesan && <p role="status" className="mt-3 rounded-xl bg-neutral-100 px-3 py-2 text-[13px] dark:bg-neutral-900">{pesan}</p>}

      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+64px)] z-30 border-t border-neutral-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
          <button onClick={salin} disabled={!b.nama} className="min-h-12 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900">Salin teks</button>
          <button onClick={keWa} disabled={!b.nama} className="min-h-12 rounded-2xl bg-[#0F8048] text-[15px] font-bold text-white disabled:opacity-40">Kirim ke WA</button>
        </div>
      </div>
    </div>
  );
}

export default function BcpPage({ akun, reloadKey = 0 }: { akun: Akun; reloadKey?: number }) {
  const [list, setList] = useState<Bcp[] | null>(null);
  const [reports, setReports] = useState<ReportSurvey[]>([]);
  const [err, setErr] = useState('');
  const [buka, setBuka] = useState<Bcp | null>(null);
  const [cari, setCari] = useState('');
  const [proses, setProses] = useState('');
  const namaAkun = akun.perfName || akun.name || '';

  const muat = useCallback(async () => {
    setErr('');
    try { setList(await daftarBcp()); } catch (e) { setErr((e as Error).message); setList([]); }
    // Report survey 6C 1EP untuk mengisi BCP dengan nama konsumen yang sama
    fetch('/api/report-survey', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.list) setReports(j.list.map(rapikanReport)); }).catch(() => {});
  }, []);
  useEffect(() => { muat(); }, [muat, reloadKey]);
  // Dibuka dari report survey ("Buat format BCP dari report ini") → langsung buka BCP itu
  useEffect(() => {
    if (!list) return;
    let id = '';
    try { id = sessionStorage.getItem(KUNCI_BUKA_BCP) || ''; sessionStorage.removeItem(KUNCI_BUKA_BCP); } catch {}
    const b = id && list.find((x) => x.id === id);
    if (b) setBuka(b);
  }, [list]);
  const simpanLokal = useCallback((b: Bcp) => setList((l) => [b, ...(l || []).filter((x) => x.id !== b.id)]), []);
  const hapus = async (b: Bcp) => {
    if (!window.confirm(`Hapus format BCP ${b.nama}?`)) return;
    const res = await fetch(`/api/bcp?id=${encodeURIComponent(b.id)}`, { method: 'DELETE' });
    if (res.ok) setList((l) => (l || []).filter((x) => x.id !== b.id));
  };
  const dariReport = async (r: ReportSurvey) => {
    setProses(r.id); setErr('');
    try { setBuka(await simpanBcpDariReport(r, { email: akun.email, nama: namaAkun })); try { sessionStorage.removeItem(KUNCI_BUKA_BCP); } catch {} }
    catch (e) { setErr((e as Error).message); }
    setProses('');
  };

  if (buka) return <Editor key={buka.id || 'baru'} awal={buka} reports={reports} onTutup={() => { setBuka(null); muat(); }} onSimpan={simpanLokal} />;
  const q = cari.trim().toUpperCase();
  const tampil = (list || []).filter((b) => !q || `${b.nama} ${b.mao} ${b.unit}`.toUpperCase().includes(q));
  // Report 6C 1EP 30 hari terakhir yang belum punya format BCP
  const batas = new Date(Date.now() - 30 * 86400000).toISOString();
  const belum = list ? reports.filter((r) => r.nama.trim() && (r.diubah || r.dibuat) >= batas && !list.some((b) => cariReportBcp(b, [r]))).slice(0, 5) : [];
  return (
    <div className="px-4 pb-10 pt-4">
      <section className="rounded-3xl bg-neutral-900 p-5 text-white">
        <p className="text-[13px] font-bold uppercase tracking-wide text-neutral-400">Format aplikasi BCP</p>
        <p className="mt-1 text-[15px] leading-snug text-neutral-200">Isi data aplikasi, lalu salin ke WA dengan susunan baku. Kalau nama konsumen sama dengan report survey 6C 1EP, data konsumen, penghasilan, pembiayaan & Note MAO terisi otomatis.</p>
        <button onClick={() => setBuka(bcpBaru(bawaanMao(list || [], { email: akun.email, nama: namaAkun })))} className="mt-3 min-h-12 w-full rounded-2xl bg-white text-[15px] font-bold text-neutral-900">+ Buat format BCP</button>
      </section>

      {belum.length > 0 && (
        <>
          <p className="mt-6 text-[15px] font-bold">Dari report 6C 1EP</p>
          <p className="text-[12px] text-neutral-500">Report survey yang belum dibuatkan format BCP</p>
          <ul className="mt-2 overflow-hidden rounded-2xl border border-blue-200 dark:border-blue-900">
            {belum.map((r) => (
              <li key={r.id} className="flex items-center gap-2 border-b border-blue-100 px-4 py-2 last:border-0 dark:border-blue-950">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{r.nama}</span>
                  <span className="block truncate text-[12px] text-neutral-500">{[tglId(r.tglSurvey), r.surveyor, r.rekomendasi].filter(Boolean).join(' · ')}</span>
                </span>
                <button onClick={() => dariReport(r)} disabled={!!proses} className="min-h-10 shrink-0 rounded-xl bg-blue-600 px-3 text-[13px] font-bold text-white disabled:opacity-50">{proses === r.id ? 'Membuat…' : 'Buat BCP'}</button>
              </li>
            ))}
          </ul>
        </>
      )}

      {(list?.length || 0) > 4 && <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama konsumen / MAO / unit" aria-label="Cari BCP" className={`${FIELD} mt-4 min-h-11`} />}
      <p className="mt-6 text-[15px] font-bold">BCP tersimpan</p>
      {akun.role !== 'owner' && <p className="text-[12px] text-neutral-500">Hanya BCP buatan akun ini (berisi no HP & rekening konsumen).</p>}
      {err && <p className="mt-2 text-[13px] text-red-700 dark:text-red-300">{err}</p>}
      {list === null ? <p className="mt-2 text-[13px] text-neutral-500">Memuat…</p> : !tampil.length ? (
        <p className="mt-2 text-[14px] text-neutral-500">{list.length ? 'Tidak ada yang cocok.' : 'Belum ada format BCP.'}</p>
      ) : (
        <ul className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {tampil.map((b) => (
            <li key={b.id} className="flex items-center border-b border-neutral-200 last:border-0 dark:border-neutral-800">
              <button onClick={() => setBuka(b)} className="flex min-h-16 min-w-0 flex-1 flex-col justify-center px-4 py-2 text-left active:bg-neutral-50 dark:active:bg-neutral-900">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-bold">{b.nama || '(tanpa nama)'}</span>
                  {b.jenisKonsumen && <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold dark:bg-neutral-800">{b.jenisKonsumen === 'Repeat Order' ? 'RO' : 'NC'}</span>}
                </span>
                <span className="truncate text-[12px] text-neutral-500">{[ringkasBcp(b), tglId(b.diubah), akun.role === 'owner' ? b.oleh : '', cariReportBcp(b, reports) ? 'ada report 6C 1EP' : ''].filter(Boolean).join(' · ')}</span>
              </button>
              <button onClick={() => hapus(b)} aria-label={`Hapus BCP ${b.nama}`} className="flex h-12 w-12 shrink-0 items-center justify-center text-neutral-400"><Ico n="x" className="h-4 w-4" sw={2} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
