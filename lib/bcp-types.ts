// Format aplikasi BCP: isian per bagian, hasilnya teks siap tempel ke WhatsApp dengan susunan baku cabang.
// Terhubung dengan report survey 6C + 1E + 1P: kalau nama konsumen sama, isian yang masih kosong diambil dari report
// (data konsumen, penghasilan, pengajuan) dan Note MAO diisi kekuatan konsumen dari analisa 6C 1EP.
import { kunciNama } from './banding-report';
import { UNSUR, hitungKapasitas, fmtPersen, labaOf, type Penghasilan, type ReportSurvey } from './report-survey';

export type PhBcp = { omzetHari: number; hariKerja: number; omzetBulan: number; margin: number; gaji: number; tambahan: number; tambahanKet: string };
export type Bcp = {
  id: string; dibuat: string; diubah: string; oleh: string; email: string;
  nama: string; pekerjaan: string; alamat: string; profesi: string;
  pasNama: string; pasPekerjaan: string; pasAlamat: string;
  pem: PhBcp; hpPemohon: string;
  pas: PhBcp; pengeluaran: number; hpPasangan: string;
  rumah: string;
  econtNama: string; econtAlamat: string; econtHubungan: string; econtTelp: string;
  unit: string; tahun: string; stnk: string; otr: number; pencairan: number; tenor: number; angsuran: number; pot: string;
  jenisKonsumen: string; jenisAplikasi: string;
  mao: string; nikMao: string;
  soa: string; ref1: string; idRef1: string; grup1: string; ref2: string; idRef2: string; grup2: string;
  jenisCair: string; bank: string; noRek: string; namaRek: string;
  tujuan: string; note: string; linkBa: string; linkFolder: string;
  reportId: string;   // report survey 6C 1EP yang terhubung (terakhir dipakai mengisi)
};

export const JENIS_KONSUMEN = ['New Customer', 'Repeat Order'] as const;
export const JENIS_APLIKASI = ['NEW APPLICATION', 'Top up', 'takeover'] as const;
export const KEPEMILIKAN = ['Milik sendiri', 'Milik orang tua', 'Sewa / kontrak', 'Rumah dinas'] as const;
export const JENIS_CAIR = ['Transfer', 'Tunai'] as const;
export const TUJUAN = ['MODAL USAHA', 'PENDIDIKAN', 'RENOVASI RUMAH', 'PENGOBATAN', 'KEBUTUHAN KONSUMTIF'] as const;

export const phKosong = (): PhBcp => ({ omzetHari: 0, hariKerja: 0, omzetBulan: 0, margin: 0, gaji: 0, tambahan: 0, tambahanKet: '' });
export function bcpBaru(p: Partial<Bcp> = {}): Bcp {
  return {
    id: '', dibuat: '', diubah: '', oleh: '', email: '',
    nama: '', pekerjaan: '', alamat: '', profesi: '',
    pasNama: '', pasPekerjaan: '', pasAlamat: '',
    pem: phKosong(), hpPemohon: '', pas: phKosong(), pengeluaran: 0, hpPasangan: '',
    rumah: '', econtNama: '', econtAlamat: '', econtHubungan: '', econtTelp: '',
    unit: '', tahun: '', stnk: '', otr: 0, pencairan: 0, tenor: 0, angsuran: 0, pot: '',
    jenisKonsumen: '', jenisAplikasi: '', mao: '', nikMao: '',
    soa: '', ref1: '', idRef1: '', grup1: '', ref2: '', idRef2: '', grup2: '',
    jenisCair: '', bank: '', noRek: '', namaRek: '', tujuan: 'MODAL USAHA', note: '', linkBa: '', linkFolder: '', reportId: '',
    ...p,
  };
}

/* ---------- Hitungan penghasilan ---------- */
/** Omzet per bulan: omzet per hari × hari kerja kalau keduanya diisi, selain itu isian omzet per bulan. */
export const omzetBulanOf = (p: PhBcp) => (p.omzetHari && p.hariKerja ? p.omzetHari * p.hariKerja : p.omzetBulan);
/** Penghasilan bersih = omzet per bulan × margin + gaji (kalau pegawai). */
export const bersihOf = (p: PhBcp) => Math.floor((omzetBulanOf(p) * p.margin) / 100) + p.gaji;

/* ---------- Simpan / baca ---------- */
export function rapikanBcp(x: unknown): Bcp {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
  const num = (v: unknown) => { const n = Number(v); return isFinite(n) && n > 0 ? Math.round(n) : 0; };
  const ph = (v: unknown): PhBcp => {
    const q = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    return { omzetHari: num(q.omzetHari), hariKerja: Math.min(31, num(q.hariKerja)), omzetBulan: num(q.omzetBulan), margin: Math.min(100, num(q.margin)), gaji: num(q.gaji), tambahan: num(q.tambahan), tambahanKet: str(q.tambahanKet, 100) };
  };
  const b = bcpBaru();
  const out = { ...b } as Record<string, unknown>;
  for (const k of Object.keys(b) as (keyof Bcp)[]) {
    if (k === 'pem' || k === 'pas') out[k] = ph(o[k]);
    else if (typeof b[k] === 'number') out[k] = num(o[k]);
    else out[k] = str(o[k], k === 'note' || k === 'alamat' || k === 'pasAlamat' || k === 'econtAlamat' ? 3000 : k === 'linkBa' || k === 'linkFolder' ? 600 : 200);
  }
  if (!str(o.tujuan)) out.tujuan = 'MODAL USAHA';
  return out as Bcp;
}

/* ---------- Teks WhatsApp (susunan baku cabang) ---------- */
const rp = (n: number) => (n ? `Rp ${n.toLocaleString('id-ID')}` : '-');
const isi = (v: string) => (v.trim() ? v.trim() : '-');
export function teksBcp(b: Bcp): string {
  const L = (label: string, v: string) => `${label} : ${v}`;
  const ph = (p: PhBcp) => [
    L('Omzet per hari', rp(p.omzetHari)),
    L('Jumlah hari kerja', p.hariKerja ? `${p.hariKerja} hari` : '-'),
    L('Omset per bulan', rp(omzetBulanOf(p))),
    L('Margin', p.margin ? `${p.margin}%` : '-'),
    L('Penghasilan bersih', rp(bersihOf(p))),
    L('Penghasilan Tambahan', p.tambahan ? `${rp(p.tambahan)}${p.tambahanKet.trim() ? ` (${p.tambahanKet.trim()})` : ''}` : '-'),
  ];
  return [
    '*FORMAT APLIKASI BCP*',
    '',
    '*Data Konsumen*',
    L('Nama', isi(b.nama)), L('Pekerjaan', isi(b.pekerjaan)), L('Alamat domisili', isi(b.alamat)), L('Profesi', isi(b.profesi)),
    '',
    '*Data Pasangan*',
    L('Nama', isi(b.pasNama)), L('Pekerjaan', isi(b.pasPekerjaan)), L('Alamat domisili', isi(b.pasAlamat)),
    '',
    '*Penghasilan Pemohon*',
    ...ph(b.pem), L('No HP Pemohon', isi(b.hpPemohon)),
    '',
    '*Penghasilan Pasangan*',
    ...ph(b.pas), L('Pengeluaran Pemohon', rp(b.pengeluaran)), L('No telp pasangan', isi(b.hpPasangan)),
    '',
    L('Kepemilikan Rumah', isi(b.rumah)),
    '',
    '*Data Emergency contact*',
    L('Nama Econt', isi(b.econtNama)), L('Alamat', isi(b.econtAlamat)), L('Hubungan dengan Econt', isi(b.econtHubungan)), L('No Telp', isi(b.econtTelp)),
    '',
    '*Struktur Pembiayaan*',
    L('Type Unit', isi(b.unit)), L('Tahun', isi(b.tahun)), L('Nama STNK', isi(b.stnk)), L('OTR', rp(b.otr)),
    L('Pencairan', rp(b.pencairan)), L('Tenor', b.tenor ? `${b.tenor} bulan` : '-'), L('Angsuran', rp(b.angsuran)), L('POT', isi(b.pot)),
    L('Jenis Konsumen', isi(b.jenisKonsumen)), L('Jenis Aplikasi', isi(b.jenisAplikasi)),
    '',
    L('Nama MAO', isi(b.mao)), L('NIK MAO', isi(b.nikMao)),
    '',
    L('Sumber Order / SOA', isi(b.soa)),
    L('REF 1', isi(b.ref1)), L('ID REF', isi(b.idRef1)), L('REF GROUP', isi(b.grup1)),
    L('REF 2', isi(b.ref2)), L('ID REF', isi(b.idRef2)), L('REF GROUP', isi(b.grup2)),
    '',
    L('Jenis pencairan', isi(b.jenisCair)),
    '',
    '*Data rekening*',
    L('Nama bank', isi(b.bank)), L('No rek', isi(b.noRek)), L('Nama rekening', isi(b.namaRek)),
    '',
    L('Tujuan Penggunaan Dana', isi(b.tujuan)),
    '',
    '*Note MAO* :',
    isi(b.note),
    '',
    L('LINK BA BCP', isi(b.linkBa)),
    '',
    L('LINK FOLDER', isi(b.linkFolder)),
  ].join('\n');
}

/* ---------- Integrasi report survey 6C + 1E + 1P ---------- */
export const samaNama = (a: string, b: string) => { const x = kunciNama(a), y = kunciNama(b); return x.length >= 3 && x === y; };
/** Report 6C 1EP untuk BCP ini: yang pernah dipakai mengisi (selama namanya masih sama), selain itu report terbaru dengan nama sama. */
export function cariReportBcp(b: Pick<Bcp, 'nama' | 'reportId'>, list: ReportSurvey[]): ReportSurvey | null {
  const terikat = b.reportId ? list.find((r) => r.id === b.reportId) : undefined;
  if (terikat && samaNama(b.nama, terikat.nama)) return terikat;
  return list.filter((r) => samaNama(b.nama, r.nama)).sort((p, q) => (q.diubah || q.dibuat).localeCompare(p.diubah || p.dibuat))[0] || null;
}
export const cariBcp = (r: Pick<ReportSurvey, 'nama' | 'id'>, list: Bcp[]) =>
  list.find((b) => b.reportId === r.id && samaNama(b.nama, r.nama)) ||
  list.filter((b) => samaNama(b.nama, r.nama)).sort((p, q) => (q.diubah || q.dibuat).localeCompare(p.diubah || p.dibuat))[0] || null;

// Kekuatan konsumen dari analisa 6C 1EP (Constraint = hambatan, tidak ikut)
export function noteDariReport(r: ReportSurvey): string {
  const kap = hitungKapasitas(r);
  const poin = (t: string) => t.split('\n').map((x) => x.trim().replace(/^[-•]\s*/, '')).filter(Boolean);
  const out: string[] = [];
  for (const [k, label] of UNSUR) {
    if (k === 'constraint') continue;
    const p = poin(r.c6[k]);
    if (k === 'capacity' && kap.penghasilan > 0) p.unshift(`Penghasilan ${kap.penghasilan.toLocaleString('id-ID')}/bln, IIR ${fmtPersen(kap.iir)}, DSR ${fmtPersen(kap.dsr)}`);
    if (!p.length) continue;
    out.push(p.length === 1 ? `- ${label}: ${p[0]}` : [`- ${label}:`, ...p.map((x) => `  • ${x}`)].join('\n'));
  }
  return out.join('\n');
}

const dariPh = (p: Penghasilan): PhBcp => ({ omzetHari: 0, hariKerja: 0, omzetBulan: p.omzet, margin: p.margin, gaji: p.gaji, tambahan: p.tambahan, tambahanKet: p.tambahanKet });
// Hari kerja saja belum dihitung terisi (sering diisi duluan oleh MAO)
const phKosongkah = (p: PhBcp) => !(p.omzetHari || p.omzetBulan || p.margin || p.gaji || p.tambahan || p.tambahanKet.trim());

/** Isi BCP dari report. timpa=false: hanya isian yang masih kosong. Mengembalikan BCP baru + jumlah isian yang berubah. */
export function bcpDariReport(b: Bcp, r: ReportSurvey, timpa = false): { b: Bcp; n: number } {
  let n = 0;
  const x: Bcp = { ...b, reportId: r.id || b.reportId };
  const teks = <K extends keyof Bcp>(k: K, v: string) => {
    const lama = String(x[k] ?? '');
    if (!v.trim() || (!timpa && lama.trim()) || lama === v) return;
    (x as Record<string, unknown>)[k] = v; n++;
  };
  const angka = <K extends keyof Bcp>(k: K, v: number) => {
    if (!v || (!timpa && x[k]) || x[k] === v) return;
    (x as Record<string, unknown>)[k] = v; n++;
  };
  if (!x.nama.trim()) teks('nama', r.nama.toUpperCase()); // nama yang sudah ada tidak ditimpa (bisa beda sapaan saja)
  teks('pekerjaan', r.pekerjaan);
  teks('alamat', r.alamat);
  teks('unit', r.unit);
  angka('pencairan', r.pencairan); angka('tenor', r.tenor); angka('angsuran', r.angsuran);
  teks('jenisKonsumen', r.status === 'NC' ? 'New Customer' : r.status === 'RO' || r.status === 'AO' || r.status === 'Top Up' ? 'Repeat Order' : '');
  teks('jenisAplikasi', r.status === 'Top Up' ? 'Top up' : /take\s*over/i.test(r.program) ? 'takeover' : r.status || r.program ? 'NEW APPLICATION' : '');
  const k = r.kapasitas;
  // Omzet di report = omzet per bulan; omzet per hari & hari kerja tetap diisi MAO (kalau diisi, omzet per bulan dihitung ulang)
  for (const [kb, kr] of [['pem', 'kons'], ['pas', 'pas']] as const) {
    const p = k[kr];
    if (!(p.omzet || p.gaji || p.tambahan) || !(timpa || phKosongkah(x[kb]))) continue;
    const baru = { ...dariPh(p), hariKerja: x[kb].hariKerja };
    if (JSON.stringify(baru) !== JSON.stringify(x[kb])) { x[kb] = baru; n++; }
  }
  const note = noteDariReport(r);
  if (note && (timpa || !x.note.trim()) && x.note !== note) { x.note = note; n++; }
  return { b: x, n };
}

export const ringkasBcp = (b: Bcp) => [b.unit, b.pencairan ? `Rp ${b.pencairan.toLocaleString('id-ID')}` : '', b.jenisAplikasi].filter(Boolean).join(' · ');
export { labaOf };

/** Nama & NIK MAO untuk BCP baru: dari BCP terakhir akun ini, kalau belum ada pakai nama akun. */
export function bawaanMao(list: Bcp[], akun: { email: string; nama: string }): Pick<Bcp, 'mao' | 'nikMao'> {
  const e = akun.email.toLowerCase();
  const lama = list.filter((b) => b.email.toLowerCase() === e && (b.mao || b.nikMao)).sort((p, q) => q.diubah.localeCompare(p.diubah))[0];
  return lama ? { mao: lama.mao, nikMao: lama.nikMao } : { mao: akun.nama.toUpperCase(), nikMao: '' };
}
