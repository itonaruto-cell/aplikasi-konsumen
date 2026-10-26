// Surat IM / Berita Acara dari template SK. Kalimat baku tetap dari template; yang diisi di aplikasi:
// kop (judul, perihal, nomor), baris "Dibuat oleh" (Niko), isian yang berubah tiap konsumen, dan lampiran foto.
// Baris penyetuju lain selalu kosong (diisi masing-masing). Template baru cukup ditambahkan ke TEMPLATE_SURAT.

export type FotoSurat = { id: string; ket: string };
export type LampiranSurat = { judul: string; foto: FotoSurat[] };
export type Surat = {
  id: string; dibuat: string; diubah: string; oleh: string;
  template: string;
  judul: string;             // kop; boleh beberapa baris
  perihal: string;           // perihal / nama file
  perihalOtomatis: boolean;  // ikut nama konsumen sampai diubah sendiri
  noUrut: string; kode: string; tanggal: string; // nomor = noUrut/kode/bulan romawi/tahun (dari tanggal surat)
  approval: string; tglApproval: string; ket: string; // baris "Dibuat oleh"
  data: Record<string, string>;
  lampiran: LampiranSurat[];
};

/* ---------- Template ---------- */
export type IsianData = {
  k: string; label: string; ph?: string; besar?: boolean; saran?: string[];
  jenis?: 'teks' | 'tanggal' | 'panjang' | 'uang'; awal?: string; grup?: 'data' | 'isi';
};
type Kolom = 'peran' | 'nama' | 'jabatan' | 'status' | 'tanggal' | 'ket';
type FormatTgl = 'panjang' | 'pendek' | 'angka';
export type Approval = {
  kolom: [Kolom, string][]; lebar: number[]; judul?: string; fill?: string; tengah?: boolean;
  kepalaGabung?: number; kepalaTebal?: boolean; peranTebal?: boolean;
  pembuat: { peran?: string; nama: string; jabatan: string };
  penyetuju: { peran?: string; nama: string; jabatan: string }[];
  status: string[]; tgl: FormatTgl; tglHariIni?: boolean; ketAwal?: string;
};
type Teks = string; // boleh berisi {kunci} / {kunci:format} dan **tebal**
export type Blok =
  | { t: 'kop'; baris: Teks[]; garis?: boolean | boolean[]; tebal?: boolean[]; besar?: boolean; kiri?: boolean }
  | { t: 'info'; baris: [string, Teks][]; tebalLabel?: boolean }
  | { t: 'approval' }
  | { t: 'p'; teks: Teks; tebal?: boolean; kiri?: number; spasi?: number; tengah?: boolean }
  | { t: 'bagian'; no: string; judul: string; kiri?: number }
  | { t: 'daftar'; isi: Teks[]; kiri?: number }
  | { t: 'data'; keys: string[]; nomorPertama?: boolean; tebal?: boolean; kiri?: number; lebarLabel?: number }
  | { t: 'halaman' }
  | { t: 'lampiran'; judul?: string; nomor: boolean };
export type TemplateSurat = {
  id: string; nama: string; ringkas: string; sk?: string;
  font: string; fontKop?: string; sz: number; szTabel: number; kertas: 'letter' | 'a4'; margin?: number;
  judul: string; perihal: Teks; perihalDiKop?: boolean;
  approval: Approval; isian: IsianData[]; blok: Blok[]; lampiran: string[];
};

const NIKO = 'Niko Widyasmara';
export const NIKO_NAMA = NIKO;
// Pejabat terbaru (sama dengan IM SAKPOLE)
const P = {
  dyah: 'Dyah Pamungkas', aji: 'Muhammad Aji Susilo', untik: 'Untik Hartati', geri: 'Geri Neno A', azza: 'Azza Dwi Septian', moga: 'Moga Mulya Saputra',
};

export const TEMPLATE_SURAT: TemplateSurat[] = [
  {
    id: 'sakpole', nama: 'IM SAKPOLE error',
    ringkas: 'Golive tanpa validasi STNK via aplikasi SAKPOLE (data pajak/kendaraan tidak muncul)',
    sk: 'SK No 251/SK/OPP/10-24 (Versi 03)',
    font: 'Arial Narrow', sz: 21, szTabel: 20, kertas: 'letter',
    judul: 'BERITA ACARA', perihalDiKop: true,
    perihal: 'IM Proses Golive Kondisi Validasi STNK Via Aplikasi SAKPOLE Error Konsumen Cabang Kendal an. {nama:upper}',
    approval: {
      kolom: [['peran', ''], ['nama', 'Nama'], ['jabatan', 'Jabatan'], ['status', 'Approval'], ['tanggal', 'Tanggal'], ['ket', 'Ket']],
      lebar: [1470, 1635, 1605, 1515, 2025, 2400],
      pembuat: { peran: 'Dibuat oleh', nama: NIKO, jabatan: 'BMH MobilKu Kendal' },
      penyetuju: [
        { peran: 'Diketahui oleh', nama: P.dyah, jabatan: 'BOH' },
        { peran: 'Disetujui oleh', nama: P.aji, jabatan: 'Branch Head' },
        { peran: 'Disetujui oleh', nama: P.untik, jabatan: 'AMM NDS JATARA' },
        { peran: 'Disetujui oleh', nama: P.geri, jabatan: 'AOM' },
        { peran: 'Disetujui oleh', nama: P.azza, jabatan: 'CAM' },
        { peran: 'Disetujui oleh', nama: P.moga, jabatan: 'BU Head' },
      ],
      status: ['Submitted', ''], tgl: 'angka',
    },
    isian: [
      { k: 'nama', label: 'Nama Konsumen', besar: true },
      { k: 'app', label: 'No APP', ph: 'APP0631…', besar: true },
      { k: 'tipe', label: 'Tipe Konsumen', saran: ['New Customer', 'Repeat Order'] },
      { k: 'jenis', label: 'Jenis Aplikasi', saran: ['Dana Tunai', 'Pembiayaan Baru'] },
      { k: 'soa', label: 'SOA', saran: ['Agent', 'Walk In', 'Channel Mediator', 'Direct Marketing'] },
      { k: 'kendaraan', label: 'Type Kendaraan', ph: 'Toyota Avanza 1.3 G MT' },
      { k: 'tahun', label: 'Tahun Kendaraan', ph: '2018' },
      { k: 'polis', label: 'No Polis', ph: 'H 1234 AB', besar: true },
      { k: 'rangka', label: 'No Rangka', besar: true },
      { k: 'mesin', label: 'No Mesin', besar: true },
      { k: 'pajak', label: 'Masa Pajak', ph: '12-05-2027' },
    ],
    blok: [
      { t: 'kop', baris: ['{judul}', '{perihal}', '{nomor}'] },
      { t: 'approval' },
      { t: 'bagian', no: 'A.', judul: 'LATAR BELAKANG' },
      { t: 'daftar', isi: [
        'Sesuai SK No 251/SK/OPP/10-24 (Versi 03) terkait Pengecekan Validasi STNK bahwa BMH/MS diwajibkan untuk melampirkan Hasil screenshot hasil validasi melalui aplikasi masing-masing daerah, CAC melakukan validasi hasil screenshot dan kesesuaian dengan data fotokopi STNK yang diterima, serta Tim Operation di cabang wajib melakukan pengecekan atas hasil validasi STNK.',
        'Tidak munculnya data pajak dan data kendaraan pada aplikasi SAKPOLE di salah satu aplikasi konsumen Cabang Kendal.',
      ] },
      { t: 'bagian', no: 'B.', judul: 'TUJUAN' },
      { t: 'daftar', isi: ['Dapat dilanjutkannya Proses Golive Aplikasi tanpa dilakukan pengecekan pada Aplikasi SAKPOLE'] },
      { t: 'bagian', no: 'C.', judul: 'PENGAJUAN' },
      { t: 'daftar', isi: [
        'Dapat dilanjutkan Proses Golive tanpa Pengecekan Aplikasi SAKPOLE',
        'Wajib dilampirkan Foto STNK Asli dan dilakukan Validasi dan Cek Keasliannya oleh BMH dan BOH',
      ] },
      { t: 'halaman' },
      { t: 'p', teks: 'D. DATA KONSUMEN', tebal: true, spasi: 120 },
      { t: 'data', keys: ['nama', 'app', 'tipe', 'jenis', 'soa', 'kendaraan', 'tahun', 'polis', 'rangka', 'mesin', 'pajak'], nomorPertama: true, kiri: 240 },
      { t: 'halaman' },
      { t: 'lampiran', judul: 'E. LAMPIRAN', nomor: true },
    ],
    lampiran: ['Hasil Pengecekan SAKPOLE kondisi saat ini'],
  },
  {
    id: 'ubah-pot', nama: 'BA Copcan Ubah POT',
    ringkas: 'Copcan ubah POT MobilKu, mis. rekomendasi turun paket',
    font: 'Arial', sz: 20, szTabel: 20, kertas: 'a4', margin: 1440,
    judul: 'BERITA ACARA COPCAN UBAH POT',
    perihal: 'BA COPCAN UBAH POT MOBILKU {nama:upper}',
    approval: {
      kolom: [['peran', 'Approved By'], ['nama', ''], ['jabatan', 'Jabatan'], ['status', 'Approval Status'], ['tanggal', 'Tanggal Approve'], ['ket', 'Keterangan']],
      lebar: [1300, 1450, 1550, 1300, 1450, 2000], kepalaGabung: 2, kepalaTebal: true, peranTebal: true,
      pembuat: { peran: 'Dibuat Oleh', nama: NIKO, jabatan: 'Branch Marketing Head MobilKu' },
      penyetuju: [{ peran: 'Disetujui Oleh', nama: 'M. Aji Susilo', jabatan: 'Branch Head' }],
      status: ['Approved', 'Submitted', ''], tgl: 'panjang', tglHariIni: true,
      ketAwal: 'Konsumen turun angsuran & pencairan dan rekomendasi turun paket',
    },
    isian: [
      { k: 'nama', label: 'Nama Konsumen', besar: true },
      { k: 'app', label: 'NO App', ph: 'APP0631…', besar: true },
      { k: 'alamat', label: 'Alamat KTP', jenis: 'panjang', besar: true },
      { k: 'nik', label: 'NIK KTP', ph: '3324…' },
      { k: 'unit', label: 'Unit yang diajukan', besar: true, ph: 'DAIHATSU AYLA …' },
      { k: 'otr', label: 'OTR', jenis: 'uang' },
      { k: 'tenor', label: 'Tenor', ph: '48' },
      { k: 'angsuran', label: 'Angsuran', jenis: 'uang' },
      { k: 'stnk', label: 'Nama STNK/BPKB', besar: true },
      { k: 'alasan', label: 'Alasan copcan', jenis: 'panjang', grup: 'isi', awal: 'aplikasi rekomendasi turun paket' },
      { k: 'potAwal', label: 'POT awal', besar: true, grup: 'isi', awal: 'OFFERING SALES AND LEASEBACK INVESTASI MOBILKU EXTRA 2' },
      { k: 'potBaru', label: 'POT baru', besar: true, grup: 'isi', awal: 'OFFERING SALES AND LEASEBACK INVESTASI MOBILKU SPESIAL' },
    ],
    blok: [
      { t: 'kop', baris: ['{judul}', '{nomor}'], garis: [true, false], kiri: true },
      { t: 'info', baris: [
        ['Dari', `${NIKO} - BMH MobilKu All`],
        ['Tanggal', '{tanggal:panjang}'],
        ['Perihal', '**BERITA ACARA COPCAN UBAH POT MOBILKU**'],
      ] },
      { t: 'approval' },
      { t: 'bagian', no: 'A.', judul: 'LATAR BELAKANG' },
      { t: 'p', teks: 'Permohonan Copcan dikarenakan {alasan} dari {potAwal} menjadi {potBaru}', kiri: 720, spasi: 120 },
      { t: 'bagian', no: 'B.', judul: 'TUJUAN' },
      { t: 'p', teks: 'Berdasarkan latar belakang tersebut, kami mengajukan Copcan ubah POT dengan data berikut', kiri: 720, spasi: 200 },
      { t: 'data', keys: ['nama', 'app', 'alamat', 'nik', 'unit', 'otr', 'tenor', 'angsuran', 'stnk'], tebal: true, kiri: 720, lebarLabel: 2100 },
      { t: 'p', teks: 'Demikianlah Berita Acara ini kami buat, atas persetujuan dan kerjasamanya kami ucapkan terima kasih', spasi: 120 },
      { t: 'halaman' },
      { t: 'lampiran', judul: '', nomor: false },
    ],
    lampiran: [''],
  },
  {
    id: 'take-over', nama: 'IM Take Over tanpa FC BPKB & Faktur',
    ringkas: 'Golive aplikasi take over yang tidak ada FC BPKB & faktur (IM sampai BU Head)',
    font: 'Cambria', sz: 22, szTabel: 20, kertas: 'letter',
    judul: 'INTERNAL MEMO\nAPLIKASI TAKE OVER TIDAK ADA FC BPKB & FAKTUR',
    perihal: 'IM Golive Aplikasi Take Over Tidak Ada FC BPKB & Faktur_{nama:upper}',
    approval: {
      kolom: [['nama', 'APPROVED BY'], ['jabatan', 'JABATAN'], ['status', 'STATUS APPROVAL'], ['tanggal', 'TANGGAL APPROVAL'], ['ket', 'NOTED']],
      lebar: [2100, 2000, 1500, 1500, 2500], judul: 'LEMBAR PERSETUJUAN', fill: 'BDD7EE',
      pembuat: { nama: NIKO, jabatan: 'BMH Mobilku Kendal' },
      penyetuju: [
        { nama: 'Dyah Pamungkas P', jabatan: 'BOH Kendal' },
        { nama: P.aji, jabatan: 'Branch Head Kendal' },
        { nama: P.untik, jabatan: 'AMM MobilKu BU Jateng Utara' },
        { nama: P.geri, jabatan: 'AOM BU Jateng Utara' },
        { nama: P.moga, jabatan: 'BU Head Jateng Utara' },
      ],
      status: ['Submitted', ''], tgl: 'panjang', tglHariIni: true,
      ketAwal: 'Go Live Aplikasi Take Over dengan Kondisi tidak ada FC BPKB & Faktur',
    },
    isian: [
      { k: 'nama', label: 'Nama', besar: true },
      { k: 'app', label: 'No APP', ph: 'APP0631…', besar: true },
      { k: 'unit', label: 'Unit', besar: true, ph: 'HONDA ALL NEW BEAT …' },
      { k: 'fincoy', label: 'Fincoy', besar: true, ph: 'PT. SUMMIT OTO' },
      { k: 'ph', label: 'PH', jenis: 'uang' },
      { k: 'tglTo', label: 'Tanggal Take Over', jenis: 'tanggal' },
      { k: 'nominal', label: 'Nominal Take Over', jenis: 'uang' },
    ],
    blok: [
      { t: 'kop', baris: ['{judul}'], garis: true, besar: true },
      { t: 'info', tebalLabel: true, baris: [
        ['No.', '{nomor}'],
        ['Kepada', `Bpk ${P.moga} - BU Head Jateng Utara\nIbu ${P.geri} - AOM BU Jateng Utara\nIbu ${P.untik} - AMM MobilKu BU Jateng Utara\nBpk ${P.aji} - Branch Head Kendal\nIbu Dyah Pamungkas P - BOH Kendal`],
        ['Dari', `${NIKO} - BMH Mobilku Kendal`],
        ['Tanggal', '{tanggal:panjang}'],
        ['Cabang', 'Kendal'],
        ['Perihal', '{perihal}'],
      ] },
      { t: 'approval' },
      { t: 'halaman' },
      { t: 'bagian', no: 'I.', judul: 'Latar Belakang' },
      { t: 'p', teks: 'Pada tanggal {tglTo:panjang}, Cabang Kendal akan melakukan take over ke **{fincoy}** untuk pelunasan BPKB konsumen an. {nama} Tidak terlampir FC BPKB dan Faktur', kiri: 720 },
      { t: 'bagian', no: 'II.', judul: 'Tujuan' },
      { t: 'p', teks: 'Agar dapat di Golive oleh Centro sesuai ketentuan wajib mengajukan IM sampai BU Head.', kiri: 720 },
      { t: 'bagian', no: 'III.', judul: 'Permohonan' },
      { t: 'p', teks: 'Berdasarkan latar belakang tersebut, kami bermaksud membuat permohonan persetujuan untuk proses golive dengan data sebagai berikut:', kiri: 720, spasi: 160 },
      { t: 'data', keys: ['nama', 'app', 'unit', 'fincoy', 'ph', 'tglTo', 'nominal'], kiri: 720, lebarLabel: 2100 },
      { t: 'p', teks: 'Demikian permohonan ini di buat, atas persetujuan Bapak/Ibu kami ucapkan terima kasih.', kiri: 720, spasi: 120 },
      { t: 'halaman' },
      { t: 'lampiran', judul: 'Lampiran :', nomor: false },
    ],
    lampiran: ['STNK', 'Form Pengurusan Takeover', 'SS History Approval'],
  },
  {
    id: 'tidak-revisi-stnk', nama: 'BA Tidak Revisi Alamat STNK',
    ringkas: 'Golive tanpa revisi alamat STNK karena alamat sama dengan BPKB & faktur',
    font: 'Times New Roman', fontKop: 'Arial', sz: 22, szTabel: 22, kertas: 'a4',
    judul: 'BERITA ACARA TIDAK REVISI STNK',
    perihal: 'BA GOLIVE TIDAK REVISI ALAMAT DI STNK AN. KONS {nama:upper}',
    approval: {
      kolom: [['nama', 'Approved By'], ['jabatan', 'Jabatan'], ['status', 'Status'], ['tanggal', 'Tanggal']],
      lebar: [2300, 1500, 2600, 2700], fill: 'B2B2B2', tengah: true,
      pembuat: { nama: NIKO, jabatan: 'BMH' },
      penyetuju: [{ nama: 'Dyah Pamungkas P', jabatan: 'BOH' }, { nama: 'Muhammad Aji S', jabatan: 'Branch Head' }],
      status: ['SUBMITTED', ''], tgl: 'panjang', tglHariIni: true,
    },
    isian: [
      { k: 'app', label: 'No APP', ph: 'APP0631…', besar: true },
      { k: 'kontrak', label: 'No kontrak', ph: '1063…' },
      { k: 'nama', label: 'Nama kontrak', besar: true },
      { k: 'jenis', label: 'Jenis aplikasi', besar: true, saran: ['OFFERING SALES AND LEASEBACK INVESTASI MOBILKU SPESIAL', 'OFFERING FASILITAS DANA MOBILKU SPESIAL'] },
      { k: 'tglGolive', label: 'Tanggal Go Live', jenis: 'tanggal' },
      { k: 'alStnk', label: 'Alamat di STNK', jenis: 'panjang', besar: true },
      { k: 'alBpkb', label: 'Alamat di BPKB', jenis: 'panjang', besar: true },
      { k: 'alFaktur', label: 'Alamat di Faktur', jenis: 'panjang', besar: true },
      { k: 'alasan', label: 'Alasan tidak revisi', jenis: 'panjang', grup: 'isi', awal: 'alamat adalah sama dengan di BPKB dan Faktur' },
    ],
    blok: [
      { t: 'kop', baris: ['{judul}', '{nomor}'], tebal: [true, false] },
      { t: 'approval' },
      { t: 'p', teks: 'Pada hari ini {tglGolive:hari}, tanggal {tglGolive:panjang} akan dilakukan Go Live MobilKu dengan kondisi sebagai berikut', spasi: 120 },
      { t: 'data', keys: ['app', 'kontrak', 'nama', 'jenis', 'tglGolive'], lebarLabel: 3000 },
      { t: 'p', teks: 'Terdapat perbedaan pada', tebal: true, spasi: 80 },
      { t: 'data', keys: ['alStnk', 'alBpkb', 'alFaktur'], lebarLabel: 3000 },
      { t: 'p', teks: 'Proses golive tetap dilanjutkan, tanpa dilakukan revisi alamat pada STNK karena {alasan}', spasi: 240 },
      { t: 'p', teks: 'Demikian berita acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.', spasi: 60 },
      { t: 'halaman' },
      { t: 'lampiran', judul: 'Lampiran', nomor: false },
    ],
    lampiran: ['STNK', 'BPKB', 'FAKTUR', 'Approval History'],
  },
];
export const templateSurat = (id: string) => TEMPLATE_SURAT.find((t) => t.id === id) || TEMPLATE_SURAT[0];

/* ---------- Format ---------- */
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const isoKe = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
export function tglFormat(iso: string, f: FormatTgl | 'hari' | 'hariPendek'): string {
  const x = isoKe(iso);
  if (!x) return iso || '';
  const dd = String(x.d).padStart(2, '0');
  const hari = HARI[new Date(Date.UTC(x.y, x.m - 1, x.d)).getUTCDay()];
  if (f === 'angka') return `${dd}/${String(x.m).padStart(2, '0')}/${x.y}`;
  if (f === 'pendek') return `${x.d} ${BULAN[x.m - 1].slice(0, 3)} ${x.y}`;
  if (f === 'hari') return hari;
  if (f === 'hariPendek') return `${hari}, ${x.d} ${BULAN[x.m - 1].slice(0, 3)} ${x.y}`;
  return `${dd} ${BULAN[x.m - 1]} ${x.y}`;
}
export const ribuan = (v: string) => { const n = v.replace(/\D/g, ''); return n ? Number(n).toLocaleString('id-ID') : ''; };

export function nomorSurat(s: Pick<Surat, 'noUrut' | 'kode' | 'tanggal'>): string {
  const x = isoKe(s.tanggal);
  return [s.noUrut.trim() || '…', s.kode.trim() || 'MKT-KENDAL', x ? ROMAWI[x.m - 1] : '…', x ? x.y : '…'].join('/');
}

/** Isi {kunci} / {kunci:format} dari data surat. */
export function isiTeks(teks: string, s: Surat, kosong = '…'): string {
  const t = templateSurat(s.template);
  return teks.replace(/\{(\w+)(?::(\w+))?\}/g, (_, k: string, f?: string) => {
    let v: string;
    if (k === 'nomor') v = nomorSurat(s);
    else if (k === 'judul') v = s.judul;
    else if (k === 'perihal') v = perihalSurat(s);
    else if (k === 'tanggal') v = s.tanggal;
    else if (k === 'lampiranDaftar') v = s.lampiran.map((l, i) => `${i + 1}. ${l.judul}`).join('\n');
    else v = (s.data[k] || '').trim();
    if (!v) return kosong;
    if (f === 'upper') return v.toUpperCase();
    if (f) return tglFormat(v, f as FormatTgl);
    const isian = t.isian.find((x) => x.k === k);
    if (isian?.jenis === 'tanggal') return tglFormat(v, 'panjang');
    return v;
  });
}
export const perihalSurat = (s: Surat): string => (s.perihalOtomatis ? isiTeks(templateSurat(s.template).perihal, { ...s, perihalOtomatis: false, perihal: '' }) : s.perihal);
/** Nilai isian untuk ditampilkan di surat (tanggal diformat). */
export function nilaiIsian(s: Surat, k: string): string {
  const d = templateSurat(s.template).isian.find((x) => x.k === k);
  const v = (s.data[k] || '').trim();
  return d?.jenis === 'tanggal' ? tglFormat(v, 'panjang') : v;
}

export function suratBaru(template: string, x: Partial<Surat> = {}): Surat {
  const t = templateSurat(template);
  const tanggal = x.tanggal || '';
  return {
    id: '', dibuat: '', diubah: '', oleh: '', template: t.id,
    judul: t.judul, perihal: '', perihalOtomatis: true, noUrut: '', kode: 'MKT-KENDAL', tanggal,
    approval: t.approval.status[0], tglApproval: t.approval.tglHariIni ? tanggal : '', ket: t.approval.ketAwal || '',
    data: Object.fromEntries(t.isian.map((d) => [d.k, d.awal || (d.jenis === 'tanggal' && tanggal ? tanggal : '')])),
    lampiran: t.lampiran.map((judul) => ({ judul, foto: [] })),
    ...x,
  };
}

const str = (v: unknown, n = 2000) => (typeof v === 'string' ? v.slice(0, n) : '');
export function rapikanSurat(x: unknown): Surat {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const t = templateSurat(str(o.template, 40));
  const d = (o.data && typeof o.data === 'object' ? o.data : {}) as Record<string, unknown>;
  const lamp = Array.isArray(o.lampiran) ? o.lampiran : [];
  const lampiran: LampiranSurat[] = lamp.slice(0, 20).map((l) => {
    const y = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
    const foto = (Array.isArray(y.foto) ? y.foto : []).slice(0, 30).map((f) => {
      const z = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
      return { id: str(z.id, 120), ket: str(z.ket, 200) };
    }).filter((f) => /^[A-Za-z0-9_-]+$/.test(f.id));
    return { judul: str(y.judul, 300), foto };
  });
  t.lampiran.forEach((judul, i) => { if (!lampiran[i]) lampiran[i] = { judul, foto: [] }; });
  return {
    id: str(o.id, 80), dibuat: str(o.dibuat, 40), diubah: str(o.diubah, 40), oleh: str(o.oleh, 120),
    template: t.id,
    judul: str(o.judul, 300) || t.judul,
    perihal: str(o.perihal, 300), perihalOtomatis: o.perihalOtomatis !== false,
    noUrut: str(o.noUrut, 20), kode: str(o.kode, 60) || 'MKT-KENDAL', tanggal: /^\d{4}-\d{2}-\d{2}$/.test(str(o.tanggal)) ? str(o.tanggal) : '',
    approval: typeof o.approval === 'string' ? str(o.approval, 60) : t.approval.status[0], tglApproval: str(o.tglApproval, 40), ket: str(o.ket, 300),
    data: Object.fromEntries(t.isian.map((f) => [f.k, typeof d[f.k] === 'string' ? str(d[f.k], 600) : f.awal || ''])),
    lampiran,
  };
}

export const namaFileSurat = (s: Surat) =>
  perihalSurat({ ...s, data: { ...s.data, nama: s.data.nama || 'tanpa nama' } }).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Nomor urut berikutnya: terbesar di daftar + 1 (sebagai saran, tetap bisa diubah). */
export function noUrutBerikut(list: Surat[]): string {
  const n = Math.max(0, ...list.map((s) => parseInt(s.noUrut, 10)).filter((x) => Number.isFinite(x)));
  return n ? String(n + 1) : '';
}

/* ---------- Susunan siap cetak (dipakai file Word & pratinjau) ---------- */
export type SelApproval = { teks: string; rowSpan?: number; lanjut?: boolean };
export type BlokJadi =
  | { t: 'kop'; baris: { teks: string; tebal: boolean; garis: boolean }[]; besar: boolean; kiri: boolean }
  | { t: 'info'; baris: [string, string][]; tebalLabel: boolean }
  | { t: 'approval'; judul?: string; fill?: string; tengah: boolean; lebar: number[]; kepala: string[]; kepalaGabung: number; kepalaTebal: boolean; peranTebal: boolean; baris: SelApproval[][] }
  | { t: 'p'; teks: string; tebal: boolean; kiri: number; spasi: number; tengah: boolean }
  | { t: 'bagian'; no: string; judul: string; kiri: number }
  | { t: 'daftar'; isi: string[]; kiri: number }
  | { t: 'data'; baris: [string, string, string][]; tebal: boolean; kiri: number; lebarLabel: number }
  | { t: 'halaman' }
  | { t: 'lampiran'; judul: string; nomor: boolean; isi: LampiranSurat[] };

export function susunSurat(s: Surat): BlokJadi[] {
  const t = templateSurat(s.template);
  const a = t.approval;
  return t.blok.map((b): BlokJadi => {
    switch (b.t) {
      case 'kop': {
        const garis = (i: number) => (Array.isArray(b.garis) ? !!b.garis[i] : !!b.garis);
        const baris = b.baris.flatMap((x, i) => isiTeks(x, s).split('\n').map((teks) => ({ teks, tebal: b.tebal ? b.tebal[i] !== false : true, garis: garis(i) })));
        return { t: 'kop', baris, besar: !!b.besar, kiri: !!b.kiri };
      }
      case 'info': return { t: 'info', baris: b.baris.map(([l, v]) => [l, isiTeks(v, s)]), tebalLabel: !!b.tebalLabel };
      case 'approval': {
        const nilai = (k: Kolom, r: { peran?: string; nama: string; jabatan: string }, niko: boolean) =>
          k === 'peran' ? r.peran || '' : k === 'nama' ? r.nama : k === 'jabatan' ? r.jabatan
            : !niko ? '' : k === 'status' ? s.approval : k === 'tanggal' ? tglFormat(s.tglApproval, a.tgl) : s.ket;
        const semua = [{ r: a.pembuat, niko: true }, ...a.penyetuju.map((r) => ({ r, niko: false }))];
        const baris = semua.map(({ r, niko }, i) => a.kolom.map(([k]): SelApproval => {
          if (k !== 'peran') return { teks: nilai(k, r, niko) };
          const sebelum = semua[i - 1]?.r.peran;
          if (sebelum && sebelum === r.peran) return { teks: '', lanjut: true };
          let n = 1; while (semua[i + n]?.r.peran === r.peran) n++;
          return { teks: r.peran || '', rowSpan: n };
        }));
        return { t: 'approval', judul: a.judul, fill: a.fill, tengah: !!a.tengah, lebar: a.lebar, kepala: a.kolom.map(([, l]) => l), kepalaGabung: a.kepalaGabung || 1, kepalaTebal: !!a.kepalaTebal || !!a.fill || !!a.tengah, peranTebal: !!a.peranTebal, baris };
      }
      case 'p': return { t: 'p', teks: isiTeks(b.teks, s), tebal: !!b.tebal, kiri: b.kiri || 0, spasi: b.spasi ?? 0, tengah: !!b.tengah };
      case 'bagian': return { t: 'bagian', no: b.no, judul: b.judul, kiri: b.kiri ?? 0 };
      case 'daftar': return { t: 'daftar', isi: b.isi.map((x) => isiTeks(x, s)), kiri: b.kiri ?? 720 };
      case 'data': return {
        t: 'data', tebal: !!b.tebal, kiri: b.kiri || 0, lebarLabel: b.lebarLabel || 2200,
        baris: b.keys.map((k, i) => [b.nomorPertama && i === 0 ? '1.' : '', t.isian.find((x) => x.k === k)?.label || k, nilaiIsian(s, k)]),
      };
      case 'halaman': return { t: 'halaman' };
      case 'lampiran': return { t: 'lampiran', judul: b.judul || 'Lampiran', nomor: b.nomor, isi: s.lampiran };
    }
  });
}
/** Teks dengan **tebal** dipecah jadi potongan. */
export const potongTebal = (teks: string): { t: string; b: boolean }[] =>
  teks.split('**').map((t, i) => ({ t, b: i % 2 === 1 })).filter((x) => x.t);
