import { NextResponse, type NextRequest } from 'next/server';
import { sesiProspek } from '../../../lib/prospek-store';
import { rapikanSurat } from '../../../lib/surat-types';
import { MAKS_JSON_SURAT, semuaSurat, tambahSurat, ubahSurat } from '../../../lib/surat-store';

export const dynamic = 'force-dynamic';
const idSah = (id: string) => /^srt_[a-z0-9]{6,12}_[a-z0-9]{6,12}$/i.test(id);

// Surat IM / Berita Acara: semua akun yang sudah login boleh melihat & mengubah
async function akses(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return { gagal: NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 }) };
  return { x };
}

export async function GET(req: NextRequest) {
  const { gagal } = await akses(req);
  if (gagal) return gagal;
  try {
    return NextResponse.json({ list: await semuaSurat() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca surat:', err);
    return NextResponse.json({ error: 'Data surat belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { x, gagal } = await akses(req);
  if (gagal) return gagal;
  const body = await req.json().catch(() => null) as { surat?: unknown } | null;
  if (!body?.surat) return NextResponse.json({ error: 'Data surat kosong.' }, { status: 400 });
  const s = rapikanSurat(body.surat);
  if (!idSah(s.id)) return NextResponse.json({ error: 'ID surat tidak valid.' }, { status: 400 });
  if (!s.data.nama?.trim() && !s.data.app?.trim()) return NextResponse.json({ error: 'Isi minimal nama konsumen atau No APP.' }, { status: 400 });
  const now = new Date().toISOString();
  const oleh = x!.aku || x!.s.name || x!.s.email;
  try {
    const lama = (await semuaSurat()).find((y) => y.id === s.id);
    const baru = lama ? { ...s, dibuat: lama.dibuat, oleh: lama.oleh, diubah: now } : { ...s, dibuat: now, diubah: now, oleh };
    if (JSON.stringify(baru).length > MAKS_JSON_SURAT) return NextResponse.json({ error: 'Isi surat terlalu panjang.' }, { status: 413 });
    if (lama) await ubahSurat(baru); else await tambahSurat(baru);
    return NextResponse.json({ ok: true, surat: baru });
  } catch (err) {
    console.error('Gagal menyimpan surat:', err);
    return NextResponse.json({ error: 'Surat gagal disimpan. Coba lagi.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { gagal } = await akses(req);
  if (gagal) return gagal;
  const id = req.nextUrl.searchParams.get('id') || '';
  try {
    const s = (await semuaSurat()).find((y) => y.id === id);
    if (!s) return NextResponse.json({ error: 'Surat tidak ditemukan.' }, { status: 404 });
    await ubahSurat(s, 'hapus');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Gagal menghapus surat:', err);
    return NextResponse.json({ error: 'Gagal menghapus. Coba lagi.' }, { status: 500 });
  }
}
