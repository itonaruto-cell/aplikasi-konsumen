// Penyimpanan format aplikasi BCP (tab BCP, dibuat otomatis); isi disimpan sebagai JSON.
import { readRows, appendRow, updateRowById } from './sheet-store';
import { rapikanBcp, type Bcp } from './bcp-types';

export const TAB_BCP = 'BCP';
const N_DATA = 2, POTONG = 45_000;
export const HEAD_BCP = ['ID', 'DIBUAT', 'DIUBAH', 'OLEH', 'EMAIL', 'NAMA', 'STATUS', ...Array.from({ length: N_DATA }, (_, i) => `DATA${i + 1}`)];
export const MAKS_JSON_BCP = N_DATA * POTONG;

const keBaris = (b: Bcp, status = 'aktif') => {
  const json = JSON.stringify(b);
  return [b.id, b.dibuat, b.diubah, b.oleh, b.email, b.nama, status, ...Array.from({ length: N_DATA }, (_, i) => json.slice(i * POTONG, (i + 1) * POTONG))];
};
export async function semuaBcp(): Promise<Bcp[]> {
  return (await readRows(TAB_BCP, HEAD_BCP)).filter((x) => x[0] && x[6] !== 'hapus').map((x) => {
    try { return rapikanBcp({ ...JSON.parse(x.slice(7, 7 + N_DATA).join('')), id: x[0], dibuat: x[1], diubah: x[2], oleh: x[3], email: x[4] }); } catch { return null; }
  }).filter((x): x is Bcp => !!x).sort((a, b) => b.diubah.localeCompare(a.diubah));
}
export const tambahBcp = (b: Bcp) => appendRow(TAB_BCP, HEAD_BCP, keBaris(b));
export const ubahBcp = (b: Bcp, status?: string) => updateRowById(TAB_BCP, HEAD_BCP, b.id, keBaris(b, status));
