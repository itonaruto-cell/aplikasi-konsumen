import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE } from './lib/session';

// Semua halaman & data wajib login dengan akun Google (email).
// Pengecualian: halaman login, proses login, manifest, ikon, dan assetlinks.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: [
    '/((?!manifest.json|icon-|.well-known|_next/static|_next/image|favicon.ico).*)',
  ],
};
