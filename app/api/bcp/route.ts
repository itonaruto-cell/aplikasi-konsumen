import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { sesiProspek } from '../../../lib/prospek-store';
import { rapikanBcp, type Bcp } from '../../../lib/bcp-types';
import { MAKS_JSON_BCP, semuaBcp, tambahBcp, ubahBcp } from '../../../lib/bcp-store';

export const dynamic = 'force-dynamic';

// BCP memuat no HP, NIK MAO & no rekening: owner melihat semua, akun lain hanya BCP buatannya sendiri.
type Sesi = NonNullable<Awaited<ReturnType<typeof sesiProspek>>>;
const milikku = (x: Sesi) => (b: Bcp) => x.role === 'owner' || (!!b.email && b.email.toLowerCase() === x.s.email.toLowerCase());

export async function GET(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  try {
    return NextResponse.json({ list: (await semuaBcp()).filter(milikku(x)) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca BCP:', err);
    return NextResponse.json({ error: 'Data BCP belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const body = await req.json().catch(() => null) as { bcp?: unknown } | null;
  if (!body?.bcp) return NextResponse.json({ error: 'Data BCP kosong.' }, { status: 400 });
  const b = rapikanBcp(body.bcp);
  if (!b.nama.trim()) return NextResponse.json({ error: 'Isi nama konsumen dulu.' }, { status: 400 });
  if (JSON.stringify(b).length > MAKS_JSON_BCP) return NextResponse.json({ error: 'Isi BCP terlalu panjang.' }, { status: 413 });
  const now = new Date().toISOString();
  try {
    if (b.id) {
      const lama = (await semuaBcp()).find((y) => y.id === b.id);
      if (!lama || !milikku(x)(lama)) return NextResponse.json({ error: 'BCP tidak ditemukan (mungkin sudah dihapus).' }, { status: 404 });
      const baru = { ...b, dibuat: lama.dibuat, oleh: lama.oleh, email: lama.email, diubah: now };
      await ubahBcp(baru);
      return NextResponse.json({ ok: true, bcp: baru });
    }
    const baru = { ...b, id: `bcp_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`, dibuat: now, diubah: now, oleh: x.aku || x.s.name || x.s.email, email: x.s.email };
    await tambahBcp(baru);
    return NextResponse.json({ ok: true, bcp: baru });
  } catch (err) {
    console.error('Gagal menyimpan BCP:', err);
    return NextResponse.json({ error: 'BCP gagal disimpan. Coba lagi.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') || '';
  try {
    const b = (await semuaBcp()).find((y) => y.id === id);
    if (!b || !milikku(x)(b)) return NextResponse.json({ error: 'BCP tidak ditemukan.' }, { status: 404 });
    await ubahBcp(b, 'hapus');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Gagal menghapus BCP:', err);
    return NextResponse.json({ error: 'Gagal menghapus. Coba lagi.' }, { status: 500 });
  }
}
