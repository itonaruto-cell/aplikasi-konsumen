import { google } from 'googleapis';

// Salinan kecil foto visit (dikirim Apps Script) disimpan di tab FOTO Google Sheets aplikasi.
// Satu baris per foto: ID Drive, jenis gambar, waktu, lalu isi base64 dipecah per 45.000 karakter (maks. 4 sel).
const TAB = 'FOTO';
const HEAD = ['ID', 'MIME', 'DIBUAT', 'D1', 'D2', 'D3', 'D4'];
const CHUNK = 45_000;
export const MAX_B64 = CHUNK * 4;
export const validId = (id: string) => /^[A-Za-z0-9_-]{20,120}$/.test(id);

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

let ready = false;
async function ensureTab() {
  if (ready) return;
  const api = sheets();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  if (!(meta.data.sheets || []).some((s) => s.properties?.title === TAB)) {
    await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] } });
    await api.spreadsheets.values.update({ spreadsheetId, range: `${TAB}!A1`, valueInputOption: 'RAW', requestBody: { values: [HEAD] } });
  }
  ready = true;
}

// Posisi baris tiap ID (disimpan sebentar supaya tidak membaca sheet terus)
let index: { at: number; rows: Map<string, number> } | null = null;
async function ids(force = false) {
  if (!force && index && Date.now() - index.at < 5 * 60_000) return index.rows;
  await ensureTab();
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${TAB}!A2:A` });
  const rows = new Map<string, number>();
  (res.data.values || []).forEach((r, i) => { const id = String(r[0] || ''); if (id) rows.set(id, i + 2); });
  index = { at: Date.now(), rows };
  return rows;
}

export async function missingIds(list: string[]) {
  const have = await ids(true);
  return list.filter((id) => validId(id) && !have.has(id));
}

export async function saveFotos(items: { id: string; mime: string; data: string }[]) {
  const have = await ids(true);
  const rows = items.filter((x) => !have.has(x.id)).map((x) => {
    const parts: string[] = [];
    for (let i = 0; i < x.data.length; i += CHUNK) parts.push(x.data.slice(i, i + CHUNK));
    return [x.id, x.mime, new Date().toISOString(), ...parts];
  });
  if (!rows.length) return 0;
  await sheets().spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${TAB}!A1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
  index = null;
  return rows.length;
}

// Foto yang sering dibuka disimpan sebentar di memori server
const mem = new Map<string, { mime: string; buf: Buffer }>();
export async function getFoto(id: string): Promise<{ mime: string; buf: Buffer } | null> {
  if (!validId(id)) return null;
  const hit = mem.get(id);
  if (hit) return hit;
  let row = (await ids()).get(id);
  if (!row) row = (await ids(true)).get(id);
  if (!row) return null;
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${TAB}!A${row}:G${row}` });
  const r = (res.data.values || [])[0] || [];
  if (String(r[0] || '') !== id) { index = null; return null; }
  const out = { mime: String(r[1] || 'image/jpeg'), buf: Buffer.from(r.slice(3).map((x) => String(x || '')).join(''), 'base64') };
  if (mem.size > 60) mem.delete(mem.keys().next().value as string);
  mem.set(id, out);
  return out;
}
