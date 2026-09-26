import { google } from 'googleapis';

// Catatan aktivitas harian di tab "LOG_AKTIF" (dibuat otomatis kalau belum ada).
// 1 baris = 1 orang per hari:
// TANGGAL | EMAIL | NAMA | ROLE | PERTAMA AKTIF | TERAKHIR AKTIF | JUMLAH BUKA | TERAKHIR_MS

export const LOG_TAB = 'LOG_AKTIF';
const HEADER = ['TANGGAL', 'EMAIL', 'NAMA', 'ROLE', 'PERTAMA AKTIF', 'TERAKHIR AKTIF', 'JUMLAH BUKA', 'TERAKHIR_MS'];
const TZ = 'Asia/Jakarta';

export type ActivityRow = {
  tanggal: string; email: string; nama: string; role: string;
  pertama: string; terakhir: string; jumlahBuka: number; terakhirMs: number;
};

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

export function todayWIB(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function timeWIB(d = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
}

let tabReady = false;
async function ensureTab() {
  if (tabReady) return;
  const api = sheets();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const meta = await api.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === LOG_TAB);
  if (!exists) {
    await api.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: LOG_TAB } } }] },
    });
    await api.spreadsheets.values.update({
      spreadsheetId, range: `${LOG_TAB}!A1:H1`, valueInputOption: 'RAW', requestBody: { values: [HEADER] },
    });
  }
  tabReady = true;
}

// kind: 'login' (baru masuk lewat Google), 'buka' (membuka aplikasi), 'aktif' (masih memakai aplikasi)
export async function recordActivity(email: string, nama: string, role: string, kind: 'login' | 'buka' | 'aktif') {
  await ensureTab();
  const api = sheets();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const now = new Date();
  const tanggal = todayWIB(now);
  const jam = timeWIB(now);

  const res = await api.spreadsheets.values.get({ spreadsheetId, range: `${LOG_TAB}!A2:G` });
  const rows = res.data.values || [];
  let idx = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]) === tanggal && String(rows[i][1]).toLowerCase() === email) { idx = i; break; }
  }

  if (idx === -1) {
    await api.spreadsheets.values.append({
      spreadsheetId, range: `${LOG_TAB}!A:H`, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[tanggal, email, nama, role, jam, jam, 1, now.getTime()]] },
    });
    return;
  }

  const rowNo = idx + 2;
  const count = Number(rows[idx][6] || 0) + (kind === 'aktif' ? 0 : 1);
  await api.spreadsheets.values.update({
    spreadsheetId, range: `${LOG_TAB}!F${rowNo}:H${rowNo}`, valueInputOption: 'RAW',
    requestBody: { values: [[jam, count, now.getTime()]] },
  });
}

export async function readActivity(tanggal: string): Promise<ActivityRow[]> {
  await ensureTab();
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${LOG_TAB}!A2:H` });
  const merged = new Map<string, ActivityRow>();
  for (const r of res.data.values || []) {
    if (String(r[0]) !== tanggal) continue;
    const email = String(r[1] || '').toLowerCase();
    if (!email) continue;
    const row: ActivityRow = {
      tanggal, email, nama: String(r[2] || ''), role: String(r[3] || ''),
      pertama: String(r[4] || ''), terakhir: String(r[5] || ''),
      jumlahBuka: Number(r[6] || 0), terakhirMs: Number(r[7] || 0),
    };
    const prev = merged.get(email);
    if (!prev) { merged.set(email, row); continue; }
    // Gabungkan kalau ada baris ganda untuk orang & tanggal yang sama
    prev.pertama = prev.pertama < row.pertama ? prev.pertama : row.pertama;
    if (row.terakhirMs > prev.terakhirMs) { prev.terakhir = row.terakhir; prev.terakhirMs = row.terakhirMs; }
    prev.jumlahBuka += row.jumlahBuka;
    prev.nama = prev.nama || row.nama;
  }
  return Array.from(merged.values());
}
