// Mesin hitung insentif (BMH, CMO, MAO).
// Angka skema (bobot, tarif, tiering) TIDAK ditulis di kode: dibaca dari Environment Variable
// INSENTIF_SKEMA (JSON) di Vercel lewat /api/insentif, supaya bisa diganti tanpa mengubah aplikasi.
// Murni (tanpa DOM / jaringan) supaya bisa dipakai di server maupun di HP.

export type Jenis = 'bmh' | 'cmo' | 'mao' | 'maoBaru';

export type SkemaBMH = {
  bobot: { amount: number; unit: number };          // persen, jumlahnya 100
  batasAmount: [number, number, number];            // nilai amount (≥): mulai dapat, tingkat 2, tingkat 3
  batasUnit: [number, number, number];              // nilai unit: mulai dapat (≥), tingkat 2 (di atas), tingkat 3 (di atas)
  pengali: number[][];                              // [tingkat amount 1..3][tingkat unit 1..3]
  tarif: Record<string, number>;                    // rupiah per kategori cabang
  tengahBulan: { min: number; bonus: Record<string, number> };   // sales tgl 1–15 ÷ target amount
  nbq: number;                                      // faktor pembayaran, 0..1
};
export type SkemaCMO = {
  target: { amount: number; unit: number };
  bobot: { amount: number; unit: number };
  tier: { min: number; dasar: number; extra: number }[];   // min = total perf (%), urut naik
  perSurvey: number;
  nbq: number;
};
export type SkemaMAO = {
  target: { amount: number; unit: number; ma: number; maNonLeasing: number };
  bobot: { amount: number; unit: number; ma: number; maNonLeasing: number };
  tier: { min: number; pencari: number; extra: number }[]; // extra = bagian dari sales non aggregator (0.01 = 1%)
  perSurvey: number;
  maProduktif: { min: number; bonus: number }[];           // urut naik
  nbq: number;
};
export type Skema = { versi?: string; bmh?: SkemaBMH; cmo?: SkemaCMO; mao?: SkemaMAO; maoBaru?: SkemaMAO };

// Angka pencapaian satu orang (atau cabang, untuk BMH). Yang tidak dipakai skemanya diabaikan.
export type Masukan = {
  kategori: string;        // BMH: kategori cabang
  targetAmount: number;
  targetUnit: number;
  amount: number;
  unit: number;
  tengahBulan: number;     // BMH: sales tanggal 1–15
  survey: number;          // CMO & MAO
  ma: number;              // MAO: MA produktif
  maNonLeasing: number;    // MAO: MA produktif non leasing
  pencari: number;         // MAO: unit retail (non aggregator) = unit pencari order
  nonAggregator: number;   // MAO: sales retail / non aggregator (rupiah)
};

export type Baris = { label: string; nilai: number };
export type Hasil = {
  perf: number;            // total sales performance (%)
  bagian: Baris[];         // penyusun perf (%)
  rincian: Baris[];        // komponen insentif (rupiah), sebelum faktor NBQ
  kotor: number;
  nbq: number;
  total: number;           // setelah faktor NBQ
};

export const JENIS_LABEL: Record<Jenis, string> = { bmh: 'BMH', cmo: 'CMO', mao: 'MAO', maoBaru: 'MAO < 3 bln' };
export const KOSONG: Masukan = {
  kategori: '', targetAmount: 0, targetUnit: 0, amount: 0, unit: 0, tengahBulan: 0,
  survey: 0, ma: 0, maNonLeasing: 0, pencari: 0, nonAggregator: 0,
};

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const bagi = (a: number, b: number) => (b > 0 ? a / b : 0);
const ribuan = (v: number) => Math.round(v).toLocaleString('id-ID');
const tierOf = <T extends { min: number }>(tier: T[], v: number): T | null => {
  let hit: T | null = null;
  for (const t of tier) if (v >= t.min) hit = t;
  return hit;
};

/* ---------- Baca skema dari teks JSON ---------- */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export function parseSkema(text: string | undefined | null): Skema | null {
  if (!text) return null;
  try {
    const j: unknown = JSON.parse(text);
    if (!isObj(j)) return null;
    const out: Skema = {};
    if (typeof j.versi === 'string') out.versi = j.versi;
    if (isObj(j.bmh) && Array.isArray(j.bmh.pengali) && isObj(j.bmh.tarif)) out.bmh = j.bmh as unknown as SkemaBMH;
    if (isObj(j.cmo) && Array.isArray(j.cmo.tier) && isObj(j.cmo.target)) out.cmo = j.cmo as unknown as SkemaCMO;
    if (isObj(j.mao) && Array.isArray(j.mao.tier) && isObj(j.mao.target)) out.mao = j.mao as unknown as SkemaMAO;
    if (isObj(j.maoBaru) && Array.isArray(j.maoBaru.tier) && isObj(j.maoBaru.target)) out.maoBaru = j.maoBaru as unknown as SkemaMAO;
    return out.bmh || out.cmo || out.mao || out.maoBaru ? out : null;
  } catch {
    return null;
  }
}
export const adaJenis = (s: Skema | null, j: Jenis) => !!s && !!s[j];

/* ---------- Target bawaan skema (CMO & MAO targetnya tetap) ---------- */
export function targetBawaan(s: Skema, j: Jenis): Partial<Masukan> {
  if (j === 'cmo' && s.cmo) return { targetAmount: s.cmo.target.amount, targetUnit: s.cmo.target.unit };
  const m = j === 'mao' ? s.mao : j === 'maoBaru' ? s.maoBaru : undefined;
  if (m) return { targetAmount: m.target.amount, targetUnit: m.target.unit };
  return {};
}

/* ---------- Hitung ---------- */
function hitungBMH(k: SkemaBMH, m: Masukan): Hasil {
  const A = r6(bagi(m.amount, m.targetAmount) * k.bobot.amount);
  const U = r6(bagi(m.unit, m.targetUnit) * k.bobot.unit);
  const ta = A < k.batasAmount[0] ? 0 : A < k.batasAmount[1] ? 1 : A < k.batasAmount[2] ? 2 : 3;
  // Batas unit tingkat 2 dan 3 baru berlaku kalau nilainya DI ATAS batas (tepat di batas masih tingkat bawah)
  const tu = U < k.batasUnit[0] ? 0 : U <= k.batasUnit[1] ? 1 : U <= k.batasUnit[2] ? 2 : 3;
  const pengali = ta && tu ? k.pengali[ta - 1]?.[tu - 1] ?? 0 : 0;
  const tarif = k.tarif[m.kategori] ?? 0;
  const dasar = pengali * tarif;
  const tb = bagi(m.tengahBulan, m.targetAmount) >= k.tengahBulan.min ? k.tengahBulan.bonus[m.kategori] ?? 0 : 0;
  const kotor = dasar + tb;
  return {
    perf: r6(A + U),
    bagian: [{ label: 'Amount', nilai: A }, { label: 'Unit', nilai: U }],
    rincian: [
      { label: `Pengali ${String(pengali).replace('.', ',')} × tarif ${m.kategori || '–'}`, nilai: dasar },
      { label: 'Tengah bulan (tgl 1–15)', nilai: tb },
    ],
    kotor, nbq: k.nbq, total: kotor * k.nbq,
  };
}

function hitungCMO(k: SkemaCMO, m: Masukan): Hasil {
  const A = r6(bagi(m.amount, m.targetAmount || k.target.amount) * k.bobot.amount);
  const U = r6(bagi(m.unit, m.targetUnit || k.target.unit) * k.bobot.unit);
  const perf = r6(A + U);
  const t = tierOf(k.tier, perf);
  const dasar = t ? t.dasar : 0;
  const survey = t ? m.survey * k.perSurvey : 0;
  const extra = t ? t.extra : 0;
  const kotor = dasar + survey + extra;
  return {
    perf,
    bagian: [{ label: 'Amount', nilai: A }, { label: 'Unit', nilai: U }],
    rincian: [
      { label: 'Insentif CMO', nilai: dasar },
      { label: `Survey ${m.survey} × ${ribuan(k.perSurvey)}`, nilai: survey },
      { label: 'Extra insentif', nilai: extra },
    ],
    kotor, nbq: k.nbq, total: kotor * k.nbq,
  };
}

function hitungMAO(k: SkemaMAO, m: Masukan): Hasil {
  const A = r6(bagi(m.amount, m.targetAmount || k.target.amount) * k.bobot.amount);
  const U = r6(bagi(m.unit, m.targetUnit || k.target.unit) * k.bobot.unit);
  const MA = r6(Math.min(bagi(m.ma, k.target.ma), 1) * k.bobot.ma);
  const NL = r6(Math.min(bagi(m.maNonLeasing, k.target.maNonLeasing), 1) * k.bobot.maNonLeasing);
  const perf = r6(A + U + MA + NL);
  const t = tierOf(k.tier, perf);
  const tarifPencari = t ? t.pencari : k.tier[0]?.pencari ?? 0;
  const pencari = t ? m.pencari * t.pencari : 0;
  const survey = t ? m.survey * k.perSurvey : 0;
  const extra = t ? m.nonAggregator * t.extra : 0;
  const ma = t ? tierOf(k.maProduktif, m.ma)?.bonus ?? 0 : 0;
  const kotor = pencari + survey + extra + ma;
  return {
    perf,
    bagian: [{ label: 'Amount', nilai: A }, { label: 'Unit', nilai: U }, { label: 'MA', nilai: r6(MA + NL) }],
    rincian: [
      { label: `Pencari order ${m.pencari} unit retail × ${ribuan(tarifPencari)}`, nilai: pencari },
      { label: `Survey ${m.survey} × ${ribuan(k.perSurvey)}`, nilai: survey },
      { label: `Extra ${String(Math.round((t ? t.extra : 0) * 1e4) / 100).replace('.', ',')}% × sales retail`, nilai: extra },
      { label: `MA produktif (${m.ma} MA)`, nilai: ma },
    ],
    kotor, nbq: k.nbq, total: kotor * k.nbq,
  };
}

export function hitung(s: Skema, j: Jenis, m: Masukan): Hasil | null {
  if (j === 'bmh') return s.bmh ? hitungBMH(s.bmh, m) : null;
  if (j === 'cmo') return s.cmo ? hitungCMO(s.cmo, m) : null;
  const k = j === 'mao' ? s.mao : s.maoBaru;
  return k ? hitungMAO(k, m) : null;
}

// Skema yang sama dengan faktor NBQ diganti (untuk simulasi)
export function denganNbq(s: Skema, j: Jenis, nbq: number): Skema {
  const k = s[j];
  return k ? ({ ...s, [j]: { ...k, nbq } } as Skema) : s;
}

/* ---------- Simulasi ---------- */
// unit / amount = tambahan biasa; untuk MAO berarti sales RETAIL (non aggregator).
// unitAgg / amountAgg = tambahan dari MA aggregator (hanya MAO).
export type Tambahan = { unit: number; amount: number; ma: number; unitAgg?: number; amountAgg?: number };
// Unit tambahan dihitung ikut disurvey (CMO & MAO).
// MAO: sales aggregator ikut menaikkan performa dan insentif survey, tetapi insentif pencari order dan
// extra insentif hanya dihitung dari sales retail.
export function tambah(j: Jenis, m: Masukan, x: Tambahan): Masukan {
  const mao = j === 'mao' || j === 'maoBaru';
  const uAgg = mao ? x.unitAgg || 0 : 0, aAgg = mao ? x.amountAgg || 0 : 0;
  return {
    ...m,
    unit: m.unit + x.unit + uAgg,
    amount: m.amount + x.amount + aAgg,
    survey: j === 'bmh' ? m.survey : m.survey + x.unit + uAgg,
    ma: m.ma + x.ma,
    pencari: mao ? m.pencari + x.unit : m.pencari,
    nonAggregator: mao ? m.nonAggregator + x.amount : m.nonAggregator,
  };
}

// Langkah terdekat supaya insentif naik: tambah amount saja, atau tambah unit saja (MAO: dihitung sebagai sales retail)
export function langkahNaik(s: Skema, j: Jenis, m: Masukan) {
  const kini = hitung(s, j, m);
  if (!kini) return { amount: null, unit: null };
  let amount: { tambah: number; total: number } | null = null;
  for (let k = 1; k <= 3000 && !amount; k++) {
    const h = hitung(s, j, tambah(j, m, { unit: 0, amount: k * 1e6, ma: 0 }));
    if (h && h.total > kini.total + 1) amount = { tambah: k * 1e6, total: h.total };
  }
  let unit: { tambah: number; total: number } | null = null;
  for (let k = 1; k <= 20 && !unit; k++) {
    const h = hitung(s, j, tambah(j, m, { unit: k, amount: 0, ma: 0 }));
    if (h && h.total > kini.total + 1) unit = { tambah: k, total: h.total };
  }
  return { amount, unit };
}

// Butuh berapa unit lagi untuk insentif sekian; tiap unit dihitung senilai `perUnit` rupiah
export function butuhUntuk(s: Skema, j: Jenis, m: Masukan, target: number, perUnit: number, maks = 40) {
  for (let k = 0; k <= maks; k++) {
    const h = hitung(s, j, tambah(j, m, { unit: k, amount: k * perUnit, ma: 0 }));
    if (h && h.total >= target) return { unit: k, hasil: h };
  }
  return null;
}

// Batas atas skema (hanya BMH yang punya plafon)
export function plafon(s: Skema, j: Jenis, m: Masukan): number | null {
  if (j !== 'bmh' || !s.bmh) return null;
  const k = s.bmh;
  const top = Math.max(0, ...k.pengali.flat());
  const tb = bagi(m.tengahBulan, m.targetAmount) >= k.tengahBulan.min ? k.tengahBulan.bonus[m.kategori] ?? 0 : 0;
  return (top * (k.tarif[m.kategori] ?? 0) + tb) * k.nbq;
}
