import { NextResponse, type NextRequest } from 'next/server';

// Mengarahkan ke halaman "Pilih akun Google".
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL('/login?error=config', req.url));

  const state = crypto.randomUUID();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: new URL('/api/auth/callback', req.url).toString(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set('ck_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
