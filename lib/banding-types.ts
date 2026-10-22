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
};

export const kosong6C = (): Analisa6C => ({ character: '', capacity: '', collateral: '', capital: '', constraint: '', condition: '', eksistensi: '', purpose: '' });
export function bandingBaru(p: Partial<Banding> = {}): Banding {
  return {
    id: '', dibuat: '', diubah: '', oleh: '', status: 'draft',
    appNo: '', nama: '', brand: 'MOBILKU', cabang: 'KENDAL', bh: '', tanggal: '',
    rejectCredit: '', rejectCam: '', rejectCdh: '',
    dok: {}, dokLain: '', dokLainCek: '',
    c6: kosong6C(), swot: { s: '', w: '', o: '', t: '' },
    reasonMh: '', reasonBh: '', pembuat: '', jabatan: 'BMH Mobilku', buh: '', slik: '', foto: [],
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
