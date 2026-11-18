// Notifikasi HP "waktunya inject P3": dikirim sekali saat visit prioritas (P1–P3) sebuah brand baru mencapai 80%.
// Status terakhir per brand disimpan di tab STATUS_NOTIF supaya tidak terkirim ulang tiap 30 menit; setelah inject
// (data bertambah, persen turun di bawah 80%) notifikasi bisa terkirim lagi saat 80% berikutnya.
import { readRows, writeRows } from './sheet-store';
import { listSubs, sameName, sendMany } from './notif';
import { getAccessList } from './access';
import { brandOf, bulanData } from './performa-calc';
import { progresVisit } from './visit-progres';
import type { Performa } from './performa-types';

const TAB = 'STATUS_NOTIF';
const HEAD = ['KUNCI', 'NILAI', 'WAKTU'];
const LABEL = { mobilku: 'Mobilku', motorku: 'Motorku' } as const;
const persen = (x: number) => `${Math.round(x * 100)}%`;

export async function notifInjectP3(d: Performa): Promise<number> {
  const bln = bulanData(d) || String(d.updated || '').slice(0, 7);
  const brand = (['mobilku', 'motorku'] as const).map((b) => ({ b, x: progresVisit(d, b), kunci: `inject-p3|${b}` })).filter((y) => y.x.tot > 0);
  if (!brand.length) return 0;
  const rows = await readRows(TAB, HEAD);
  const lama = new Map(rows.map((r) => [r[0], r[1]]));
  const sekarang = brand.map((y) => ({ ...y, nilai: `${bln}|${y.x.waktunya ? 'atas' : 'bawah'}` }));
  const berubah = sekarang.filter((y) => lama.get(y.kunci) !== y.nilai);
  if (!berubah.length) return 0;
  const naik = berubah.filter((y) => y.x.waktunya);

  let terkirim = 0;
  if (naik.length) {
    const atasan = new Set([
      ...(process.env.OWNER_EMAIL || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
      ...(await getAccessList()).filter((a) => a.role === 'owner' || a.role === 'spv').map((a) => a.email.toLowerCase()),
    ]);
    const subs = await listSubs();
    for (const y of naik) {
      const r = await sendMany(subs, (s) => {
        const o = (d.orang || []).find((x) => sameName(x.nama, s.nama));
        if (!atasan.has(s.email.toLowerCase()) && !(o && brandOf(o) === y.b)) return null;
        return {
          title: `Waktunya inject P3 ${LABEL[y.b]}`,
          body: `Visit prioritas ${LABEL[y.b]} sudah ${persen(y.x.pct || 0)} (${y.x.sudah}/${y.x.tot} data). Ajukan konsumen baru di Saya › Inject P3.`,
          url: '/', tag: `inject-p3-${y.b}`,
        };
      });
      terkirim += r.terkirim;
      console.info('Notifikasi inject P3.', JSON.stringify({ brand: y.b, persen: y.x.pct, sudah: y.x.sudah, tot: y.x.tot, ...r }));
    }
  }
  const waktu = new Date().toISOString();
  const baru = new Map(rows.map((r) => [r[0], r]));
  for (const y of berubah) baru.set(y.kunci, [y.kunci, y.nilai, waktu]);
  await writeRows(TAB, HEAD, [...baru.values()]);
  return terkirim;
}
