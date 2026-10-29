import { verifySession, SESSION_COOKIE } from '../../../lib/session';
import { getRole, canSeeKonsumen } from '../../../lib/access';
import { bacaDatabase, terapkan } from '../../../lib/koreksi-konsumen';
import { koreksiAman } from '../../../lib/konsumen-db';
import { bacaTabel, barisCair, isiCair, kunciSheet1, pembuatKunci, petaCair, TAB_CAIR } from '../../../lib/tarikan-data';

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
    const [{ head, rows }, peta, cair] = await Promise.all([
      bacaDatabase(), koreksiAman(),
      bacaTabel(TAB_CAIR).catch((err) => { console.error('Gagal membaca tab CAIR:', err); return null; }),
    ]);
    if (!head.length && !cair) return Response.json([]);
    const owner = role === 'owner';

    // 2. Tentukan kolom yang boleh dikirim
    const allowed = head.map((h, i) => ({ h, i })).filter(({ h }) => h && (owner || !PHONE_COLUMN.test(h)));

    const cairAda = petaCair(cair);
    const cairIsi = isiCair(cair);
    const kunciDari = pembuatKunci(head);
    const result = terapkan(head, rows, peta)
      .map(({ nilai, kunci, dikoreksi }) => {
        const obj = {};
        allowed.forEach(({ h, i }) => { obj[h] = nilai[i] || ''; });
        // Konsumen lama yang bulan ini cair lagi: tandai supaya ikut di daftar "Sudah cair"
        const c = cairAda.size ? kunciDari(nilai).map((x) => cairAda.get(x)).find(Boolean) : null;
        if (c) {
          obj.__CAIR = '1'; obj.__CAIR_INFO = JSON.stringify(c);
          // Lengkapi dengan isi tarikan sales (angsuran, tenor, tipe, LTV, dst.) tanpa menimpa data yang sudah ada
          const isi = kunciDari(nilai).map((x) => cairIsi.get(x)).find(Boolean) || {};
          for (const [k, v] of Object.entries(isi)) {
            if (!owner && PHONE_COLUMN.test(k.trim())) continue;
            if (!String(obj[k] ?? '').trim()) obj[k] = v;
          }
        }
        if (owner) {
          obj.__ID = kunci;
          if (dikoreksi.size) obj.__KOREKSI = JSON.stringify(Object.fromEntries([...dikoreksi].map(([k, x]) => [k, x.asli])));
        }
        return obj;
      })
      // Konsumen yang sudah cair (tab tarikan sales) dan belum ada di Sheet1 ikut ditambahkan, ditandai __CAIR
      .concat(barisCair(cair, head, kunciSheet1(head, rows))
        .map((o) => (owner ? o : Object.fromEntries(Object.entries(o).filter(([k]) => !PHONE_COLUMN.test(k.trim()))))))
      .filter((obj) => !query || Object.entries(obj).some(([k, v]) => !k.startsWith('__') && String(v).toLowerCase().includes(query)));

    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Gagal membaca database konsumen:', error);
    return Response.json({ error: 'Database konsumen belum bisa dibaca. Coba lagi sebentar.' }, { status: 500 });
  }
}
