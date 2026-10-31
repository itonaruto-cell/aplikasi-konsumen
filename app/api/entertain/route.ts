import { NextResponse, type NextRequest } from 'next/server';
import { sesiProspek } from '../../../lib/prospek-store';
import { rapikanEntertain } from '../../../lib/entertain-types';
import { MAKS_JSON_ENT, semuaEntertain, tambahEntertain, ubahEntertain } from '../../../lib/entertain-store';

export const dynamic = 'force-dynamic';
const idSah = (id: string) => /^ent_[a-z0-9]{6,12}_[a-z0-9]{6,12}$/i.test(id);

// Form Entertain: semua akun yang sudah login boleh melihat & mengubah
async function akses(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return { gagal: NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 }) };
  return { x };
}

export async function GET(req: NextRequest) {
  const { gagal } = await akses(req);
  if (gagal) return gagal;
  try {
    return NextResponse.json({ list: await semuaEntertain() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca form entertain:', err);
    return NextResponse.json({ error: 'Data form entertain belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { x, gagal } = await akses(req);
  if (gagal) return gagal;
  const body = await req.json().catch(() => null) as { entertain?: unknown } | null;
  if (!body?.entertain) return NextResponse.json({ error: 'Data form entertain kosong.' }, { status: 400 });
  const s = rapikanEntertain(body.entertain);
  if (!idSah(s.id)) return NextResponse.json({ error: 'ID form tidak valid.' }, { status: 400 });
  const now = new Date().toISOString();
  const oleh = x!.aku || x!.s.name || x!.s.email;
  try {
    const lama = (await semuaEntertain()).find((y) => y.id === s.id);
    const baru = lama ? { ...s, dibuat: lama.dibuat, oleh: lama.oleh, diubah: now } : { ...s, dibuat: now, diubah: now, oleh };
    if (JSON.stringify(baru).length > MAKS_JSON_ENT) return NextResponse.json({ error: 'Isi form terlalu panjang.' }, { status: 413 });
    if (lama) await ubahEntertain(baru); else await tambahEntertain(baru);
    return NextResponse.json({ ok: true, entertain: baru });
  } catch (err) {
    console.error('Gagal menyimpan form entertain:', err);
    return NextResponse.json({ error: 'Form gagal disimpan. Coba lagi.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { gagal } = await akses(req);
  if (gagal) return gagal;
  const id = req.nextUrl.searchParams.get('id') || '';
  try {
    const s = (await semuaEntertain()).find((y) => y.id === id);
    if (!s) return NextResponse.json({ error: 'Form tidak ditemukan.' }, { status: 404 });
    await ubahEntertain(s, 'hapus');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Gagal menghapus form entertain:', err);
    return NextResponse.json({ error: 'Gagal menghapus. Coba lagi.' }, { status: 500 });
  }
}
