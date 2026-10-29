import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getPerfName, getRole, lihatTim } from '../../../lib/access';
import { bacaTabel, cariKolom, TAB_OI } from '../../../lib/tarikan-data';
import { samaOrang } from '../../../lib/sales-brand';

export const dynamic = 'force-dynamic';

// Kolom nomor telepon & alamat hanya untuk owner
const RAHASIA = /^(NO\.?\s*)?(HP|WA|TELP|TELEPON|TLP|PHONE|HANDPHONE|WHATSAPP|MOBILE)(\s*(NO|\d+))?$|ALAMAT|ADDRESS|NIK|KTP/i;

// Bahan OI: isi tab data OI dari pantauan. Owner & SPV melihat semua, staff hanya baris dengan nama CMO-nya.
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
    let rows = t.r;
    let semua = true;
    if (!lihatTim(role) && role !== 'konsumen') {
      semua = false;
      const aku = (await getPerfName(s.email)) || '';
      rows = iCmo >= 0 && aku ? rows.filter((r) => samaOrang(r[iCmo] || '', aku)) : [];
    }
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
