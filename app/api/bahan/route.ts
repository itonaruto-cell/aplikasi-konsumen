import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getPerfName, getRole } from '../../../lib/access';
import { appendRow, readRows, updateRowById } from '../../../lib/sheet-store';
import { SUMBER, type Bahan, type StatusBahan, type Sumber } from '../../../lib/bahan-types';
import { keyOf } from '../../../lib/performa-calc';

export const dynamic = 'force-dynamic';

// Bahan survey per staff, disimpan di tab BAHAN_SURVEY (dibuat otomatis).
// Staff melihat & mengubah bahan yang ia buat atau yang PIC survey-nya dia; owner melihat semua.
// Menghapus = menandai status "hapus" (baris tidak dibuang, supaya aman saat banyak yang menyimpan bersamaan).
const TAB = 'BAHAN_SURVEY';
const HEAD = ['ID', 'EMAIL', 'NAMA', 'KONSUMEN', 'NOMINAL', 'SUMBER', 'KETERANGAN_SUMBER', 'STEP', 'STATUS', 'DIBUAT', 'DIUBAH', 'PIC_SURVEY'];
const STATUS: StatusBahan[] = ['aktif', 'cair', 'batal'];

const toObj = (r: string[]): Bahan => ({
  id: r[0], email: r[1].toLowerCase(), nama: r[2], konsumen: r[3], nominal: Number(r[4]) || 0,
  sumber: (SUMBER as readonly string[]).includes(r[5]) ? (r[5] as Sumber) : 'Lainnya',
  ket: r[6], step: r[7], status: (STATUS as string[]).includes(r[8]) ? (r[8] as StatusBahan) : 'aktif',
  dibuat: r[9], diubah: r[10] || r[9], pic: r[11] || '',
});
const toRow = (b: Bahan, status: string = b.status): string[] =>
  [b.id, b.email, b.nama, b.konsumen, String(b.nominal), b.sumber, b.ket, b.step, status, b.dibuat, b.diubah, b.pic];

async function session(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return { s: null, role: null };
  return { s, role: await getRole(s.email) };
}
const gagalSimpan = (err: unknown) => {
  console.error('Gagal menyimpan bahan survey:', err);
  return NextResponse.json({ error: 'Gagal menyimpan. Pastikan service account punya akses Editor.' }, { status: 500 });
};

// Boleh melihat/mengubah: owner, pembuat bahan, atau PIC survey-nya
async function akses(emailAsli: string, role: string) {
  const email = emailAsli.toLowerCase();
  const aku = role === 'owner' ? '' : keyOf((await getPerfName(email)) || '');
  return (b: Bahan) => role === 'owner' || b.email === email || (!!aku && keyOf(b.pic) === aku);
}

export async function GET(req: NextRequest) {
  const { s, role } = await session(req);
  if (!s || !role) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  try {
    const boleh = await akses(s.email, role);
    const list = (await readRows(TAB, HEAD))
      .filter((r) => r[0] && r[8] !== 'hapus')
      .map(toObj)
      .filter(boleh)
      .sort((a, b) => b.diubah.localeCompare(a.diubah));
    return NextResponse.json({ list }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca bahan survey:', err);
    return NextResponse.json({ error: 'Bahan survey belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

// Tambah (tanpa id) atau ubah (dengan id)
export async function POST(req: NextRequest) {
  const { s, role } = await session(req);
  if (!s || !role) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const b = await req.json().catch(() => null);

  const konsumen = String(b?.konsumen || '').trim().slice(0, 80);
  const nominal = Math.round(Number(b?.nominal) || 0);
  const sumber: Sumber = (SUMBER as readonly string[]).includes(b?.sumber) ? b.sumber : 'Lainnya';
  const ket = sumber === 'Agent' || sumber === 'Lainnya' ? String(b?.ket || '').trim().slice(0, 80) : '';
  const step = String(b?.step || '').trim().slice(0, 300);
  const pic = String(b?.pic || '').trim().slice(0, 80);
  const status: StatusBahan = (STATUS as string[]).includes(b?.status) ? b.status : 'aktif';
  if (!konsumen) return NextResponse.json({ error: 'Nama konsumen wajib diisi.' }, { status: 400 });
  if (nominal < 0 || nominal > 100_000_000_000) return NextResponse.json({ error: 'Nominal pencairan tidak wajar.' }, { status: 400 });

  const now = new Date().toISOString();
  const id = String(b?.id || '');
  try {
    if (!id) {
      const email = s.email.toLowerCase();
      const baru: Bahan = {
        id: randomUUID().slice(0, 8), email, nama: (await getPerfName(email)) || s.name || email,
        konsumen, nominal, sumber, ket, step, pic, status, dibuat: now, diubah: now,
      };
      await appendRow(TAB, HEAD, toRow(baru));
      return NextResponse.json({ ok: true, bahan: baru });
    }
    const lama = (await readRows(TAB, HEAD)).filter((r) => r[0] === id && r[8] !== 'hapus').map(toObj)[0];
    if (!lama) return NextResponse.json({ error: 'Bahan tidak ditemukan.' }, { status: 404 });
    if (!(await akses(s.email, role))(lama)) return NextResponse.json({ error: 'Bukan bahan kamu.' }, { status: 403 });
    const ubah: Bahan = { ...lama, konsumen, nominal, sumber, ket, step, pic, status, diubah: now };
    await updateRowById(TAB, HEAD, id, toRow(ubah));
    return NextResponse.json({ ok: true, bahan: ubah });
  } catch (err) {
    return gagalSimpan(err);
  }
}

export async function DELETE(req: NextRequest) {
  const { s, role } = await session(req);
  if (!s || !role) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const id = req.nextUrl.searchParams.get('id') || '';
  try {
    const lama = (await readRows(TAB, HEAD)).filter((r) => r[0] === id && r[8] !== 'hapus').map(toObj)[0];
    if (!lama) return NextResponse.json({ ok: true });
    if (!(await akses(s.email, role))(lama)) return NextResponse.json({ error: 'Bukan bahan kamu.' }, { status: 403 });
    await updateRowById(TAB, HEAD, id, toRow({ ...lama, diubah: new Date().toISOString() }, 'hapus'));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return gagalSimpan(err);
  }
}
