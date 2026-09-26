import { google } from 'googleapis';

// Siapa boleh masuk & perannya.
// - OWNER_EMAIL (Environment Variable di Vercel): selalu owner, pisahkan dengan koma kalau lebih dari satu.
// - Tab "AKSES" di Google Sheets: kolom A = EMAIL, kolom B = ROLE (owner / tim). Mulai baris 2.
//   Email yang tidak ada di daftar tidak bisa masuk.

export type Role = 'owner' | 'tim';

let cache: { at: number; map: Map<string, Role> } | null = null;
const CACHE_MS = 60_000;

function sheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function loadAccessSheet(): Promise<Map<string, Role>> {
  const map = new Map<string, Role>();
  try {
    const res = await sheetsClient().spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'AKSES!A2:B',
    });
    for (const row of res.data.values || []) {
      const email = String(row[0] || '').trim().toLowerCase();
      if (!email || !email.includes('@')) continue;
      const role = String(row[1] || '').trim().toLowerCase();
      map.set(email, role === 'owner' ? 'owner' : 'tim');
    }
  } catch (err) {
    console.error('Gagal membaca tab AKSES:', err);
  }
  return map;
}

async function accessMap(): Promise<Map<string, Role>> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    cache = { at: Date.now(), map: await loadAccessSheet() };
  }
  return cache.map;
}

function ownerEmails(): string[] {
  return (process.env.OWNER_EMAIL || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export async function getRole(email: string): Promise<Role | null> {
  const e = email.trim().toLowerCase();
  if (ownerEmails().includes(e)) return 'owner';
  return (await accessMap()).get(e) ?? null;
}

// Semua email yang terdaftar (owner dari Vercel + isi tab AKSES).
export async function getAccessList(): Promise<{ email: string; role: Role }[]> {
  const map = new Map<string, Role>(await accessMap());
  ownerEmails().forEach((e) => map.set(e, 'owner'));
  return Array.from(map, ([email, role]) => ({ email, role }));
}
