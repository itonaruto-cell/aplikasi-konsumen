import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../../lib/session';
import { getRole } from '../../../../lib/access';
import { listSubs, sameName, sendMany } from '../../../../lib/notif';
import { MIN_AKTIVITAS } from '../../../../lib/plan-types';

export const dynamic = 'force-dynamic';

// Owner mengingatkan staff yang plan hari ini belum lengkap (notifikasi ke HP mereka).
export async function POST(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if ((await getRole(s.email)) !== 'owner') return NextResponse.json({ error: 'Khusus owner.' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const nama: string[] = (Array.isArray(b?.nama) ? b.nama : []).map((x: unknown) => String(x || '').trim()).filter(Boolean).slice(0, 30);
  if (!nama.length) return NextResponse.json({ error: 'Pilih siapa yang diingatkan.' }, { status: 400 });
  try {
    const subs = (await listSubs()).filter((x) => nama.some((n) => sameName(n, x.nama)));
    const r = await sendMany(subs, () => ({
      title: 'Plan aktivitas hari ini',
      body: `Plan kamu belum lengkap. Isi minimal ${MIN_AKTIVITAS} aktivitas di menu Plan ya.`,
      url: '/', tag: 'plan',
    }));
    return NextResponse.json({ ok: true, terkirim: r.terkirim, hp: subs.length });
  } catch (err) {
    console.error('Gagal mengirim pengingat plan:', err);
    return NextResponse.json({ error: 'Pengingat gagal dikirim.' }, { status: 500 });
  }
}
