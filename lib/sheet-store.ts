import { google } from 'googleapis';

// Tabel kecil di Google Sheets aplikasi (dibuat otomatis): PENGUMUMAN dan PUSH.
// Baris 1 = judul kolom, data mulai baris 2. Jangan diubah manual kecuali menghapus baris.

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

const ready = new Set<string>();
async function ensureTab(tab: string, header: string[]) {
  if (ready.has(tab)) return;
  const api = sheets();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === tab);
  if (!exists) {
    await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] } });
    await api.spreadsheets.values.update({
      spreadsheetId, range: `${tab}!A1`, valueInputOption: 'RAW', requestBody: { values: [header] },
    });
  }
  ready.add(tab);
}

export async function readRows(tab: string, header: string[]): Promise<string[][]> {
  await ensureTab(tab, header);
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${tab}!A2:Z` });
  return ((res.data.values || []) as unknown[][]).map((r) => header.map((_, i) => String(r[i] ?? '')));
}

export async function appendRow(tab: string, header: string[], row: string[]) {
  await ensureTab(tab, header);
  await sheets().spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${tab}!A1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

// Tulis ulang seluruh isi tabel (untuk hapus/ubah; tabelnya kecil)
export async function writeRows(tab: string, header: string[], rows: string[][]) {
  await ensureTab(tab, header);
  const api = sheets();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  await api.spreadsheets.values.clear({ spreadsheetId, range: `${tab}!A2:Z` });
  if (rows.length) {
    await api.spreadsheets.values.update({ spreadsheetId, range: `${tab}!A2`, valueInputOption: 'RAW', requestBody: { values: rows } });
  }
}
