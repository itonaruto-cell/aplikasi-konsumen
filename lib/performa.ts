import { google } from 'googleapis';
import type { Performa } from './performa-types';

// Data performa terakhir disimpan di tab "PERFORMA" Google Sheets aplikasi ini
// (dibuat otomatis). Isinya JSON dari Apps Script, dipotong per sel karena
// satu sel Google Sheets maksimal 50.000 karakter. Jangan diubah manual.

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

export async function savePerforma(data: Performa) {
  await ensureTab();
  const api = sheets();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const json = JSON.stringify(data);
  const chunks: string[][] = [];
  for (let i = 0; i < json.length; i += CHUNK) chunks.push([json.slice(i, i + CHUNK)]);

  await api.spreadsheets.values.clear({ spreadsheetId, range: `${PERF_TAB}!A:A` });
  await api.spreadsheets.values.update({
    spreadsheetId,
    range: `${PERF_TAB}!A1:A${chunks.length + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[NOTE], ...chunks] },
  });
  cache = { at: Date.now(), data };
}

export async function loadPerforma(): Promise<Performa | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  await ensureTab();
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${PERF_TAB}!A2:A`,
  });
  const json = (res.data.values || []).map((r) => String(r[0] || '')).join('');
  let data: Performa | null = null;
  if (json) {
    try { data = JSON.parse(json) as Performa; } catch { data = null; }
  }
  cache = { at: Date.now(), data };
  return data;
}
