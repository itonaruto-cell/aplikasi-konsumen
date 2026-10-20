import { NextResponse, type NextRequest } from 'next/server';
import { sesiProspek } from '../../../lib/prospek-store';
import { daftarDokumen, hapusDokumen, simpanDokumen, validDok, type ImporSK } from '../../../lib/sk-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daftar dokumen SK (semua peran yang sudah login)
export async function GET(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  try {
    const dok = await daftarDokumen(req.nextUrl.searchParams.has('segar'));
    return NextResponse.json({ dok, ai: !!process.env.ANTHROPIC_API_KEY, owner: x.role === 'owner' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca dokumen SK:', err);
    return NextResponse.json({ error: 'Dokumen SK belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

const teksOk = (t: unknown): t is ImporSK['teks'] => Array.isArray(t) && t.length > 0 && t.length <= 600 &&
  t.every((p) => p && typeof p.isi === 'string' && p.isi.length <= 10_000 && typeof p.bagian === 'string' && p.bagian.length <= 300 && Number.isFinite(Number(p.hal)));

// Owner: masukkan / perbarui satu dokumen (teks + PDF)
export async function POST(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if (x.role !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa memperbarui dokumen SK.' }, { status: 403 });
  const b = await req.json().catch(() => null) as ImporSK | null;
  if (!b || !validDok(b.dok) || typeof b.judul !== 'string' || !b.judul.trim() || b.judul.length > 200 || !teksOk(b.teks))
    return NextResponse.json({ error: 'Isi file dokumen tidak sesuai format.' }, { status: 400 });
  if (b.pdf !== undefined && (typeof b.pdf !== 'string' || b.pdf.length > 4_200_000 || !/^JVBER/.test(b.pdf)))
    return NextResponse.json({ error: 'File PDF tidak valid atau terlalu besar (maks. ±3 MB).' }, { status: 400 });
  try {
    await simpanDokumen({
      dok: b.dok, judul: b.judul.trim(), keterangan: String(b.keterangan || '').slice(0, 300), namaFile: String(b.namaFile || '').replace(/[^\w.() -]+/g, '-').slice(0, 120),
      halaman: Number(b.halaman) || 0, urut: Number(b.urut) || 0, pdf: b.pdf,
      teks: b.teks.map((t) => ({ hal: Number(t.hal) || 0, bagian: t.bagian.trim(), isi: t.isi })),
    }, x.s.name || x.s.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Gagal menyimpan dokumen SK:', err);
    return NextResponse.json({ error: 'Dokumen gagal disimpan. Coba lagi.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if (x.role !== 'owner') return NextResponse.json({ error: 'Hanya owner.' }, { status: 403 });
  const dok = req.nextUrl.searchParams.get('dok');
  if (!validDok(dok)) return NextResponse.json({ error: 'Dokumen tidak dikenal.' }, { status: 400 });
  try { await hapusDokumen(dok); return NextResponse.json({ ok: true }); } catch (err) {
    console.error('Gagal menghapus dokumen SK:', err);
    return NextResponse.json({ error: 'Gagal menghapus. Coba lagi.' }, { status: 500 });
  }
}
