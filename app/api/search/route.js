import { google } from 'googleapis';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase() || '';

  // Ambil data dari .env.local
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  // Proteksi jika variabel environment belum terbaca
  if (!sheetId || !clientEmail || !privateKey) {
    return Response.json({
      error: "Variabel lingkungan (environment variables) belum terbaca!",
      detail: {
        GOOGLE_SHEET_ID: sheetId ? "Terbaca" : "KOSONG / TIDAK TERBACA",
        GOOGLE_SERVICE_ACCOUNT_EMAIL: clientEmail ? "Terbaca" : "KOSONG / TIDAK TERBACA",
        GOOGLE_PRIVATE_KEY: privateKey ? "Terbaca" : "KOSONG / TIDAK TERBACA",
      },
      solusi: "Pastikan file .env.local berada di folder utama (aplikasi-konsumen) dan restart server (npm run dev)."
    }, { status: 500 });
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
      range: 'Sheet1!A1:Z', // Pastikan 'Sheet1' sesuai nama tab di Google Sheets Anda
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return Response.json([]);

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const filtered = dataRows.filter(row =>
      row.some(cell => cell.toLowerCase().includes(query))
    );

    const result = filtered.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}