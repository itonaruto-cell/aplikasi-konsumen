import { google } from 'googleapis';
import type { Performa, Peringkat } from './performa-types';
import { rankSnapshot, todayJkt } from './performa-calc';

// Data performa terakhir disimpan di tab "PERFORMA" Google Sheets aplikasi ini
// (dibuat otomatis). Isinya JSON dari Apps Script, dipotong per sel karena
// satu sel Google Sheets maksimal 50.000 karakter. Jangan diubah manual.
// Sel B1 menyimpan urutan peringkat hari ini & hari sebelumnya (untuk panah naik/turun di Papan juara).

export const PERF_TAB = 'PERFORMA';
const CHUNK = 40_000;
const CACHE_MS = 60_000;
const NOTE = 'Diisi otomatis oleh Apps Script pantauan cabang. Jangan diubah.';

function sheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
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

export async function savePerforma(data: Performa) {
  data = { ...data, riwayat: undefined };
  await ensureTab();
  const api = sheets();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
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
  return { before, after: rank };
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
    try { data = JSON.parse(json) as Performa; } catch { data = null; }
  }
  if (data) {
    const kemarin = kemarinOf(parseSnaps(rows[0]?.[1]), todayJkt());
    data = { ...data, riwayat: kemarin ? { kemarin } : undefined };
  }
  cache = { at: Date.now(), data };
  return data;
}
