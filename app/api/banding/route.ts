import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { sesiProspek } from '../../../lib/prospek-store';
import { canSeeKonsumen } from '../../../lib/access';
import { rapikanBanding } from '../../../lib/banding-types';
import { MAKS_JSON, semuaBanding, tambahBanding, ubahBanding } from '../../../lib/banding-store';

export const dynamic = 'force-dynamic';

// Form Analisa Banding: owner & akun yang boleh melihat database konsumen (data konsumen & SLIK)
async function akses(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return { gagal: NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 }) };
  if (!canSeeKonsumen(x.role as 'owner')) return { gagal: NextResponse.json({ error: 'Form banding hanya untuk owner dan tim pemegang database konsumen.' }, { status: 403 }) };
  return { x };
}

export async function GET(req: NextRequest) {
  const { gagal } = await akses(req);
  if (gagal) return gagal;
  try {
    return NextResponse.json({ list: await semuaBanding() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca banding:', err);
    return NextResponse.json({ error: 'Data banding belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { x, gagal } = await akses(req);
  if (gagal) return gagal;
  const body = await req.json().catch(() => null) as { banding?: unknown } | null;
  if (!body?.banding) return NextResponse.json({ error: 'Data form kosong.' }, { status: 400 });
  const b = rapikanBanding(body.banding);
  if (!b.nama.trim() && !b.appNo.trim()) return NextResponse.json({ error: 'Isi minimal nama konsumen atau App No.' }, { status: 400 });
  const now = new Date().toISOString();
  const oleh = x!.aku || x!.s.name || x!.s.email;
  try {
    if (b.id) {
      const lama = (await semuaBanding()).find((y) => y.id === b.id);
      if (!lama) return NextResponse.json({ error: 'Form tidak ditemukan (mungkin sudah dihapus).' }, { status: 404 });
      const baru = { ...b, dibuat: lama.dibuat, oleh: lama.oleh, diubah: now };
      if (JSON.stringify(baru).length > MAKS_JSON) return NextResponse.json({ error: 'Isi form terlalu panjang.' }, { status: 413 });
      await ubahBanding(baru);
      return NextResponse.json({ ok: true, banding: baru });
    }
    const baru = { ...b, id: `bdg_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`, dibuat: now, diubah: now, oleh };
    if (JSON.stringify(baru).length > MAKS_JSON) return NextResponse.json({ error: 'Isi form terlalu panjang.' }, { status: 413 });
    await tambahBanding(baru);
    return NextResponse.json({ ok: true, banding: baru });
  } catch (err) {
    console.error('Gagal menyimpan banding:', err);
    return NextResponse.json({ error: 'Form gagal disimpan. Coba lagi.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { gagal } = await akses(req);
  if (gagal) return gagal;
  const id = req.nextUrl.searchParams.get('id') || '';
  try {
    const b = (await semuaBanding()).find((y) => y.id === id);
    if (!b) return NextResponse.json({ error: 'Form tidak ditemukan.' }, { status: 404 });
    await ubahBanding(b, 'hapus');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Gagal menghapus banding:', err);
    return NextResponse.json({ error: 'Gagal menghapus. Coba lagi.' }, { status: 500 });
  }
}
