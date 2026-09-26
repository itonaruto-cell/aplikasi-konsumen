import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole, getAccessList } from '../../../lib/access';
import { readActivity, todayWIB } from '../../../lib/activity';

export const dynamic = 'force-dynamic';

const ONLINE_MS = 5 * 60_000; // dianggap "online" kalau aktif dalam 5 menit terakhir

// Hanya untuk OWNER: aktivitas tim pada tanggal tertentu (default hari ini, WIB).
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if ((await getRole(s.email)) !== 'owner') return NextResponse.json({ error: 'Khusus owner.' }, { status: 403 });

  const q = req.nextUrl.searchParams.get('tanggal') || '';
  const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayWIB();

  try {
    const [log, access] = await Promise.all([readActivity(tanggal), getAccessList()]);
    const now = Date.now();
    const isToday = tanggal === todayWIB();

    const byEmail = new Map(log.map((r) => [r.email, r]));
    const people = new Map<string, { email: string; role: string }>();
    access.forEach((a) => people.set(a.email, a));
    log.forEach((r) => { if (!people.has(r.email)) people.set(r.email, { email: r.email, role: r.role }); });

    const list = Array.from(people.values()).map((p) => {
      const r = byEmail.get(p.email);
      return {
        email: p.email,
        nama: r?.nama || '',
        role: r?.role || p.role,
        aktif: !!r,
        online: !!r && isToday && now - r.terakhirMs < ONLINE_MS,
        pertama: r?.pertama || '',
        terakhir: r?.terakhir || '',
        jumlahBuka: r?.jumlahBuka || 0,
      };
    });
    list.sort((a, b) => Number(b.online) - Number(a.online) || Number(b.aktif) - Number(a.aktif) || b.terakhir.localeCompare(a.terakhir) || a.email.localeCompare(b.email));

    return NextResponse.json({ tanggal, list }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca aktivitas:', err);
    return NextResponse.json({ error: 'Gagal membaca LOG_AKTIF. Pastikan service account punya akses Editor di Google Sheets.' }, { status: 500 });
  }
}
