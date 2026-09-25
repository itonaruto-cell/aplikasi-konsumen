import { NextResponse, type NextRequest } from 'next/server';
import { signSession, SESSION_COOKIE, SESSION_DAYS } from '../../../../lib/session';
import { getRole } from '../../../../lib/access';

// Google mengembalikan pengguna ke sini setelah memilih akun.
export async function GET(req: NextRequest) {
  const fail = (error: string, email?: string) => {
    const u = new URL('/login', req.url);
    u.searchParams.set('error', error);
    if (email) u.searchParams.set('email', email);
    const r = NextResponse.redirect(u);
    r.cookies.delete('ck_state');
    return r;
  };

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  if (!code || !state || state !== req.cookies.get('ck_state')?.value) return fail('gagal');

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
        redirect_uri: new URL('/api/auth/callback', req.url).toString(),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      console.error('Token Google gagal:', await tokenRes.text());
      return fail('gagal');
    }
    const token = (await tokenRes.json()) as { access_token?: string };

    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; name?: string };
    if (!info.email || info.email_verified === false) return fail('gagal');

    const email = info.email.toLowerCase();
    const role = await getRole(email);
    if (!role) return fail('akses', email);

    const session = await signSession({ email, name: info.name, exp: Date.now() + SESSION_DAYS * 86_400_000 });
    const res = NextResponse.redirect(new URL('/', req.url));
    res.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 86_400,
    });
    res.cookies.delete('ck_state');
    return res;
  } catch (err) {
    console.error('Login gagal:', err);
    return fail('gagal');
  }
}
