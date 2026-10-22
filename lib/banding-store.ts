// Penyimpanan Form Banding (tab BANDING, dibuat otomatis). Isi form disimpan sebagai JSON yang dipotong
// per 45.000 karakter (batas sel Google Sheets 50.000) di kolom DATA1..DATA6.
import { readRows, appendRow, updateRowById } from './sheet-store';
import { rapikanBanding, type Banding } from './banding-types';

export const TAB_BANDING = 'BANDING';
const N_DATA = 6, POTONG = 45_000;
export const HEAD_BANDING = ['ID', 'DIBUAT', 'DIUBAH', 'OLEH', 'APP_NO', 'NAMA', 'STATUS', ...Array.from({ length: N_DATA }, (_, i) => `DATA${i + 1}`)];
export const MAKS_JSON = N_DATA * POTONG;

export function keBaris(b: Banding, status: string = b.status): string[] {
  const json = JSON.stringify(b);
  const data = Array.from({ length: N_DATA }, (_, i) => json.slice(i * POTONG, (i + 1) * POTONG));
  return [b.id, b.dibuat, b.diubah, b.oleh, b.appNo, b.nama, status, ...data];
}
const dariBaris = (r: string[]): Banding | null => {
  try { return rapikanBanding({ ...JSON.parse(r.slice(7, 7 + N_DATA).join('')), id: r[0], dibuat: r[1], diubah: r[2], oleh: r[3] }); } catch { return null; }
};

export async function semuaBanding(): Promise<Banding[]> {
  return (await readRows(TAB_BANDING, HEAD_BANDING)).filter((r) => r[0] && r[6] !== 'hapus')
    .map(dariBaris).filter((b): b is Banding => !!b)
    .sort((a, b) => b.diubah.localeCompare(a.diubah));
}
export const tambahBanding = (b: Banding) => appendRow(TAB_BANDING, HEAD_BANDING, keBaris(b));
export const ubahBanding = (b: Banding, status?: string) => updateRowById(TAB_BANDING, HEAD_BANDING, b.id, keBaris(b, status));
