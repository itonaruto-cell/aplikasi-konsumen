// Klien Google Sheets ringan (REST + token service account), pengganti paket "googleapis".
// - Token akses disimpan & dipakai ulang sampai hampir kedaluwarsa (dulu: minta token baru di setiap panggilan).
// - Tanpa paket googleapis yang besar, server lebih cepat "bangun" saat pertama dipanggil.
// Bentuk pemanggilannya sama dengan googleapis: sheetsApi().spreadsheets.values.get({ spreadsheetId, range }) → { data }.
import { createSign } from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

let token: { nilai: string; sampai: number } | null = null;
let minta: Promise<string> | null = null;

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

async function ambilToken(): Promise<string> {
  if (token && Date.now() < token.sampai) return token.nilai;
  if (minta) return minta;
  minta = (async () => {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
    const kunci = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    const iat = Math.floor(Date.now() / 1000);
    const isi = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }))}`;
    const ttd = createSign('RSA-SHA256').update(isi).sign(kunci);
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${isi}.${b64url(ttd)}` }),
    });
    const j = await r.json().catch(() => null) as { access_token?: string; expires_in?: number; error_description?: string } | null;
    if (!r.ok || !j?.access_token) throw new Error(`Token Google gagal: ${j?.error_description || r.status}`);
    token = { nilai: j.access_token, sampai: Date.now() + Math.max(60, (j.expires_in || 3600) - 300) * 1000 };
    return token.nilai;
  })();
  try { return await minta; } finally { minta = null; }
}

type Kueri = Record<string, string | string[] | boolean | undefined>;
async function panggil<T>(metode: string, jalur: string, kueri: Kueri = {}, body?: unknown, ulang = true): Promise<{ data: T }> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(kueri)) {
    if (v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) q.append(k, String(x));
  }
  const url = `${BASE}/${jalur}${q.toString() ? `?${q}` : ''}`;
  const r = await fetch(url, {
    method: metode,
    headers: { Authorization: `Bearer ${await ambilToken()}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && ulang) { token = null; return panggil(metode, jalur, kueri, body, false); }
  const teks = await r.text();
  const data = teks ? JSON.parse(teks) : {};
  if (!r.ok) {
    const e = new Error(data?.error?.message || `Google Sheets ${r.status}`) as Error & { code?: number };
    e.code = r.status;
    throw e;
  }
  return { data: data as T };
}

const id = (s?: string | null) => encodeURIComponent(s || '');
const rg = (s: string) => encodeURIComponent(s);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Nilai = { range?: string; majorDimension?: string; values?: any[][] };
type Umum = { spreadsheetId?: string | null };

const API = {
  spreadsheets: {
    get: (o: Umum & { fields?: string; ranges?: string[]; includeGridData?: boolean }) =>
      panggil<{ sheets?: { properties?: { title?: string; sheetId?: number; index?: number; gridProperties?: { rowCount?: number; columnCount?: number } } }[] }>(
        'GET', id(o.spreadsheetId), { fields: o.fields, ranges: o.ranges, includeGridData: o.includeGridData }),
    batchUpdate: (o: Umum & { requestBody: unknown }) => panggil<Record<string, unknown>>('POST', `${id(o.spreadsheetId)}:batchUpdate`, {}, o.requestBody),
    values: {
      get: (o: Umum & { range: string; valueRenderOption?: string; majorDimension?: string; dateTimeRenderOption?: string }) =>
        panggil<Nilai>('GET', `${id(o.spreadsheetId)}/values/${rg(o.range)}`, { valueRenderOption: o.valueRenderOption, majorDimension: o.majorDimension, dateTimeRenderOption: o.dateTimeRenderOption }),
      batchGet: (o: Umum & { ranges: string[]; valueRenderOption?: string; majorDimension?: string }) =>
        panggil<{ valueRanges?: Nilai[] }>('GET', `${id(o.spreadsheetId)}/values:batchGet`, { ranges: o.ranges, valueRenderOption: o.valueRenderOption, majorDimension: o.majorDimension }),
      append: (o: Umum & { range: string; valueInputOption?: string; insertDataOption?: string; requestBody: { values: unknown[][] } }) =>
        panggil<Record<string, unknown>>('POST', `${id(o.spreadsheetId)}/values/${rg(o.range)}:append`, { valueInputOption: o.valueInputOption || 'RAW', insertDataOption: o.insertDataOption }, o.requestBody),
      update: (o: Umum & { range: string; valueInputOption?: string; requestBody: { values: unknown[][] } }) =>
        panggil<Record<string, unknown>>('PUT', `${id(o.spreadsheetId)}/values/${rg(o.range)}`, { valueInputOption: o.valueInputOption || 'RAW' }, o.requestBody),
      batchUpdate: (o: Umum & { requestBody: { valueInputOption?: string; data: { range: string; values: unknown[][] }[] } }) =>
        panggil<Record<string, unknown>>('POST', `${id(o.spreadsheetId)}/values:batchUpdate`, {}, o.requestBody),
      clear: (o: Umum & { range: string }) => panggil<Record<string, unknown>>('POST', `${id(o.spreadsheetId)}/values/${rg(o.range)}:clear`, {}, {}),
    },
  },
};
export type SheetsApi = typeof API;
export const sheetsApi = (): SheetsApi => API;
