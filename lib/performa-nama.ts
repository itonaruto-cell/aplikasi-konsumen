// Konsumen prioritas yang di sheet AKTIVITAS RO kolom namanya berisi nomor kontrak / cust no (mis. hasil inject
// P3 yang belum lengkap): namanya dicarikan dari database konsumen supaya daftar P1–P3 tetap menampilkan nama.
import { cariKonsumen } from './konsumen-db';
import type { Calon } from './inject-types';
import type { Performa } from './performa-types';

const SEPERTI_NOMOR = /^\d{8,}$/;
const angka = (s: string) => String(s || '').replace(/\D/g, '');

export async function lengkapiNamaKonsumen(d: Performa): Promise<Performa> {
  const kons = d.aktivitas?.konsumen;
  if (!kons) return d;
  const perlu = new Set<string>();
  for (const l of Object.values(kons)) for (const k of l) { const n = String(k.n || '').replace(/\s/g, ''); if (SEPERTI_NOMOR.test(n)) perlu.add(n); }
  if (!perlu.size) return d;
  const peta = new Map<string, Calon>();
  await Promise.all([...perlu].slice(0, 60).map(async (no) => {
    const r = await cariKonsumen(no, 5).catch(() => null);
    const c = r?.list.find((x) => angka(x.kontrak) === no || angka(x.cust) === no);
    if (c) peta.set(no, c);
  }));
  if (!peta.size) return d;
  const ganti = <T extends { n: string; k: string }>(k: T, nkLama?: string) => {
    const no = String(k.n || '').replace(/\s/g, '');
    const c = peta.get(no);
    return c ? { ...k, n: c.nama, k: k.k || c.kecamatan, ...(nkLama !== undefined ? { nk: nkLama || c.kontrak || no } : {}) } : k;
  };
  return {
    ...d,
    aktivitas: { ...d.aktivitas!, konsumen: Object.fromEntries(Object.entries(kons).map(([b, l]) => [b, l.map((k) => ganti(k, k.nk || ''))])) },
    orang: (d.orang || []).map((o) => (o.visit?.list ? { ...o, visit: { ...o.visit, list: o.visit.list.map((k) => ganti(k)) } } : o)),
  };
}
