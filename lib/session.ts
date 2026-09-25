// Sesi login: cookie bertanda tangan (HMAC-SHA256) memakai AUTH_SECRET.
// Tidak butuh library tambahan, jalan di proxy maupun API.

export const SESSION_COOKIE = 'ck_session';
export const SESSION_DAYS = 30;

export type Session = { email: string; name?: string; exp: number };

const enc = new TextEncoder();

function toB64url(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET || '';
  return crypto.subtle.importKey('raw', enc.encode(secret) as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signSession(s: Session): Promise<string> {
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET belum diisi di Vercel');
  const body = toB64url(enc.encode(JSON.stringify(s)));
  const sig = await crypto.subtle.sign('HMAC', await getKey(), enc.encode(body) as BufferSource);
  return `${body}.${toB64url(new Uint8Array(sig))}`;
}

export async function verifySession(token?: string | null): Promise<Session | null> {
  try {
    if (!token || !process.env.AUTH_SECRET) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const ok = await crypto.subtle.verify('HMAC', await getKey(), fromB64url(sig) as BufferSource, enc.encode(body) as BufferSource);
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session;
    if (!s.email || !s.exp || s.exp < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}
