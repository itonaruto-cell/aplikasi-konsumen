import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Versi aplikasi yang sedang live. HP yang masih menjalankan versi lama (aplikasi tidak pernah ditutup)
// membandingkan angka ini dan menampilkan ajakan "Muat ulang".
export function GET() {
  const v = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || '';
  return NextResponse.json({ v }, { headers: { 'Cache-Control': 'no-store' } });
}
