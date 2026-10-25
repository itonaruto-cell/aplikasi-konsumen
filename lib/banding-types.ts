// Form Analisa Banding Branch Head (F-761): data yang diisi BMH di aplikasi, lalu diunduh sebagai Excel
// dengan susunan yang sama seperti template, untuk diunggah / disalin ke G Suite kantor.

export type KatFoto = 'mandatory' | 'ots' | 'tambahan';
export const KAT_FOTO: [KatFoto, string][] = [['mandatory', 'Dokumen Mandatory'], ['ots', 'Dokumen & PIC OTS'], ['tambahan', 'Dokumen Tambahan']];
export type FotoBanding = { id: string; kat: KatFoto; ket: string };

export type Cek = 'valid' | 'tidak' | '';
// Baris checklist dokumen, sama seperti template (kolom E). kunci tetap supaya data lama tetap terbaca.
export const DOK_CEK: { k: string; label: string; grup: KatFoto }[] = [
  { k: 'ktp', label: 'KTP', grup: 'mandatory' },
  { k: 'kk', label: 'KK', grup: 'mandatory' },
  { k: 'pbb', label: 'PBB/REK LISTRIK/SERTIFIKAT', grup: 'mandatory' },
  { k: 'slip', label: 'SLIP GAJI/REK TABUNGAN/SKU/SIUP/NIB', grup: 'mandatory' },
  { k: 'formots', label: 'FORM OTS', grup: 'ots' },
  { k: 'fotoots', label: 'FOTO OTS', grup: 'ots' },
  { k: 'proforma', label: 'FORM PROFORMA', grup: 'tambahan' },
  { k: 'usaha', label: 'FOTO USAHA REPRESENTATIF', grup: 'tambahan' },
];

export const C6: [keyof Analisa6C, string, string][] = [
  ['character', 'Character', 'Sikap saat survey, hasil cek lingkungan, riwayat kredit'],
  ['capacity', 'Capacity', 'Usaha / pekerjaan, penghasilan, bukti terlampir'],
  ['collateral', 'Collateral', 'Unit, atas nama, kondisi, harga pasar'],
  ['capital', 'Capital', 'Rumah, aset lain'],
  ['constraint', 'Constraint', 'Pinjaman lain, hambatan'],
  ['condition', 'Condition of Economy', 'Kondisi usaha / ekonomi'],
  ['eksistensi', 'Eksistensi', 'Hasil cek lingkungan tempat tinggal & unit'],
  ['purpose', 'Purpose', 'Tujuan penggunaan dana'],
];
export type Analisa6C = { character: string; capacity: string; collateral: string; capital: string; constraint: string; condition: string; eksistensi: string; purpose: string };
export type Swot = { s: string; w: string; o: string; t: string };

export type Banding = {
  id: string; dibuat: string; diubah: string; oleh: string; status: 'draft' | 'selesai';
  appNo: string; nama: string; brand: 'MOBILKU' | 'MOTORKU'; cabang: string; bh: string; tanggal: string; // YYYY-MM-DD
  rejectCredit: string; rejectCam: string; rejectCdh: string;
  dok: Record<string, Cek>; dokLain: string; dokLainCek: Cek;
  c6: Analisa6C; swot: Swot;
  reasonMh: string; reasonBh: string;
  pembuat: string; jabatan: string; buh: string;
  slik: string;            // tabel SLIK / Pefindo yang ditempel (dipisah tab), jadi lembar kedua
  foto: FotoBanding[];
  wa: WaBanding;           // isian tambahan untuk format banding ke BU Head lewat WhatsApp
};

/* ---------- Format banding ke BU Head (WhatsApp) ---------- */
export type MutasiBanding = { bulan: string; awal: number; kredit: number; debit: number; akhir: number };
export type WaBanding = {
  link: string; tipe: 'NC' | 'RO' | ''; sumber: string;
  merk: string; tahun: string; bpkb: string;
  otr: number; rekondisi: number; ph: number; pencairan: number; angsuran: number; tenor: number;
  market: { sumber: string; harga: number }[];
  reason: string;          // reason credit reject singkat, satu per baris
  klarifikasi: string;
  pekerjaan: string; rumah: string; penghasilan: string; dsr: string;
  mutasi: MutasiBanding[];
  kol: string[];           // Kol 1–5: satu fasilitas per baris "Fincoy / plafon awal / baki debet"
};
export const waKosong = (): WaBanding => ({
  link: '', tipe: '', sumber: '', merk: '', tahun: '', bpkb: 'Sendiri',
  otr: 0, rekondisi: 0, ph: 0, pencairan: 0, angsuran: 0, tenor: 0,
  market: [], reason: '', klarifikasi: '', pekerjaan: '', rumah: '', penghasilan: '', dsr: '',
  mutasi: [0, 1, 2].map(() => ({ bulan: '', awal: 0, kredit: 0, debit: 0, akhir: 0 })),
  kol: ['', '', '', '', ''],
});

export const kosong6C = (): Analisa6C => ({ character: '', capacity: '', collateral: '', capital: '', constraint: '', condition: '', eksistensi: '', purpose: '' });
export function bandingBaru(p: Partial<Banding> = {}): Banding {
  return {
    id: '', dibuat: '', diubah: '', oleh: '', status: 'draft',
    appNo: '', nama: '', brand: 'MOBILKU', cabang: 'KENDAL', bh: '', tanggal: '',
    rejectCredit: '', rejectCam: '', rejectCdh: '',
    dok: {}, dokLain: '', dokLainCek: '',
    c6: kosong6C(), swot: { s: '', w: '', o: '', t: '' },
    reasonMh: '', reasonBh: '', pembuat: '', jabatan: 'BMH Mobilku', buh: '', slik: '', foto: [], wa: waKosong(),
    ...p,
  };
}

// Data dari server / lama dirapikan ke bentuk lengkap
export function rapikanBanding(x: unknown): Banding {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<Banding>;
  const b = bandingBaru();
  const str = (v: unknown, max = 20_000) => (typeof v === 'string' ? v.slice(0, max) : '');
  const cek = (v: unknown): Cek => (v === 'valid' || v === 'tidak' ? v : '');
  return {
    ...b,
    id: str(o.id, 80), dibuat: str(o.dibuat, 40), diubah: str(o.diubah, 40), oleh: str(o.oleh, 200), status: o.status === 'selesai' ? 'selesai' : 'draft',
    appNo: str(o.appNo, 60), nama: str(o.nama, 150), brand: o.brand === 'MOTORKU' ? 'MOTORKU' : 'MOBILKU', cabang: str(o.cabang, 60) || 'KENDAL',
    bh: str(o.bh, 150), tanggal: /^\d{4}-\d{2}-\d{2}$/.test(String(o.tanggal || '')) ? String(o.tanggal) : '',
    rejectCredit: str(o.rejectCredit), rejectCam: str(o.rejectCam), rejectCdh: str(o.rejectCdh),
    dok: Object.fromEntries(DOK_CEK.map((d) => [d.k, cek(o.dok?.[d.k])])), dokLain: str(o.dokLain, 120), dokLainCek: cek(o.dokLainCek),
    c6: Object.fromEntries(C6.map(([k]) => [k, str(o.c6?.[k], 5000)])) as Analisa6C,
    swot: { s: str(o.swot?.s, 8000), w: str(o.swot?.w, 4000), o: str(o.swot?.o, 4000), t: str(o.swot?.t, 4000) },
    reasonMh: str(o.reasonMh), reasonBh: str(o.reasonBh),
    pembuat: str(o.pembuat, 150), jabatan: str(o.jabatan, 80) || b.jabatan, buh: str(o.buh, 150),
    slik: str(o.slik, 30_000),
    foto: (Array.isArray(o.foto) ? o.foto : []).filter((f) => f && typeof f.id === 'string' && /^[A-Za-z0-9_-]{20,120}$/.test(f.id))
      .slice(0, 40).map((f) => ({ id: f.id, kat: (['mandatory', 'ots', 'tambahan'] as KatFoto[]).includes(f.kat) ? f.kat : 'tambahan', ket: str(f.ket, 120) })),
    wa: rapikanWa(o.wa),
  };
}

const poin = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => (/^[-•*]/.test(x) ? x.replace(/^[-•*]\s*/, '- ') : `- ${x}`));

// Teks "Analisa 6C 1EP" seperti di template
export function teks6C(c: Analisa6C): string {
  const isi = C6.filter(([k]) => c[k].trim()).map(([k, label]) => `- ${label} : ${c[k].trim().replace(/\n+/g, ' ')}`);
  return isi.length ? ['Analisa 6C 1EP→', ...isi].join('\n') : '';
}
export function teksSwot(s: Swot): string {
  const blok = ([['S', s.s], ['W', s.w], ['O', s.o], ['T', s.t]] as const).filter(([, v]) => v.trim()).map(([h, v]) => [`${h} :`, ...poin(v)].join('\n'));
  return blok.join('\n\n');
}
// Usulan isi SWOT dari analisa 6C (bisa diedit): kekuatan = character, capacity, collateral, capital, eksistensi
export function saranSwot(c: Analisa6C): Swot {
  const s = [c.character, c.capacity, c.collateral, c.capital, c.eksistensi].map((x) => x.trim().replace(/\n+/g, ' ')).filter(Boolean);
  const w = c.constraint.trim().replace(/\n+/g, ' ');
  return { s: s.join('\n'), w, o: 'Potensi RO loyal cabang', t: w };
}
export const saranReasonMh = (sw: Swot) => poin(sw.s).join('\n');

// SLIK / Pefindo yang ditempel dari tabel (dipisah tab) atau CSV
export function bacaSlik(t: string): string[][] {
  const baris = t.split(/\r?\n/).filter((x) => x.trim());
  if (!baris.length) return [];
  const pisah = baris[0].includes('\t') ? '\t' : baris[0].includes(';') ? ';' : '\t';
  return baris.map((b) => b.split(pisah).map((x) => x.trim()));
}

export const tglPanjang = (iso: string) => (iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
export const namaFileBanding = (b: Banding) =>
  `F - 761 Form Analisa Banding Branch Head - ${b.cabang || 'Kendal'} - ${b.brand === 'MOTORKU' ? 'MotorKu' : 'MobilKu'} - ${b.nama || 'Konsumen'}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

function rapikanWa(x: unknown): WaBanding {
  const o = (x && typeof x === 'object' ? x : {}) as Partial<WaBanding>;
  const d = waKosong();
  const str = (v: unknown, max = 5000) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v: unknown) => { const n = Math.round(Number(v)); return isFinite(n) && n >= 0 && n < 1e13 ? n : 0; };
  return {
    link: str(o.link, 500), tipe: o.tipe === 'NC' || o.tipe === 'RO' ? o.tipe : '', sumber: str(o.sumber, 150),
    merk: str(o.merk, 150), tahun: str(o.tahun, 10), bpkb: typeof o.bpkb === 'string' ? str(o.bpkb, 100) : d.bpkb,
    otr: num(o.otr), rekondisi: num(o.rekondisi), ph: num(o.ph), pencairan: num(o.pencairan), angsuran: num(o.angsuran), tenor: Math.min(240, num(o.tenor)),
    market: (Array.isArray(o.market) ? o.market : []).slice(0, 10).map((m) => ({ sumber: str(m?.sumber, 60), harga: num(m?.harga) })),
    reason: str(o.reason, 4000), klarifikasi: str(o.klarifikasi, 8000),
    pekerjaan: str(o.pekerjaan), rumah: str(o.rumah, 2000), penghasilan: str(o.penghasilan), dsr: str(o.dsr),
    mutasi: Array.isArray(o.mutasi)
      ? o.mutasi.slice(0, 6).map((m) => ({ bulan: str(m?.bulan, 30), awal: num(m?.awal), kredit: num(m?.kredit), debit: num(m?.debit), akhir: num(m?.akhir) }))
      : d.mutasi,
    kol: [0, 1, 2, 3, 4].map((i) => str(Array.isArray(o.kol) ? o.kol[i] : '', 4000)),
  };
}

const ribu = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const otrTaksasi = (w: WaBanding) => Math.max(0, w.otr - w.rekondisi);
export const ltv = (w: WaBanding) => (otrTaksasi(w) > 0 && w.ph > 0 ? `${((w.ph / otrTaksasi(w)) * 100).toFixed(2)}%` : '');
export const rataMarket = (w: WaBanding) => { const h = w.market.filter((m) => m.harga > 0); return h.length ? Math.round(h.reduce((s, m) => s + m.harga, 0) / h.length) : 0; };
const judulKata = (s: string) => s.toLowerCase().replace(/\b\w/g, (h) => h.toUpperCase());
// Baris bernomor: "1. …" dipertahankan, selain itu diberi nomor urut
const bernomor = (t: string) => {
  const l = t.split('\n').map((x) => x.trim()).filter(Boolean);
  return l.every((x) => /^\d+[.)]/.test(x)) ? l : l.map((x, i) => `${i + 1}. ${x.replace(/^[-•*]\s*/, '')}`);
};

// Teks banding ke BU Head lewat WhatsApp, susunan sama seperti format cabang
export function teksWaBanding(b: Banding): string {
  const w = b.wa;
  const rp = (n: number) => (n ? ribu(n) : '');
  const out: string[] = [];
  const blok = (...l: string[]) => { if (out.length) out.push(''); out.push(...l); };
  out.push(`Aplikasi Banding ${b.brand === 'MOTORKU' ? 'MotorKu' : 'MobilKu'} Cabang ${judulKata(b.cabang || 'Kendal')}`);
  if (w.link.trim()) blok('Link Banding', w.link.trim());
  blok('Informasi aplikasi :', `Tipe konsumen : ${w.tipe}`, `No APP : ${b.appNo}`, `Cabang : ${judulKata(b.cabang || 'Kendal')}`, `Nama konsumen : ${b.nama}`, `Sumber Order : ${w.sumber}`);
  const pasar = w.market.filter((m) => m.sumber.trim() || m.harga);
  blok('Struktur Pembiayaan :', `Merk & Type : ${w.merk}`, `Tahun : ${w.tahun}`, `BPKB a/n : ${w.bpkb}`, `OTR : ${rp(w.otr)}`, `Harga Rekondisi : ${rp(w.rekondisi)}`,
    `OTR Taksasi : ${rp(otrTaksasi(w))}`, `PH : ${rp(w.ph)}`, `Pencairan : ${rp(w.pencairan)}`, `Angsuran : ${rp(w.angsuran)}`, `Tenor : ${w.tenor || ''}`, `LTV : ${ltv(w)}`,
    'Harga Market (jika NDS) :', ...pasar.map((m) => `• ${m.sumber.trim() || 'Market'}: ${rp(m.harga)}`), ...(pasar.length ? [`Rata rata : ${rp(rataMarket(w))}`] : []));
  const reason = bernomor(w.reason.trim() || b.rejectCredit);
  if (reason.length) blok('Reason Credit Reject :', ...reason);
  if (w.klarifikasi.trim()) blok('Klarifikasi reason credit reject', ...w.klarifikasi.trim().split('\n').map((x) => x.trimEnd()));
  const analisa: string[] = ['Analisa Cabang Mengajukan Banding :'];
  const tambah = (no: number, label: string, isi: string) => { if (analisa.length > 1) analisa.push(''); analisa.push(`${no}. ${label} : ${isi.trim()}`); };
  tambah(1, 'Pekerjaan/Usaha Konsumen', w.pekerjaan);
  tambah(2, 'Status rumah', w.rumah);
  tambah(3, 'Penghasilan', w.penghasilan);
  tambah(4, 'DSR & Perhitungan Singkat', w.dsr);
  const mut = w.mutasi.filter((m) => m.bulan.trim() || m.kredit || m.debit);
  analisa.push('', '5. Analisa Rek Koran :', ...mut.flatMap((m) => [`• Mutasi ${m.bulan.trim()}:`, `Saldo Awal: ${ribu(m.awal)}`, `Credit: ${ribu(m.kredit)}`, `Debit: ${ribu(m.debit)}`, `Saldo Akhir: ${ribu(m.akhir)}`]));
  analisa.push('', '6. Hasil cek Slik :', 'Fincoy / Plafon awal / baki debet ');
  w.kol.forEach((k, i) => {
    const l = k.split('\n').map((x) => x.trim()).filter(Boolean).map((x) => (/^[-•]/.test(x) ? x.replace(/^[-•]\s*/, '- ') : `- ${x}`));
    analisa.push(`Kol ${i + 1} :`, ...(l.length ? l : ['- kosong']));
  });
  blok(...analisa);
  const c6 = teks6C(b.c6);
  if (c6) blok('Informasi tambahan :', c6);
  blok('Terima Kasih');
  return out.join('\n');
}
