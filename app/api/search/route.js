import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole, canSeeKonsumen } from '../../../lib/access';
import { bacaDatabase, terapkan } from '../../../lib/koreksi-konsumen';
import { koreksiAman } from '../../../lib/konsumen-db';

export const dynamic = 'force-dynamic';

// Kolom nomor telepon: hanya dikirim ke akun OWNER. Akun TIM tidak pernah menerima kolom ini.
const PHONE_COLUMN = /^(NO\.?\s*)?(HP|WA|TELP|TELEPON|TLP|PHONE|HANDPHONE|WHATSAPP)(\s*\d+)?$/i;

// Data konsumen dari tab Sheet1, sudah ditimpa koreksi owner (tab KOREKSI_KONSUMEN).
// Khusus owner, tiap baris juga membawa:
//   __ID      = kunci konsumen untuk menyimpan koreksi
//   __KOREKSI = JSON { kolom: nilai asli } untuk kolom yang sudah dikoreksi
export async function GET(request) {
  // 1. Cek login & peran
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const role = await getRole(session.email);
  if (!role) return Response.json({ error: 'Akses akun ini sudah dicabut. Hubungi owner.' }, { status: 403 });
  if (!canSeeKonsumen(role)) {
    return Response.json({ error: 'Akun ini hanya bisa melihat performa tim.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase() || '';

  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return Response.json({ error: 'Pengaturan Google Sheets di Vercel belum lengkap.' }, { status: 500 });
  }

  try {
    const [{ head, rows }, peta] = await Promise.all([bacaDatabase(), koreksiAman()]);
    if (!head.length) return Response.json([]);
    const owner = role === 'owner';

    // 2. Tentukan kolom yang boleh dikirim
    const allowed = head.map((h, i) => ({ h, i })).filter(({ h }) => h && (owner || !PHONE_COLUMN.test(h)));

    const result = terapkan(head, rows, peta)
      .map(({ nilai, kunci, dikoreksi }) => {
        const obj = {};
        allowed.forEach(({ h, i }) => { obj[h] = nilai[i] || ''; });
        if (owner) {
          obj.__ID = kunci;
          if (dikoreksi.size) obj.__KOREKSI = JSON.stringify(Object.fromEntries([...dikoreksi].map(([k, x]) => [k, x.asli])));
        }
        return obj;
      })
      .filter((obj) => !query || Object.entries(obj).some(([k, v]) => !k.startsWith('__') && String(v).toLowerCase().includes(query)));

    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Gagal membaca database konsumen:', error);
    return Response.json({ error: 'Database konsumen belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}
