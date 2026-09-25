import { google } from 'googleapis';
import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole } from '../../../lib/access';

export const dynamic = 'force-dynamic';

// >>> SESUAIKAN dengan nama tab data konsumen di Google Sheets (sama seperti di route.js lama) <<<
const DATA_RANGE = 'Sheet1!A1:Z';

// Kolom nomor telepon: hanya dikirim ke akun OWNER. Akun TIM tidak pernah menerima kolom ini.
const PHONE_COLUMN = /^(NO\.?\s*)?(HP|WA|TELP|TELEPON|TLP|PHONE|HANDPHONE|WHATSAPP)(\s*\d+)?$/i;

export async function GET(request) {
  // 1. Cek login & peran
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const role = await getRole(session.email);
  if (!role) return Response.json({ error: 'Akses akun ini sudah dicabut. Hubungi owner.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase() || '';

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!sheetId || !clientEmail || !privateKey) {
    return Response.json({ error: 'Pengaturan Google Sheets di Vercel belum lengkap.' }, { status: 500 });
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: DATA_RANGE,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return Response.json([]);

    // 2. Tentukan kolom yang boleh dikirim
    const headers = rows[0].map((h) => String(h || '').trim());
    const allowed = headers
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => h && (role === 'owner' || !PHONE_COLUMN.test(h)));

    const result = rows
      .slice(1)
      .map((row) => {
        const obj = {};
        allowed.forEach(({ h, i }) => { obj[h] = row[i] || ''; });
        return obj;
      })
      .filter((obj) => !query || Object.values(obj).some((v) => String(v).toLowerCase().includes(query)));

    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
