import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { loadPerforma } from '../../../../lib/performa';
import { getAccessList } from '../../../../lib/access';
import { listSubs, sendMany } from '../../../../lib/notif';
import { cekData } from '../../../../lib/performa-calc';

export const dynamic = 'force-dynamic';

// Dipanggil Vercel Cron setiap pagi (lihat vercel.json), terpisah dari Apps Script.
// Kalau data pantauan masih bulan lalu atau kiriman Apps Script berhenti, owner dikirimi notifikasi HP.
// Vercel mengirim header "Authorization: Bearer <CRON_SECRET>"; tanpa CRON_SECRET di Vercel, rute ini menolak.
function cronOk(auth: string | null): boolean {
  const expected = process.env.CRON_SECRET || '';
  if (!expected || !auth) return false;
  const a = Buffer.from(auth), b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!cronOk(req.headers.get('authorization'))) return NextResponse.json({ error: 'Kunci salah.' }, { status: 401 });
  const data = await loadPerforma();
  if (!data) return NextResponse.json({ ok: true, tingkat: 'kosong' });
  const cek = cekData(data);
  if (cek.tingkat !== 'gawat') return NextResponse.json({ ok: true, tingkat: cek.tingkat });

  const owner = new Set([
    ...(process.env.OWNER_EMAIL || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
    ...(await getAccessList()).filter((a) => a.role === 'owner').map((a) => a.email.toLowerCase()),
  ]);
  const subs = (await listSubs()).filter((s) => owner.has(s.email.toLowerCase()));
  const r = await sendMany(subs, () => ({
    title: cek.sebab === 'bulan' ? 'Pantauan masih data bulan lalu' : 'Kiriman pantauan berhenti',
    body: `${cek.teks} Buka Pantau → Cara memperbaiki.`,
    url: '/',
    tag: 'cek-data',
  }));
  console.warn('Cek data pantauan:', cek.teks, JSON.stringify(r));
  return NextResponse.json({ ok: true, tingkat: cek.tingkat, langganan: subs.length, ...r });
}
