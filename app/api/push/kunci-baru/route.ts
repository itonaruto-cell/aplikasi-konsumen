import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../../lib/session';
import { getRole } from '../../../../lib/access';
import { newVapidKeys, vapidReady } from '../../../../lib/webpush';

export const dynamic = 'force-dynamic';

// Khusus OWNER, sekali saja: buat pasangan kunci VAPID untuk notifikasi HP.
// Salin hasilnya ke Vercel → Settings → Environment Variables, lalu Redeploy.
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if ((await getRole(s.email)) !== 'owner') return NextResponse.json({ error: 'Khusus owner.' }, { status: 403 });
  const k = newVapidKeys();
  return NextResponse.json({
    catatan: vapidReady()
      ? 'Kunci sudah terpasang di Vercel. Jangan diganti kecuali perlu: semua HP harus menyalakan notifikasi ulang.'
      : 'Salin ketiga nilai ini ke Vercel → Settings → Environment Variables (Production), lalu Redeploy. Jangan dibagikan.',
    VAPID_PUBLIC_KEY: k.publicKey,
    VAPID_PRIVATE_KEY: k.privateKey,
    VAPID_SUBJECT: `mailto:${s.email}`,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
