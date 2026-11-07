import { NextResponse, type NextRequest } from 'next/server';
import { cronOk } from '../../../../lib/cron-auth';
import { getAccessList } from '../../../../lib/access';
import { listSubs, sameName, sendMany } from '../../../../lib/notif';
import { HEAD_PROSPEK, TAB_PROSPEK, keBaris, semuaProspek } from '../../../../lib/prospek-store';
import { tglJkt } from '../../../../lib/prospek-log';
import { updateRowsById } from '../../../../lib/sheet-store';
import { loadPerforma } from '../../../../lib/performa';
import { BAGI_HARIAN, namaPenerima, susunBagi, sebut } from '../../../../lib/bagi-prospek';
import { sudahJalan, tandaiJalan } from '../../../../lib/jadwal-log';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Dipanggil Vercel Cron Senin–Sabtu ±07.00 WIB (lihat vercel.json): Naufal & Rizal masing-masing
// mendapat 10 prospek baru dari database prospek yang belum ada PIC-nya. Penerima & owner dikirimi notifikasi HP.
export async function GET(req: NextRequest) {
  if (!cronOk(req.headers.get('authorization'))) return NextResponse.json({ error: 'Kunci salah.' }, { status: 401 });
  const now = new Date();
  const tgl = tglJkt(now.toISOString());
  if (new Date(tgl + 'T00:00:00Z').getUTCDay() === 0) return NextResponse.json({ ok: true, lewat: 'Minggu' });
  const idJalan = `bagi-prospek|${tgl}`;
  try {
    if (await sudahJalan(idJalan)) return NextResponse.json({ ok: true, lewat: 'sudah dibagi hari ini' });
    const [prospek, data] = await Promise.all([semuaProspek(), loadPerforma().catch(() => null)]);
    const penerima = namaPenerima(prospek, (data?.orang || []).map((o) => o.nama));
    const bagi = susunBagi(prospek, penerima);
    const peta = new Map(bagi.map((b) => [b.id, b.pic]));
    const iso = now.toISOString();
    const n = bagi.length ? await updateRowsById(TAB_PROSPEK, HEAD_PROSPEK, prospek.filter((p) => peta.has(p.id)).map((p) => keBaris({ ...p, pic: peta.get(p.id)!, diubah: iso }))) : 0;
    const sisa = prospek.filter((p) => !p.pic && p.status === 'baru').length - bagi.length;
    const per = penerima.map((nama) => ({ nama, jumlah: bagi.filter((b) => b.pic === nama).length }));
    const ringkas = per.map((x) => `${sebut(x.nama)} ${x.jumlah}`).join(', ');
    await tandaiJalan(idJalan, `${ringkas}; sisa tanpa PIC ${sisa}`);

    // Notifikasi: penerima & owner
    const [subs, akses] = await Promise.all([listSubs(), getAccessList()]);
    const owner = new Set([
      ...(process.env.OWNER_EMAIL || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
      ...akses.filter((a) => a.role === 'owner').map((a) => a.email.toLowerCase()),
    ]);
    const r = await sendMany(subs, (s) => {
      if (owner.has(s.email.toLowerCase())) return {
        title: bagi.length ? 'Prospek pagi sudah dibagikan' : 'Database prospek habis',
        body: bagi.length
          ? `${ringkas} prospek baru. Sisa belum ada PIC: ${sisa}.${sisa < BAGI_HARIAN * penerima.length ? ' Tambah database prospek untuk besok.' : ''}`
          : 'Tidak ada prospek tanpa PIC untuk dibagikan pagi ini. Tambah database prospek.',
        url: '/', tag: 'bagi-prospek',
      };
      const aku = per.find((x) => sameName(s.nama, x.nama));
      if (!aku || !aku.jumlah) return null;
      return { title: `${aku.jumlah} prospek baru untukmu`, body: 'Buka Saya › Database prospek, hubungi hari ini & catat hasilnya dengan foto bukti.', url: '/', tag: 'bagi-prospek' };
    });
    return NextResponse.json({ ok: true, tgl, dibagi: n, per, sisa, ...r });
  } catch (err) {
    console.error('Bagi prospek harian gagal:', err);
    return NextResponse.json({ error: 'Gagal membagikan prospek.' }, { status: 500 });
  }
}
