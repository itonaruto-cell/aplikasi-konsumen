// Rekap mutasi rekening: membaca PDF e-statement (sudah diubah jadi baris teks di HP) dan mengambil total
// dana masuk (kredit) per bulan dari ringkasan resmi bank, lalu menyusun teks rekap untuk WhatsApp.
//   Mandiri: "Periode/ Period : 01 Jul 2026 - …" + "Dana Masuk/ Incoming Transactions : + 256.840.000,00"
//   BCA    : "PERIODE : JULI 2026" + "MUTASI CR : 413,107,475.00"
//   BRI    : "Periode Transaksi : 01/06/26 - 30/06/26" + baris angka di bawah "Total Transaksi Kredit"
//   BNI    : "Periode: 1 - 31 Mei 2026" + baris angka di bawah "Total Pemasukan" (angka bertanda +)

// bulan = yyyy-mm, kredit dibulatkan ke rupiah, penuh = periode satu bulan penuh (bukan cetakan sampai tanggal tertentu)
export type BulanMutasi = { bulan: string; kredit: number; penuh: boolean };
export type HasilMutasi = { bank: string; rekening: string; nama: string; bulan: BulanMutasi[] };

/* ---------- Teks PDF → baris ---------- */
type ItemTeks = { str?: string; transform?: number[] };
// Item teks pdf.js dikelompokkan per baris (posisi y), diurutkan dari kiri ke kanan
export function barisDariItem(items: ItemTeks[]): string[] {
  const rows = new Map<number, { x: number; s: string }[]>();
  for (const it of items) {
    if (!it || typeof it.str !== 'string' || !it.str.trim() || !it.transform) continue;
    const y = Math.round(it.transform[5]);
    const r = rows.get(y) || [];
    r.push({ x: it.transform[4], s: it.str });
    rows.set(y, r);
  }
  return [...rows.keys()].sort((a, b) => b - a).map((y) => rows.get(y)!.sort((a, b) => a.x - b.x).map((i) => i.s).join(' '));
}

/* ---------- Alat ---------- */
const padat = (s: string) => s.toUpperCase().replace(/\s+/g, '');
const BULAN: Record<string, number> = {
  JANUARI: 1, JANUARY: 1, FEBRUARI: 2, FEBRUARY: 2, MARET: 3, MARCH: 3, APRIL: 4, MEI: 5, MAY: 5, JUNI: 6, JUNE: 6,
  JULI: 7, JULY: 7, AGUSTUS: 8, AUGUST: 8, SEPTEMBER: 9, OKTOBER: 10, OCTOBER: 10, NOVEMBER: 11, DESEMBER: 12, DECEMBER: 12,
};
const BULAN3: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MEI: 5, MAY: 5, JUN: 6, JUL: 7, AGU: 8, AGT: 8, AUG: 8, SEP: 9, OKT: 10, OCT: 10, NOV: 11, DES: 12, DEC: 12,
};
export function bulanDari(nama: string, tahun: string): string | null {
  const n = nama.toUpperCase();
  const m = BULAN[n] ?? BULAN3[n.slice(0, 3)];
  return m && /^\d{4}$/.test(tahun) ? `${tahun}-${String(m).padStart(2, '0')}` : null;
}
// "256.840.000,00" / "413,107,475.00" / "264,013,502.58" → bilangan bulat rupiah
export function angkaRupiah(s: string): number | null {
  const t = String(s || '').trim().replace(/[^\d.,]/g, '');
  if (!/\d/.test(t)) return null;
  const des = /[.,](\d{1,2})$/.exec(t);
  const utuh = (des ? t.slice(0, des.index) : t).replace(/[.,]/g, '');
  const v = Number(utuh + (des ? '.' + des[1] : ''));
  return isFinite(v) ? Math.round(v) : null;
}

/* ---------- Pembaca per bank ---------- */
function bacaMandiri(baris: string[]): HasilMutasi | null {
  if (!baris.some((b) => padat(b).includes('DANAMASUK/INCOMINGTRANSACTIONS'))) return null;
  const bulan = new Map<string, { kredit: number; penuh: boolean }>();
  let kini: string | null = null, penuh = true, nama = '', rekening = '';
  baris.forEach((b, i) => {
    const p = padat(b);
    const per = /Periode\s*\/\s*Period\s*:\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:\s*-\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4}))?/i.exec(b);
    if (per) {
      kini = bulanDari(per[2], per[3]);
      // Penuh kalau mulai tanggal 1 dan berakhir di tanggal terakhir bulan itu
      const akhir = kini ? new Date(Date.UTC(Number(kini.slice(0, 4)), Number(kini.slice(5, 7)), 0)).getUTCDate() : 0;
      penuh = Number(per[1]) === 1 && (!per[4] || (Number(per[4]) === akhir && bulanDari(per[5], per[6]) === kini));
    }
    if (!nama) { const n = /Nama\s*\/\s*Name\s*:\s*(.+?)\s+Periode/i.exec(b); if (n) nama = n[1].trim(); }
    if (!rekening && p.includes('NOMORREKENING/ACCOUNTNUMBER')) {
      const sini = /ACCOUNTNUMBER:(\d{6,20})/.exec(p)?.[1];
      const dekat = [baris[i - 1], baris[i + 1]].map((x) => String(x ?? '').trim()).find((x) => /^\d{6,20}$/.test(x));
      rekening = sini || dekat || '';
    }
    const dm = /Dana\s*Masuk\s*\/\s*Incoming\s*Transactions\s*:\s*\+?\s*([\d.,]+)/i.exec(b);
    if (dm && kini && !bulan.has(kini)) { const v = angkaRupiah(dm[1]); if (v !== null) bulan.set(kini, { kredit: v, penuh }); }
  });
  return { bank: 'MANDIRI', rekening, nama, bulan: urut(bulan) };
}

function bacaBca(baris: string[]): HasilMutasi | null {
  if (!baris.some((b) => /MUTASICR:/.test(padat(b)))) return null;
  const bulan = new Map<string, { kredit: number; penuh: boolean }>();
  let kini: string | null = null, rekening = '';
  for (const b of baris) {
    const p = padat(b);
    const per = /^PERIODE:([A-Z]+?)(\d{4})$/.exec(p) || /PERIODE:([A-Z]+?)(\d{4})/.exec(p);
    if (per) kini = bulanDari(per[1], per[2]);
    if (!rekening) { const r = /NO\.?REKENING:(\d{6,20})/.exec(p); if (r) rekening = r[1]; }
    // Baris "MUTASI CR : 413,107,475.00 54" (angka terakhir = jumlah transaksi): ambil nominal pertama saja
    const cr = /M\s*U\s*T\s*A\s*S\s*I\s+C\s*R\s*:\s*([\d.,]+)/i.exec(b);
    if (cr && kini && !bulan.has(kini)) { const v = angkaRupiah(cr[1]); if (v !== null) bulan.set(kini, { kredit: v, penuh: true }); }
  }
  return { bank: 'BCA', rekening, nama: '', bulan: urut(bulan) };
}

const urut = (m: Map<string, { kredit: number; penuh: boolean }>): BulanMutasi[] =>
  [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([bulan, v]) => ({ bulan, ...v }));

// Bulan yang dipilih awal: 3 bulan penuh terakhir (bulan berjalan yang belum penuh tidak ikut)
export function pilihAwal(b: BulanMutasi[], n = 3): string[] {
  const penuh = b.filter((x) => x.penuh);
  return (penuh.length ? penuh : b).slice(-n).map((x) => x.bulan);
}

// Baris teks satu PDF → hasil, atau null kalau format bank belum dikenali
// BRI: "Periode Transaksi : 01/06/26 - 30/06/26"; di akhir tiap periode baris judul "… Total Transaksi Kredit …"
// lalu (setelah baris judul bahasa Inggris) baris angka: saldo awal, total debet, total kredit, saldo akhir
function bacaBri(baris: string[]): HasilMutasi | null {
  if (!baris.some((b) => padat(b).includes('TOTALTRANSAKSIKREDIT'))) return null;
  const bulan = new Map<string, { kredit: number; penuh: boolean }>();
  let kini: string | null = null, penuh = true, nama = '', rekening = '';
  const tgl = (d: string, m: string, y: string) => ({ d: Number(d), bulan: `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}` });
  baris.forEach((b, i) => {
    const per = /Periode\s+Transaksi\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i.exec(b);
    if (per) {
      const a = tgl(per[1], per[2], per[3]), z = tgl(per[4], per[5], per[6]);
      kini = a.bulan;
      const akhir = new Date(Date.UTC(Number(kini.slice(0, 4)), Number(kini.slice(5, 7)), 0)).getUTCDate();
      penuh = a.d === 1 && z.bulan === a.bulan && z.d === akhir;
      if (!nama) { const n = String(baris[i + 1] ?? '').trim(); if (/^[A-Z][A-Z .,'-]{2,}$/.test(n) && !/TRANSACTION|PERIOD/.test(n)) nama = n; }
    }
    if (!rekening) { const r = /No\.?\s*Rekening\s*:\s*(\d{6,20})/i.exec(b); if (r) rekening = r[1]; }
    if (padat(b).includes('TOTALTRANSAKSIKREDIT') && kini && !bulan.has(kini)) {
      // Baris angka ada 1–3 baris di bawah judul (lewati baris judul bahasa Inggris)
      for (let k = i + 1; k <= i + 3 && k < baris.length; k++) {
        const angka = baris[k].match(/[\d.,]+\d/g) || [];
        if (angka.length >= 4) { const v = angkaRupiah(angka[2]); if (v !== null) bulan.set(kini, { kredit: v, penuh }); break; }
      }
    }
  });
  return { bank: 'BRI', rekening, nama, bulan: urut(bulan) };
}

// BNI: "Periode: 1 - 31 Mei 2026"; baris judul "Saldo Awal Total Pemasukan Total Pengeluaran Saldo Akhir"
// lalu baris angka "867,087 +21,339,030 -22,203,177 2,940" (pemasukan = angka bertanda +)
function bacaBni(baris: string[]): HasilMutasi | null {
  if (!baris.some((b) => padat(b).includes('TOTALPEMASUKAN'))) return null;
  const bulan = new Map<string, { kredit: number; penuh: boolean }>();
  let kini: string | null = null, penuh = true, nama = '', rekening = '';
  baris.forEach((b, i) => {
    const per = /Periode\s*:\s*(\d{1,2})(?:\s+([A-Za-z]+)\s+(\d{4}))?\s*-\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i.exec(b);
    if (per) {
      kini = bulanDari(per[5], per[6]);
      const awalBln = per[2] ? bulanDari(per[2], per[3]) : kini;
      const akhir = kini ? new Date(Date.UTC(Number(kini.slice(0, 4)), Number(kini.slice(5, 7)), 0)).getUTCDate() : 0;
      penuh = Number(per[1]) === 1 && awalBln === kini && Number(per[4]) === akhir;
      if (!rekening) {
        const r = /^(.*?)\s*-\s*(\d{6,20})\s*$/.exec(String(baris[i + 1] ?? '').trim());
        if (r) { rekening = r[2]; nama = r[1].replace(/\s+(BNI\s+)?(TAPLUS|TAPENAS|GIRO|BNI)\b.*$/i, '').trim(); }
      }
    }
    if (padat(b).includes('TOTALPEMASUKAN') && kini && !bulan.has(kini)) {
      const plus = /\+\s*([\d.,]+)/.exec(String(baris[i + 1] ?? ''));
      if (plus) { const v = angkaRupiah(plus[1]); if (v !== null) bulan.set(kini, { kredit: v, penuh }); }
    }
  });
  return { bank: 'BNI', rekening, nama, bulan: urut(bulan) };
}

export function bacaMutasi(baris: string[]): HasilMutasi | null {
  for (const f of [bacaMandiri, bacaBca, bacaBri, bacaBni]) {
    const h = f(baris);
    if (h && h.bulan.length) return h;
  }
  return null;
}

// Beberapa PDF (mis. satu file per bulan) digabung per bank + nomor rekening
export function gabungMutasi(list: HasilMutasi[]): HasilMutasi[] {
  const out: HasilMutasi[] = [];
  for (const h of list) {
    const g = out.find((x) => x.bank === h.bank && (x.rekening === h.rekening || !x.rekening || !h.rekening));
    if (!g) { out.push({ ...h, bulan: [...h.bulan] }); continue; }
    for (const b of h.bulan) if (!g.bulan.some((x) => x.bulan === b.bulan)) g.bulan.push(b);
    g.bulan.sort((a, b) => a.bulan.localeCompare(b.bulan));
    g.rekening ||= h.rekening; g.nama ||= h.nama;
  }
  return out;
}

/* ---------- Teks rekap untuk WhatsApp ---------- */
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const labelBulan = (yyyymm: string) => `${BLN[Number(yyyymm.slice(5, 7)) - 1] || yyyymm}`;
export const ribuan = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const rataRata = (b: BulanMutasi[]) => (b.length ? Math.round(b.reduce((s, x) => s + x.kredit, 0) / b.length) : 0);

export function teksRekap(grup: { bank: string; rekening?: string; bulan: BulanMutasi[] }[]): string {
  const dobel = (bank: string) => grup.filter((g) => g.bank === bank).length > 1;
  const blok = grup.filter((g) => g.bulan.length).map((g, i) => [
    `*${i + 1}. ${g.bank}${dobel(g.bank) && g.rekening ? ` ${g.rekening}` : ''}*`,
    'Rekap :',
    ...g.bulan.map((b) => `• ${labelBulan(b.bulan)} : Rp.${ribuan(b.kredit)} `),
    `Avg : *Rp.${ribuan(rataRata(g.bulan))}*`,
  ].join('\n'));
  const total = grup.filter((g) => g.bulan.length).reduce((s, g) => s + rataRata(g.bulan), 0);
  return [...blok, `Total avg (omzet) : ${ribuan(total)}`].join('\n\n');
}
