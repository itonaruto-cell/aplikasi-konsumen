'use client';
// Pratinjau lembar Excel (Lembar dari lib/xlsx-lembar) di layar: sel, gabungan, gaya, tinggi baris, dan foto
// digambar dari data yang sama dengan file yang diunduh, jadi tampilannya sesuai hasil unduhan.
import type { CSSProperties } from 'react';
import { kolomPx, ptKePx, type Gaya, type Lembar } from '../../lib/xlsx-lembar';

const BARIS_DASAR = 15; // pt

export function ukuranLembar(l: Lembar) {
  const xs = [0];
  l.lebar.forEach((w) => xs.push(xs[xs.length - 1] + kolomPx(w)));
  const nBaris = Math.max(0, ...l.sel.keys(), ...l.tinggi.keys(), ...l.gambar.map((g) => g.baris)) + 1;
  const ys = [0];
  for (let r = 1; r <= nBaris; r++) ys.push(ys[r - 1] + ptKePx(l.tinggi.get(r) ?? BARIS_DASAR));
  return { xs, ys, w: xs[xs.length - 1], h: ys[ys.length - 1] };
}

function gayaCss(g: Gaya | undefined): CSSProperties {
  if (!g) return {};
  const garis = g.border === 'thick' ? '3px solid #000' : g.border === 'thin' ? '1px solid #000' : undefined;
  return {
    fontSize: ptKePx(g.size || 11), fontWeight: g.bold ? 700 : 400, fontStyle: g.italic ? 'italic' : undefined,
    color: g.color ? `#${g.color}` : '#000', background: g.fill ? `#${g.fill}` : undefined,
    border: garis, borderBottom: g.border === 'bawahTebal' ? '3px solid #000' : garis,
    textAlign: g.h || 'left', justifyContent: g.v === 'top' ? 'flex-start' : g.v === 'bottom' ? 'flex-end' : 'center',
    whiteSpace: g.wrap ? 'pre-wrap' : 'pre', overflowWrap: g.wrap ? 'anywhere' : undefined,
  };
}

export default function PreviewLembar({ lembar, gaya, skala }: { lembar: Lembar; gaya: Gaya[]; skala: number }) {
  const { xs, ys, w, h } = ukuranLembar(lembar);
  const tertutup = new Set<string>();
  const gab = new Map<string, [number, number]>();
  for (const [r1, c1, r2, c2] of lembar.gabung) {
    gab.set(`${r1}:${c1}`, [r2, c2]);
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (r !== r1 || c !== c1) tertutup.add(`${r}:${c}`);
  }
  const sel: { r: number; c: number; v: unknown; s: number }[] = [];
  lembar.sel.forEach((m, r) => m.forEach((x, c) => { if (!tertutup.has(`${r}:${c}`)) sel.push({ r, c, v: x.v, s: x.s }); }));
  return (
    <div style={{ width: w * skala, height: h * skala }} className="relative overflow-hidden bg-white">
      <div style={{ width: w, height: h, transform: `scale(${skala})`, transformOrigin: '0 0', fontFamily: 'Arial, Helvetica, sans-serif' }} className="absolute left-0 top-0">
        {sel.map(({ r, c, v, s }) => {
          const [r2, c2] = gab.get(`${r}:${c}`) || [r, c];
          const g = s ? gaya[s - 1] : undefined;
          const teks = v === null || v === undefined || v === '' ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
          return (
            <div key={`${r}:${c}`} style={{ position: 'absolute', left: xs[c - 1], top: ys[r - 1], width: xs[c2] - xs[c - 1], height: ys[r2] - ys[r - 1], display: 'flex', flexDirection: 'column', padding: '1px 3px', overflow: 'hidden', lineHeight: 1.25, boxSizing: 'border-box', ...gayaCss(g) }}>
              {teks}
            </div>
          );
        })}
        {lembar.gambar.map((g, i) => g.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={g.src} alt="" style={{ position: 'absolute', left: xs[g.kolom - 1] + (g.dx || 0), top: ys[g.baris - 1] + (g.dy || 0), width: g.w, height: g.h }} />
        ) : null)}
      </div>
    </div>
  );
}
