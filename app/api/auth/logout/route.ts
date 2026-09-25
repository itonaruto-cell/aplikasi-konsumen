import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '../../../../lib/session';

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login?keluar=1', req.url));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
