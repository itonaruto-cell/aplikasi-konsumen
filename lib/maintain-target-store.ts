// Penyimpanan target maintain MA di tab TARGET_MAINTAIN (satu baris per MA, plus baris __KET untuk keterangan report).
import { readRows, writeRows } from './sheet-store';
import { KET_AWAL, kunciMa, rapikanTarget, type BrandMa, type TargetMa } from './maintain-target';

const TAB = 'TARGET_MAINTAIN';
const HEAD = ['BRAND', 'KUNCI', 'NAMA', 'TARGET', 'DIUBAH', 'OLEH'];
const KET = '__KET';
const brandOk = (b: string): b is BrandMa => b === 'mobilku' || b === 'motorku';

export async function bacaTarget(): Promise<TargetMa> {
  const t: TargetMa = { target: { mobilku: {}, motorku: {} }, ket: { mobilku: KET_AWAL, motorku: KET_AWAL } };
  for (const [b, k, n, v] of await readRows(TAB, HEAD)) {
    if (!brandOk(b)) continue;
    if (k === KET) { if (n.trim()) t.ket[b] = n.trim(); continue; }
    const x = Number(v);
    if (k && v !== '' && isFinite(x)) t.target[b][k] = x;
  }
  return rapikanTarget(t);
}

export type UbahTarget = { brand: BrandMa; ubah: { nama: string; target: number | null }[]; ket?: string };
export async function simpanTarget(x: UbahTarget, oleh: string): Promise<TargetMa> {
  const rows = await readRows(TAB, HEAD);
  const now = new Date().toISOString();
  const peta = new Map(rows.filter((r) => brandOk(r[0]) && r[1]).map((r) => [`${r[0]}|${r[1]}`, r]));
  for (const u of x.ubah) {
    const k = kunciMa(u.nama);
    if (!k) continue;
    if (u.target === null) peta.delete(`${x.brand}|${k}`);
    else peta.set(`${x.brand}|${k}`, [x.brand, k, u.nama.trim().slice(0, 80), String(Math.max(0, Math.min(9, Math.round(u.target)))), now, oleh]);
  }
  if (typeof x.ket === 'string') peta.set(`${x.brand}|${KET}`, [x.brand, KET, x.ket.trim().slice(0, 80) || KET_AWAL, '', now, oleh]);
  await writeRows(TAB, HEAD, [...peta.values()]);
  return bacaTarget();
}
