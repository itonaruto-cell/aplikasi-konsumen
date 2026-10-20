import { NextResponse, type NextRequest } from 'next/server';
import { bolehLihat, semuaProspek, sesiProspek } from '../../../../lib/prospek-store';
import { bacaLog, susunLaporan, tglJkt } from '../../../../lib/prospek-log';

export const dynamic = 'force-dynamic';

// Laporan follow up prospek per hari (?tgl=YYYY-MM-DD, bawaan hari ini). Semua akun; prospek privat hanya
// dihitung untuk owner dan PIC-nya.
export async function GET(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const q = req.nextUrl.searchParams.get('tgl') || '';
  const tgl = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : tglJkt(new Date().toISOString());
  try {
    const [log, semua] = await Promise.all([bacaLog(), semuaProspek()]);
    const lihat = semua.filter(bolehLihat(x.role, x.aku));
    const boleh = new Set(lihat.map((p) => p.id));
    const lap = susunLaporan(log.filter((l) => boleh.has(l.id)), lihat, tgl);
    return NextResponse.json(lap, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal menyusun laporan follow up:', err);
    return NextResponse.json({ error: 'Laporan belum bisa dibuat. Coba lagi sebentar.' }, { status: 500 });
  }
}
