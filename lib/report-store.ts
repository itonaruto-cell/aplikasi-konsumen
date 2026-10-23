// Penyimpanan report survey (tab REPORT_SURVEY, dibuat otomatis); isi disimpan sebagai JSON.
import { readRows, appendRow, updateRowById } from './sheet-store';
import { rapikanReport, type ReportSurvey } from './report-survey';

export const TAB_REPORT = 'REPORT_SURVEY';
const N_DATA = 3, POTONG = 45_000;
export const HEAD_REPORT = ['ID', 'DIBUAT', 'DIUBAH', 'OLEH', 'NAMA', 'STATUS', ...Array.from({ length: N_DATA }, (_, i) => `DATA${i + 1}`)];
export const MAKS_JSON_REPORT = N_DATA * POTONG;

const keBaris = (r: ReportSurvey, status = 'aktif') => {
  const json = JSON.stringify(r);
  return [r.id, r.dibuat, r.diubah, r.oleh, r.nama, status, ...Array.from({ length: N_DATA }, (_, i) => json.slice(i * POTONG, (i + 1) * POTONG))];
};
export async function semuaReport(): Promise<ReportSurvey[]> {
  return (await readRows(TAB_REPORT, HEAD_REPORT)).filter((x) => x[0] && x[5] !== 'hapus').map((x) => {
    try { return rapikanReport({ ...JSON.parse(x.slice(6, 6 + N_DATA).join('')), id: x[0], dibuat: x[1], diubah: x[2], oleh: x[3] }); } catch { return null; }
  }).filter((x): x is ReportSurvey => !!x).sort((a, b) => b.diubah.localeCompare(a.diubah));
}
export const tambahReport = (r: ReportSurvey) => appendRow(TAB_REPORT, HEAD_REPORT, keBaris(r));
export const ubahReport = (r: ReportSurvey, status?: string) => updateRowById(TAB_REPORT, HEAD_REPORT, r.id, keBaris(r, status));
