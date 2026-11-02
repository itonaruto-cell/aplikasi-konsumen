import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole } from '../../../lib/access';
import { arsipkan, isiSales, loadPerforma } from '../../../lib/performa';
import { bulanBasi, kosongkanBulan } from '../../../lib/performa-kosong';
import { bacaArsip } from '../../../lib/performa-arsip';
import { rapikanPerforma } from '../../../lib/sales-brand';
import type { Performa } from '../../../lib/performa-types';

export const dynamic = 'force-dynamic';
let sudahArsip = '';

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
      // UPDATE PER file salinan bisa sudah tanggal bulan berikutnya: pakai akhir bulan arsip supaya label bulan benar
      const [y, m] = bulan.split('-').map(Number);
      const updated = String(a.updated || '').slice(0, 7) === bulan ? a.updated : new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      return NextResponse.json({ ...rapikanPerforma({ ...a, updated }), arsip: bulan }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const data = await loadPerforma();
    if (!data) return NextResponse.json({ kosong: true }, { headers: { 'Cache-Control': 'no-store' } });
    // Sudah ganti bulan tapi file pantauan bulan ini belum tersambung: tampilkan bulan berjalan kosong
    // (data bulan lalu ada di arsip, diperbarui otomatis tiap pagi oleh cron cek-data)
    if (bulanBasi(data)) {
      // Data akhir bulan lalu disimpan ke arsip (sekali per kiriman) supaya arsip berisi angka terakhir
      if (isiSales(data) && sudahArsip !== data.dikirim) { sudahArsip = data.dikirim; await arsipkan(data); }
      return NextResponse.json(kosongkanBulan(data), { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca performa:', err);
    return NextResponse.json({ error: 'Data performa belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}
