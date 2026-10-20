import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from '../../../../lib/session';
import { getRole } from '../../../../lib/access';
import { ACTOR, dariApify, type ItemMaps } from '../../../../lib/ambil-maps';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Owner: jalankan Google Maps Scraper di akun Apify milik owner, pantau, lalu ambil hasilnya.
// Token Apify dikirim dari HP owner di tiap permintaan dan TIDAK disimpan di server.
//   { aksi: 'mulai', token, cari: string[], maks }  → { runId }
//   { aksi: 'cek', token, runId }                   → { status, jumlah, datasetId }
//   { aksi: 'ambil', token, datasetId }             → { items, total, tanpaHp }
const API = 'https://api.apify.com/v2';

async function apify(token: string, path: string, init?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) }, cache: 'no-store' });
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const pesan = r.status === 401 ? 'Token Apify salah atau sudah dicabut.'
      : r.status === 402 || /credit|usage|limit/i.test(JSON.stringify(j)) ? 'Kredit Apify habis. Tunggu bulan depan atau kurangi jumlah pencarian.'
      : j?.error?.message || `Apify menolak permintaan (kode ${r.status}).`;
    throw Object.assign(new Error(pesan), { status: r.status === 401 ? 401 : 400 });
  }
  return j;
}

export async function POST(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s || (await getRole(s.email)) !== 'owner') return NextResponse.json({ error: 'Hanya owner.' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const token = String(b?.token || '').trim();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) return NextResponse.json({ error: 'Isi token Apify dulu.' }, { status: 400 });
  try {
    if (b.aksi === 'mulai') {
      const cari = (Array.isArray(b.cari) ? b.cari : []).map((x: unknown) => String(x).slice(0, 120)).filter(Boolean).slice(0, 400);
      if (!cari.length) return NextResponse.json({ error: 'Pilih wilayah dan kata kunci.' }, { status: 400 });
      const maks = Math.max(1, Math.min(50, Number(b.maks) || 10));
      const j = await apify(token, `/acts/${ACTOR}/runs`, {
        method: 'POST',
        body: JSON.stringify({ searchStringsArray: cari, maxCrawledPlacesPerSearch: maks, language: 'id' }),
      });
      return NextResponse.json({ runId: j?.data?.id, datasetId: j?.data?.defaultDatasetId });
    }
    if (b.aksi === 'cek') {
      const runId = String(b.runId || '');
      if (!/^[A-Za-z0-9]{8,40}$/.test(runId)) return NextResponse.json({ error: 'Run tidak dikenal.' }, { status: 400 });
      const j = await apify(token, `/actor-runs/${runId}`);
      const datasetId = String(j?.data?.defaultDatasetId || '');
      let jumlah = 0;
      if (datasetId) jumlah = Number((await apify(token, `/datasets/${datasetId}`))?.data?.itemCount) || 0;
      return NextResponse.json({ status: String(j?.data?.status || ''), jumlah, datasetId });
    }
    if (b.aksi === 'ambil') {
      const datasetId = String(b.datasetId || '');
      if (!/^[A-Za-z0-9]{8,40}$/.test(datasetId)) return NextResponse.json({ error: 'Dataset tidak dikenal.' }, { status: 400 });
      const fields = 'title,phone,phoneUnformatted,categoryName,categories,address,url,searchString,permanentlyClosed';
      const r = await fetch(`${API}/datasets/${datasetId}/items?clean=true&format=json&limit=5000&fields=${fields}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      if (!r.ok) return NextResponse.json({ error: `Hasil belum bisa diambil (kode ${r.status}).` }, { status: 400 });
      const raw = (await r.json().catch(() => [])) as Record<string, unknown>[];
      const items: ItemMaps[] = [];
      const lihat = new Set<string>();
      let tanpaHp = 0;
      for (const x of Array.isArray(raw) ? raw : []) {
        const it = dariApify(x);
        if (!it) { tanpaHp++; continue; }
        if (lihat.has(it.hp)) continue;   // tempat sama dari beberapa kata kunci
        lihat.add(it.hp);
        items.push(it);
      }
      return NextResponse.json({ items, total: Array.isArray(raw) ? raw.length : 0, tanpaHp });
    }
    return NextResponse.json({ error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (err) {
    const e = err as Error & { status?: number };
    if (!e.status) console.error('Ambil Google Maps gagal:', err);
    return NextResponse.json({ error: e.status ? e.message : 'Apify tidak bisa dihubungi. Coba lagi sebentar.' }, { status: e.status || 502 });
  }
}
