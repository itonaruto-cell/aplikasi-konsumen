import { sheetsApi } from './sheets-api';
import type { Performa, Peringkat } from './performa-types';
import { bulanAktivitas, rankSnapshot, todayJkt } from './performa-calc';
import { rapikanPerforma } from './sales-brand';
import { simpanArsip } from './performa-arsip';
import { bacaTabel, kolomCair, TAB_CAIR, TAB_OI, type Tabel } from './tarikan-data';
import { bulanData } from './performa-kosong';

// Data performa terakhir disimpan di tab "PERFORMA" Google Sheets aplikasi ini
// (dibuat otomatis). Isinya JSON dari Apps Script, dipotong per sel karena
// satu sel Google Sheets maksimal 50.000 karakter. Jangan diubah manual.
// Sel B1 menyimpan urutan peringkat hari ini & hari sebelumnya (untuk panah naik/turun di Papan juara).

export const PERF_TAB = 'PERFORMA';
const CHUNK = 40_000;
const CACHE_MS = 60_000;
const NOTE = 'Diisi otomatis oleh Apps Script pantauan cabang. Jangan diubah.';

function sheets() {
  return sheetsApi();
}

let tabReady = false;
async function ensureTab() {
  if (tabReady) return;
  const api = sheets();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === PERF_TAB);
  if (!exists) {
    await api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: PERF_TAB } } }] },
    });
  }
  tabReady = true;
}

let cache: { at: number; data: Performa | null } | null = null;

type Snap = { tgl: string; rank: Peringkat };
type Snaps = { cur?: Snap; prev?: Snap };
const parseSnaps = (v: unknown): Snaps => { try { return JSON.parse(String(v || '{}')) as Snaps; } catch { return {}; } };
// Peringkat pembanding = snapshot terakhir SEBELUM hari ini
const kemarinOf = (s: Snaps, today: string) =>
  s.cur && s.cur.tgl < today ? s.cur : s.prev && s.prev.tgl < today ? s.prev : undefined;

// Kiriman yang tidak membawa rekap tarikan sales / bulan lalu (mis. jadwal kirimPerforma lama masih jalan,
// atau tab tarikan sedang tidak terbaca) memakai rekap dari kiriman sebelumnya di bulan yang sama,
// supaya pemisahan motor sukarela tidak hilang-timbul.
export function bawaRekapLama(baru: Performa, lama: Performa | null, sekarang = new Date().toISOString()): Performa {
  let d: Performa = baru.salesBrand ? { ...baru, salesBrand: { ...baru.salesBrand, diterima: sekarang, dibawa: undefined } } : baru;
  if (!lama || !bulanData(lama) || bulanData(lama) !== bulanData(baru)) return d;
  if (!d.salesBrand && lama.salesBrand?.orang?.length) {
    const sb = lama.salesBrand;
    d = { ...d, salesBrand: { sumber: sb.sumber, orang: sb.orang, diterima: sb.diterima, dibawa: sb.dibawa || sb.diterima || 'sebelumnya' } };
  }
  if (!d.salesLalu && lama.salesLalu) d = { ...d, salesLalu: lama.salesLalu };
  return d;
}

// Pengaman kiriman kosong: file pantauan sedang diperbarui / rumus belum selesai menghitung saat Apps Script jalan,
// sehingga terkirim angka kosong. Kalau kiriman sebelumnya di bulan yang sama ada isinya, kiriman kosong diabaikan
// dan angka terakhir yang benar tetap tampil. Awal bulan baru (bulan berbeda) tetap diterima walau masih nol.
const adaAngka = (v?: { ini?: number | null } | null) => typeof v?.ini === 'number' && v.ini > 0;
export const aktivitasLebihBaru = (baru: Performa, lama: Performa | null) => {
  const a = bulanAktivitas(baru), b = bulanAktivitas(lama);
  return !!a && !!b && a > b;
};
const positif = (v: unknown) => typeof v === 'number' && v > 0;
const adaKerangka = (d: Performa) => [d.cabangTotal?.unit, d.cabangTotal?.amount, ...(d.orang || []).flatMap((o) => [o.unit, o.amount])]
  .some((x) => positif(x?.lalu) || positif(x?.target));
export function isiSales(d: Performa | null): boolean {
  if (!d) return false;
  if (adaAngka(d.cabangTotal?.amount) || adaAngka(d.cabangTotal?.unit)) return true;
  return (d.orang || []).some((o) => adaAngka(o.amount) || adaAngka(o.unit));
}
export function kirimanKosong(baru: Performa, lama: Performa | null): boolean {
  if (!lama || !isiSales(lama) || isiSales(baru)) return false;
  // Aktivitas (visit/maintain) sudah bulan yang lebih baru = file pantauan bulan baru yang sales-nya memang masih nol
  if (aktivitasLebihBaru(baru, lama)) return false;
  // Tabel sales terbaca (ada angka bulan lalu atau target) tapi bulan ini masih nol = awal bulan, bukan sheet yang
  // gagal dihitung (kalau gagal, semua kolom ikut kosong)
  if (adaKerangka(baru)) return false;
  const bulanSama = bulanData(baru) && bulanData(lama)
    ? bulanData(baru) === bulanData(lama)
    : !!baru.bulan?.ini && baru.bulan.ini === lama.bulan?.ini;
  return bulanSama || !bulanData(baru);
}

// Bulan TGL GL terbanyak di tab CAIR (kosong kalau tidak terbaca). Tanggal: 2026-11-03, 03/11/2026, 3-Nov-2026, serial.
const KODE_BLN = [/^JAN/, /^FEB/, /^MAR/, /^APR/, /^(MEI|MAY)/, /^JUN/, /^JUL/, /^(AGU|AGS|AUG)/, /^SEP/, /^(OKT|OCT)/, /^NOV/, /^(DES|DEC)/];
function bulanTgl(v: string): string {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-\d{1,2}/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;
  m = s.match(/^\d{1,2}[/.-](\d{1,2})[/.-](\d{4})/);
  if (m && Number(m[1]) <= 12) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = s.match(/^\d{1,2}[\s-]+([A-Za-z]+)[\s-]+(\d{4})/);
  if (m) { const i = KODE_BLN.findIndex((r) => r.test(m![1].toUpperCase())); if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, '0')}`; }
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 864e5).toISOString().slice(0, 7);
  return '';
}
function bulanTabel(t: Tabel | null): string {
  if (!t?.r.length) return '';
  const k = kolomCair(t.h, t.r);
  if (k.tgl < 0) return '';
  const n = new Map<string, number>();
  for (const r of t.r) { const b = bulanTgl(r[k.tgl] || ''); if (b) n.set(b, (n.get(b) || 0) + 1); }
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

// Simpan data (dan tab CAIR & DATA_OI saat ini) sebagai arsip bulan data itu. Gagal tidak menghentikan proses lain.
// Hanya kalau seluruh isinya memang bulan itu: aktivitas terakhir di bulan yang sama dengan angka sales
// (file bulan baru yang sales-nya belum diganti tapi aktivitasnya sudah bulan baru tidak menimpa arsip).
// paksa = owner menyimpan arsip secara manual.
export const bolehArsip = (d: Performa) => {
  const b = bulanData(d), akt = bulanAktivitas(d);
  return !!b && (akt ? akt === b : String(d.updated || '').slice(0, 7) === b);
};
export async function arsipkan(d: Performa, paksa = false) {
  const b = bulanData(d);
  if (!b || (!paksa && !bolehArsip(d))) return false;
  try {
    await simpanArsip(b, 'performa', { ...d, riwayat: undefined });
    const [cair, oi] = await Promise.all([bacaTabel(TAB_CAIR).catch(() => null), bacaTabel(TAB_OI).catch(() => null)]);
    // Tab tarikan bisa sudah berisi bulan lain (dikirim dari file bulan baru): jangan timpa arsip tarikan bulan ini
    const bt = bulanTabel(cair);
    if (!bt || bt === b) {
      if (cair) await simpanArsip(b, 'cair', cair);
      if (oi) await simpanArsip(b, 'oi', oi);
    }
    return true;
  } catch (err) { console.error('Gagal menyimpan arsip bulan', b, err); return false; }
}

async function bacaMentah(api: ReturnType<typeof sheets>, spreadsheetId?: string): Promise<Performa | null> {
  try {
    const res = await api.spreadsheets.values.get({ spreadsheetId, range: `${PERF_TAB}!A2:A` });
    const json = (res.data.values || []).map((r) => String(r[0] || '')).join('');
    return json ? (JSON.parse(json) as Performa) : null;
  } catch { return null; }
}

export async function savePerforma(data: Performa) {
  await ensureTab();
  const api = sheets();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const lama = await bacaMentah(api, spreadsheetId);
  // UPDATE PER kosong (mis. file pantauan bulan baru yang tabel sales-nya belum terisi): pakai tanggal hari ini
  if (!data.updated) data = { ...data, updated: todayJkt() };
  // Bulan berganti: simpan dulu data bulan sebelumnya (termasuk daftar konsumen, konsumen cair, data OI) ke arsip
  if (lama && isiSales(lama) && ((bulanData(lama) && bulanData(data) && bulanData(lama) !== bulanData(data)) || aktivitasLebihBaru(data, lama))) {
    await arsipkan(lama);
  }
  if (kirimanKosong(data, lama)) {
    console.warn('Kiriman performa kosong diabaikan; data terakhir tetap dipakai.', { updated: data.updated, bulan: data.bulan, lama: lama?.updated, lamaBulan: lama?.bulan });
    return { before: undefined, after: undefined, dilewati: true as const };
  }
  data = rapikanPerforma({ ...bawaRekapLama(data, lama), riwayat: undefined });
  console.info('Kiriman performa diterima.', JSON.stringify({ updated: data.updated, bulan: data.bulan, sales: isiSales(data), aktivitas: bulanAktivitas(data), orang: data.orang?.length, blok: data.blok?.length }));
  const json = JSON.stringify(data);
  const chunks: string[][] = [];
  for (let i = 0; i < json.length; i += CHUNK) chunks.push([json.slice(i, i + CHUNK)]);

  // Snapshot peringkat harian
  const today = todayJkt();
  let snaps: Snaps = {};
  try {
    const r = await api.spreadsheets.values.get({ spreadsheetId, range: `${PERF_TAB}!B1` });
    snaps = parseSnaps(r.data.values?.[0]?.[0]);
  } catch { snaps = {}; }
  const rank = rankSnapshot(data, today);
  const before = snaps.cur?.rank;   // urutan dari kiriman sebelumnya (untuk notifikasi naik/disalip)
  snaps = snaps.cur && snaps.cur.tgl !== today ? { prev: snaps.cur, cur: { tgl: today, rank } } : { prev: snaps.prev, cur: { tgl: today, rank } };
  await api.spreadsheets.values.update({
    spreadsheetId, range: `${PERF_TAB}!B1`, valueInputOption: 'RAW', requestBody: { values: [[JSON.stringify(snaps)]] },
  });
  const kemarin = kemarinOf(snaps, today);
  data = { ...data, riwayat: kemarin ? { kemarin } : undefined };

  await api.spreadsheets.values.clear({ spreadsheetId, range: `${PERF_TAB}!A:A` });
  await api.spreadsheets.values.update({
    spreadsheetId,
    range: `${PERF_TAB}!A1:A${chunks.length + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[NOTE], ...chunks] },
  });
  cache = { at: Date.now(), data };
  return { before, after: rank, dilewati: false as const };
}

export async function loadPerforma(): Promise<Performa | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  await ensureTab();
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${PERF_TAB}!A1:B`,
  });
  const rows = res.data.values || [];
  const json = rows.slice(1).map((r) => String(r[0] || '')).join('');
  let data: Performa | null = null;
  if (json) {
    try { data = rapikanPerforma(JSON.parse(json) as Performa); } catch { data = null; }
  }
  if (data) {
    const kemarin = kemarinOf(parseSnaps(rows[0]?.[1]), todayJkt());
    data = { ...data, riwayat: kemarin ? { kemarin } : undefined };
  }
  cache = { at: Date.now(), data };
  return data;
}
