import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole } from '../../../lib/access';
import { parseSkema } from '../../../lib/insentif';

export const dynamic = 'force-dynamic';

// Skema insentif (bobot, tarif, tiering) disimpan di Environment Variable INSENTIF_SKEMA (JSON) di Vercel,
// bukan di kode. Skema BMH hanya dikirim ke owner.
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const role = await getRole(s.email);
  if (!role) return NextResponse.json({ error: 'Akses akun ini sudah dicabut.' }, { status: 403 });

  const skema = parseSkema(process.env.INSENTIF_SKEMA);
  if (skema && role !== 'owner') delete skema.bmh;
  return NextResponse.json({ skema }, { headers: { 'Cache-Control': 'no-store' } });
}
