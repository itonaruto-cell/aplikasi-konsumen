import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../../lib/session';
import { getRole } from '../../../../lib/access';
import { getFoto } from '../../../../lib/foto-store';

export const dynamic = 'force-dynamic';

// Foto visit untuk akun yang sudah login (semua peran, sama seperti riwayat visit).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s || !(await getRole(s.email))) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const f = await getFoto(id);
    if (!f) return NextResponse.json({ error: 'Foto belum tersedia.' }, { status: 404 });
    return new NextResponse(new Uint8Array(f.buf), {
      headers: { 'Content-Type': f.mime, 'Cache-Control': 'private, max-age=604800, immutable' },
    });
  } catch (err) {
    console.error('Gagal membaca foto:', err);
    return NextResponse.json({ error: 'Foto gagal dimuat.' }, { status: 500 });
  }
}
