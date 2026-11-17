import { NextResponse, type NextRequest } from 'next/server';
import { secretOk } from '../../../../lib/secret';
import { rapikanBlokSheet, simpanBlokSheet } from '../../../../lib/blok-sheet';
import { lupakanPerforma } from '../../../../lib/performa';

export const dynamic = 'force-dynamic';

// Dipanggil file Apps Script "BlokSheet" setiap selesai kirimPerformaLengkap.
// Body: { sumber, dikirim, blok: [{ s, t, h, r }], tidakAda: [judul tabel yang tidak ketemu] }
export async function POST(req: NextRequest) {
  if (!process.env.PERFORMA_SECRET) return NextResponse.json({ error: 'PERFORMA_SECRET belum diisi di Vercel.' }, { status: 500 });
  if (!secretOk(req.headers.get('x-performa-secret'))) return NextResponse.json({ error: 'Kunci salah.' }, { status: 401 });
  const text = await req.text();
  if (text.length > 1_000_000) return NextResponse.json({ error: 'Data terlalu besar.' }, { status: 413 });
  let x;
  try { x = rapikanBlokSheet(JSON.parse(text)); } catch { return NextResponse.json({ error: 'Format data salah.' }, { status: 400 }); }
  if (!x) return NextResponse.json({ error: 'Tidak ada tabel.' }, { status: 400 });
  console.info('BlokSheet diterima.', JSON.stringify({ sumber: x.sumber, blok: x.blok.map((b) => `${b.t} (${b.r.length} baris, ${b.h.length} kolom)`), tidakAda: x.tidakAda }));
  try {
    await simpanBlokSheet(x);
    lupakanPerforma();
    return NextResponse.json({ ok: true, blok: x.blok.length, tidakAda: x.tidakAda });
  } catch (err) {
    console.error('Gagal menyimpan BlokSheet:', err);
    return NextResponse.json({ error: 'Gagal menyimpan. Coba lagi.' }, { status: 500 });
  }
}
