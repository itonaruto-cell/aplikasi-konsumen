import { NextResponse, type NextRequest } from 'next/server';
import { secretOk } from '../../../../lib/secret';
import { loadPerforma } from '../../../../lib/performa';
import { listSubs, sameName, sendMany } from '../../../../lib/notif';
import { buildCtx, notifPagi, notifSore } from '../../../../lib/performa-calc';

export const dynamic = 'force-dynamic';

// Dipanggil Apps Script (kirimNotifPagi / kirimNotifSore) dengan header x-performa-secret.
// Isi pesan dibuat per orang dari data performa terakhir.
export async function POST(req: NextRequest) {
  if (!secretOk(req.headers.get('x-performa-secret'))) return NextResponse.json({ error: 'Kunci salah.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const jenis = body?.jenis === 'sore' ? 'sore' : 'pagi';
  const data = await loadPerforma();
  if (!data) return NextResponse.json({ error: 'Belum ada data performa.' }, { status: 409 });
  const c = buildCtx(data);
  const subs = await listSubs();
  const r = await sendMany(subs, (s) => {
    const o = (data.orang || []).find((x) => sameName(x.nama, s.nama)) || null;
    return jenis === 'sore' ? notifSore(c, o) : notifPagi(c, o);
  });
  return NextResponse.json({ jenis, langganan: subs.length, ...r });
}
