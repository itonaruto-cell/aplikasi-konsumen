// Penyimpanan Form Entertain (tab ENTERTAIN, dibuat otomatis). Isi disimpan sebagai JSON dipotong per 45.000 karakter.
import { readRows, appendRow, updateRowById } from './sheet-store';
import { rapikanEntertain, ringkasEnt, type Entertain } from './entertain-types';

export const TAB_ENT = 'ENTERTAIN';
const N_DATA = 2, POTONG = 45_000;
export const HEAD_ENT = ['ID', 'DIBUAT', 'DIUBAH', 'OLEH', 'NOMOR', 'RINGKAS', 'STATUS', ...Array.from({ length: N_DATA }, (_, i) => `DATA${i + 1}`)];
export const MAKS_JSON_ENT = N_DATA * POTONG;

function keBaris(e: Entertain, status = 'aktif'): string[] {
  const json = JSON.stringify(e);
  return [e.id, e.dibuat, e.diubah, e.oleh, `${e.noUrut}/${e.kode}`, ringkasEnt(e), status, ...Array.from({ length: N_DATA }, (_, i) => json.slice(i * POTONG, (i + 1) * POTONG))];
}
const dariBaris = (r: string[]): Entertain | null => {
  try { return rapikanEntertain({ ...JSON.parse(r.slice(7, 7 + N_DATA).join('')), id: r[0], dibuat: r[1], diubah: r[2], oleh: r[3] }); } catch { return null; }
};
export async function semuaEntertain(): Promise<Entertain[]> {
  return (await readRows(TAB_ENT, HEAD_ENT)).filter((r) => r[0] && r[6] !== 'hapus')
    .map(dariBaris).filter((s): s is Entertain => !!s)
    .sort((a, b) => b.diubah.localeCompare(a.diubah));
}
export const tambahEntertain = (e: Entertain) => appendRow(TAB_ENT, HEAD_ENT, keBaris(e));
export const ubahEntertain = (e: Entertain, status?: string) => updateRowById(TAB_ENT, HEAD_ENT, e.id, keBaris(e, status));
