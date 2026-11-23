import { NextResponse, type NextRequest } from 'next/server';
import { sesiProspek } from '../../../lib/prospek-store';
import { bacaTarget, simpanTarget, type UbahTarget } from '../../../lib/maintain-target-store';

export const dynamic = 'force-dynamic';

// Target maintain MA: semua akun tim bisa melihat; owner & SPV yang mengatur
export async function GET(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  try {
    return NextResponse.json({ ...(await bacaTarget()), bolehUbah: x.role === 'owner' || x.role === 'spv' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca target maintain:', err);
    return NextResponse.json({ error: 'Target maintain belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if (x.role !== 'owner' && x.role !== 'spv') return NextResponse.json({ error: 'Hanya owner atau SPV yang bisa mengatur target maintain.' }, { status: 403 });
  const b = await req.json().catch(() => null) as Partial<UbahTarget> | null;
  if (!b || (b.brand !== 'mobilku' && b.brand !== 'motorku')) return NextResponse.json({ error: 'Brand tidak dikenal.' }, { status: 400 });
  const ubah = (Array.isArray(b.ubah) ? b.ubah : []).slice(0, 500)
    .map((u) => ({ nama: String(u?.nama || ''), target: u?.target === null || u?.target === undefined ? null : Number(u.target) }))
    .filter((u) => u.nama.trim() && (u.target === null || isFinite(u.target)));
  try {
    const t = await simpanTarget({ brand: b.brand, ubah, ket: typeof b.ket === 'string' ? b.ket : undefined }, x.aku || x.s.name || x.s.email);
    return NextResponse.json({ ...t, bolehUbah: true });
  } catch (err) {
    console.error('Gagal menyimpan target maintain:', err);
    return NextResponse.json({ error: 'Target gagal disimpan. Coba lagi.' }, { status: 500 });
  }
}
