import { bulanData } from '../../../../lib/performa-calc';
import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../../lib/session';
import { getRole } from '../../../../lib/access';
import { daftarArsip } from '../../../../lib/performa-arsip';
import { arsipkan, isiSales, loadPerforma } from '../../../../lib/performa';

export const dynamic = 'force-dynamic';

// GET: bulan yang punya arsip performa. POST (owner): simpan arsip data yang sedang tampil sekarang.
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if (!(await getRole(s.email))) return NextResponse.json({ error: 'Akses akun ini sudah dicabut.' }, { status: 403 });
  try {
    return NextResponse.json({ bulan: await daftarArsip() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca daftar arsip:', err);
    return NextResponse.json({ error: 'Arsip belum bisa dibaca.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if ((await getRole(s.email)) !== 'owner') return NextResponse.json({ error: 'Khusus owner.' }, { status: 403 });
  const data = await loadPerforma();
  if (!data || !isiSales(data)) return NextResponse.json({ error: 'Belum ada data untuk diarsipkan.' }, { status: 400 });
  const ok = await arsipkan(data);
  return ok ? NextResponse.json({ ok: true, bulan: bulanData(data) }) : NextResponse.json({ error: 'Arsip gagal disimpan.' }, { status: 500 });
}
