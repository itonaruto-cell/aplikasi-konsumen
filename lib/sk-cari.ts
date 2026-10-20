// Pencarian bagian SK yang paling relevan untuk sebuah pertanyaan (BM25 sederhana, tanpa layanan luar).
export type PotonganSK = { dok: string; judul: string; hal: number; bagian: string; isi: string };
export type Sumber = PotonganSK & { n: number };

const STOP = new Set(('yang dan di ke dari untuk dengan atau ini itu ada apa apakah bagaimana gimana gmn kalau kalo jika bila saya aku kita kami ' +
  'kamu bisa boleh harus akan sudah belum jadi juga lagi saja aja sih dong ya yg dgn utk tsb pada dalam oleh sebagai karena agar supaya mana siapa ' +
  'berapa kapan kenapa mengapa seperti tersebut nya the of to a an is').split(' '));

// Kata yang artinya sama → satu bentuk, supaya pertanyaan sehari-hari ketemu istilah di SK
const SAMA: Record<string, string> = {
  approve: 'approval', approved: 'approval', acc: 'approval', setuju: 'approval', persetujuan: 'approval', menyetujui: 'approval', disetujui: 'approval', wewenang: 'approval', kewenangan: 'approval',
  appeal: 'banding', kolek: 'kol', kolektibilitas: 'kol', slik: 'kol', bi: 'kol', checking: 'kol',
  mobil: 'mobil', mobilku: 'mobilku', motor: 'motor', motorku: 'motor', nb: 'motor',
  ktp: 'ktp', kk: 'kk', fotokopi: 'copy', fc: 'copy', salinan: 'copy',
  plafon: 'ltv', plafond: 'ltv', dp: 'ltv', pencairan: 'cair', dicairkan: 'cair', golive: 'cair',
  tolak: 'reject', ditolak: 'reject', penolakan: 'reject',
  usia: 'usia', umur: 'usia', tahun: 'th', thn: 'th', bulan: 'bln', bulanan: 'bln',
  angsuran: 'angsuran', cicilan: 'angsuran', installment: 'angsuran', penghasilan: 'penghasilan', gaji: 'penghasilan', income: 'penghasilan',
  telp: 'vertel', telepon: 'vertel', verifikasi_telepon: 'vertel', palsu: 'palsu', aspal: 'palsu', duplikat: 'duplikat',
};

export function akar(w: string) {
  if (/\d/.test(w) || w.length <= 4) return w;
  let s = w.replace(/(lah|kah|pun|nya)$/, '');
  if (s.length > 5) s = s.replace(/(kan|an)$/, '');
  for (const p of ['meng', 'meny', 'mem', 'men', 'peng', 'peny', 'pem', 'pen', 'ber', 'ter', 'me', 'pe', 'di', 'ke', 'se']) {
    if (s.startsWith(p) && s.length - p.length >= 4) { s = s.slice(p.length); break; }
  }
  return s;
}

export function kata(t: string): string[] {
  const out: string[] = [];
  const bersih = t.toLowerCase().replace(/rp\s?(\d)/g, 'rp$1').replace(/(\d)[.,](\d{3})/g, '$1$2');
  for (const raw of bersih.split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw)) continue;
    const w = SAMA[raw] || raw;
    out.push(akar(w));
  }
  return out;
}

type Indeks = { pot: PotonganSK[]; tf: Map<string, number>[]; len: number[]; df: Map<string, number>; rata: number };
export function buatIndeks(pot: PotonganSK[]): Indeks {
  const df = new Map<string, number>();
  const tf: Map<string, number>[] = [];
  const len: number[] = [];
  for (const p of pot) {
    // Judul bagian dihitung dua kali supaya berbobot lebih
    const ks = [...kata(p.isi), ...kata(p.bagian), ...kata(p.bagian), ...kata(p.judul)];
    const m = new Map<string, number>();
    for (const k of ks) m.set(k, (m.get(k) || 0) + 1);
    for (const k of m.keys()) df.set(k, (df.get(k) || 0) + 1);
    tf.push(m); len.push(ks.length);
  }
  return { pot, tf, len, df, rata: len.reduce((a, b) => a + b, 0) / Math.max(1, len.length) };
}

export function cari(ix: Indeks, q: string, n = 8): Sumber[] {
  const qs = [...new Set(kata(q))];
  if (!qs.length) return [];
  const N = ix.pot.length, k1 = 1.2, b = 0.75;
  const skor = ix.pot.map((_, i) => {
    let s = 0;
    for (const k of qs) {
      const f = ix.tf[i].get(k);
      if (!f) continue;
      const d = ix.df.get(k) || 0;
      const idf = Math.log(1 + (N - d + 0.5) / (d + 0.5));
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * ix.len[i] / ix.rata));
    }
    return { i, s };
  }).filter((x) => x.s > 0).sort((a, b2) => b2.s - a.s).slice(0, n);
  return skor.map((x, j) => ({ ...ix.pot[x.i], n: j + 1 }));
}
