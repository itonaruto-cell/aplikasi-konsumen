import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole } from '../../../lib/access';
import { appendRow, readRows, writeRows } from '../../../lib/sheet-store';
import { loadPerforma } from '../../../lib/performa';
import { listSubs, sameName, sendMany } from '../../../lib/notif';
import { brandOf, todayJkt } from '../../../lib/performa-calc';
import type { Pengumuman } from '../../../lib/performa-types';

export const dynamic = 'force-dynamic';

// Pengumuman dari owner, disimpan di tab PENGUMUMAN. Semua akun boleh membaca; hanya owner yang membuat/menghapus.
const TAB = 'PENGUMUMAN';
const HEAD = ['ID', 'JUDUL', 'ISI', 'UNTUK', 'SAMPAI', 'DIBUAT', 'OLEH'];
const toObj = (r: string[]): Pengumuman => ({ id: r[0], judul: r[1], isi: r[2], untuk: (['mobilku', 'motorku'].includes(r[3]) ? r[3] : 'semua') as Pengumuman['untuk'], sampai: r[4], dibuat: r[5], oleh: r[6] });

async function session(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return { s: null, role: null };
  return { s, role: await getRole(s.email) };
}

export async function GET(req: NextRequest) {
  const { s, role } = await session(req);
  if (!s || !role) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  try {
    const today = todayJkt();
    const list = (await readRows(TAB, HEAD)).map(toObj).filter((p) => p.id && (!p.sampai || p.sampai >= today))
      .sort((a, b) => b.dibuat.localeCompare(a.dibuat));
    return NextResponse.json({ list }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca pengumuman:', err);
    return NextResponse.json({ list: [] });
  }
}

export async function POST(req: NextRequest) {
  const { s, role } = await session(req);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if (role !== 'owner') return NextResponse.json({ error: 'Khusus owner.' }, { status: 403 });
  const b = await req.json().catch(() => null);
  const judul = String(b?.judul || '').trim().slice(0, 120);
  const isi = String(b?.isi || '').trim().slice(0, 1000);
  const untuk = ['mobilku', 'motorku'].includes(b?.untuk) ? b.untuk : 'semua';
  const sampai = /^\d{4}-\d{2}-\d{2}$/.test(String(b?.sampai || '')) ? String(b.sampai) : '';
  if (!judul) return NextResponse.json({ error: 'Judul wajib diisi.' }, { status: 400 });
  const p: Pengumuman = { id: randomUUID().slice(0, 8), judul, isi, untuk, sampai, dibuat: new Date().toISOString(), oleh: s.name || s.email };
  try {
    await appendRow(TAB, HEAD, [p.id, p.judul, p.isi, p.untuk, p.sampai, p.dibuat, p.oleh]);
  } catch (err) {
    console.error('Gagal menyimpan pengumuman:', err);
    return NextResponse.json({ error: 'Gagal menyimpan. Pastikan service account punya akses Editor.' }, { status: 500 });
  }
  let notif = 0;
  if (b?.notif !== false) {
    try {
      const data = untuk === 'semua' ? null : await loadPerforma();
      const subs = await listSubs();
      const r = await sendMany(subs, (x) => {
        if (untuk !== 'semua') {
          const o = data?.orang.find((y) => sameName(y.nama, x.nama));
          if (o && brandOf(o) && brandOf(o) !== untuk) return null;   // beda brand: lewati (owner/tanpa nama tetap dapat)
        }
        return { title: `Pengumuman: ${judul}`, body: isi.slice(0, 180) || 'Buka aplikasi untuk detail.', url: '/', tag: `p-${p.id}` };
      });
      notif = r.terkirim;
    } catch (err) { console.error('Notifikasi pengumuman gagal:', err); }
  }
  return NextResponse.json({ ok: true, pengumuman: p, notif });
}

export async function DELETE(req: NextRequest) {
  const { s, role } = await session(req);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if (role !== 'owner') return NextResponse.json({ error: 'Khusus owner.' }, { status: 403 });
  const id = req.nextUrl.searchParams.get('id') || '';
  const rows = await readRows(TAB, HEAD);
  await writeRows(TAB, HEAD, rows.filter((r) => r[0] !== id));
  return NextResponse.json({ ok: true });
}
