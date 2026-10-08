import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../../lib/session';
import { getPerfName, getRole } from '../../../../lib/access';
import { parseHO } from '../../../../lib/insentif-ho';
import { findMe } from '../../../../lib/performa-calc';
import type { Performa } from '../../../../lib/performa-types';

export const dynamic = 'force-dynamic';

// Insentif hasil hitungan HO, disimpan di Environment Variable INSENTIF_HO (JSON) di Vercel, bukan di kode.
// Owner menerima semua orang; akun lain hanya menerima barisnya sendiri (dicocokkan dari nama di tab AKSES,
// nama akun Google, atau alamat email).
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const role = await getRole(s.email);
  if (!role) return NextResponse.json({ error: 'Akses akun ini sudah dicabut.' }, { status: 403 });

  const data = parseHO(process.env.INSENTIF_HO);
  if (!data) return NextResponse.json({ data: null }, { headers: { 'Cache-Control': 'no-store' } });
  if (role !== 'owner') {
    const aku = findMe({ orang: data.orang.map((o) => ({ nama: o.nama, brand: '' })) } as unknown as Performa, await getPerfName(s.email), s.name, s.email);
    data.orang = data.orang.filter((o) => o.nama === aku?.nama);
  }
  return NextResponse.json({ data: data.orang.length ? data : null }, { headers: { 'Cache-Control': 'no-store' } });
}
