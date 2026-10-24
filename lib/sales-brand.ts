// Memisahkan pencairan motor "sukarela" oleh orang Mobilku (CMO/MAO Mobilku yang ikut mencairkan motor).
// Tabel sales per PIC di pantauan menjumlah semua pencairan seseorang, termasuk motor. Rekap tarikan sales
// (salesBrand, dikirim Apps Script) memberi rincian per jenis kendaraan, jadi motor bisa dikeluarkan dari
// achievement Mobilku orang itu dan dicatat terpisah sebagai `sukarela`.
import type { Blok, Performa, Sales, SalesBrandOrang } from './performa-types';
import { namaPengisi } from './posisi-isi';

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
// Untuk PIC survey: sama seperti samaNama, ditambah nama satu kata ("YOGA") yang ada di nama lain ("YOGA PRATAMA")
const KATA_UMUM = /^(MUHAMMAD|MUHAMAD|MOHAMMAD|MOH|MOCH|M|AHMAD|NUR|SITI|DWI|TRI|EKA)$/;
export const samaOrang = (a: string, b: string) => {
  const x = key(a), y = key(b);
  if (!x || !y) return false;
  if (x === y || samaNama(a, b)) return true;
  const [p, q] = x.length <= y.length ? [x, y] : [y, x];
  return !p.includes(' ') && p.length >= 3 && !KATA_UMUM.test(p) && q.split(' ').includes(p);
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
  return { lalu: n(r[2]), ini: r[3] as number, target: n(r[4]), ach: n(r[5]), diffLalu: n(r[6]), diffTarget: n(r[7]), laluPenuh: n(r[8]) };
};

/* ---------- Posisi kosong yang sudah ada orangnya ---------- */
// Baris "MAO MOTOR" / "CMO MOTORKU" di pantauan diganti nama pengisinya (lib/posisi-isi.ts),
// di daftar orang dan di tabel blok.
export function isiPosisiKosong(data: Performa): Performa {
  let ubah = false;
  // Angka bulan ini di baris posisi kosong biasanya 0 (rumus sheet mencari nama posisi). Kalau rekap tarikan sales
  // punya tepat satu nama yang cocok, pakai unit & amount brand posisi itu dari rekap tarikan.
  const rekap = (data.salesBrand?.orang || []).filter((x) => x && x.nama);
  const isiDariRekap = (s: Sales | undefined, v: number | undefined): Sales | undefined => {
    if (!s || !isNum(v) || v <= 0 || (isNum(s.ini) && s.ini > 0)) return s;
    return { ...s, ini: v, ach: isNum(s.target) && s.target > 0 ? v / s.target : s.ach,
      diffLalu: isNum(s.lalu) ? v - s.lalu : s.diffLalu, diffTarget: isNum(s.target) ? v - s.target : s.diffTarget };
  };
  const orang = (data.orang || []).map((o) => {
    const n = namaPengisi(o.nama);
    if (!n) return o;
    ubah = true;
    const cocok = rekap.filter((x) => samaOrang(x.nama, n));
    const jual = cocok.length === 1 ? cocok[0][/MOTOR/i.test(o.nama) ? 'motorku' : 'mobilku'] : undefined;
    return { ...o, nama: n, unit: isiDariRekap(o.unit, Number(jual?.unit)), amount: isiDariRekap(o.amount, Number(jual?.amount)) };
  });
  const blok = data.blok?.map((b) => {
    if (!b.r.some((r) => namaPengisi(r[0]))) return b;
    ubah = true;
    return { ...b, r: b.r.map((r) => { const n = namaPengisi(r[0]); return n ? [n, ...r.slice(1)] : r; }) };
  });
  return ubah ? { ...data, orang, ...(blok ? { blok } : {}) } : data;
}

/* ---------- Kolom "bulan lalu" per orang ---------- */
// salesLalu.orang (tabel per PIC di file pantauan bulan lalu, kolom bulan itu = sebulan penuh) → laluPenuh.
// Kolom sheet (bulan lalu s.d. tanggal yang sama) tetap di lalu; kalau kosong / 0, diisi angka sebulan penuh.
export function isiLaluOrang(data: Performa): Performa {
  const daftar = data.salesLalu?.orang;
  if (!daftar?.length || !data.orang?.length) return data;
  // Nama satu kata (mis. "RIZAL") hanya dipakai kalau tepat satu orang di pantauan memuat kata itu
  const UMUM = /^(MUHAMMAD|MUHAMAD|MOHAMMAD|MOH|MOCH|M|AHMAD|NUR|SITI|DWI|TRI|EKA|CMO|MAO|MOBILKU|MOTORKU|MOBIL|MOTOR)$/;
  const satuKata = (d: string, o: string) => {
    const w = key(d);
    if (!w || w.includes(' ') || w.length < 3 || UMUM.test(w)) return false;
    const punya = (n: string) => key(n).split(' ').includes(w);
    return punya(o) && data.orang.filter((x) => punya(x.nama)).length === 1;
  };
  let ubah = false;
  const orang = data.orang.map((o) => {
    const x = daftar.find((d) => samaNama(d.nama, o.nama)) || daftar.find((d) => satuKata(d.nama, o.nama));
    if (!x) return o;
    let baru = o;
    for (const w of ['unit', 'amount'] as const) {
      const s = baru[w], v = x[w];
      if (!s || !isNum(v)) continue;
      const kosong = !isNum(s.lalu) || s.lalu === 0;
      if (!kosong && s.laluPenuh === v) continue;
      baru = { ...baru, [w]: kosong
        ? { ...s, lalu: v, laluPenuh: v, diffLalu: isNum(s.ini) ? s.ini - v : s.diffLalu }
        : { ...s, laluPenuh: v } };
      ubah = true;
    }
    return baru;
  });
  return ubah ? { ...data, orang } : data;
}

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
  // Angka sebulan penuh dari file pantauan bulan lalu (disimpan di kolom ke-9 baris tabel = laluPenuh)
  const dariFile = (k: 'mobilku' | 'motorku' | 'total', w: 'unit' | 'amount'): number | null => {
    const v = data.salesLalu?.[k]?.[w];
    if (isNum(v) && v > 0) return v;
    if (k !== 'total') return null;
    const a = dariFile('mobilku', w), b = dariFile('motorku', w);
    return a !== null && b !== null ? a + b : null;
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
    return { ...bl, r: bl.r.map((r0) => {
      const k = brandBaris(r0[0]) || (/^(grand\s*)?total$/i.test(String(r0[0] ?? '').trim()) ? 'total' : '');
      if (!k) return r0;
      const f = dariFile(k, w);
      let r = r0;
      if (f !== null && r[8] !== f) { r = [...r]; while (r.length < 8) r.push(null); r[8] = f; ubah = true; }
      if (isNum(r[2]) && r[2] !== 0) return r;
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
export const rapikanPerforma = (data: Performa): Performa => pisahSukarela(totalCabangPerBrand(isiBulanLalu(isiLaluOrang(isiPosisiKosong(data)))));

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

/* ---------- Keterangan bulan lalu ---------- */
// "s.d. 23 Sep" (bulan lalu sampai tanggal yang sama dengan data) dan "Sep penuh" (sebulan penuh)
const BLN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export function labelLalu(updated?: string | null): { sama: string; penuh: string } {
  const d = updated && /^\d{4}-\d{2}-\d{2}/.test(updated) ? new Date(updated.slice(0, 10) + 'T00:00:00Z') : null;
  if (!d || isNaN(d.getTime())) return { sama: 's.d. tgl sama', penuh: 'sebulan penuh' };
  const pm = (d.getUTCMonth() + 11) % 12, py = d.getUTCMonth() === 0 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
  const akhir = new Date(Date.UTC(py, pm + 1, 0)).getUTCDate();
  return { sama: `s.d. ${Math.min(d.getUTCDate(), akhir)} ${BLN_PENDEK[pm]}`, penuh: `${BLN_PENDEK[pm]} penuh` };
}

// Rupiah bulan lalu: miliaran 3 desimal (Rp 1,154 M) supaya cocok dengan angka di file; di bawahnya ringkas (Rp 993,3 jt)
export function rpLalu(v: number): string {
  const a = Math.abs(v), t = v < 0 ? '−' : '';
  if (a >= 1e9) return `${t}Rp ${(a / 1e9).toFixed(3).replace(/\.?0+$/, '').replace('.', ',')} M`;
  return `${t}Rp ${new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(a)}`;
}
