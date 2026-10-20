import { NextResponse, type NextRequest } from 'next/server';
import { bolehLihat, semuaProspek, sesiProspek } from '../../../../lib/prospek-store';
import { bacaLog } from '../../../../lib/prospek-log';
import { STATUS_LABEL } from '../../../../lib/prospek-types';

export const dynamic = 'force-dynamic';

// Riwayat follow up (tab FU_LOG) untuk diunduh sebagai Excel / PDF.
// ?dari=YYYY-MM-DD&sampai=YYYY-MM-DD. Satu baris = satu kali follow up, digabung dengan data prospeknya.
// Prospek privat hanya untuk owner dan PIC-nya; prospek yang sudah dihapus tidak ikut.
const tglOk = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

export async function GET(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const dari = tglOk(req.nextUrl.searchParams.get('dari')), sampai = tglOk(req.nextUrl.searchParams.get('sampai'));
  try {
    const [log, semua] = await Promise.all([bacaLog(), semuaProspek()]);
    const peta = new Map(semua.filter(bolehLihat(x.role, x.aku)).map((p) => [p.id, p]));
    const asal = req.nextUrl.origin;
    const baris = log
      .filter((l) => peta.has(l.id) && (!dari || l.tgl >= dari) && (!sampai || l.tgl <= sampai))
      .sort((a, b) => a.waktu.localeCompare(b.waktu))
      .map((l) => {
        const p = peta.get(l.id)!;
        return {
          waktu: l.waktu, tgl: l.tgl, nama: p.nama || l.nama, hp: p.hp, profesi: p.profesi, alamat: p.alamat, sumber: p.sumber,
          oleh: l.oleh, pic: p.pic, hasil: STATUS_LABEL[l.status], status: l.status, catatan: l.hasil,
          foto: l.foto ? `${asal}/api/foto/${encodeURIComponent(l.foto)}` : '', maps: p.maps,
        };
      });
    return NextResponse.json({ baris }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca riwayat follow up:', err);
    return NextResponse.json({ error: 'Riwayat follow up belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}
