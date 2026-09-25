import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole } from '../../../lib/access';

export const dynamic = 'force-dynamic';

// Info akun yang sedang login (dipakai halaman depan).
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const role = await getRole(s.email);
  if (!role) return NextResponse.json({ error: 'Akses akun ini sudah dicabut.' }, { status: 403 });
  return NextResponse.json({ email: s.email, name: s.name, role });
}
