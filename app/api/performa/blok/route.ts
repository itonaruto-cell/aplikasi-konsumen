import { NextResponse, type NextRequest } from 'next/server';
import { secretOk } from '../../../../lib/secret';
import { rapikanBlokSheet, simpanBlokSheet } from '../../../../lib/blok-sheet';
import { lupakanPerforma } from '../../../../lib/performa';

export const dynamic = 'force-dynamic';

// Dipanggil file Apps Script "BlokSheet" setiap kirimPerformaLengkap.
// Versi 2: { sumber, dikirim, grid: isi tab BAHAN REVIEW MKT } — tabelnya dicari di server (lib/blok-grid.ts).
// Versi 1: { sumber, dikirim, blok: [{ s, t, h, r }], tidakAda }. Header x-cek: 1 = hanya cek, tidak disimpan.
export async function POST(req: NextRequest) {
  if (!process.env.PERFORMA_SECRET) return NextResponse.json({ error: 'PERFORMA_SECRET belum diisi di Vercel.' }, { status: 500 });
  if (!secretOk(req.headers.get('x-performa-secret'))) return NextResponse.json({ error: 'Kunci salah.' }, { status: 401 });
  const text = await req.text();
  if (text.length > 1_000_000) return NextResponse.json({ error: 'Data terlalu besar.' }, { status: 413 });
  let x;
  try { x = rapikanBlokSheet(JSON.parse(text)); } catch { return NextResponse.json({ error: 'Format data salah.' }, { status: 400 }); }
  if (!x) return NextResponse.json({ error: 'Tidak ada tabel.' }, { status: 400 });
  const ringkas = x.blok.map((b) => `${b.s === 'cabang' ? '' : `${b.s} · `}${b.t} (${b.r.length} baris)`);
  const info = { sumber: x.sumber, versi: x.grid ? 2 : 1, ukuran: x.grid ? `${x.grid.length}x${Math.max(0, ...x.grid.map((r) => r.length))}` : undefined,
    bulan: x.hasil?.bulan, updated: x.hasil?.updated, blok: ringkas, tidakAda: x.tidakAda };
  if (req.headers.get('x-cek') === '1') return NextResponse.json({ ok: true, cek: true, ...info, contoh: x.blok.map((b) => ({ t: `${b.s} · ${b.t}`, h: b.h, r: b.r.slice(0, 8) })) });
  console.info('BlokSheet diterima.', JSON.stringify(info));
  try {
    await simpanBlokSheet(x);
    lupakanPerforma();
    return NextResponse.json({ ok: true, blok: ringkas, tidakAda: x.tidakAda });
  } catch (err) {
    console.error('Gagal menyimpan BlokSheet:', err);
    return NextResponse.json({ error: 'Gagal menyimpan. Coba lagi.' }, { status: 500 });
  }
}
