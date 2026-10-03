import { google } from 'googleapis';

// Tabel kecil di Google Sheets aplikasi (dibuat otomatis): PENGUMUMAN, PUSH, BAHAN_SURVEY, dan INJECT_P3.
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
  } else {
    // Tab lama: samakan judul kolom kalau ada kolom baru (isi data tidak disentuh)
    const cur = await api.spreadsheets.values.get({ spreadsheetId, range: `${tab}!1:1` });
    const now = (((cur.data.values || []) as unknown[][])[0] || []);
    if (header.some((h, i) => String(now[i] ?? '') !== h)) {
      await api.spreadsheets.values.update({
        spreadsheetId, range: `${tab}!A1`, valueInputOption: 'RAW', requestBody: { values: [header] },
      });
    }
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

// Tambah beberapa baris sekaligus (satu kali kirim)
export async function appendRows(tab: string, header: string[], rows: string[][]) {
  if (!rows.length) return;
  await ensureTab(tab, header);
  await sheets().spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${tab}!A1`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
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

// Ubah satu baris berdasarkan ID di kolom A, tanpa menulis ulang seluruh tabel
// (aman saat beberapa orang menyimpan bersamaan). Mengembalikan false kalau ID tidak ditemukan.
export async function updateRowById(tab: string, header: string[], id: string, row: string[]): Promise<boolean> {
  await ensureTab(tab, header);
  const api = sheets();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const res = await api.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A2:A` });
  const i = ((res.data.values || []) as unknown[][]).findIndex((r) => String(r[0] ?? '') === id);
  if (i < 0) return false;
  await api.spreadsheets.values.update({
    spreadsheetId, range: `${tab}!A${i + 2}`, valueInputOption: 'RAW', requestBody: { values: [row] },
  });
  return true;
}
