import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../../lib/session';
import { getRole } from '../../../../lib/access';
import { cariKonsumen } from '../../../../lib/konsumen-db';

export const dynamic = 'force-dynamic';

// Cari konsumen untuk diajukan Inject P3. Terbuka untuk semua akun terdaftar, tetapi hanya mengembalikan
// nama, nomor kontrak, cust no, kecamatan, kelurahan, dan unit: nomor HP dan alamat tidak pernah dikirim dari sini.
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const role = s ? await getRole(s.email) : null;
  if (!s || !role) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 60);
  if (q.replace(/\s/g, '').length < 3) return NextResponse.json({ list: [], lebih: false });
  try {
    return NextResponse.json(await cariKonsumen(q), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal mencari konsumen untuk Inject P3:', err);
    return NextResponse.json({ error: 'Database konsumen belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}
