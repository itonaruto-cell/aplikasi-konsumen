import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole } from '../../../lib/access';
import { bacaTabel, cariKolom, TAB_OI } from '../../../lib/tarikan-data';

export const dynamic = 'force-dynamic';

// Kolom nomor telepon & alamat hanya untuk owner
const RAHASIA = /^(NO\.?\s*)?(HP|WA|TELP|TELEPON|TLP|PHONE|HANDPHONE|WHATSAPP|MOBILE)(\s*(NO|\d+))?$|ALAMAT|ADDRESS|NIK|KTP/i;

// Order in per CMO: isi tab data OI dari pantauan, untuk semua akun yang login.
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const role = await getRole(s.email);
  if (!role) return NextResponse.json({ error: 'Akses akun ini sudah dicabut. Hubungi owner.' }, { status: 403 });
  try {
    const t = await bacaTabel(TAB_OI);
    if (!t) return NextResponse.json({ ada: false }, { headers: { 'Cache-Control': 'no-store' } });
    const owner = role === 'owner';
    const pakai = t.h.map((h, i) => ({ h, i })).filter(({ h }) => owner || !RAHASIA.test(h.trim()));
    const iCmo = cariKolom(t.h, [/^NAMA CMO$/, /^CMO$/, /^NAMA CMO\b/, /^(NAMA )?SALES$/, /^PIC$/, /CMO/]);
    const rows = t.r;
    const semua = true;
    // Semua akun boleh melihat aplikasi order in seluruh CMO (sama seperti angka OI per CMO di Pantau);
    // kolom HP / alamat / NIK tetap hanya untuk owner.
    return NextResponse.json({
      ada: true, sumber: t.sumber, dikirim: t.dikirim, semua,
      h: pakai.map((x) => x.h), r: rows.map((r) => pakai.map((x) => r[x.i] || '')),
      cmo: iCmo >= 0 ? pakai.findIndex((x) => x.i === iCmo) : -1,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca data OI:', err);
    return NextResponse.json({ error: 'Data OI belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}
