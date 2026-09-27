// Web Push tanpa library tambahan (RFC 8291 aes128gcm + RFC 8292 VAPID), memakai node:crypto.
// Kunci VAPID disimpan di Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mis. mailto:email@anda).
import { createCipheriv, createECDH, createHmac, createPrivateKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto';

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushResult = { ok: boolean; status: number; gone: boolean };

export const b64u = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64u = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();

// Pasangan kunci baru (sekali saja, lalu simpan di Vercel)
export function newVapidKeys() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pub = publicKey.export({ format: 'jwk' });
  const priv = privateKey.export({ format: 'jwk' });
  const raw = Buffer.concat([Buffer.from([4]), unb64u(pub.x as string), unb64u(pub.y as string)]);
  return { publicKey: b64u(raw), privateKey: priv.d as string };
}

export const vapidReady = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

function vapidAuth(endpoint: string): string {
  const pub = unb64u(process.env.VAPID_PUBLIC_KEY || '');
  const key = createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: process.env.VAPID_PRIVATE_KEY || '', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: 'jwk',
  });
  const header = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(Buffer.from(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  })));
  const sig = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${process.env.VAPID_PUBLIC_KEY}`;
}

// Enkripsi isi pesan untuk satu langganan (aes128gcm, satu record)
export function encrypt(sub: PushSub, payload: string, salt: Buffer = randomBytes(16), serverKey?: ReturnType<typeof createECDH>) {
  const ecdh = serverKey ?? createECDH('prime256v1');
  if (!serverKey) ecdh.generateKeys();
  const uaPublic = unb64u(sub.keys.p256dh);
  const authSecret = unb64u(sub.keys.auth);
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);

  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);

  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096, 0);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

export async function sendPush(sub: PushSub, message: { title: string; body: string; url?: string; tag?: string }): Promise<PushResult> {
  try {
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '43200',
        Urgency: 'normal',
        Authorization: vapidAuth(sub.endpoint),
      },
      body: new Uint8Array(encrypt(sub, JSON.stringify(message))),
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, gone: res.status === 404 || res.status === 410 };
  } catch (err) {
    console.error('Push gagal:', err);
    return { ok: false, status: 0, gone: false };
  }
}
