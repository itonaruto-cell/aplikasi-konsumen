import { NextResponse, type NextRequest } from 'next/server';
import { sesiProspek } from '../../../../../lib/prospek-store';
import { ambilPdf, daftarDokumen } from '../../../../../lib/sk-store';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// PDF dokumen SK untuk semua akun yang sudah login
export async function GET(req: NextRequest, ctx: { params: Promise<{ dok: string }> }) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const { dok } = await ctx.params;
  try {
    const [buf, daftar] = await Promise.all([ambilPdf(dok), daftarDokumen()]);
    if (!buf) return NextResponse.json({ error: 'File belum tersedia.' }, { status: 404 });
    const nama = daftar.find((d) => d.dok === dok)?.namaFile || `${dok}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${nama.replace(/"/g, '')}"`, 'Cache-Control': 'private, max-age=600' },
    });
  } catch (err) {
    console.error('Gagal membaca PDF SK:', err);
    return NextResponse.json({ error: 'File gagal dimuat.' }, { status: 500 });
  }
}
