import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole } from '../../../lib/access';
import { loadPerforma } from '../../../lib/performa';

export const dynamic = 'force-dynamic';

// Performa semua anggota tim. Boleh dilihat semua akun yang terdaftar (owner, konsumen, tim).
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if (!(await getRole(s.email))) return NextResponse.json({ error: 'Akses akun ini sudah dicabut.' }, { status: 403 });

  try {
    const data = await loadPerforma();
    if (!data) return NextResponse.json({ kosong: true }, { headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca performa:', err);
    return NextResponse.json({ error: 'Data performa belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}
