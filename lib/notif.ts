import { appendRow, readRows, writeRows } from './sheet-store';
import { sendPush, vapidReady, type PushSub } from './webpush';
import { keyOf, type Notif } from './performa-calc';

// Langganan notifikasi HP disimpan di tab PUSH (satu baris per HP/browser).
export const PUSH_TAB = 'PUSH';
const HEAD = ['EMAIL', 'NAMA', 'ENDPOINT', 'P256DH', 'AUTH', 'DIBUAT'];
export type Langganan = { email: string; nama: string; sub: PushSub };

export async function listSubs(): Promise<Langganan[]> {
  return (await readRows(PUSH_TAB, HEAD))
    .filter((r) => r[2])
    .map((r) => ({ email: r[0], nama: r[1], sub: { endpoint: r[2], keys: { p256dh: r[3], auth: r[4] } } }));
}

export async function saveSub(email: string, nama: string, sub: PushSub) {
  const rows = await readRows(PUSH_TAB, HEAD);
  const rest = rows.filter((r) => r[2] !== sub.endpoint);
  if (rest.length === rows.length) {
    await appendRow(PUSH_TAB, HEAD, [email, nama, sub.endpoint, sub.keys.p256dh, sub.keys.auth, new Date().toISOString()]);
  } else {
    await writeRows(PUSH_TAB, HEAD, [...rest, [email, nama, sub.endpoint, sub.keys.p256dh, sub.keys.auth, new Date().toISOString()]]);
  }
}

export async function removeSubs(endpoints: string[]) {
  if (!endpoints.length) return;
  const rows = await readRows(PUSH_TAB, HEAD);
  const keep = rows.filter((r) => !endpoints.includes(r[2]));
  if (keep.length !== rows.length) await writeRows(PUSH_TAB, HEAD, keep);
}

// Kirim ke banyak langganan; pesan bisa berbeda per orang. Langganan yang sudah mati dihapus.
export async function sendMany(subs: Langganan[], msgOf: (s: Langganan) => Notif | null) {
  if (!vapidReady()) return { terkirim: 0, gagal: 0, dihapus: 0, error: 'Kunci VAPID belum diisi di Vercel.' };
  let terkirim = 0, gagal = 0;
  const gone: string[] = [];
  await Promise.all(subs.map(async (s) => {
    const m = msgOf(s);
    if (!m) return;
    const r = await sendPush(s.sub, m);
    if (r.ok) terkirim++; else gagal++;
    if (r.gone) gone.push(s.sub.endpoint);
  }));
  try { await removeSubs(gone); } catch (err) { console.error('Gagal menghapus langganan mati:', err); }
  return { terkirim, gagal, dihapus: gone.length };
}

export const sameName = (a: string, b: string) => !!a && !!b && keyOf(a) === keyOf(b);
