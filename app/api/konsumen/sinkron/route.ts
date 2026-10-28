import { NextResponse, type NextRequest } from 'next/server';
import { sheetsApi } from '../../../../lib/sheets-api';
import { verifySession, SESSION_COOKIE } from '../../../../lib/session';
import { getRole } from '../../../../lib/access';
import { hurufKolom, rencanakan, type Grid } from '../../../../lib/sinkron-konsumen';
import { lupakanKonsumen } from '../../../../lib/konsumen-db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Owner: perbarui database konsumen (Sheet1) dari tab KA …, SALES …, dan MAPS di file yang sama.
// GET  ?motor=1 → pratinjau (tidak menulis apa pun)
// POST { motor } → tambahkan kontrak baru & isi sel kosong (dihitung ulang dari data terbaru)
const SHEET1 = 'Sheet1';
const TAB_SUMBER = /^(KA|SALES)\b|^MAPS$/i;

function api() {
  return sheetsApi();
}
const q = (t: string) => `'${t.replace(/'/g, "''")}'`;

async function bacaSemua() {
  const s = api();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await s.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const judul = (meta.data.sheets || []).map((x) => x.properties?.title || '').filter((t) => TAB_SUMBER.test(t.trim()));
  const [db, src] = await Promise.all([
    s.spreadsheets.values.get({ spreadsheetId, range: `${SHEET1}!A1:Z` }),
    judul.length
      ? s.spreadsheets.values.batchGet({ spreadsheetId, ranges: judul.map((t) => `${q(t)}!A1:DZ`), valueRenderOption: 'UNFORMATTED_VALUE' })
      : Promise.resolve({ data: { valueRanges: [] as { values?: unknown[][] }[] } }),
  ]);
  const tabs = judul.map((nama, i) => ({ nama: nama.trim(), grid: (src.data.valueRanges?.[i]?.values || []) as Grid }));
  return { sheet1: (db.data.values || []) as Grid, tabs };
}

function ringkas(r: ReturnType<typeof rencanakan>) {
  const n = (f: (x: (typeof r.isi)[number]) => boolean) => r.isi.filter(f).length;
  return {
    tab: r.tab,
    baru: {
      total: r.baru.length,
      mobil: r.baru.filter((b) => b.jenis === 'mobil').length,
      motor: r.baru.filter((b) => b.jenis === 'motor').length,
      contoh: r.baru.slice(0, 60).map((b) => ({ nama: b.nama, kontrak: b.kontrak, jenis: b.jenis, sumber: b.sumber })),
    },
    isi: { maps: n((x) => x.jenisIsi === 'maps'), alamat: n((x) => x.jenisIsi === 'alamat'), lengkapi: n((x) => x.jenisIsi === 'lengkapi') },
    maps: { cocok: r.maps.cocok, sudahAda: r.maps.sudahAda, tidakKetemu: r.maps.tidakKetemu.slice(0, 80), jumlahTidakKetemu: r.maps.tidakKetemu.length, ragu: r.maps.ragu.slice(0, 80) },
  };
}

async function owner(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  return !!s && (await getRole(s.email)) === 'owner';
}

export async function GET(req: NextRequest) {
  if (!(await owner(req))) return NextResponse.json({ error: 'Hanya owner.' }, { status: 403 });
  try {
    const { sheet1, tabs } = await bacaSemua();
    if (!sheet1.length) return NextResponse.json({ error: 'Sheet1 kosong.' }, { status: 400 });
    const r = rencanakan(sheet1, tabs, { motor: req.nextUrl.searchParams.get('motor') === '1' });
    return NextResponse.json(ringkas(r), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Gagal membaca untuk sinkron konsumen:', err);
    return NextResponse.json({ error: 'Gagal membaca file database. Coba lagi sebentar.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await owner(req))) return NextResponse.json({ error: 'Hanya owner.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  try {
    const { sheet1, tabs } = await bacaSemua();
    if (!sheet1.length) return NextResponse.json({ error: 'Sheet1 kosong.' }, { status: 400 });
    const r = rencanakan(sheet1, tabs, { motor: !!b?.motor });
    const s = api();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    // 1. Isi sel kosong di baris lama (sebelum menambah baris, supaya nomor baris tetap)
    for (let i = 0; i < r.isi.length; i += 400) {
      await s.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: r.isi.slice(i, i + 400).map((x) => ({ range: `${SHEET1}!${hurufKolom(x.kolom)}${x.baris}`, values: [[x.nilai]] })),
        },
      });
    }
    // 2. Tambahkan kontrak baru di bawah
    if (r.baru.length) {
      await s.spreadsheets.values.append({
        spreadsheetId, range: `${SHEET1}!A1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
        requestBody: { values: r.baru.map((x) => x.nilai) },
      });
    }
    lupakanKonsumen();
    return NextResponse.json({ ok: true, ...ringkas(r) });
  } catch (err) {
    console.error('Gagal sinkron konsumen:', err);
    return NextResponse.json({ error: 'Gagal menulis ke Sheet1. Pastikan service account punya akses Editor.' }, { status: 500 });
  }
}
