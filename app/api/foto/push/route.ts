import { NextResponse, type NextRequest } from 'next/server';
import { secretOk } from '../../../../lib/secret';
import { MAX_B64, missingIds, saveFotos, validId } from '../../../../lib/foto-store';

export const dynamic = 'force-dynamic';

// Dipanggil Apps Script (kirimFoto) dengan header x-performa-secret.
// { cek: [id…] } → { missing: [id yang belum ada] }   |   { foto: [{ id, mime, data(base64) }] } → simpan
export async function POST(req: NextRequest) {
  if (!secretOk(req.headers.get('x-performa-secret'))) return NextResponse.json({ error: 'Kunci salah.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  try {
    if (Array.isArray(body?.cek)) {
      const list = body.cek.map(String).slice(0, 5000);
      return NextResponse.json({ missing: await missingIds(list) });
    }
    if (Array.isArray(body?.foto)) {
      const items = (body.foto as { id?: unknown; mime?: unknown; data?: unknown }[])
        .map((x) => ({ id: String(x.id || ''), mime: String(x.mime || 'image/jpeg'), data: String(x.data || '') }))
        .filter((x) => validId(x.id) && /^image\/(jpeg|png|webp|gif)$/.test(x.mime) && x.data.length > 100 && x.data.length <= MAX_B64 && /^[A-Za-z0-9+/=]+$/.test(x.data))
        .slice(0, 20);
      return NextResponse.json({ ok: true, disimpan: await saveFotos(items) });
    }
    return NextResponse.json({ error: 'Format tidak dikenal.' }, { status: 400 });
  } catch (err) {
    console.error('Foto push gagal:', err);
    return NextResponse.json({ error: 'Gagal menyimpan foto. Pastikan service account punya akses Editor.' }, { status: 500 });
  }
}
