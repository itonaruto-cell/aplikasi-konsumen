import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { appendRows, updateRowById, updateRowsById } from '../../../lib/sheet-store';
import { STATUS_PROSPEK, rapikanHp, rapikanMaps, type Prospek, type StatusProspek } from '../../../lib/prospek-types';
import { catatFU } from '../../../lib/prospek-log';
import { HEAD_PROSPEK, TAB_PROSPEK, bolehLihat, keBaris, semuaProspek, sesiProspek, type BarisProspek } from '../../../lib/prospek-store';
import { MAX_B64, saveFotos } from '../../../lib/foto-store';

export const dynamic = 'force-dynamic';

// Database prospek di tab PROSPEK (dibuat otomatis). Satu baris = satu calon konsumen.
// Semua akun terdaftar: melihat semua prospek, menambah (satu per satu atau impor massal), mengubah, mengatur PIC,
// dan mencatat hasil follow up dengan foto bukti (wajib untuk selain owner).
// Menghapus: owner, atau orang yang menambahkan prospek itu.
// Prospek tanpa PIC yang di-follow up staff otomatis menjadi miliknya.
// Prospek PRIVAT (mis. hasil Ambil dari Google Maps oleh owner) hanya terlihat oleh owner dan PIC-nya.
const TAB = TAB_PROSPEK, HEAD = HEAD_PROSPEK;
const MAKS_IMPOR = 3000;
type Baris = BarisProspek;
const toRow = keBaris;
const keluar = ({ hapus: _h, ...p }: Baris): Prospek => p;
const teks = (v: unknown, maks: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, maks);
const gagal = (err: unknown) => {
  console.error('Gagal menyimpan prospek:', err);
  return NextResponse.json({ error: 'Gagal menyimpan. Pastikan service account punya akses Editor.' }, { status: 500 });
};

export async function GET(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  try {
    const list = (await semuaProspek()).filter(bolehLihat(x.role, x.aku)).map(keluar)
      .sort((a, b) => b.diubah.localeCompare(a.diubah));
    return NextResponse.json({ list, aku: x.aku }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca prospek:', err);
    return NextResponse.json({ error: 'Database prospek belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

// { items: [...] } = tambah (owner); { id, ... } = ubah / catat follow up
export async function POST(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const now = new Date().toISOString();
  try {
    // Owner: atur PIC banyak prospek sekaligus. { aksi: 'pic', daftar: [{ id, pic }] } (pic kosong = lepas PIC)
    if (b?.aksi === 'pic' && Array.isArray(b?.daftar)) {
      if (x.role !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa membagikan prospek sekaligus.' }, { status: 403 });
      if (b.daftar.length > MAKS_IMPOR) return NextResponse.json({ error: `Maksimal ${MAKS_IMPOR} prospek sekali bagi.` }, { status: 400 });
      const peta = new Map<string, string>();
      for (const d of b.daftar as Record<string, unknown>[]) { const id = String(d?.id || ''); if (id) peta.set(id, teks(d?.pic, 80)); }
      const ubah = (await semuaProspek()).filter((p) => peta.has(p.id)).map((p) => toRow({ ...p, pic: peta.get(p.id)!, diubah: now }));
      const n = await updateRowsById(TAB, HEAD, ubah);
      return NextResponse.json({ ok: true, diubah: n });
    }
    if (Array.isArray(b?.items)) {
      if (b.items.length > MAKS_IMPOR) return NextResponse.json({ error: `Maksimal ${MAKS_IMPOR} prospek sekali simpan.` }, { status: 400 });
      const sumber = teks(b.sumber, 40) || 'Manual';
      const pic = teks(b.pic, 80);
      const privat = x.role === 'owner' && !!b.privat;
      const ada = new Set((await semuaProspek()).map((p) => p.hp));
      const baru: Prospek[] = [];
      let dobel = 0, tanpaHp = 0;
      for (const raw of b.items as Record<string, unknown>[]) {
        const hp = rapikanHp(String(raw?.hp ?? ''));
        if (!hp) { tanpaHp++; continue; }
        if (ada.has(hp)) { dobel++; continue; }
        ada.add(hp);
        baru.push({
          id: randomUUID().slice(0, 8), nama: teks(raw?.nama, 100) || '(tanpa nama)', hp,
          profesi: teks(raw?.profesi, 80), alamat: teks(raw?.alamat, 160), sumber: teks(raw?.sumber, 40) || sumber, catatan: teks(raw?.catatan, 200),
          pic: teks(raw?.pic, 80) || pic, status: 'baru', hasil: '', fu: '', dibuat: now, diubah: now, oleh: x.s.email.toLowerCase(), foto: '', maps: rapikanMaps(raw?.maps), privat,
        });
      }
      await appendRows(TAB, HEAD, baru.map((p) => toRow(p)));
      return NextResponse.json({ ok: true, ditambah: baru.length, dobel, tanpaHp });
    }

    const id = String(b?.id || '');
    const lama = (await semuaProspek()).find((p) => p.id === id);
    if (!lama || !bolehLihat(x.role, x.aku)(lama)) return NextResponse.json({ error: 'Prospek tidak ditemukan.' }, { status: 404 });
    const status: StatusProspek | null = (STATUS_PROSPEK as readonly string[]).includes(b?.status) ? b.status : null;
    const ubah: Baris = { ...lama, diubah: now };
    const fu = status !== null || b?.hasil !== undefined;
    if (status) ubah.status = status;
    if (b?.hasil !== undefined) ubah.hasil = teks(b.hasil, 300);
    if (fu) ubah.fu = now;
    // Foto bukti follow up: wajib untuk selain owner setiap kali mencatat hasil
    const f = b?.foto;
    if (f && typeof f.data === 'string') {
      const mime = /^image\/(jpeg|png|webp)$/.test(String(f.mime)) ? String(f.mime) : 'image/jpeg';
      const data = f.data.replace(/^data:[^,]+,/, '');
      if (!/^[A-Za-z0-9+/=]+$/.test(data) || data.length > MAX_B64) return NextResponse.json({ error: 'Foto terlalu besar atau rusak. Coba foto ulang.' }, { status: 400 });
      const idFoto = `prospek_${id}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
      await saveFotos([{ id: idFoto, mime, data }]);
      ubah.foto = idFoto;
    } else if (fu && x.role !== 'owner') {
      return NextResponse.json({ error: 'Lampirkan foto bukti follow up (foto atau screenshot chat).' }, { status: 400 });
    }
    {
      if (b?.nama !== undefined) ubah.nama = teks(b.nama, 100) || lama.nama;
      if (b?.hp !== undefined) {
        const hp = rapikanHp(String(b.hp));
        if (!hp) return NextResponse.json({ error: 'Nomor HP tidak valid.' }, { status: 400 });
        ubah.hp = hp;
      }
      if (b?.profesi !== undefined) ubah.profesi = teks(b.profesi, 80);
      if (b?.alamat !== undefined) ubah.alamat = teks(b.alamat, 160);
      if (b?.catatan !== undefined) ubah.catatan = teks(b.catatan, 200);
      if (b?.maps !== undefined) ubah.maps = rapikanMaps(b.maps);
      if (b?.privat !== undefined && x.role === 'owner') ubah.privat = !!b.privat;
      if (b?.pic !== undefined) ubah.pic = teks(b.pic, 80);
    }
    if (!lama.pic && fu && x.role !== 'owner' && b?.pic === undefined) ubah.pic = x.aku;   // diambil staff yang mem-follow up
    await updateRowById(TAB, HEAD, id, toRow(ubah));
    if (fu) {
      try { await catatFU({ waktu: now, id, nama: ubah.nama, tempat: ubah.profesi || ubah.alamat, oleh: x.aku || x.s.name || x.s.email, email: x.s.email.toLowerCase(), status: ubah.status, hasil: ubah.hasil, foto: ubah.foto && ubah.foto !== lama.foto ? ubah.foto : '' }); }
      catch (err) { console.error('Gagal mencatat log follow up:', err); }
    }
    return NextResponse.json({ ok: true, prospek: keluar(ubah) });
  } catch (err) {
    return gagal(err);
  }
}

export async function DELETE(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') || '';
  try {
    const lama = (await semuaProspek()).find((p) => p.id === id);
    if (lama && x.role !== 'owner' && lama.oleh !== x.s.email.toLowerCase()) {
      return NextResponse.json({ error: 'Hanya owner atau yang menambahkan prospek ini yang bisa menghapus.' }, { status: 403 });
    }
    if (lama) await updateRowById(TAB, HEAD, id, toRow({ ...lama, diubah: new Date().toISOString() }, 'hapus'));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return gagal(err);
  }
}
