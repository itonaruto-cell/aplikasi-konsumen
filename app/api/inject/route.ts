import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getPerfName, getRole } from '../../../lib/access';
import { appendRows, readRows, updateRowById } from '../../../lib/sheet-store';
import { KET_BAWAAN, type Inject } from '../../../lib/inject-types';
import { keyOf, todayJkt } from '../../../lib/performa-calc';

export const dynamic = 'force-dynamic';

// Inject P3: konsumen yang diajukan staff, disimpan di tab INJECT_P3 (dibuat otomatis).
// Kolom C sampai H sama persis dengan format HO: NAMA CABANG, NAMA KONSUMEN, NO KONTRAK, CUST NO, KECAMATAN, KETERANGAN.
// Semua akun terdaftar melihat daftar bulan berjalan (supaya tidak dobel); yang boleh mengubah / menghapus
// hanya owner dan staff yang mengajukan. Menghapus = menandai status "hapus".
const TAB = 'INJECT_P3';
const HEAD = ['ID', 'BULAN', 'NAMA CABANG', 'NAMA KONSUMEN', 'NO KONTRAK', 'CUST NO', 'KECAMATAN', 'KETERANGAN', 'EMAIL', 'DIAJUKAN OLEH', 'DIBUAT', 'STATUS', 'SUMBER'];
const MAKS_SEKALI = 30;

type Baris = Omit<Inject, 'punyaku'> & { email: string };
const toObj = (r: string[]): Baris => ({
  id: r[0], bulan: r[1], cabang: r[2], konsumen: r[3], kontrak: r[4], cust: r[5], kecamatan: r[6], ket: r[7],
  email: r[8].toLowerCase(), oleh: r[9], dibuat: r[10], sumber: r[12] === 'manual' ? 'manual' : 'database',
});
const toRow = (b: Baris, status = 'aktif'): string[] =>
  [b.id, b.bulan, b.cabang, b.konsumen, b.kontrak, b.cust, b.kecamatan, b.ket, b.email, b.oleh, b.dibuat, status, b.sumber];
const keluar = (b: Baris, email: string): Inject => {
  const { email: pemilik, ...x } = b;
  return { ...x, punyaku: pemilik === email };
};

const teks = (v: unknown, maks: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, maks);
const isi = (b: Record<string, unknown> | null | undefined) => ({
  konsumen: teks(b?.konsumen, 80).toUpperCase(),
  kontrak: teks(b?.kontrak, 30),
  cust: teks(b?.cust, 30).toUpperCase(),
  kecamatan: teks(b?.kecamatan, 40),
});
// Dua pengajuan dianggap sama kalau nomor kontraknya sama; tanpa nomor kontrak, dibandingkan dari nama
const kunci = (x: { kontrak: string; konsumen: string }) => (x.kontrak ? `k:${x.kontrak}` : `n:${keyOf(x.konsumen)}`);

async function session(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return { s: null, role: null };
  return { s, role: await getRole(s.email) };
}
const aktif = async () => (await readRows(TAB, HEAD)).filter((r) => r[0] && r[11] !== 'hapus').map(toObj);
const gagalSimpan = (err: unknown) => {
  console.error('Gagal menyimpan Inject P3:', err);
  return NextResponse.json({ error: 'Gagal menyimpan. Pastikan service account punya akses Editor.' }, { status: 500 });
};

export async function GET(req: NextRequest) {
  const { s, role } = await session(req);
  if (!s || !role) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  try {
    const email = s.email.toLowerCase();
    const list = (await aktif()).sort((a, b) => b.dibuat.localeCompare(a.dibuat)).map((b) => keluar(b, email));
    return NextResponse.json({ list, bulanIni: todayJkt().slice(0, 7) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca Inject P3:', err);
    return NextResponse.json({ error: 'Daftar Inject P3 belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

// Ajukan (items: beberapa konsumen sekaligus) atau ubah satu pengajuan (dengan id)
export async function POST(req: NextRequest) {
  const { s, role } = await session(req);
  if (!s || !role) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const email = s.email.toLowerCase();
  const ket = teks(b?.ket, 60) || KET_BAWAAN;

  try {
    const semua = await aktif();

    const id = String(b?.id || '');
    if (id) {
      const lama = semua.find((x) => x.id === id);
      if (!lama) return NextResponse.json({ error: 'Pengajuan tidak ditemukan.' }, { status: 404 });
      if (role !== 'owner' && lama.email !== email) return NextResponse.json({ error: 'Bukan pengajuan kamu.' }, { status: 403 });
      const baru = isi(b);
      if (!baru.konsumen) return NextResponse.json({ error: 'Nama konsumen wajib diisi.' }, { status: 400 });
      const kembar = semua.find((x) => x.id !== id && x.bulan === lama.bulan && kunci(x) === kunci(baru));
      if (kembar) return NextResponse.json({ error: `Sudah diajukan ${kembar.oleh} bulan ini.` }, { status: 409 });
      const ubah: Baris = { ...lama, ...baru, ket };
      await updateRowById(TAB, HEAD, id, toRow(ubah));
      return NextResponse.json({ ok: true, inject: keluar(ubah, email) });
    }

    const items: unknown[] = Array.isArray(b?.items) ? b.items : [];
    if (!items.length) return NextResponse.json({ error: 'Pilih konsumen dulu.' }, { status: 400 });
    if (items.length > MAKS_SEKALI) return NextResponse.json({ error: `Maksimal ${MAKS_SEKALI} konsumen sekali ajukan.` }, { status: 400 });

    const bulan = todayJkt().slice(0, 7);
    const cabang = teks(b?.cabang, 40).toUpperCase() || (process.env.NAMA_CABANG || 'KENDAL').toUpperCase();
    const oleh = (await getPerfName(email)) || s.name || email;
    const sudah = new Map(semua.filter((x) => x.bulan === bulan).map((x) => [kunci(x), x.oleh]));
    const now = new Date().toISOString();
    const baru: Baris[] = [];
    const dilewati: { konsumen: string; oleh: string }[] = [];
    for (const it of items) {
      const x = isi(it as Record<string, unknown>);
      if (!x.konsumen) continue;
      const k = kunci(x);
      const pemilik = sudah.get(k);
      if (pemilik) { dilewati.push({ konsumen: x.konsumen, oleh: pemilik }); continue; }
      sudah.set(k, oleh);
      baru.push({
        ...x, id: randomUUID().slice(0, 8), bulan, cabang, ket, email, oleh, dibuat: now,
        sumber: (it as { sumber?: string })?.sumber === 'manual' ? 'manual' : 'database',
      });
    }
    if (!baru.length && !dilewati.length) return NextResponse.json({ error: 'Nama konsumen wajib diisi.' }, { status: 400 });
    await appendRows(TAB, HEAD, baru.map((x) => toRow(x)));
    return NextResponse.json({ ok: true, ditambah: baru.length, dilewati });
  } catch (err) {
    return gagalSimpan(err);
  }
}

export async function DELETE(req: NextRequest) {
  const { s, role } = await session(req);
  if (!s || !role) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') || '';
  try {
    const lama = (await aktif()).find((x) => x.id === id);
    if (!lama) return NextResponse.json({ ok: true });
    if (role !== 'owner' && lama.email !== s.email.toLowerCase()) return NextResponse.json({ error: 'Bukan pengajuan kamu.' }, { status: 403 });
    await updateRowById(TAB, HEAD, id, toRow(lama, 'hapus'));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return gagalSimpan(err);
  }
}
