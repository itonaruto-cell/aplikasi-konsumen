import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole } from '../../../lib/access';
import { listSubs, removeSubs, saveSub, sendMany } from '../../../lib/notif';
import { vapidReady, type PushSub } from '../../../lib/webpush';

export const dynamic = 'force-dynamic';

async function who(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s || !(await getRole(s.email))) return null;
  return s;
}
const validSub = (x: unknown): x is PushSub => {
  const s = x as PushSub;
  return !!s && typeof s.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && !!s.keys?.p256dh && !!s.keys?.auth;
};

// Kunci publik untuk mendaftarkan HP
export async function GET(req: NextRequest) {
  if (!(await who(req))) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  return NextResponse.json({ siap: vapidReady(), publicKey: process.env.VAPID_PUBLIC_KEY || '' });
}

// Simpan langganan HP ini
export async function POST(req: NextRequest) {
  const s = await who(req);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!validSub(body?.subscription)) return NextResponse.json({ error: 'Data langganan tidak valid.' }, { status: 400 });
  try {
    await saveSub(s.email, String(body.nama || '').slice(0, 80), body.subscription);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Gagal menyimpan langganan:', err);
    return NextResponse.json({ error: 'Gagal menyimpan. Pastikan service account punya akses Editor.' }, { status: 500 });
  }
}

// Matikan notifikasi di HP ini
export async function DELETE(req: NextRequest) {
  const s = await who(req);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const endpoint = String(body?.endpoint || '');
  const mine = (await listSubs()).filter((x) => x.email === s.email && x.sub.endpoint === endpoint);
  await removeSubs(mine.map((x) => x.sub.endpoint));
  return NextResponse.json({ ok: true });
}

// Kirim notifikasi uji ke HP milik akun ini
export async function PUT(req: NextRequest) {
  const s = await who(req);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const mine = (await listSubs()).filter((x) => x.email === s.email);
  const r = await sendMany(mine, () => ({ title: 'Notifikasi aktif', body: 'Mantap! Kamu akan dapat misi pagi, rekap sore, dan kabar peringkat.', url: '/', tag: 'tes' }));
  return NextResponse.json(r);
}
