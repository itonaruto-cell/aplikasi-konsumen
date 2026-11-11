// Report survey 6C 1EP → Format BCP: lengkapi BCP konsumen yang sama (isian BCP tidak ditimpa) atau buat baru.
import { bawaanMao, bcpBaru, bcpDariReport, cariBcp, rapikanBcp, type Bcp } from '../../lib/bcp-types';
import type { ReportSurvey } from '../../lib/report-survey';

export const KUNCI_BUKA_BCP = 'bcp-buka';
// Format BCP → BA BCP di menu Surat (isian dibawa lewat sessionStorage)
export const KUNCI_BA_BCP = 'surat-dari-bcp';
export async function daftarBcp(): Promise<Bcp[]> {
  const res = await fetch('/api/bcp', { cache: 'no-store' });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error || 'Data BCP gagal dimuat.');
  return (j.list || []).map(rapikanBcp);
}
export async function simpanBcpDariReport(r: ReportSurvey, akun: { email: string; nama: string }): Promise<Bcp> {
  const list = await daftarBcp();
  const dasar = cariBcp(r, list) || bcpBaru(bawaanMao(list, akun));
  const { b } = bcpDariReport(dasar, r, false);
  const res = await fetch('/api/bcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bcp: b }) });
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error || 'Format BCP gagal disimpan.');
  try { sessionStorage.setItem(KUNCI_BUKA_BCP, j.bcp.id); } catch {}
  return rapikanBcp(j.bcp);
}
