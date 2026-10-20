// Penyimpanan database prospek (tab PROSPEK, dibuat otomatis) dan aturan siapa boleh melihat.
import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from './session';
import { getPerfName, getRole } from './access';
import { readRows } from './sheet-store';
import { keyOf } from './performa-calc';
import { bacaStatus, type Prospek } from './prospek-types';

export const TAB_PROSPEK = 'PROSPEK';
export const HEAD_PROSPEK = ['ID', 'NAMA', 'NO_HP', 'PROFESI', 'ALAMAT', 'SUMBER', 'CATATAN', 'PIC', 'STATUS', 'HASIL', 'FU_TERAKHIR', 'DIBUAT', 'DIUBAH', 'OLEH', 'FOTO', 'MAPS', 'PRIVAT'];

export type BarisProspek = Prospek & { hapus: boolean };
export const keObj = (r: string[]): BarisProspek => ({
  id: r[0], nama: r[1], hp: r[2], profesi: r[3], alamat: r[4], sumber: r[5], catatan: r[6], pic: r[7],
  status: bacaStatus(r[8]), hapus: r[8] === 'hapus',
  hasil: r[9], fu: r[10], dibuat: r[11], diubah: r[12] || r[11], oleh: r[13], foto: r[14] || '', maps: r[15] || '', privat: r[16] === '1',
});
export const keBaris = (b: Prospek, status: string = b.status): string[] =>
  [b.id, b.nama, b.hp, b.profesi, b.alamat, b.sumber, b.catatan, b.pic, status, b.hasil, b.fu, b.dibuat, b.diubah, b.oleh, b.foto || '', b.maps || '', b.privat ? '1' : ''];

export async function sesiProspek(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const role = await getRole(s.email);
  if (!role) return null;
  const aku = role === 'owner' ? '' : (await getPerfName(s.email)) || s.name || s.email;
  return { s, role, aku };
}
// Prospek privat hanya terlihat owner dan PIC-nya
export const bolehLihat = (role: string, aku: string) => (p: Prospek) => role === 'owner' || !p.privat || (!!p.pic && keyOf(p.pic) === keyOf(aku));
export const semuaProspek = async () => (await readRows(TAB_PROSPEK, HEAD_PROSPEK)).filter((r) => r[0]).map(keObj).filter((p) => !p.hapus);
