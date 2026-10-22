import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { sesiProspek } from '../../../../lib/prospek-store';
import { MAX_B64, saveFotos } from '../../../../lib/foto-store';

export const dynamic = 'force-dynamic';

// Unggah satu foto lampiran banding (sudah diperkecil di HP). Mengembalikan ID foto untuk disimpan di form.
export async function POST(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const b = await req.json().catch(() => null) as { mime?: string; data?: string } | null;
  const mime = b?.mime === 'image/png' ? 'image/png' : 'image/jpeg';
  const data = typeof b?.data === 'string' ? b.data : '';
  if (!data || data.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return NextResponse.json({ error: 'Foto tidak valid atau terlalu besar.' }, { status: 400 });
  const id = `banding_${Date.now().toString(36)}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  try {
    await saveFotos([{ id, mime, data }]);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('Gagal menyimpan foto banding:', err);
    return NextResponse.json({ error: 'Foto gagal disimpan. Coba lagi.' }, { status: 500 });
  }
}
