import { NextResponse, type NextRequest } from 'next/server';
import { secretOk } from '../../../../lib/secret';
import { kolomCair, rapikanTabel, simpanTabel, TAB_CAIR, TAB_OI } from '../../../../lib/tarikan-data';
import { lupakanKonsumen } from '../../../../lib/konsumen-db';

export const dynamic = 'force-dynamic';
const MAX_BYTES = 4_000_000;

// Dipanggil Apps Script (kirimDataTarikan) bersama kiriman performa.
// Body: { cair?: { sumber, h, r }, oi?: { sumber, h, r } } — h = judul kolom, r = baris (teks tampilan sheet).
export async function POST(req: NextRequest) {
  if (!process.env.PERFORMA_SECRET) return NextResponse.json({ error: 'PERFORMA_SECRET belum diisi di Vercel.' }, { status: 500 });
  if (!secretOk(req.headers.get('x-performa-secret'))) return NextResponse.json({ error: 'Kunci salah.' }, { status: 401 });
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: 'Data terlalu besar.' }, { status: 413 });
  let body: { cair?: unknown; oi?: unknown };
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: 'Format data salah.' }, { status: 400 }); }
  const cair = body?.cair ? rapikanTabel(body.cair) : null;
  const oi = body?.oi ? rapikanTabel(body.oi) : null;
  if (!cair && !oi) return NextResponse.json({ error: 'Tidak ada data cair / OI.' }, { status: 400 });
  if (cair) {
    // Cek kolom tanggal cair (untuk jatuh tempo): judul kolom tanggal + contoh isinya (tanpa data pribadi)
    const k = kolomCair(cair.h, cair.r);
    const kolTgl = cair.h.map((x, i) => [x, i] as const).filter(([x]) => /TGL|TANGGAL|DATE|PROCEED|DISB|CAIR|GO ?LIVE|\bGL\b/i.test(x));
    console.info('Tarikan cair diterima.', JSON.stringify({ kolom: cair.h.length, baris: cair.r.length, tgl: k.tgl >= 0 ? `${k.tgl}:${cair.h[k.tgl]}` : null,
      kandidat: kolTgl.map(([x, i]) => ({ i, judul: x, contoh: cair.r.slice(0, 3).map((b) => b[i] || '') })) }));
  }
  try {
    if (cair) { await simpanTabel(TAB_CAIR, cair); lupakanKonsumen(); }
    if (oi) await simpanTabel(TAB_OI, oi);
    return NextResponse.json({ ok: true, cair: cair?.r.length ?? null, oi: oi?.r.length ?? null });
  } catch (err) {
    console.error('Gagal menyimpan data tarikan/OI:', err);
    return NextResponse.json({ error: 'Gagal menyimpan. Pastikan service account punya akses Editor.' }, { status: 500 });
  }
}
