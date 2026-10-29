import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole } from '../../../lib/access';
import { bacaTabel, daftarCair, kolomCair, TAB_CAIR } from '../../../lib/tarikan-data';

export const dynamic = 'force-dynamic';

// Konsumen yang sudah cair bulan ini (tab tarikan sales), untuk Pantau: per brand & per channel/sumber order.
// Tanpa nomor HP / alamat (tab tarikan sales tidak dibaca kolom itu).
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if (!(await getRole(s.email))) return NextResponse.json({ error: 'Akses akun ini sudah dicabut. Hubungi owner.' }, { status: 403 });
  try {
    const t = await bacaTabel(TAB_CAIR);
    if (!t) return NextResponse.json({ ada: false, list: [] }, { headers: { 'Cache-Control': 'no-store' } });
    const k = kolomCair(t.h, t.r);
    // Judul kolom yang dipakai (ditampilkan kecil di aplikasi, untuk cek kalau ada kolom yang salah tebak)
    const kolom = Object.fromEntries(Object.entries(k).map(([x, i]) => [x, i >= 0 ? t.h[i] : '']));
    return NextResponse.json({ ada: true, sumber: t.sumber, dikirim: t.dikirim, adaSumber: k.sumber >= 0, kolom, semuaKolom: t.h, list: daftarCair(t) },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca konsumen cair:', err);
    return NextResponse.json({ error: 'Data cair belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}
