// Memperbarui database konsumen (tab Sheet1) dari tab lain di file yang sama:
//  - tab KA (mis. "KA OKTOBER") dan tab SALES (mis. "SALES SEPT-OKT"): kontrak yang belum ada di Sheet1
//    ditambahkan sebagai baris baru, kolomnya diisi sesuai judul kolom Sheet1.
//  - tab MAPS (nama + link maps / titik koordinat / alamat): mengisi kolom MAPS atau ALAMAT yang masih kosong.
// Hanya MENAMBAH baris dan MENGISI sel kosong; isi yang sudah ada tidak pernah ditimpa.
// Fungsi di sini murni (tanpa Google API) supaya bisa diuji; pembacaan & penulisan ada di route.

import { rapikanKontrak } from './koreksi-konsumen';

export type Grid = unknown[][];
export type Sumber = 'ka' | 'sales';
export type Jenis = 'mobil' | 'motor' | '';
export type BarisBaru = { nilai: string[]; nama: string; kontrak: string; jenis: Jenis; sumber: Sumber[] };
export type IsiSel = { baris: number; kolom: number; nilai: string; nama: string; jenisIsi: 'maps' | 'alamat' | 'lengkapi' };
export type Rencana = {
  head: string[];
  baru: BarisBaru[];
  isi: IsiSel[];
  maps: { cocok: number; sudahAda: number; tidakKetemu: string[]; ragu: string[] };
  tab: { ka: string[]; sales: string[]; maps: string | null };
};

const teks = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const kosong = (v: unknown) => { const t = teks(v); return !t || t === '-' || t === '0'; };
const H = (v: unknown) => teks(v).toUpperCase();
export const kunciNama = (v: unknown) => H(v).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const angkaId = (v: unknown) => {
  const n = Number(teks(v).replace(/[^\d.-]/g, ''));
  return isFinite(n) && n > 0 ? Math.round(n).toLocaleString('id-ID') : '';
};
export const rapikanHp = (v: unknown) => {
  let d = teks(v).replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  else if (d.startsWith('8')) d = '0' + d;
  return d.length >= 9 && d.length <= 15 ? d : '';
};
const nilaiAtau = (v: unknown) => (kosong(v) ? '' : teks(v));

/* ---------- Mengenali tab ---------- */
// Baris judul = baris pertama (dari 6 teratas) yang memuat kolom kunci
function cariJudul(g: Grid, wajib: string[]): number {
  for (let r = 0; r < Math.min(6, g.length); r++) {
    const h = (g[r] || []).map(H);
    if (wajib.every((w) => h.includes(w))) return r;
  }
  return -1;
}
export const jenisTab = (g: Grid): Sumber | null =>
  cariJudul(g, ['NO KONTRAK', 'ID KONSUMEN']) >= 0 ? 'ka'
    : cariJudul(g, ['NO KONTRAK', 'NAMA COSTUMER']) >= 0 || cariJudul(g, ['NO KONTRAK', 'NAMA CUSTOMER']) >= 0 ? 'sales' : null;

type Rec = Record<string, string>;
function bacaTab(g: Grid, wajib: string[]): Rec[] {
  const r0 = cariJudul(g, wajib);
  if (r0 < 0) return [];
  const head = (g[r0] || []).map(H);
  return g.slice(r0 + 1).map((row) => {
    const o: Rec = {};
    head.forEach((h, i) => { if (h && !(h in o)) o[h] = teks((row || [])[i]); });
    return o;
  }).filter((o) => Object.values(o).some(Boolean));
}

/* ---------- Data per kontrak dari KA & SALES ---------- */
type Kontrak = {
  kontrak: string; nama: string; cust: string; kel: string; kec: string; hp: string; tenor: string; angs: string;
  produk: string; merk: string; tipe: string; tahun: string; nopol: string; milik: string; ltv: string; alamat: string;
  jenis: Jenis; sumber: Sumber[];
};
const jenisDari = (...v: string[]): Jenis => {
  const t = v.map(H).join(' ');
  return /\bMOBIL/.test(t) ? 'mobil' : /\bMOTOR/.test(t) ? 'motor' : '';
};
const dariKa = (o: Rec): Kontrak => ({
  kontrak: rapikanKontrak(o['NO KONTRAK']), nama: H(o['NAMA KONSUMEN']), cust: nilaiAtau(o['ID KONSUMEN']),
  kel: nilaiAtau(o['KELURAHAN']), kec: nilaiAtau(o['KECAMATAN']), hp: rapikanHp(o['NO HP KONSUMEN']),
  tenor: nilaiAtau(o['TENOR']), angs: angkaId(o['NOMINAL ANGS']), produk: '', merk: nilaiAtau(o['NAMA MERK']),
  tipe: nilaiAtau(o['TIPE KENDARAAN RINCI']), tahun: '', nopol: nilaiAtau(o['NO POLISI']), milik: '', ltv: '',
  alamat: nilaiAtau(o['ALAMAT KONSUMEN']), jenis: jenisDari(o['TIPE BARANG']), sumber: ['ka'],
});
const dariSales = (o: Rec): Kontrak => ({
  kontrak: rapikanKontrak(o['NO KONTRAK']), nama: H(o['NAMA COSTUMER'] || o['NAMA CUSTOMER']),
  cust: nilaiAtau(o['COSTUMER NO'] || o['CUSTOMER NO']), kel: nilaiAtau(o['KELURAHAN']), kec: nilaiAtau(o['KECAMATAN']),
  hp: rapikanHp(o['NO HP'] || o['NO HP KONSUMEN']), tenor: nilaiAtau(o['TENOR']), angs: angkaId(o['NOMINAL ANGS']),
  produk: nilaiAtau(o['NAMA PRODUK']), merk: nilaiAtau(o['NAMA MERK']), tipe: nilaiAtau(o['TIPE KENDARAAN RINCI']),
  tahun: nilaiAtau(o['THN KENDARAAN']), nopol: nilaiAtau(o['NO POLISI']), milik: nilaiAtau(o['HUBUNGAN PEMILIK BPKB']),
  ltv: nilaiAtau(o['LTV %'] || o['LTV']), alamat: '', jenis: jenisDari(o['TIPE KENDARAAN'], o['NAMA PRODUK']), sumber: ['sales'],
});
// Gabungkan dua catatan kontrak yang sama: isi yang kosong dilengkapi dari yang lain
function gabung(a: Kontrak, b: Kontrak): Kontrak {
  const x = { ...a } as Record<string, unknown>;
  for (const [k, v] of Object.entries(b)) {
    if (k === 'sumber') continue;
    if (!x[k] && v) x[k] = v;
  }
  return { ...(x as Kontrak), sumber: [...new Set([...a.sumber, ...b.sumber])] };
}

/* ---------- MAPS: link / koordinat / alamat ---------- */
const KOORD = /^(-?\d{1,2}\.\d{2,})\s*,\s*(-?\d{1,3}\.\d{2,})$/;
export function bacaLokasi(v: string): { jenis: 'maps' | 'alamat'; nilai: string } | null {
  const t = teks(v);
  if (!t || t === '-') return null;
  if (/^https?:\/\//i.test(t) || /(maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps)/i.test(t)) return { jenis: 'maps', nilai: t };
  const k = t.match(KOORD);
  if (k) return { jenis: 'maps', nilai: `https://www.google.com/maps?q=${k[1]},${k[2]}` };
  return { jenis: 'alamat', nilai: t };
}
// Satu baris tab MAPS: sel pertama yang berisi = nama, sel terakhir yang berisi = lokasi.
// Koordinat yang terpecah di dua sel ("-7.07" | "109.88") digabung.
function barisMaps(row: unknown[]): { nama: string; lokasi: string } | null {
  const isi = (row || []).map(teks).filter(Boolean);
  if (isi.length < 2) return null;
  const nama = isi[0];
  let lokasi = isi[isi.length - 1];
  if (isi.length >= 3 && /^-?\d{1,3}\.\d+$/.test(lokasi) && /^-?\d{1,2}\.\d+$/.test(isi[isi.length - 2])) lokasi = `${isi[isi.length - 2]},${lokasi}`;
  if (/^COLUMN \d+$/i.test(nama) || /^NAMA/i.test(nama)) return null;   // baris judul
  return { nama, lokasi };
}

/* ---------- Rencana ---------- */
export function rencanakan(sheet1: Grid, tabs: { nama: string; grid: Grid }[], opsi: { motor: boolean }): Rencana {
  const head = (sheet1[0] || []).map(teks);
  const HU = head.map((h) => h.toUpperCase());
  const ci = (...n: string[]) => { for (const x of n) { const i = HU.indexOf(x); if (i >= 0) return i; } return -1; };
  const C = {
    nama: ci('NAMA KONSUMEN', 'NAMA'), kontrak: ci('ORDER_NO', 'ORDER NO', 'NO KONTRAK'), cust: ci('ID CUST', 'CUST NO'),
    kel: ci('KELURAHAN'), kec: ci('KECAMATAN'), hp: ci('NO HP'), tenor: ci('TENOR'), angs: ci('ANGSURAN'), produk: ci('PRODUK'),
    merk: ci('BRAND UNIT'), tipe: ci('TYPE UNIT DETAIL', 'TYPE UNIT'), tahun: ci('TAHUN UNIT'), nopol: ci('NOPOL'),
    milik: ci('KEPEMILIKAN UNIT'), ltv: ci('LTV'), maps: ci('MAPS'), alamat: ci('ALAMAT'),
  };
  const rows = sheet1.slice(1).map((r) => head.map((_, i) => teks((r || [])[i])));
  const sel = (r: string[], i: number) => (i >= 0 ? r[i] || '' : '');

  // Yang sudah ada di Sheet1
  const adaKontrak = new Set(rows.map((r) => rapikanKontrak(sel(r, C.kontrak))).filter(Boolean));
  // Baris lama yang nomor kontraknya rusak/terpotong: dikenali dari nama + nopol
  const adaNamaNopol = new Set(rows.filter((r) => !/^\d{8,}$/.test(rapikanKontrak(sel(r, C.kontrak))))
    .map((r) => `${kunciNama(sel(r, C.nama))}|${H(sel(r, C.nopol)).replace(/\s/g, '')}`));
  // Data pribadi per cust no (untuk melengkapi kontrak baru pelanggan lama)
  const perCust = new Map<string, string[]>();
  rows.forEach((r) => { const c = H(sel(r, C.cust)); if (c) perCust.set(c, r); });

  // Kontrak dari tab KA & SALES
  const tab = { ka: [] as string[], sales: [] as string[], maps: null as string | null };
  const semua = new Map<string, Kontrak>();
  for (const t of tabs) {
    if (H(t.nama) === 'MAPS') { tab.maps = t.nama; continue; }
    const j = jenisTab(t.grid);
    if (!j) continue;
    tab[j].push(t.nama);
    const list = j === 'ka' ? bacaTab(t.grid, ['NO KONTRAK', 'ID KONSUMEN']).map(dariKa)
      : bacaTab(t.grid, ['NO KONTRAK']).map(dariSales);
    for (const k of list) {
      if (!/^\d{8,}$/.test(k.kontrak) || !k.nama) continue;
      semua.set(k.kontrak, semua.has(k.kontrak) ? gabung(semua.get(k.kontrak)!, k) : k);
    }
  }

  const baru: BarisBaru[] = [];
  for (const k of semua.values()) {
    if (adaKontrak.has(k.kontrak)) continue;
    if (adaNamaNopol.has(`${kunciNama(k.nama)}|${H(k.nopol).replace(/\s/g, '')}`) && k.nopol) continue;
    if (k.jenis === 'motor' && !opsi.motor) continue;
    const lama = perCust.get(H(k.cust));
    const nilai = head.map(() => '');
    const set = (i: number, v: string) => { if (i >= 0 && v) nilai[i] = v; };
    set(C.nama, k.nama); set(C.kontrak, k.kontrak); set(C.cust, k.cust);
    set(C.kel, k.kel || sel(lama || [], C.kel)); set(C.kec, k.kec || sel(lama || [], C.kec));
    set(C.hp, k.hp || sel(lama || [], C.hp)); set(C.tenor, k.tenor); set(C.angs, k.angs); set(C.produk, k.produk);
    set(C.merk, k.merk); set(C.tipe, k.tipe); set(C.tahun, k.tahun); set(C.nopol, k.nopol); set(C.milik, k.milik);
    set(C.ltv, k.ltv); set(C.maps, sel(lama || [], C.maps)); set(C.alamat, k.alamat || sel(lama || [], C.alamat));
    baru.push({ nilai, nama: k.nama, kontrak: k.kontrak, jenis: k.jenis, sumber: k.sumber });
  }

  // Lengkapi sel kosong di baris lama dari KA/SALES dengan kontrak yang sama
  const isi: IsiSel[] = [];
  rows.forEach((r, i) => {
    const k = semua.get(rapikanKontrak(sel(r, C.kontrak)));
    if (!k) return;
    const pasang: [number, string][] = [[C.kel, k.kel], [C.kec, k.kec], [C.hp, k.hp], [C.tenor, k.tenor], [C.angs, k.angs],
      [C.produk, k.produk], [C.merk, k.merk], [C.tipe, k.tipe], [C.tahun, k.tahun], [C.nopol, k.nopol], [C.milik, k.milik],
      [C.ltv, k.ltv], [C.alamat, k.alamat]];
    for (const [c, v] of pasang) if (c >= 0 && v && kosong(r[c])) isi.push({ baris: i + 2, kolom: c, nilai: v, nama: sel(r, C.nama), jenisIsi: 'lengkapi' });
  });

  // MAPS → kolom MAPS / ALAMAT yang masih kosong
  const maps = { cocok: 0, sudahAda: 0, tidakKetemu: [] as string[], ragu: [] as string[] };
  const mapsGrid = tabs.find((t) => t.nama === tab.maps)?.grid || [];
  if (mapsGrid.length && (C.maps >= 0 || C.alamat >= 0)) {
    // nama → baris (lama: nomor baris sheet; baru: indeks di `baru`)
    const lamaPerNama = new Map<string, number[]>();
    rows.forEach((r, i) => { const k = kunciNama(sel(r, C.nama)); if (k) lamaPerNama.set(k, [...(lamaPerNama.get(k) || []), i]); });
    const baruPerNama = new Map<string, number[]>();
    baru.forEach((b, i) => { const k = kunciNama(b.nama); baruPerNama.set(k, [...(baruPerNama.get(k) || []), i]); });
    const custOf = (k: string) => new Set([
      ...(lamaPerNama.get(k) || []).map((i) => H(sel(rows[i], C.cust)) || `#${i}`),
      ...(baruPerNama.get(k) || []).map((i) => H(sel(baru[i].nilai, C.cust)) || `b${i}`),
    ]);
    const sudah = new Set<string>();
    for (const row of mapsGrid) {
      const m = barisMaps(row as unknown[]);
      if (!m) continue;
      const lok = bacaLokasi(m.lokasi);
      const kn = kunciNama(m.nama);
      if (!lok || !kn) continue;
      const kol = lok.jenis === 'maps' ? C.maps : C.alamat;
      if (kol < 0) continue;
      const custs = custOf(kn);
      if (!custs.size) { maps.tidakKetemu.push(m.nama); continue; }
      if (custs.size > 1) { maps.ragu.push(m.nama); continue; }   // nama sama, orang berbeda: tidak diisi
      let terisi = false, ada = false;
      for (const i of lamaPerNama.get(kn) || []) {
        const key = `L${i}|${kol}`;
        if (sudah.has(key)) continue;
        if (!kosong(rows[i][kol])) { ada = true; continue; }
        sudah.add(key);
        isi.push({ baris: i + 2, kolom: kol, nilai: lok.nilai, nama: m.nama, jenisIsi: lok.jenis });
        terisi = true;
      }
      for (const i of baruPerNama.get(kn) || []) {
        if (baru[i].nilai[kol]) { ada = true; continue; }
        baru[i].nilai[kol] = lok.nilai;
        terisi = true;
      }
      if (terisi) maps.cocok++; else if (ada) maps.sudahAda++;
    }
  }
  // Satu sel diisi sekali saja (isian MAPS menang atas "lengkapi" untuk sel yang sama)
  const unik = new Map<string, IsiSel>();
  for (const x of isi) { const k = `${x.baris}|${x.kolom}`; if (!unik.has(k) || x.jenisIsi !== 'lengkapi') unik.set(k, x); }
  return { head, baru, isi: [...unik.values()], maps, tab };
}

export const hurufKolom = (i: number) => {
  let s = '', n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};
