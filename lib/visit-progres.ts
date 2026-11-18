// Progres visit prioritas (P1–P3) per brand: dari tabel Status visit di sheet, atau ringkasan aktivitas.
// Dipakai tab Mobilku/Motorku dan notifikasi "waktunya inject P3" (saat visit sudah ≥ 80% dari data).
import type { Blok, Performa } from './performa-types';

export const AMBANG_INJECT = 0.8;
export type VisitP = { bt: number; tb: number; bl: number; tot: number };
export type ProgresVisit = { p: VisitP[]; tot: number; sudah: number; bt: number; tb: number; bl: number; pct: number | null; kurang: number; waktunya: boolean };

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);
const label = (v: unknown) => String(v ?? '').trim();
const blok = (d: Performa, s: string, t: string): Blok | undefined =>
  (d.blok || []).find((b) => b.s === s && b.t.toLowerCase() === t.toLowerCase());

export function visitPrioritas(d: Performa, b: string): VisitP[] {
  const sv = blok(d, b, 'Status visit');
  return ([1, 2, 3] as const).map((p) => {
    const get = (re: RegExp) => num(sv?.r.find((r) => re.test(label(r[0])))?.[p]);
    const bt = get(/^bertemu$/i), tb = get(/^tidak\s*bertemu$/i), bl = get(/^belum\s*visit$/i), gt = get(/^grand\s*total$/i);
    if (gt !== null) return { bt: bt || 0, tb: tb || 0, bl: bl || 0, tot: gt };
    const x = d.aktivitas?.visit?.[b]?.[`p${p}` as 'p1'];
    return { bt: x?.ditemui || 0, tb: (x?.tervisit || 0) - (x?.ditemui || 0), bl: (x?.database || 0) - (x?.tervisit || 0), tot: x?.database || 0 };
  });
}

/** Total P1–P3: sudah divisit (bertemu + tidak bertemu) dibanding seluruh data; waktunya inject P3 kalau ≥ 80%. */
export function progresVisit(d: Performa, b: string): ProgresVisit {
  const p = visitPrioritas(d, b);
  const jml = (k: keyof VisitP) => p.reduce((s, x) => s + x[k], 0);
  const tot = jml('tot'), bt = jml('bt'), tb = jml('tb'), sudah = bt + tb;
  const pct = tot > 0 ? sudah / tot : null;
  return { p, tot, sudah, bt, tb, bl: jml('bl'), pct, kurang: Math.max(0, Math.ceil(AMBANG_INJECT * tot - 1e-9) - sudah), waktunya: pct !== null && pct >= AMBANG_INJECT };
}
