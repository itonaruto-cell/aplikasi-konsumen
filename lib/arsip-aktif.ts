// Bulan arsip yang sedang dilihat di aplikasi ('' = bulan berjalan). Dipakai daftar konsumen cair & data OI
// supaya ikut mengambil data bulan arsip yang sama.
let aktif = '';
const pendengar = new Set<() => void>();
export const bulanArsip = () => aktif;
export function aturBulanArsip(b: string) { if (b === aktif) return; aktif = b; pendengar.forEach((f) => f()); }
export function dengarArsip(f: () => void) { pendengar.add(f); return () => { pendengar.delete(f); }; }
export const dgnBulan = (url: string) => (aktif ? `${url}${url.includes('?') ? '&' : '?'}bulan=${aktif}` : url);
