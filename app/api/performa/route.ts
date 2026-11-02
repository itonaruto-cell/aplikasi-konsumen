import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole } from '../../../lib/access';
import { loadPerforma } from '../../../lib/performa';
import { bulanBasi, kosongkanBulan } from '../../../lib/performa-kosong';
import { bacaArsip } from '../../../lib/performa-arsip';
import { rapikanPerforma } from '../../../lib/sales-brand';
import type { Performa } from '../../../lib/performa-types';

export const dynamic = 'force-dynamic';

// Performa semua anggota tim. Boleh dilihat semua akun yang terdaftar (owner, konsumen, tim).
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if (!(await getRole(s.email))) return NextResponse.json({ error: 'Akses akun ini sudah dicabut.' }, { status: 403 });

  try {
    // ?bulan=YYYY-MM: data bulan yang sudah diarsipkan (hanya dibaca)
    const bulan = req.nextUrl.searchParams.get('bulan') || '';
    if (/^\d{4}-\d{2}$/.test(bulan)) {
      const a = await bacaArsip<Performa>(bulan, 'performa');
      if (!a) return NextResponse.json({ error: 'Arsip bulan itu tidak ada.' }, { status: 404 });
      return NextResponse.json({ ...rapikanPerforma(a), arsip: bulan }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const data = await loadPerforma();
    if (!data) return NextResponse.json({ kosong: true }, { headers: { 'Cache-Control': 'no-store' } });
    // Sudah ganti bulan tapi file pantauan bulan ini belum tersambung: tampilkan bulan berjalan kosong
    // (data bulan lalu ada di arsip, diperbarui otomatis tiap pagi oleh cron cek-data)
    if (bulanBasi(data)) return NextResponse.json(kosongkanBulan(data), { headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca performa:', err);
    return NextResponse.json({ error: 'Data performa belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}
