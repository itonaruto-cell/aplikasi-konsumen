// Catatan tugas terjadwal yang sudah dijalankan (tab JADWAL), supaya cron yang terpanggil dua kali tidak dobel.
import { appendRow, readRows } from './sheet-store';

const TAB = 'JADWAL';
const HEAD = ['ID', 'WAKTU', 'HASIL'];
export async function sudahJalan(id: string): Promise<boolean> {
  return (await readRows(TAB, HEAD)).some((r) => r[0] === id);
}
export async function tandaiJalan(id: string, hasil: string) {
  await appendRow(TAB, HEAD, [id, new Date().toISOString(), hasil.slice(0, 500)]);
}
