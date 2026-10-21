// Memisahkan pencairan motor "sukarela" oleh orang Mobilku (CMO/MAO Mobilku yang ikut mencairkan motor).
// Tabel sales per PIC di pantauan menjumlah semua pencairan seseorang, termasuk motor. Rekap tarikan sales
// (salesBrand, dikirim Apps Script) memberi rincian per jenis kendaraan, jadi motor bisa dikeluarkan dari
// achievement Mobilku orang itu dan dicatat terpisah sebagai `sukarela`.
import type { Blok, Performa, Sales, SalesBrandOrang } from './performa-types';

const key = (s: unknown) => String(s ?? '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

export const samaNama = (a: string, b: string) => {
  const x = key(a), y = key(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // "RIZAL HIMAWAN" vs "MUHAMMAD RIZAL HIMAWAN": semua kata nama pendek ada di nama panjang
  const [p, q] = x.length <= y.length ? [x, y] : [y, x];
  const kata = new Set(q.split(' '));
  const w = p.split(' ');
  return w.length >= 2 && w.every((k) => kata.has(k));
};
export const cariSalesBrand = (list: SalesBrandOrang[] | undefined, nama: string) =>
  (list || []).find((s) => samaNama(s.nama, nama));

const kurangi = (s: Sales | undefined, n: number): Sales | undefined => {
  if (!s || !isNum(s.ini) || n <= 0) return s;
  const ini = Math.max(0, s.ini - n);
  return {
    ...s,
    ini,
    ach: isNum(s.target) && s.target > 0 ? ini / s.target : s.ach,
    diffLalu: isNum(s.lalu) ? ini - s.lalu : isNum(s.diffLalu) ? s.diffLalu - (s.ini - ini) : s.diffLalu,
    diffTarget: isNum(s.target) ? ini - s.target : isNum(s.diffTarget) ? s.diffTarget - (s.ini - ini) : s.diffTarget,
  };
};

const brandMobil = (b: unknown) => String(b ?? '').toLowerCase().includes('mobil');

export function pisahSukarela(data: Performa): Performa {
  const sb = data.salesBrand;
  if (!sb || !Array.isArray(sb.orang) || !sb.orang.length) return data;
  const list = sb.orang.map((o) => ({
    nama: String(o?.nama ?? '').trim(),
    mobilku: { unit: Number(o?.mobilku?.unit) || 0, amount: Number(o?.mobilku?.amount) || 0 },
    motorku: { unit: Number(o?.motorku?.unit) || 0, amount: Number(o?.motorku?.amount) || 0 },
  })).filter((o) => o.nama);

  // Pengaman: rekap harus bulan yang sama dengan pantauan (jumlah unit ≈ total cabang per brand).
  // Selisih kecil wajar (tab tarikan diperbarui terpisah dari pantauan), jadi toleransi 2 unit / 20%.
  const totU = list.reduce((s, o) => s + o.mobilku.unit + o.motorku.unit, 0);
  const cab = data.cabangTotal?.unit?.ini;
  if (isNum(cab) && Math.abs(totU - cab) > Math.max(2, cab * 0.2)) {
    return { ...data, salesBrand: { ...sb, orang: list, dipakai: false, alasan: `Rekap tarikan sales ${totU} unit, pantauan cabang ${cab} unit` } };
  }

  const orang = data.orang.map((o) => {
    if (o.sukarela || !brandMobil(o.brand)) return o;
    const s = cariSalesBrand(list, o.nama);
    const m = s?.motorku;
    if (!m || (m.unit <= 0 && m.amount <= 0)) return o;
    // Motor tidak boleh lebih besar dari yang tercatat di tabel per PIC
    const unit = isNum(o.unit?.ini) ? Math.min(m.unit, o.unit!.ini as number) : m.unit;
    const amount = isNum(o.amount?.ini) ? Math.min(m.amount, o.amount!.ini as number) : m.amount;
    return { ...o, unit: kurangi(o.unit, unit), amount: kurangi(o.amount, amount), sukarela: { unit, amount } };
  });
  return { ...data, orang, salesBrand: { ...sb, orang: list, dipakai: true, alasan: undefined } };
}

// Baris "Sales … per brand": label MOBILKU/MOTORKU (bulan lalu) atau MOBIL/MOTOR (mulai Oktober)
export const brandBaris = (v: unknown): 'mobilku' | 'motorku' | '' => {
  const t = String(v ?? '').toLowerCase().replace(/\s+/g, '');
  return t === 'mobilku' || t === 'mobil' ? 'mobilku' : t === 'motorku' || t === 'motor' ? 'motorku' : '';
};

/* ---------- Total cabang dari tabel "Sales … per brand" ---------- */
// Tabel sales per PIC hanya memuat nama yang terdaftar di tabel; pencairan lain (mis. SPV, CMO Motorku
// yang tidak lagi di tabel) hanya masuk tabel per brand. Total cabang diambil dari baris TOTAL tabel per brand.
const blokCabang = (data: Performa, judul: string): Blok | undefined =>
  (data.blok || []).find((b) => b.s === 'cabang' && String(b.t).toLowerCase() === judul);
const barisTotal = (b: Blok | undefined): Sales | null => {
  const r = b?.r.find((x) => /^(grand\s*)?total$/i.test(String(x[0] ?? '').trim()));
  if (!r || !isNum(r[3])) return null;
  const n = (v: unknown) => (isNum(v) ? v : null);
  return { lalu: n(r[2]), ini: r[3] as number, target: n(r[4]), ach: n(r[5]), diffLalu: n(r[6]), diffTarget: n(r[7]) };
};

/* ---------- Kolom "bulan lalu" di tabel per brand ---------- */
// Mulai Oktober kolom bulan lalu di tabel per brand bernilai 0. Diisi dari salesLalu (file pantauan bulan lalu,
// dikirim Apps Script); kalau tidak ada, Mobilku/Motorku dari jumlah bulan lalu orang di tabel per PIC.
export function isiBulanLalu(data: Performa): Performa {
  if (!data.blok?.length) return data;
  const dariOrang = (b: 'mobilku' | 'motorku', w: 'unit' | 'amount') => {
    const n = (data.orang || []).filter((o) => String(o.brand ?? '').toLowerCase().includes(b === 'mobilku' ? 'mobil' : 'motor'))
      .reduce((s, o) => s + (isNum(o[w]?.lalu) ? (o[w]!.lalu as number) : 0), 0);
    return n > 0 ? n : null;
  };
  const sumber = (k: 'mobilku' | 'motorku' | 'total', w: 'unit' | 'amount'): number | null => {
    const v = data.salesLalu?.[k]?.[w];
    if (isNum(v) && v > 0) return v;
    if (k !== 'total') return dariOrang(k, w);
    const a = sumber('mobilku', w), b = sumber('motorku', w);
    return a !== null && b !== null ? a + b : null;
  };
  let ubah = false;
  const blok = data.blok.map((bl) => {
    const t = String(bl.t).toLowerCase();
    const w = bl.s === 'cabang' && t === 'sales account per brand' ? 'unit' : bl.s === 'cabang' && t === 'sales amount per brand' ? 'amount' : null;
    if (!w) return bl;
    return { ...bl, r: bl.r.map((r) => {
      const k = brandBaris(r[0]) || (/^(grand\s*)?total$/i.test(String(r[0] ?? '').trim()) ? 'total' : '');
      if (!k || (isNum(r[2]) && r[2] !== 0)) return r;
      const v = sumber(k, w);
      if (v === null) {
        // Angka 0 untuk satu brand penuh hampir pasti kolom yang belum terisi: tampilkan kosong, bukan 0
        if (r[2] === 0 && isNum(r[3]) && (r[3] as number) > 0) { ubah = true; const x = [...r]; x[2] = null; x[6] = null; return x; }
        return r;
      }
      ubah = true;
      const x = [...r];
      x[2] = v;
      if (isNum(r[3])) x[6] = (r[3] as number) - v;
      return x;
    }) };
  });
  return ubah ? { ...data, blok } : data;
}

export function totalCabangPerBrand(data: Performa): Performa {
  const unit = barisTotal(blokCabang(data, 'sales account per brand'));
  const amount = barisTotal(blokCabang(data, 'sales amount per brand'));
  if (!unit && !amount) return data;
  const ct = data.cabangTotal || { unit: null, amount: null, oi: null };
  return { ...data, cabangTotal: { ...ct, unit: unit || ct.unit, amount: amount || ct.amount } };
}

// Dipakai saat menyimpan dan membaca data pantauan (aman dipanggil berulang)
export const rapikanPerforma = (data: Performa): Performa => pisahSukarela(totalCabangPerBrand(isiBulanLalu(data)));

/* ---------- Rincian pencairan Motorku per nama (untuk tab Motorku & laporan) ---------- */
export type RincianMotor = { nama: string; unit: number; amount: number; sukarela: boolean };
export function rincianMotor(data: Performa): RincianMotor[] {
  const sb = data.salesBrand;
  if (!sb || sb.dipakai === false || !Array.isArray(sb.orang)) return [];
  return sb.orang.filter((x) => x.motorku.unit > 0 || x.motorku.amount > 0).map((x) => {
    const o = (data.orang || []).find((p) => samaNama(x.nama, p.nama));
    return { nama: x.nama, unit: x.motorku.unit, amount: x.motorku.amount, sukarela: !!o?.sukarela && brandMobil(o.brand) };
  }).sort((a, b) => b.amount - a.amount);
}
