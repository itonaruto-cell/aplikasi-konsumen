import { NextResponse, type NextRequest } from 'next/server';
import { cronOk } from '../../../../lib/cron-auth';
import { getAccessList } from '../../../../lib/access';
import { listSubs, sendMany } from '../../../../lib/notif';
import { semuaProspek } from '../../../../lib/prospek-store';
import { bacaLog, susunLaporan, tglJkt } from '../../../../lib/prospek-log';
import { peganganAktif, pesanOwner, pesanTim } from '../../../../lib/pengingat-fu';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Dipanggil Vercel Cron Senin–Sabtu ±15.00 WIB (lihat vercel.json)
export async function GET(req: NextRequest) {
  if (!cronOk(req.headers.get('authorization'))) return NextResponse.json({ error: 'Kunci salah.' }, { status: 401 });
  const now = new Date();
  const tgl = tglJkt(now.toISOString());
  if (new Date(tgl + 'T00:00:00Z').getUTCDay() === 0) return NextResponse.json({ ok: true, lewat: 'Minggu' });
  try {
    const [log, prospek, subs, akses] = await Promise.all([bacaLog(), semuaProspek(), listSubs(), getAccessList()]);
    const lap = susunLaporan(log, prospek, tgl);
    const pegang = peganganAktif(prospek);
    const owner = new Set([
      ...(process.env.OWNER_EMAIL || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
      ...akses.filter((a) => a.role === 'owner').map((a) => a.email.toLowerCase()),
    ]);
    const namaPic = [...new Set(prospek.map((p) => p.pic).filter(Boolean))];
    const r = await sendMany(subs, (s) => (owner.has(s.email.toLowerCase()) ? pesanOwner(lap, pegang, namaPic) : pesanTim(s.nama, lap, pegang)));
    return NextResponse.json({ ok: true, tgl, langganan: subs.length, ...r });
  } catch (err) {
    console.error('Pengingat follow up gagal:', err);
    return NextResponse.json({ error: 'Gagal mengirim pengingat.' }, { status: 500 });
  }
}
