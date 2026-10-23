import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { sesiProspek } from '../../../lib/prospek-store';
import { rapikanReport } from '../../../lib/report-survey';
import { MAKS_JSON_REPORT, semuaReport, tambahReport, ubahReport } from '../../../lib/report-store';

export const dynamic = 'force-dynamic';

// Report survey 6C + 1E + 1P: semua akun yang login boleh melihat & mengubah
export async function GET(req: NextRequest) {
  if (!(await sesiProspek(req))) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  try {
    return NextResponse.json({ list: await semuaReport() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca report survey:', err);
    return NextResponse.json({ error: 'Report survey belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const body = await req.json().catch(() => null) as { report?: unknown } | null;
  if (!body?.report) return NextResponse.json({ error: 'Data report kosong.' }, { status: 400 });
  const r = rapikanReport(body.report);
  if (!r.nama.trim() && !r.appNo.trim()) return NextResponse.json({ error: 'Isi minimal nama konsumen atau App No.' }, { status: 400 });
  const now = new Date().toISOString();
  try {
    if (r.id) {
      const lama = (await semuaReport()).find((y) => y.id === r.id);
      if (!lama) return NextResponse.json({ error: 'Report tidak ditemukan (mungkin sudah dihapus).' }, { status: 404 });
      const baru = { ...r, dibuat: lama.dibuat, oleh: lama.oleh, diubah: now };
      if (JSON.stringify(baru).length > MAKS_JSON_REPORT) return NextResponse.json({ error: 'Isi report terlalu panjang.' }, { status: 413 });
      await ubahReport(baru);
      return NextResponse.json({ ok: true, report: baru });
    }
    const baru = { ...r, id: `rs_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`, dibuat: now, diubah: now, oleh: x.aku || x.s.name || x.s.email };
    await tambahReport(baru);
    return NextResponse.json({ ok: true, report: baru });
  } catch (err) {
    console.error('Gagal menyimpan report survey:', err);
    return NextResponse.json({ error: 'Report gagal disimpan. Coba lagi.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await sesiProspek(req))) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') || '';
  try {
    const r = (await semuaReport()).find((y) => y.id === id);
    if (!r) return NextResponse.json({ error: 'Report tidak ditemukan.' }, { status: 404 });
    await ubahReport(r, 'hapus');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Gagal menghapus report survey:', err);
    return NextResponse.json({ error: 'Gagal menghapus. Coba lagi.' }, { status: 500 });
  }
}
