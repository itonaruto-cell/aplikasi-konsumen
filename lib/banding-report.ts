// Integrasi Form Banding (F-761) ↔ Report survey 6C + 1E + 1P: kalau nama konsumen (atau App No) sama,
// isian report dipakai mengisi form banding. Isian banding yang sudah ada tidak ditimpa kecuali diminta.
import { C6, type Banding } from './banding-types';
import { fmtPersen, hitungKapasitas, teksCapacity, type ReportSurvey } from './report-survey';

const SAPAAN = /\b(BPK|BAPAK|BP|PAK|IBU|IB|BU|SDR|SDRI|SAUDARA|SAUDARI|NY|NYONYA|TN|TUAN|HJ|H|HAJI|HAJJAH)\b\.?/g;
export const kunciNama = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z\s]/g, ' ').replace(SAPAAN, ' ').replace(/\s+/g, ' ').trim();
const kunciApp = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function samaKonsumen(a: { nama: string; appNo: string }, b: { nama: string; appNo: string }): boolean {
  const x = kunciApp(a.appNo), y = kunciApp(b.appNo);
  if (x && y) return x === y;
  const n = kunciNama(a.nama), m = kunciNama(b.nama);
  return n.length >= 3 && n === m;
}
/** Report terbaru untuk konsumen yang sama dengan form banding. */
export const cariReport = (b: Pick<Banding, 'nama' | 'appNo'>, list: ReportSurvey[]) =>
  list.filter((r) => samaKonsumen(b, r)).sort((p, q) => (q.diubah || q.dibuat).localeCompare(p.diubah || p.dibuat))[0] || null;
export const cariBanding = (r: Pick<ReportSurvey, 'nama' | 'appNo'>, list: Banding[]) =>
  list.filter((b) => samaKonsumen(b, r)).sort((p, q) => (q.diubah || q.dibuat).localeCompare(p.diubah || p.dibuat))[0] || null;

const rb = (n: number) => n.toLocaleString('id-ID');
/** Isian banding dari report. timpa=false: hanya mengisi yang masih kosong. Mengembalikan form baru + jumlah isian yang berubah. */
export function isiDariReport(b: Banding, r: ReportSurvey, timpa = false): { b: Banding; n: number } {
  let n = 0;
  const pakai = <T,>(lama: T, baru: T, kosong: boolean): T => {
    if (baru === undefined || baru === null || baru === '' || baru === 0) return lama;
    if (!timpa && !kosong) return lama;
    if (lama !== baru) n++;
    return baru;
  };
  const c6 = { ...b.c6 };
  for (const [k] of C6) {
    const isi = (k === 'capacity' ? teksCapacity(r) : r.c6[k]).trim();
    c6[k] = pakai(c6[k], isi, !c6[k].trim());
  }
  const kap = hitungKapasitas(r);
  const wa = { ...b.wa };
  wa.merk = pakai(wa.merk, r.unit.trim(), !wa.merk.trim());
  wa.pencairan = pakai(wa.pencairan, r.pencairan, !wa.pencairan);
  wa.angsuran = pakai(wa.angsuran, r.angsuran, !wa.angsuran);
  wa.tenor = pakai(wa.tenor, r.tenor, !wa.tenor);
  wa.pekerjaan = pakai(wa.pekerjaan, r.pekerjaan.trim(), !wa.pekerjaan.trim());
  wa.penghasilan = pakai(wa.penghasilan, kap.penghasilan ? `Total penghasilan : ${rb(kap.penghasilan)}` : '', !wa.penghasilan.trim());
  wa.dsr = pakai(wa.dsr, kap.penghasilan ? [`Angsuran wom : ${rb(kap.wom)}`, `Total angsuran : ${rb(kap.total)}`, `IIR : ${fmtPersen(kap.iir)}`, `DSR : ${fmtPersen(kap.dsr)}`].join('\n') : '', !wa.dsr.trim());
  const appNo = pakai(b.appNo, r.appNo.trim().toUpperCase(), !b.appNo.trim());
  const nama = b.nama.trim() ? b.nama : (n++, r.nama.toUpperCase());
  return { b: { ...b, nama, appNo, c6, wa }, n };
}
