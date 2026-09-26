import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole } from '../../../lib/access';
import { recordActivity } from '../../../lib/activity';

export const dynamic = 'force-dynamic';

// Dipanggil aplikasi saat dibuka dan setiap 2 menit selama aplikasi tampil di layar.
export async function POST(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const role = await getRole(s.email);
  if (!role) return NextResponse.json({ error: 'Akses dicabut.' }, { status: 403 });

  let kind: 'buka' | 'aktif' = 'aktif';
  try {
    const body = (await req.json()) as { kind?: string };
    if (body.kind === 'buka') kind = 'buka';
  } catch { /* body kosong */ }

  try {
    await recordActivity(s.email, s.name || '', role, kind);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Gagal mencatat aktivitas:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
