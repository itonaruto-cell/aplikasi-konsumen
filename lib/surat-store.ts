// Penyimpanan Surat IM / Berita Acara (tab SURAT, dibuat otomatis). Isi disimpan sebagai JSON dipotong per 45.000 karakter.
import { readRows, appendRow, updateRowById } from './sheet-store';
import { rapikanSurat, type Surat } from './surat-types';

export const TAB_SURAT = 'SURAT';
const N_DATA = 3, POTONG = 45_000;
export const HEAD_SURAT = ['ID', 'DIBUAT', 'DIUBAH', 'OLEH', 'TEMPLATE', 'NAMA', 'STATUS', ...Array.from({ length: N_DATA }, (_, i) => `DATA${i + 1}`)];
export const MAKS_JSON_SURAT = N_DATA * POTONG;

function keBaris(s: Surat, status = 'aktif'): string[] {
  const json = JSON.stringify(s);
  return [s.id, s.dibuat, s.diubah, s.oleh, s.template, s.data.nama || '', status, ...Array.from({ length: N_DATA }, (_, i) => json.slice(i * POTONG, (i + 1) * POTONG))];
}
const dariBaris = (r: string[]): Surat | null => {
  try { return rapikanSurat({ ...JSON.parse(r.slice(7, 7 + N_DATA).join('')), id: r[0], dibuat: r[1], diubah: r[2], oleh: r[3] }); } catch { return null; }
};
export async function semuaSurat(): Promise<Surat[]> {
  return (await readRows(TAB_SURAT, HEAD_SURAT)).filter((r) => r[0] && r[6] !== 'hapus')
    .map(dariBaris).filter((s): s is Surat => !!s)
    .sort((a, b) => b.diubah.localeCompare(a.diubah));
}
export const tambahSurat = (s: Surat) => appendRow(TAB_SURAT, HEAD_SURAT, keBaris(s));
export const ubahSurat = (s: Surat, status?: string) => updateRowById(TAB_SURAT, HEAD_SURAT, s.id, keBaris(s, status));
