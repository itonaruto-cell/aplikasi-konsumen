import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../../lib/session';
import { getPerfName, getRole } from '../../../../lib/access';
import { cocokHO, parseHO, type OrangHO } from '../../../../lib/insentif-ho';
import { findMe } from '../../../../lib/performa-calc';
import { loadPerforma } from '../../../../lib/performa';

export const dynamic = 'force-dynamic';

// Baris HO milik akun ini. Mengikuti cara aplikasi mengenali "Kamu": nama di tab AKSES, lalu orang yang
// dikenali sebagai "Kamu" di pantauan. Nama akun Google saja tidak dipakai untuk menebak, supaya insentif
// orang lain yang namanya mirip tidak pernah ikut terkirim. Kalau keduanya tidak ada, hanya nama lengkap
// yang termuat utuh di alamat email yang diterima.
async function barisku(orang: OrangHO[], email: string, googleName?: string | null): Promise<OrangHO | null> {
  const perf = await getPerfName(email);
  const pantauan = await loadPerforma().catch(() => null);
  const kamu = pantauan ? findMe(pantauan, perf, googleName, email) : null;
  const dikenal = [perf, kamu?.nama].filter((n): n is string => !!n);
  if (dikenal.length) {
    for (const n of dikenal) { const hit = cocokHO(orang, n); if (hit) return hit; }
    return null;
  }
  const e = email.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
  const dariEmail = e.length >= 6 ? orang.filter((o) => { const n = o.nama.toLowerCase().replace(/[^a-z]/g, ''); return n.length >= 6 && e.includes(n); }) : [];
  return dariEmail.length === 1 ? dariEmail[0] : null;
}

// Insentif hasil hitungan HO, disimpan di Environment Variable INSENTIF_HO (JSON) di Vercel, bukan di kode.
// Owner menerima semua orang; akun lain hanya menerima barisnya sendiri.
export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const role = await getRole(s.email);
  if (!role) return NextResponse.json({ error: 'Akses akun ini sudah dicabut.' }, { status: 403 });

  const data = parseHO(process.env.INSENTIF_HO);
  if (!data) return NextResponse.json({ data: null }, { headers: { 'Cache-Control': 'no-store' } });
  if (role !== 'owner') {
    const aku = await barisku(data.orang, s.email, s.name);
    // Bantu owner mencari sebabnya kalau ada staff yang barisnya tidak muncul (tanpa angka apa pun)
    if (!aku) console.warn('Insentif HO: tidak ada baris yang cocok untuk akun', s.email);
    data.orang = aku ? [aku] : [];
  }
  return NextResponse.json({ data: data.orang.length ? data : null }, { headers: { 'Cache-Control': 'no-store' } });
}
