// Perhitungan untuk tampilan Performa: peringkat, aktivitas harian, streak, sorotan, kabar, misi, dan rute.
// Murni (tanpa DOM / tanpa akses jaringan) supaya bisa dipakai di server (snapshot peringkat) dan di HP.
import type { KonsumenFull, MaFull, Metric, Orang, Performa, Peringkat, VisitRow } from './performa-types';

export type BrandKey = 'semua' | 'mobilku' | 'motorku';
export type Period = 'bulan' | 'minggu';

export const METRICS: [Metric, string][] = [
  ['amount', 'Amount'], ['unit', 'Unit'], ['visit', 'Visit'], ['bertemu', 'Bertemu'], ['maintain', 'Maintain'],
];

/* ---------- Dasar ---------- */
export const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
export const keyOf = (s: string) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
export const isMet = (v: VisitRow) => /^bertemu$/i.test(String(v.st || '').trim());
export const brandOf = (o: Pick<Orang, 'brand'>): 'mobilku' | 'motorku' | '' => {
  const b = String(o.brand || '').toLowerCase();
  return b.includes('mobil') ? 'mobilku' : b.includes('motor') ? 'motorku' : '';
};
const inBrand = (b: string, brand: BrandKey) => brand === 'semua' || b === brand;

/* ---------- Tanggal (format yyyy-MM-dd, zona WIB) ---------- */
export const todayJkt = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
const toDate = (s: string) => new Date(s + 'T00:00:00Z');
const fmt = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
export const dayOfWeek = (s: string) => toDate(s).getUTCDay(); // 0 = Minggu
export const weekStart = (s: string) => addDays(s, -((dayOfWeek(s) + 6) % 7)); // Senin
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
const day10 = (s: string) => String(s || '').slice(0, 10);
const validDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ---------- Indeks aktivitas per orang ---------- */
export type VisitAct = { d: string; met: boolean; k: KonsumenFull; brand: 'mobilku' | 'motorku'; row: VisitRow };
export type MaintAct = { d: string; m: MaFull; brand: 'mobilku' | 'motorku' };
export type Acts = { visits: VisitAct[]; maint: MaintAct[] };

export type Ctx = {
  data: Performa;
  today: string;
  ref: string;            // hari terakhir yang ada aktivitasnya (data sheet sering telat 1–3 hari)
  acts: Map<string, Acts>;
  sales: Orang[];         // anggota yang ikut papan juara (punya data amount / unit)
};

export function buildCtx(data: Performa, today = todayJkt()): Ctx {
  const acts = new Map<string, Acts>();
  const get = (name: string) => {
    const k = keyOf(name);
    let a = acts.get(k);
    if (!a) { a = { visits: [], maint: [] }; acts.set(k, a); }
    return a;
  };
  let ref = '';
  const bump = (d: string) => { if (d <= today && d > ref) ref = d; };
  (['mobilku', 'motorku'] as const).forEach((brand) => {
    (data.aktivitas?.konsumen?.[brand] || []).forEach((k) => {
      k.v.forEach((row) => {
        const d = day10(row.tgl);
        if (!row.pic || !validDay(d)) return;
        get(row.pic).visits.push({ d, met: isMet(row), k, brand, row });
        bump(d);
      });
    });
    (data.aktivitas?.ma?.[brand] || []).forEach((m) => {
      if (!m.pic) return;
      (m.tgl || []).forEach((t) => {
        const d = day10(t);
        if (!validDay(d)) return;
        get(m.pic).maint.push({ d, m, brand });
        bump(d);
      });
    });
  });
  if (!ref) ref = validDay(day10(data.updated || '')) ? day10(data.updated || '') : today;
  const sales = (data.orang || []).filter((o) => o.amount || o.unit);
  return { data, today, ref, acts, sales };
}

export const actsOf = (c: Ctx, name: string): Acts => c.acts.get(keyOf(name)) || { visits: [], maint: [] };

/* ---------- Peringkat ---------- */
export type RankRow = {
  o: Orang; val: number | null; ach: number | null; // ach = isi bar 0..1 (persen target / relatif ke juara)
  pct: boolean;           // nilai berupa persen target
  rank: number;           // 0 kalau tidak ada nilai
  move: 'up' | 'down' | 'same' | 'new';
  moveBy: number;
};

function range(c: Ctx, period: Period): [string, string] {
  return period === 'minggu' ? [weekStart(c.ref), c.ref] : [c.ref.slice(0, 8) + '01', c.ref];
}

export function metricValue(c: Ctx, o: Orang, metric: Metric, period: Period = 'bulan'): number | null {
  if (metric === 'amount') return period === 'bulan' ? o.amount?.ach ?? null : null;
  if (metric === 'unit') return period === 'bulan' ? o.unit?.ach ?? null : null;
  const a = actsOf(c, o.nama);
  const [from, to] = range(c, period);
  const inR = (d: string) => d >= from && d <= to;
  if (metric === 'visit') {
    if (!o.visit && !a.visits.length) return null;
    return period === 'bulan' && o.visit ? o.visit.total : a.visits.filter((v) => inR(v.d)).length;
  }
  if (metric === 'bertemu') {
    if (!o.visit && !a.visits.length) return null;
    return period === 'bulan' && o.visit ? o.visit.ditemui : a.visits.filter((v) => v.met && inR(v.d)).length;
  }
  if (!o.maintain && !a.maint.length) return null;
  return a.maint.filter((m) => inR(m.d)).length;
}

export function ranking(c: Ctx, metric: Metric, period: Period = 'bulan', brand: BrandKey = 'semua'): RankRow[] {
  const pct = metric === 'amount' || metric === 'unit';
  const base = c.sales.filter((o) => inBrand(brandOf(o), brand))
    .map((o) => ({ o, val: metricValue(c, o, metric, period) }))
    .filter((x) => pct || x.val !== null);
  base.sort((a, b) => {
    if (a.val === null && b.val === null) return a.o.nama.localeCompare(b.o.nama);
    if (a.val === null) return 1;
    if (b.val === null) return -1;
    return b.val - a.val || a.o.nama.localeCompare(b.o.nama);
  });
  const top = Math.max(0, ...base.map((x) => x.val || 0));
  const prev = c.data.riwayat?.kemarin?.rank?.[metric];
  return base.map((x, i) => {
    const rank = x.val === null ? 0 : i + 1;
    const pi = prev ? prev.indexOf(keyOf(x.o.nama)) : -2;
    const move: RankRow['move'] = pi === -2 || !rank ? 'same' : pi === -1 ? 'new' : pi + 1 > rank ? 'up' : pi + 1 < rank ? 'down' : 'same';
    return {
      o: x.o, val: x.val, pct, rank, move, moveBy: pi >= 0 && rank ? Math.abs(pi + 1 - rank) : 0,
      ach: x.val === null ? null : pct ? x.val : top ? x.val / top : 0,
    };
  });
}

// Urutan nama per ukuran (bulan berjalan) — disimpan server tiap hari untuk panah naik/turun
export function rankSnapshot(data: Performa, today = todayJkt()): Peringkat {
  const c = buildCtx({ ...data, riwayat: undefined }, today);
  const out: Peringkat = {};
  METRICS.forEach(([m]) => { out[m] = ranking(c, m).filter((r) => r.rank).map((r) => keyOf(r.o.nama)); });
  return out;
}

// Pasangan berdekatan dengan selisih paling tipis (untuk kartu "Persaingan ketat")
export function rivalry(rows: RankRow[]) {
  let best: { up: RankRow; down: RankRow; gap: number } | null = null;
  for (let i = 1; i < rows.length; i++) {
    const up = rows[i - 1], down = rows[i];
    if (!isNum(up.val) || !isNum(down.val) || !up.rank || !down.rank) continue;
    const gap = up.val - down.val;
    if (!best || gap < best.gap) best = { up, down, gap };
  }
  return best;
}

/* ---------- Anggota yang sedang login ---------- */
export function findMe(data: Performa, perfName?: string | null, googleName?: string | null): Orang | null {
  const list = data.orang || [];
  if (perfName) {
    const k = keyOf(perfName);
    const hit = list.find((o) => keyOf(o.nama) === k) || list.find((o) => keyOf(o.nama).includes(k));
    if (hit) return hit;
  }
  const words = keyOf(googleName || '').split(' ').filter((w) => w.length >= 3);
  if (!words.length) return null;
  let best: Orang | null = null, score = 0, tie = false;
  list.forEach((o) => {
    const parts = keyOf(o.nama).split(' ');
    const s = words.filter((w) => parts.includes(w)).length;
    if (s > score) { best = o; score = s; tie = false; } else if (s && s === score) tie = true;
  });
  if (!best || tie) return null;
  return score >= 2 || (score === 1 && words.length === 1) ? best : null;
}

/* ---------- Streak: hari kerja (Senin–Sabtu) berturut-turut ada visit / maintain ---------- */
export function streak(c: Ctx, name: string): number {
  const a = actsOf(c, name);
  const days = new Set([...a.visits.map((v) => v.d), ...a.maint.map((m) => m.d)]);
  if (!days.size) return 0;
  const prevWork = (d: string) => { let x = addDays(d, -1); if (dayOfWeek(x) === 0) x = addDays(x, -1); return x; };
  let d = c.ref;
  if (dayOfWeek(d) === 0) d = prevWork(d);
  if (!days.has(d)) d = prevWork(d);   // hari terakhir belum diisi → mulai dari hari kerja sebelumnya
  let n = 0;
  while (days.has(d) && n < 400) { n++; d = prevWork(d); }
  return n;
}

/* ---------- Label waktu relatif ---------- */
export function relDay(c: Ctx, d: string): string {
  const n = daysBetween(d, c.today);
  if (n <= 0) return 'hari ini';
  if (n === 1) return 'kemarin';
  if (n < 7) return `${n} hr`;
  return new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/* ---------- Sorotan (ala story): aktivitas hari terakhir tiap anggota, maks. 7 hari ke belakang ---------- */
export type Story = {
  o: Orang; d: string; visits: VisitAct[]; met: number; maint: MaintAct[]; count: number;
  kec: [string, number][]; amountRank: number; amountMove: RankRow['move'];
};

export function stories(c: Ctx, brand: BrandKey = 'semua', me?: Orang | null): Story[] {
  const amount = ranking(c, 'amount');
  const out: Story[] = [];
  c.sales.filter((o) => inBrand(brandOf(o), brand)).forEach((o) => {
    const a = actsOf(c, o.nama);
    const last = [...a.visits.map((v) => v.d), ...a.maint.map((m) => m.d)].sort().pop();
    if (!last || daysBetween(last, c.today) > 7) return;
    const visits = a.visits.filter((v) => v.d === last);
    const maint = a.maint.filter((m) => m.d === last);
    const kc = new Map<string, number>();
    visits.forEach((v) => { const k = v.k.k || 'Tanpa kecamatan'; kc.set(k, (kc.get(k) || 0) + 1); });
    const r = amount.find((x) => x.o === o);
    out.push({
      o, d: last, visits, met: visits.filter((v) => v.met).length, maint, count: visits.length + maint.length,
      kec: [...kc].sort((x, y) => y[1] - x[1]), amountRank: r?.rank || 0, amountMove: r?.move || 'same',
    });
  });
  // Kamu paling depan, lalu yang terbaru & paling banyak aktivitasnya
  return out.sort((x, y) => (me && x.o === me ? -1 : me && y.o === me ? 1 : 0) || y.d.localeCompare(x.d) || y.count - x.count);
}

/* ---------- Kabar (feed otomatis) ---------- */
export type FeedItem =
  | { t: 'target'; key: string; d: string; o: Orang; what: 'amount' | 'unit'; ach: number; ini: number | null; target: number | null }
  | { t: 'naik'; key: string; d: string; o: Orang; from: number; to: number; metric: Metric }
  | { t: 'visit'; key: string; d: string; o: Orang; visits: VisitAct[]; met: VisitAct[] }
  | { t: 'maint'; key: string; d: string; o: Orang; maint: MaintAct[] }
  | { t: 'rekap'; key: string; d: string; juara: { label: string; o: Orang; n: number }[] };

export function feed(c: Ctx, brand: BrandKey = 'semua'): FeedItem[] {
  const items: FeedItem[] = [];
  const people = c.sales.filter((o) => inBrand(brandOf(o), brand));
  const upd = validDay(day10(c.data.updated || '')) ? day10(c.data.updated || '') : c.ref;
  const sent = validDay(day10(c.data.dikirim || '')) ? todayJkt(new Date(c.data.dikirim)) : c.today;

  people.forEach((o) => {
    (['amount', 'unit'] as const).forEach((w) => {
      const s = o[w];
      if (s && isNum(s.ach) && s.ach >= 1) items.push({ t: 'target', key: `t-${w}-${o.nama}`, d: upd, o, what: w, ach: s.ach, ini: s.ini, target: s.target });
    });
  });

  (['amount', 'unit', 'visit'] as Metric[]).forEach((m) => {
    ranking(c, m, 'bulan', 'semua').forEach((r) => {
      if (r.move === 'up' && r.rank && inBrand(brandOf(r.o), brand)) {
        items.push({ t: 'naik', key: `n-${m}-${r.o.nama}`, d: sent, o: r.o, from: r.rank + r.moveBy, to: r.rank, metric: m });
      }
    });
  });

  const from = addDays(c.ref, -6);
  people.forEach((o) => {
    const a = actsOf(c, o.nama);
    const byDay = new Map<string, VisitAct[]>();
    a.visits.filter((v) => v.d >= from).forEach((v) => byDay.set(v.d, [...(byDay.get(v.d) || []), v]));
    byDay.forEach((vs, d) => items.push({ t: 'visit', key: `v-${d}-${o.nama}`, d, o, visits: vs, met: vs.filter((v) => v.met) }));
    const mDay = new Map<string, MaintAct[]>();
    a.maint.filter((m) => m.d >= from).forEach((m) => mDay.set(m.d, [...(mDay.get(m.d) || []), m]));
    mDay.forEach((ms, d) => items.push({ t: 'maint', key: `m-${d}-${o.nama}`, d, o, maint: ms }));
  });

  // Juara minggu lalu (Senin–Sabtu sebelum minggu ini)
  const lwEnd = addDays(weekStart(c.ref), -1), lwStart = addDays(weekStart(c.ref), -7);
  const count = (o: Orang, f: (a: Acts) => number) => f(actsOf(c, o.nama));
  const inLw = (d: string) => d >= lwStart && d <= lwEnd;
  const juara: { label: string; o: Orang; n: number }[] = [];
  ([
    ['Visit terbanyak', (a: Acts) => a.visits.filter((v) => inLw(v.d)).length],
    ['Paling banyak bertemu', (a: Acts) => a.visits.filter((v) => v.met && inLw(v.d)).length],
    ['Maintain terbanyak', (a: Acts) => a.maint.filter((m) => inLw(m.d)).length],
  ] as [string, (a: Acts) => number][]).forEach(([label, f]) => {
    let best: Orang | null = null, n = 0;
    people.forEach((o) => { const x = count(o, f); if (x > n) { n = x; best = o; } });
    if (best) juara.push({ label, o: best, n });
  });
  if (juara.length) items.push({ t: 'rekap', key: `r-${lwStart}`, d: weekStart(c.ref), juara });

  const order: Record<FeedItem['t'], number> = { naik: 0, target: 1, rekap: 2, visit: 3, maint: 4 };
  return items.sort((a, b) => b.d.localeCompare(a.d) || order[a.t] - order[b.t]);
}

/* ---------- Konsumen prioritas: belum visit / perlu visit ulang ---------- */
export const konsumenOf = (data: Performa, brand: BrandKey) =>
  (brand === 'semua' ? (['mobilku', 'motorku'] as const) : [brand]).flatMap((b) =>
    (data.aktivitas?.konsumen?.[b] || []).map((k) => ({ k, brand: b })));

export const belumVisit = (k: KonsumenFull) => k.v.length === 0;
export const perluUlang = (k: KonsumenFull) => k.v.length > 0 && !k.v.some(isMet);

export type KecGroup = { kec: string; items: { k: KonsumenFull; brand: 'mobilku' | 'motorku' }[]; belum: number; ulang: number };
export function kecGroups(data: Performa, brand: BrandKey, mode: 'belum' | 'ulang', p = 0): KecGroup[] {
  const all = konsumenOf(data, brand).filter((x) => !p || x.k.p === p);
  const m = new Map<string, KecGroup>();
  all.forEach((x) => {
    const kec = String(x.k.k || '').trim() || 'Tanpa kecamatan';
    let g = m.get(kec.toUpperCase());
    if (!g) { g = { kec, items: [], belum: 0, ulang: 0 }; m.set(kec.toUpperCase(), g); }
    if (belumVisit(x.k)) g.belum++;
    if (perluUlang(x.k)) g.ulang++;
    if (mode === 'belum' ? belumVisit(x.k) : perluUlang(x.k)) g.items.push(x);
  });
  return [...m.values()].filter((g) => g.items.length)
    .sort((a, b) => (a.kec === 'Tanpa kecamatan' ? 1 : 0) - (b.kec === 'Tanpa kecamatan' ? 1 : 0) || b.items.length - a.items.length || a.kec.localeCompare(b.kec));
}

/* ---------- Badge ---------- */
export type Badge = { id: string; label: string; desc: string; holders: Orang[] };
export function badges(c: Ctx): Badge[] {
  const top = (m: Metric, period: Period = 'bulan') => {
    const r = ranking(c, m, period).filter((x) => x.rank && (x.val || 0) > 0);
    return r.length ? r.filter((x) => x.val === r[0].val).map((x) => x.o) : [];
  };
  return [
    { id: 'amount', label: 'Target tembus', desc: 'Amount ≥ 100%', holders: c.sales.filter((o) => (o.amount?.ach ?? 0) >= 1) },
    { id: 'unit', label: 'Unit tembus', desc: 'Unit ≥ 100%', holders: c.sales.filter((o) => (o.unit?.ach ?? 0) >= 1) },
    { id: 'visit', label: 'Rajin visit', desc: 'Visit terbanyak bulan ini', holders: top('visit') },
    { id: 'bertemu', label: 'Jago bertemu', desc: 'Paling banyak bertemu konsumen', holders: top('bertemu') },
    { id: 'maintain', label: 'Maintain lengkap', desc: 'Semua MA sudah dimaintain', holders: c.sales.filter((o) => o.maintain && o.maintain.ma > 0 && o.maintain.belum === 0) },
    { id: 'rekrut', label: 'Raja rekrut', desc: 'Rekrut MA capai target', holders: c.sales.filter((o) => { const r = o.rekrut?.rekrut; return !!r && !!r.target && r.jumlah >= r.target; }) },
  ];
}
