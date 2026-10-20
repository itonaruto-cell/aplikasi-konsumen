import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getPerfName, getRole } from '../../../lib/access';
import { appendRows, readRows, updateRowById } from '../../../lib/sheet-store';
import { STATUS_PROSPEK, rapikanHp, rapikanMaps, type Prospek, type StatusProspek } from '../../../lib/prospek-types';
import { MAX_B64, saveFotos } from '../../../lib/foto-store';

export const dynamic = 'force-dynamic';

// Database prospek di tab PROSPEK (dibuat otomatis). Satu baris = satu calon konsumen.
// Semua akun terdaftar: melihat semua prospek, menambah (satu per satu atau impor massal), mengubah, mengatur PIC,
// dan mencatat hasil follow up dengan foto bukti (wajib untuk selain owner).
// Menghapus: owner, atau orang yang menambahkan prospek itu.
// Prospek tanpa PIC yang di-follow up staff otomatis menjadi miliknya.
const TAB = 'PROSPEK';
const HEAD = ['ID', 'NAMA', 'NO_HP', 'PROFESI', 'ALAMAT', 'SUMBER', 'CATATAN', 'PIC', 'STATUS', 'HASIL', 'FU_TERAKHIR', 'DIBUAT', 'DIUBAH', 'OLEH', 'FOTO', 'MAPS'];
const MAKS_IMPOR = 3000;

type Baris = Prospek & { hapus: boolean };
const toObj = (r: string[]): Baris => ({
  id: r[0], nama: r[1], hp: r[2], profesi: r[3], alamat: r[4], sumber: r[5], catatan: r[6], pic: r[7],
  status: (STATUS_PROSPEK as readonly string[]).includes(r[8]) ? (r[8] as StatusProspek) : 'baru', hapus: r[8] === 'hapus',
  hasil: r[9], fu: r[10], dibuat: r[11], diubah: r[12] || r[11], oleh: r[13], foto: r[14] || '', maps: r[15] || '',
});
const toRow = (b: Prospek, status: string = b.status): string[] =>
  [b.id, b.nama, b.hp, b.profesi, b.alamat, b.sumber, b.catatan, b.pic, status, b.hasil, b.fu, b.dibuat, b.diubah, b.oleh, b.foto || '', b.maps || ''];
const keluar = ({ hapus: _h, ...p }: Baris): Prospek => p;
const teks = (v: unknown, maks: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, maks);

async function session(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const role = await getRole(s.email);
  if (!role) return null;
  const aku = role === 'owner' ? '' : (await getPerfName(s.email)) || s.name || s.email;
  return { s, role, aku };
}
const semua = async () => (await readRows(TAB, HEAD)).filter((r) => r[0]).map(toObj).filter((p) => !p.hapus);
const gagal = (err: unknown) => {
  console.error('Gagal menyimpan prospek:', err);
  return NextResponse.json({ error: 'Gagal menyimpan. Pastikan service account punya akses Editor.' }, { status: 500 });
};

export async function GET(req: NextRequest) {
  const x = await session(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  try {
    const list = (await semua()).map(keluar)
      .sort((a, b) => b.diubah.localeCompare(a.diubah));
    return NextResponse.json({ list, aku: x.aku }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca prospek:', err);
    return NextResponse.json({ error: 'Database prospek belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

// { items: [...] } = tambah (owner); { id, ... } = ubah / catat follow up
export async function POST(req: NextRequest) {
  const x = await session(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const now = new Date().toISOString();
  try {
    if (Array.isArray(b?.items)) {
      if (b.items.length > MAKS_IMPOR) return NextResponse.json({ error: `Maksimal ${MAKS_IMPOR} prospek sekali simpan.` }, { status: 400 });
      const sumber = teks(b.sumber, 40) || 'Manual';
      const pic = teks(b.pic, 80);
      const ada = new Set((await semua()).map((p) => p.hp));
      const baru: Prospek[] = [];
      let dobel = 0, tanpaHp = 0;
      for (const raw of b.items as Record<string, unknown>[]) {
        const hp = rapikanHp(String(raw?.hp ?? ''));
        if (!hp) { tanpaHp++; continue; }
        if (ada.has(hp)) { dobel++; continue; }
        ada.add(hp);
        baru.push({
          id: randomUUID().slice(0, 8), nama: teks(raw?.nama, 100) || '(tanpa nama)', hp,
          profesi: teks(raw?.profesi, 80), alamat: teks(raw?.alamat, 160), sumber, catatan: teks(raw?.catatan, 200),
          pic: teks(raw?.pic, 80) || pic, status: 'baru', hasil: '', fu: '', dibuat: now, diubah: now, oleh: x.s.email.toLowerCase(), foto: '', maps: rapikanMaps(raw?.maps),
        });
      }
      await appendRows(TAB, HEAD, baru.map((p) => toRow(p)));
      return NextResponse.json({ ok: true, ditambah: baru.length, dobel, tanpaHp });
    }

    const id = String(b?.id || '');
    const lama = (await semua()).find((p) => p.id === id);
    if (!lama) return NextResponse.json({ error: 'Prospek tidak ditemukan.' }, { status: 404 });
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
      if (b?.pic !== undefined) ubah.pic = teks(b.pic, 80);
    }
    if (!lama.pic && fu && x.role !== 'owner' && b?.pic === undefined) ubah.pic = x.aku;   // diambil staff yang mem-follow up
    await updateRowById(TAB, HEAD, id, toRow(ubah));
    return NextResponse.json({ ok: true, prospek: keluar(ubah) });
  } catch (err) {
    return gagal(err);
  }
}

export async function DELETE(req: NextRequest) {
  const x = await session(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') || '';
  try {
    const lama = (await semua()).find((p) => p.id === id);
    if (lama && x.role !== 'owner' && lama.oleh !== x.s.email.toLowerCase()) {
      return NextResponse.json({ error: 'Hanya owner atau yang menambahkan prospek ini yang bisa menghapus.' }, { status: 403 });
    }
    if (lama) await updateRowById(TAB, HEAD, id, toRow({ ...lama, diubah: new Date().toISOString() }, 'hapus'));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return gagal(err);
  }
}
