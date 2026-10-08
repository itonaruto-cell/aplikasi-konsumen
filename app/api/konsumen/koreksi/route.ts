import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../../lib/session';
import { getRole } from '../../../../lib/access';
import {
  MAKS_NILAI, bacaDatabase, bacaKoreksi, kunciKonsumen, pengambil, simpanKoreksi, type Koreksi,
} from '../../../../lib/koreksi-konsumen';
import { lupakanKonsumen } from '../../../../lib/konsumen-db';

export const dynamic = 'force-dynamic';

// Simpan koreksi data satu konsumen. Khusus owner.
// Body: { id: kunci konsumen (__ID dari /api/search), ubah: { "NAMA KOLOM": "nilai baru", ... } }
// Nilai yang sama dengan data asli = koreksinya dibatalkan (kembali ke data asli).
const MAKS_KOLOM = 30;
const rapikan = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, MAKS_NILAI);

export async function POST(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  if ((await getRole(s.email)) !== 'owner') return NextResponse.json({ error: 'Hanya owner yang bisa mengubah data konsumen.' }, { status: 403 });

  const b = await req.json().catch(() => null);
  const id = typeof b?.id === 'string' ? b.id : '';
  const ubah = b?.ubah && typeof b.ubah === 'object' && !Array.isArray(b.ubah) ? (b.ubah as Record<string, unknown>) : null;
  if (!id || !ubah || !Object.keys(ubah).length) return NextResponse.json({ error: 'Tidak ada data yang diubah.' }, { status: 400 });
  if (Object.keys(ubah).length > MAKS_KOLOM) return NextResponse.json({ error: `Maksimal ${MAKS_KOLOM} kolom sekali simpan.` }, { status: 400 });

  try {
    const [{ head, rows }, peta] = await Promise.all([bacaDatabase(), bacaKoreksi()]);
    const r = rows.find((x) => kunciKonsumen(pengambil(head, x)) === id);
    if (!r) return NextResponse.json({ error: 'Konsumen tidak ditemukan. Muat ulang dulu.' }, { status: 404 });
    const salah = Object.keys(ubah).filter((k) => !head.includes(k));
    if (salah.length) return NextResponse.json({ error: `Kolom tidak dikenal: ${salah.join(', ')}` }, { status: 400 });

    const lama = peta.get(id);
    const now = new Date().toISOString();
    const simpan: Koreksi[] = [];
    const nilai: Record<string, string> = {};
    const asli: Record<string, string> = {};
    for (const [kolom, v] of Object.entries(ubah)) {
      const awal = String(r[head.indexOf(kolom)] ?? '').trim();
      const baru = rapikan(v);
      const ada = lama?.get(kolom);
      if (baru === awal) {
        // Sama dengan data asli: batalkan koreksi kalau ada
        if (ada) simpan.push({ ...ada, aktif: false, email: s.email, diubah: now });
        nilai[kolom] = awal;
        continue;
      }
      nilai[kolom] = baru;
      asli[kolom] = awal;
      if (ada?.nilai === baru) continue;
      simpan.push({ kunci: id, kolom, nilai: baru, asli: awal, aktif: true, email: s.email, diubah: now });
    }
    await simpanKoreksi(simpan);
    lupakanKonsumen();

    // Semua koreksi yang berlaku untuk konsumen ini sesudah disimpan (kolom → nilai asli)
    const koreksi: Record<string, string> = {};
    lama?.forEach((x, k) => { koreksi[k] = x.asli; });
    for (const k of Object.keys(nilai)) { if (k in asli) koreksi[k] = asli[k]; else delete koreksi[k]; }
    return NextResponse.json({ ok: true, nilai, koreksi, disimpan: simpan.length });
  } catch (err) {
    console.error('Gagal menyimpan koreksi konsumen:', err);
    return NextResponse.json({ error: 'Gagal menyimpan. Pastikan service account punya akses Editor.' }, { status: 500 });
  }
}
