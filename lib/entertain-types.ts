// Form Entertain Marketing Agent (F-384) + Konfirmasi Saldo AOP + FPD (F-109).
// Satu isian di aplikasi → tiga file Excel dengan format template kantor (public/template/*.xlsx).
// Data yang sama (nomor IM, tanggal, total, rekening) dipakai di ketiga file; saldo AOP diisi manual.

export type Orang = { nama: string; jabatan: string };
export type Perjamuan = {
  tgl: string;              // YYYY-MM-DD
  produk: 'Mobilku' | 'Motorku' | 'Reguler' | 'Masku';
  tempat: string;
  nominal: number;
  menjamu: Orang[];         // internal WOM
  dijamu: string;           // nama yang dijamu, satu per baris
  jabatanDijamu: string;    // satu per baris
  perusahaan: string;       // nama perusahaan / agent, satu per baris
};
export type BarisMA = { nama: string; plan: string; fincoy: string; historis: string };
export type Approver = { nama: string; jabatan: string; status: string; tgl: string };
export type FotoEnt = { id: string; ket: string };

export type Entertain = {
  id: string; dibuat: string; diubah: string; oleh: string;
  noUrut: string; kode: string; tanggal: string;      // tanggal pengajuan (YYYY-MM-DD) → nomor IM & periode
  pengaju: Orang; cabang: string;
  approval: Approver[];                                // baris "Approved By" di F-384 (pengaju di baris pertama)
  perjamuan: Perjamuan[];
  ma: BarisMA[];
  rekening: { nama: string; nomor: string; bank: string; cabangBank: string };
  link: { aop: string; fpd: string };                  // link Google Sheet AOP & FPD (opsional)
  aop: {
    perihal: string; beban: string;
    aopTahun: number; aopDeviasi: number; aopTerpakai: number; aopProses: number;
    danaAnggaran: number; danaTerpakai: number; danaProses: number;
    disiapkan: Approver[];                             // Prepared by
  };
  fpd: {
    nomor: string; dari: string; lokasi: string; pembayaran: string;
    totalAnggaran: number; proses: number;
    dibuat: Approver & { telp: string; email: string };
    diperiksa: Orang; disetujui: Orang[];
    uraian: string;
  };
  foto: { nota: FotoEnt[]; dokumentasi: FotoEnt[] };
};

export const PRODUK = ['Mobilku', 'Motorku', 'Reguler', 'Masku'] as const;
export const BULAN_ID = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const iso = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
const kapital = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export const tglPanjang = (s: string, besar = false) => { const x = iso(s); if (!x) return ''; const b = BULAN_ID[x.m - 1]; return `${x.d} ${besar ? b : kapital(b)} ${x.y}`; };
export const periodeDari = (s: string) => { const x = iso(s); return x ? `${BULAN_ID[x.m - 1]} ${x.y}` : ''; };
export const nomorIM = (e: Pick<Entertain, 'noUrut' | 'kode' | 'tanggal'>) => {
  const x = iso(e.tanggal);
  return [e.noUrut.trim() || '…', e.kode.trim() || 'MKT-KENDAL', x ? ROMAWI[x.m - 1] : '…', x ? x.y : '…'].join('/');
};
export const totalEnt = (e: Pick<Entertain, 'perjamuan'>) => e.perjamuan.reduce((a, p) => a + (p.nominal || 0), 0);
export const produkUtama = (e: Pick<Entertain, 'perjamuan'>) => e.perjamuan.find((p) => p.nominal || p.tempat)?.produk || 'Mobilku';
export const tglPerjamuan = (e: Pick<Entertain, 'perjamuan' | 'tanggal'>) => e.perjamuan.find((p) => p.tgl)?.tgl || e.tanggal;
const kotaCabang = (c: string) => kapital((c || 'KENDAL').trim());

// Nama file: sama dengan kebiasaan kantor, sekaligus dipakai sebagai teks link antar-file
export const namaFileEnt = (e: Entertain) => `F - 384 Form Entertain Marketing Agent ${produkUtama(e)} - ${kotaCabang(e.cabang)} - ${tglPanjang(tglPerjamuan(e))}`;
export const namaFileAop = (e: Entertain) => `Form Konfirmasi Saldo AOP Entertain ${kotaCabang(e.cabang)}_${produkUtama(e)}_${tglPanjang(tglPerjamuan(e))}`;
export const namaFileFpd = (e: Entertain) => `FPD IM Pengajuan ENTERTAIN MARKETING ${kotaCabang(e.cabang)} ${tglPanjang(tglPerjamuan(e))}`;

export const sisaAop = (e: Entertain) => e.aop.aopTahun + e.aop.aopDeviasi - e.aop.aopTerpakai - e.aop.aopProses;
export const sisaDana = (e: Entertain) => e.aop.danaAnggaran - e.aop.danaTerpakai - e.aop.danaProses - totalEnt(e);

export const perjamuanKosong = (tgl = ''): Perjamuan => ({
  tgl, produk: 'Mobilku', tempat: '', nominal: 0,
  menjamu: [{ nama: 'MUHAMMAD AJI SUSILO', jabatan: 'BRANCH HEAD KENDAL' }, { nama: 'NIKO WIDYASMARA', jabatan: 'MARKETING HEAD MOBILKU' }],
  dijamu: '', jabatanDijamu: '', perusahaan: '',
});

export function entertainBaru(p: Partial<Entertain> = {}): Entertain {
  return {
    id: '', dibuat: '', diubah: '', oleh: '',
    noUrut: '', kode: 'MKT-KENDAL', tanggal: '',
    pengaju: { nama: 'Muhammad Aji Susilo', jabatan: 'BRANCH HEAD' }, cabang: 'KENDAL',
    approval: [
      { nama: 'Muhammad Aji Susilo', jabatan: 'BRANCH HEAD KENDAL', status: 'Submitted', tgl: '' },
      { nama: 'Untik Hartanti', jabatan: 'AMM MOBILKU JATARA', status: '', tgl: '' },
      { nama: 'Moga Mulya Saputra', jabatan: 'BU HEAD JATARA', status: '', tgl: '' },
    ],
    perjamuan: [perjamuanKosong()],
    ma: [],
    rekening: { nama: 'MUHAMMAD AJI SUSILO', nomor: '8640453801', bank: 'BCA', cabangBank: 'WELERI' },
    link: { aop: '', fpd: '' },
    aop: {
      perihal: 'Pengajuan Dana Entertain MA', beban: 'Cabang Kendal',
      aopTahun: 0, aopDeviasi: 0, aopTerpakai: 0, aopProses: 0, danaAnggaran: 0, danaTerpakai: 0, danaProses: 0,
      disiapkan: [
        { nama: 'Muhammad Aji Susilo', jabatan: 'BRANCH HEAD KENDAL', status: 'Submitted', tgl: '' },
        { nama: 'Dyah Pamungkas P', jabatan: 'BOH', status: 'Confirmed', tgl: '' },
      ],
    },
    fpd: {
      nomor: '', dari: 'Niko Widyasmara / MARKETING / MDS', lokasi: 'BU JATENG UTARA', pembayaran: '',
      totalAnggaran: 0, proses: 0,
      dibuat: { nama: 'Niko Widyasmara', jabatan: 'BMH MobilKu', status: 'Submitted', tgl: '', telp: '087762347397', email: 'nwidyasmara@wom.co.id' },
      diperiksa: { nama: 'Dyah Pamungkas', jabatan: 'BOH' },
      disetujui: [{ nama: 'Anis Sulistyaningsih', jabatan: 'Fincoord' }, { nama: 'Muhammad Aji Susilo', jabatan: 'Branch Manager' }],
      uraian: '',
    },
    foto: { nota: [], dokumentasi: [] },
    ...p,
  };
}

/* ---------- Data dari server / draf dirapikan ke bentuk lengkap ---------- */
const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown) => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0; };
const tgl = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : '');
const obj = (v: unknown) => (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
const orang = (v: unknown, b: Orang): Orang => { const o = obj(v); return { nama: typeof o.nama === 'string' ? str(o.nama, 120) : b.nama, jabatan: typeof o.jabatan === 'string' ? str(o.jabatan, 120) : b.jabatan }; };
const appr = (v: unknown, b: Approver): Approver => { const o = obj(v); return { ...orang(o, b), status: typeof o.status === 'string' ? str(o.status, 40) : b.status, tgl: tgl(o.tgl) }; };
const foto = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 12).map((f) => { const o = obj(f); return { id: str(o.id, 120), ket: str(o.ket, 200) }; }).filter((f) => /^[A-Za-z0-9_-]+$/.test(f.id));

export function rapikanEntertain(x: unknown): Entertain {
  const o = obj(x), b = entertainBaru();
  const a = obj(o.aop), f = obj(o.fpd), r = obj(o.rekening), l = obj(o.link), fo = obj(o.foto);
  const listAppr = (v: unknown, def: Approver[]) => (Array.isArray(v) ? v.slice(0, 8).map((y, i) => appr(y, def[i] || { nama: '', jabatan: '', status: '', tgl: '' })) : def);
  const fd = obj(f.dibuat);
  return {
    id: str(o.id, 80), dibuat: str(o.dibuat, 40), diubah: str(o.diubah, 40), oleh: str(o.oleh, 120),
    noUrut: str(o.noUrut, 20), kode: str(o.kode, 60) || b.kode, tanggal: tgl(o.tanggal),
    pengaju: orang(o.pengaju, b.pengaju), cabang: str(o.cabang, 60) || b.cabang,
    approval: listAppr(o.approval, b.approval),
    perjamuan: (Array.isArray(o.perjamuan) && o.perjamuan.length ? o.perjamuan : b.perjamuan).slice(0, 6).map((p) => {
      const y = obj(p);
      return {
        tgl: tgl(y.tgl), produk: (PRODUK as readonly string[]).includes(str(y.produk)) ? (str(y.produk) as Perjamuan['produk']) : 'Mobilku',
        tempat: str(y.tempat, 200), nominal: num(y.nominal),
        menjamu: (Array.isArray(y.menjamu) ? y.menjamu : []).slice(0, 10).map((m) => orang(m, { nama: '', jabatan: '' })),
        dijamu: str(y.dijamu, 2000), jabatanDijamu: str(y.jabatanDijamu, 2000), perusahaan: str(y.perusahaan, 2000),
      };
    }),
    ma: (Array.isArray(o.ma) ? o.ma : []).slice(0, 20).map((m) => { const y = obj(m); return { nama: str(y.nama, 120), plan: str(y.plan, 200), fincoy: str(y.fincoy, 200), historis: str(y.historis, 200) }; }),
    rekening: { nama: str(r.nama, 120) || (typeof r.nama === 'string' ? '' : b.rekening.nama), nomor: typeof r.nomor === 'string' ? str(r.nomor, 40) : b.rekening.nomor, bank: typeof r.bank === 'string' ? str(r.bank, 60) : b.rekening.bank, cabangBank: typeof r.cabangBank === 'string' ? str(r.cabangBank, 60) : b.rekening.cabangBank },
    link: { aop: /^https:\/\//.test(str(l.aop)) ? str(l.aop, 500) : '', fpd: /^https:\/\//.test(str(l.fpd)) ? str(l.fpd, 500) : '' },
    aop: {
      perihal: typeof a.perihal === 'string' ? str(a.perihal, 200) : b.aop.perihal, beban: typeof a.beban === 'string' ? str(a.beban, 120) : b.aop.beban,
      aopTahun: num(a.aopTahun), aopDeviasi: num(a.aopDeviasi), aopTerpakai: num(a.aopTerpakai), aopProses: num(a.aopProses),
      danaAnggaran: num(a.danaAnggaran), danaTerpakai: num(a.danaTerpakai), danaProses: num(a.danaProses),
      disiapkan: listAppr(a.disiapkan, b.aop.disiapkan),
    },
    fpd: {
      nomor: str(f.nomor, 80), dari: typeof f.dari === 'string' ? str(f.dari, 200) : b.fpd.dari, lokasi: typeof f.lokasi === 'string' ? str(f.lokasi, 120) : b.fpd.lokasi,
      pembayaran: str(f.pembayaran, 300), totalAnggaran: num(f.totalAnggaran), proses: num(f.proses),
      dibuat: { ...appr(fd, b.fpd.dibuat), telp: typeof fd.telp === 'string' ? str(fd.telp, 40) : b.fpd.dibuat.telp, email: typeof fd.email === 'string' ? str(fd.email, 120) : b.fpd.dibuat.email },
      diperiksa: orang(f.diperiksa, b.fpd.diperiksa),
      disetujui: Array.isArray(f.disetujui) ? f.disetujui.slice(0, 4).map((y, i) => orang(y, b.fpd.disetujui[i] || { nama: '', jabatan: '' })) : b.fpd.disetujui,
      uraian: str(f.uraian, 4000),
    },
    foto: { nota: foto(fo.nota), dokumentasi: foto(fo.dokumentasi) },
  };
}

// Isian otomatis yang mengikuti data lain kalau dibiarkan kosong
export const pembayaranFpd = (e: Entertain) => e.fpd.pembayaran.trim() || `FPD IM Pengajuan ENTERTAIN MARKETING ${kotaCabang(e.cabang)} ${periodeDari(tglPerjamuan(e))}`;
export const nomorFpd = (e: Entertain) => e.fpd.nomor.trim() || nomorIM(e);
export const ringkasEnt = (e: Entertain) => [e.perjamuan.map((p) => p.tempat).filter(Boolean).join(', ') || 'Form entertain', tglPanjang(tglPerjamuan(e))].filter(Boolean).join(' · ');
