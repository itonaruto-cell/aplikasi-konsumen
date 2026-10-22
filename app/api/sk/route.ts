import { NextResponse, type NextRequest } from 'next/server';
import { sesiProspek } from '../../../lib/prospek-store';
import { adaAI } from '../../../lib/sk-jawab';
import { PDF_PER_BAGIAN, daftarDokumen, hapusDokumen, simpanDokumen, tambahBagianPdf, validDok, type ImporSK } from '../../../lib/sk-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daftar dokumen SK (semua peran yang sudah login)
export async function GET(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  try {
    const dok = await daftarDokumen(req.nextUrl.searchParams.has('segar'));
    return NextResponse.json({ dok, ai: adaAI(), owner: x.role === 'owner' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca dokumen SK:', err);
    return NextResponse.json({ error: 'Dokumen SK belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

const teksOk = (t: unknown): t is ImporSK['teks'] => Array.isArray(t) && t.length > 0 && t.length <= 2000 &&
  t.every((p) => p && typeof p.isi === 'string' && p.isi.length <= 10_000 && typeof p.bagian === 'string' && p.bagian.length <= 300 && Number.isFinite(Number(p.hal)));

// Owner: masukkan / perbarui satu dokumen (teks + PDF)
export async function POST(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if (x.role !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa memperbarui dokumen SK.' }, { status: 403 });
  const b = await req.json().catch(() => null) as (ImporSK & { pdfBagian?: { ke?: number; total?: number; ukuran?: number } }) | null;
  // Bagian PDF lanjutan (PDF besar dikirim beberapa kali)
  const bg = b?.pdfBagian;
  if (b && bg && Number(bg.ke) > 1) {
    const ke = Number(bg.ke);
    if (!validDok(b.dok) || ke > 20 || typeof b.pdf !== 'string' || !b.pdf || b.pdf.length > PDF_PER_BAGIAN || !/^[A-Za-z0-9+/=]+$/.test(b.pdf))
      return NextResponse.json({ error: 'Bagian PDF tidak valid.' }, { status: 400 });
    try { await tambahBagianPdf(b.dok, ke, b.pdf); return NextResponse.json({ ok: true }); } catch (err) {
      console.error('Gagal menyimpan bagian PDF SK:', err);
      return NextResponse.json({ error: 'Bagian PDF gagal disimpan. Coba lagi.' }, { status: 500 });
    }
  }
  if (!b || !validDok(b.dok) || typeof b.judul !== 'string' || !b.judul.trim() || b.judul.length > 200 || !teksOk(b.teks))
    return NextResponse.json({ error: 'Isi file dokumen tidak sesuai format.' }, { status: 400 });
  const maksPdf = bg && Number(bg.total) > 1 ? PDF_PER_BAGIAN : 4_200_000;
  if (b.pdf !== undefined && (typeof b.pdf !== 'string' || b.pdf.length > maksPdf || !/^JVBER/.test(b.pdf)))
    return NextResponse.json({ error: 'File PDF tidak valid atau terlalu besar (maks. ±3 MB).' }, { status: 400 });
  try {
    await simpanDokumen({
      dok: b.dok, judul: b.judul.trim(), keterangan: String(b.keterangan || '').slice(0, 300), namaFile: String(b.namaFile || '').replace(/[^\w.() -]+/g, '-').slice(0, 120),
      halaman: Number(b.halaman) || 0, urut: Number(b.urut) || 0, pdf: b.pdf, pdfUkuran: Number(bg?.ukuran) || undefined,
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
