import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getAccessList, getPerfName, getRole } from '../../../lib/access';
import { appendRows, readRows, updateRowById } from '../../../lib/sheet-store';
import { JENIS, type Jenis, type PlanItem, type StatusPlan } from '../../../lib/plan-types';
import { addDays, keyOf, todayJkt } from '../../../lib/performa-calc';

export const dynamic = 'force-dynamic';

// Plan aktivitas harian, disimpan di tab PLAN (dibuat otomatis). Satu baris = satu aktivitas.
// Staff mengisi dan mencentang plan miliknya sendiri; owner melihat plan semua staff dan boleh merevisinya
// (centang, hasil, catatan, hapus).
// Aturan map pencairan: survey yang sudah selesai dalam 4 hari terakhir dan belum punya map pencairan
// muncul sebagai aktivitas WAJIB di plan hari ini (baru benar-benar tersimpan saat dicentang / dibatalkan).
const TAB = 'PLAN';
const HEAD = ['ID', 'TANGGAL', 'EMAIL', 'NAMA', 'JENIS', 'SIAPA', 'LOKASI', 'CATATAN', 'STATUS', 'HASIL', 'DIBUAT', 'DIUBAH', 'REF'];
const STATUS: StatusPlan[] = ['rencana', 'selesai', 'batal'];
const MAKS_SEKALI = 20;
const HARI_WAJIB = 4;

type Baris = Omit<PlanItem, 'punyaku' | 'wajib' | 'spv'> & { email: string; ref: string; hapus: boolean };
const toObj = (r: string[]): Baris => ({
  id: r[0], tgl: r[1], email: r[2].toLowerCase(), nama: r[3],
  jenis: (JENIS as readonly string[]).includes(r[4]) ? (r[4] as Jenis) : 'lainnya',
  siapa: r[5], lokasi: r[6], catatan: r[7],
  status: (STATUS as string[]).includes(r[8]) ? (r[8] as StatusPlan) : 'rencana', hapus: r[8] === 'hapus',
  hasil: r[9], dibuat: r[10], diubah: r[11] || r[10], ref: r[12],
});
const toRow = (b: Baris, status: string = b.status): string[] =>
  [b.id, b.tgl, b.email, b.nama, b.jenis, b.siapa, b.lokasi, b.catatan, status, b.hasil, b.dibuat, b.diubah, b.ref];
const keluar = (b: Baris, email: string, owner?: Set<string>): PlanItem => ({
  id: b.id, tgl: b.tgl, nama: b.nama, jenis: b.jenis, siapa: b.siapa, lokasi: b.lokasi, catatan: b.catatan,
  status: b.status, hasil: b.hasil, dibuat: b.dibuat, diubah: b.diubah, wajib: !!b.ref, punyaku: b.email === email,
  spv: !!owner?.has(b.email),
});

const teks = (v: unknown, maks: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, maks);
const tglOk = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function session(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return { s: null, role: null };
  return { s, role: await getRole(s.email) };
}
const semuaBaris = async () => (await readRows(TAB, HEAD)).filter((r) => r[0]).map(toObj);
const gagalSimpan = (err: unknown) => {
  console.error('Gagal menyimpan plan aktivitas:', err);
  return NextResponse.json({ error: 'Gagal menyimpan. Pastikan service account punya akses Editor.' }, { status: 500 });
};

// Survey selesai yang belum punya map pencairan → aktivitas wajib hari ini
function wajibHariIni(semua: Baris[], hariIni: string): Baris[] {
  const dari = addDays(hariIni, -HARI_WAJIB);
  const adaRef = new Set(semua.map((x) => x.ref).filter(Boolean));
  return semua
    .filter((x) => !x.hapus && x.jenis === 'survey' && x.status === 'selesai' && x.tgl >= dari && x.tgl < hariIni && !adaRef.has(x.id))
    // staff sudah menulis sendiri map pencairan untuk konsumen yang sama: tidak perlu ditambahkan lagi
    .filter((sv) => !semua.some((m) => !m.hapus && m.jenis === 'map' && m.email === sv.email && m.tgl >= sv.tgl && keyOf(m.siapa) === keyOf(sv.siapa)))
    .map((sv) => ({
      ...sv, id: `wajib:${sv.id}`, tgl: hariIni, jenis: 'map' as Jenis, status: 'rencana' as StatusPlan, hasil: '',
      catatan: 'Wajib: survey sudah selesai, lengkapi map pencairan', ref: sv.id, dibuat: sv.diubah, diubah: sv.diubah,
    }));
}

export async function GET(req: NextRequest) {
  const { s, role } = await session(req);
  if (!s || !role) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const hariIni = todayJkt();
  const q = req.nextUrl.searchParams.get('tgl');
  const tgl = tglOk(q) ? q : hariIni;
  try {
    const email = s.email.toLowerCase();
    const semua = await semuaBaris();
    const hari = semua.filter((x) => !x.hapus && x.tgl === tgl);
    const list = [...hari, ...(tgl === hariIni ? wajibHariIni(semua, hariIni) : [])]
      .filter((x) => role === 'owner' || x.email === email);
    // Owner adalah SPV: aktivitas miliknya ditandai, dan namanya dikirim supaya tidak ikut ditagih di plan tim
    const owner = new Set((await getAccessList()).filter((a) => a.role === 'owner').map((a) => a.email.toLowerCase()));
    const spv = role === 'owner' ? (await Promise.all([...owner].map((e) => getPerfName(e)))).filter((n): n is string => !!n) : [];
    return NextResponse.json({ tgl, hariIni, list: list.map((x) => keluar(x, email, owner)), spv }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca plan aktivitas:', err);
    return NextResponse.json({ error: 'Plan aktivitas belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}

// Tambah (items) atau ubah satu aktivitas (id): status, hasil, catatan, siapa, lokasi
export async function POST(req: NextRequest) {
  const { s, role } = await session(req);
  if (!s || !role) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const email = s.email.toLowerCase();
  const hariIni = todayJkt();
  const now = new Date().toISOString();

  try {
    const semua = await semuaBaris();

    const id = String(b?.id || '');
    if (id) {
      const status: StatusPlan | null = (STATUS as string[]).includes(b?.status) ? b.status : null;
      const ubah = (lama: Baris): Baris => ({
        ...lama,
        status: status || lama.status,
        hasil: b?.hasil === undefined ? lama.hasil : teks(b.hasil, 200),
        catatan: b?.catatan === undefined ? lama.catatan : teks(b.catatan, 200),
        siapa: (b?.siapa !== undefined && teks(b.siapa, 80)) || lama.siapa,
        lokasi: b?.lokasi === undefined ? lama.lokasi : teks(b.lokasi, 60),
        diubah: now,
      });
      if (id.startsWith('wajib:')) {
        // Map pencairan wajib: disimpan saat pertama kali dicentang / dibatalkan
        const v = wajibHariIni(semua, hariIni).find((x) => x.id === id && (x.email === email || role === 'owner'));
        if (!v) return NextResponse.json({ error: 'Aktivitas tidak ditemukan. Muat ulang dulu.' }, { status: 404 });
        const baru = ubah({ ...v, id: randomUUID().slice(0, 8), catatan: '', dibuat: now });
        await appendRows(TAB, HEAD, [toRow(baru)]);
        return NextResponse.json({ ok: true, item: keluar(baru, email) });
      }
      const lama = semua.find((x) => x.id === id && !x.hapus);
      if (!lama) return NextResponse.json({ error: 'Aktivitas tidak ditemukan.' }, { status: 404 });
      if (lama.email !== email && role !== 'owner') return NextResponse.json({ error: 'Bukan plan kamu.' }, { status: 403 });
      const baru = ubah(lama);
      await updateRowById(TAB, HEAD, id, toRow(baru));
      return NextResponse.json({ ok: true, item: keluar(baru, email) });
    }

    const items: unknown[] = Array.isArray(b?.items) ? b.items : [];
    if (!items.length) return NextResponse.json({ error: 'Pilih aktivitas dulu.' }, { status: 400 });
    if (items.length > MAKS_SEKALI) return NextResponse.json({ error: `Maksimal ${MAKS_SEKALI} aktivitas sekali simpan.` }, { status: 400 });
    const tgl = tglOk(b?.tgl) ? b.tgl : hariIni;
    if (tgl < addDays(hariIni, -1) || tgl > addDays(hariIni, 7)) return NextResponse.json({ error: 'Plan hanya bisa diisi untuk kemarin sampai 7 hari ke depan.' }, { status: 400 });

    const nama = (await getPerfName(email)) || s.name || email;
    const kunci = (x: { jenis: string; siapa: string }) => `${x.jenis}|${keyOf(x.siapa)}`;
    const sudah = new Set(semua.filter((x) => !x.hapus && x.tgl === tgl && x.email === email).map(kunci));
    const baru: Baris[] = [];
    let dilewati = 0;
    for (const raw of items) {
      const it = raw as Record<string, unknown>;
      const jenis: Jenis = (JENIS as readonly string[]).includes(String(it?.jenis)) ? (it.jenis as Jenis) : 'lainnya';
      const siapa = teks(it?.siapa, 80);
      if (!siapa) continue;
      if (sudah.has(kunci({ jenis, siapa }))) { dilewati++; continue; }
      sudah.add(kunci({ jenis, siapa }));
      baru.push({
        id: randomUUID().slice(0, 8), tgl, email, nama, jenis, siapa, lokasi: teks(it?.lokasi, 60), catatan: teks(it?.catatan, 200),
        status: 'rencana', hapus: false, hasil: '', dibuat: now, diubah: now, ref: '',
      });
    }
    if (!baru.length && !dilewati) return NextResponse.json({ error: 'Isi dulu siapa / apa aktivitasnya.' }, { status: 400 });
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
    const lama = (await semuaBaris()).find((x) => x.id === id && !x.hapus);
    if (!lama) return NextResponse.json({ ok: true });
    if (lama.email !== s.email.toLowerCase() && role !== 'owner') return NextResponse.json({ error: 'Bukan plan kamu.' }, { status: 403 });
    if (lama.ref) return NextResponse.json({ error: 'Map pencairan wajib tidak bisa dihapus. Tandai selesai atau batal.' }, { status: 400 });
    await updateRowById(TAB, HEAD, id, toRow({ ...lama, diubah: new Date().toISOString() }, 'hapus'));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return gagalSimpan(err);
  }
}
