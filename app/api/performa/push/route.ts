import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { savePerforma } from '../../../../lib/performa';
import type { Performa } from '../../../../lib/performa-types';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 500_000;

function secretOk(given: string | null): boolean {
  const expected = process.env.PERFORMA_SECRET || '';
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Dipanggil Apps Script (kirimPerforma) tiap 30 menit. Tidak butuh login,
// tapi wajib membawa header x-performa-secret yang sama dengan PERFORMA_SECRET di Vercel.
export async function POST(req: NextRequest) {
  if (!process.env.PERFORMA_SECRET) {
    return NextResponse.json({ error: 'PERFORMA_SECRET belum diisi di Vercel.' }, { status: 500 });
  }
  if (!secretOk(req.headers.get('x-performa-secret'))) {
    return NextResponse.json({ error: 'Kunci salah.' }, { status: 401 });
  }

  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: 'Data terlalu besar.' }, { status: 413 });

  let data: Performa;
  try {
    data = JSON.parse(text) as Performa;
  } catch {
    return NextResponse.json({ error: 'Format data salah.' }, { status: 400 });
  }
  if (!data || !Array.isArray(data.orang)) {
    return NextResponse.json({ error: 'Data performa tidak lengkap.' }, { status: 400 });
  }

  try {
    await savePerforma(data);
    return NextResponse.json({ ok: true, orang: data.orang.length });
  } catch (err) {
    console.error('Gagal menyimpan performa:', err);
    return NextResponse.json({ error: 'Gagal menyimpan. Pastikan service account punya akses Editor di Google Sheets.' }, { status: 500 });
  }
}
