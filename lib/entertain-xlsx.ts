// Isi tiga template kantor dari satu Form Entertain:
//   public/template/entertain.xlsx  → F-384 Form Entertain (lembar Form Perjamuan + Dokumentasi & Nota/Struk)
//   public/template/saldo-aop.xlsx  → Form Konfirmasi Saldo AOP (lembar AOP_Pengajuan AOP ke Cabang&BU)
//   public/template/fpd.xlsx        → FPD (F-109)
import {
  aturLink, bukaZip, hitungUlang, isiSel, nilaiRumus, pasangGambar, serialTgl, teksDari, tinggiBaris, tulisTeks, tutupZip, gayaSel,
  type Berkas, type Gambar,
} from './xlsx-isi';
import {
  namaFileAop, namaFileEnt, namaFileFpd, nomorFpd, nomorIM, pembayaranFpd, periodeDari, sisaAop, sisaDana, tglPanjang, totalEnt,
  type Entertain,
} from './entertain-types';

export type FotoData = { data: Uint8Array; ext: 'jpeg' | 'png'; w: number; h: number };
export type HasilFile = { nama: string; data: Uint8Array };

const daftarBernomor = (baris: string[]) => {
  const isi = baris.map((x) => x.trim()).filter(Boolean);
  return isi.length > 1 ? isi.map((x, i) => `${i + 1}. ${x}`).join('\n') : isi.join('');
};
const barisTeks = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean);
const ubah = (b: Berkas, sheet: string, f: (xml: string) => string) => tulisTeks(b, sheet, f(teksDari(b, sheet)));

/* ---------- F-384 Form Entertain ---------- */
export async function isiFormEntertain(tpl: ArrayBuffer, e: Entertain, foto: { nota: FotoData[]; dokumentasi: FotoData[] }): Promise<Uint8Array> {
  const b = await bukaZip(tpl);
  const S = 'xl/worksheets/sheet2.xml';
  const total = totalEnt(e);
  ubah(b, S, (x0) => {
    let x = x0;
    x = isiSel(x, 'D2', nomorIM(e));
    // Approved By: baris 5–7 (pengaju lalu atasan); status & tanggal atasan dikosongkan bila belum ada
    e.approval.slice(0, 3).forEach((a, i) => {
      const r = 5 + i;
      x = isiSel(x, `D${r}`, a.nama); x = isiSel(x, `F${r}`, a.jabatan);
      x = isiSel(x, `J${r}`, a.status || null); x = isiSel(x, `K${r}`, a.tgl ? tglPanjang(a.tgl) : null);
      x = isiSel(x, `L${r}`, null);
    });
    x = isiSel(x, 'F19', `: ${e.pengaju.jabatan.toUpperCase()}`);
    x = isiSel(x, 'F20', `: ${e.cabang.toUpperCase()}`);
    x = isiSel(x, 'F21', `: ${periodeDari(e.tanggal)}`);
    x = isiSel(x, 'F22', `: ${tglPanjang(e.tanggal, true)}`);
    // Detail perjamuan: baris 26–31
    for (let i = 0; i < 6; i++) {
      const r = 26 + i, p = e.perjamuan[i];
      const ada = !!p && (p.nominal > 0 || !!p.tempat.trim());
      x = isiSel(x, `E${r}`, ada && p.tgl ? serialTgl(p.tgl) : null);
      x = isiSel(x, `F${r}`, ada ? p.produk : null);
      x = isiSel(x, `G${r}`, ada ? p.tempat.toUpperCase() : null);
      x = isiSel(x, `H${r}`, ada ? p.nominal : null);
      const menjamu = ada ? p.menjamu.filter((m) => m.nama.trim()) : [];
      const dijamu = ada ? barisTeks(p.dijamu) : [], jab = ada ? barisTeks(p.jabatanDijamu) : [], pt = ada ? barisTeks(p.perusahaan) : [];
      x = isiSel(x, `I${r}`, daftarBernomor(menjamu.map((m) => m.nama.toUpperCase())) || null);
      x = isiSel(x, `J${r}`, daftarBernomor(menjamu.map((m) => m.jabatan.toUpperCase())) || null);
      x = isiSel(x, `K${r}`, daftarBernomor(dijamu.map((y) => y.toUpperCase())) || null);
      x = isiSel(x, `L${r}`, daftarBernomor(jab.map((y) => y.toUpperCase())) || null);
      x = isiSel(x, `M${r}`, daftarBernomor(pt.map((y) => y.toUpperCase())) || null);
      if (ada) x = tinggiBaris(x, r, Math.max(30, 15 * Math.max(menjamu.length, dijamu.length, jab.length, pt.length, 1) + 6));
    }
    x = nilaiRumus(x, 'H32', total);
    x = isiSel(x, 'F40', `: ${e.rekening.nama.toUpperCase()}`);
    x = isiSel(x, 'F41', `: ${e.rekening.nomor}`);
    x = isiSel(x, 'F42', `: ${e.rekening.bank.toUpperCase()}`);
    x = nilaiRumus(x, 'F43', total);
    x = isiSel(x, 'F47', namaFileAop(e));
    x = isiSel(x, 'F49', namaFileFpd(e));
    // Ringkasan per produk (I9–I13) dihitung ulang Excel; nilai tersimpan ikut diperbarui
    (['Reguler', 'Motorku', 'Mobilku', 'Masku'] as const).forEach((pr, i) => {
      x = nilaiRumus(x, `I${9 + i}`, e.perjamuan.filter((p) => p.produk === pr).reduce((a, p) => a + p.nominal, 0));
    });
    x = nilaiRumus(x, 'I13', total);
    // Tabel MA: judul di baris 54, isi mulai baris 55 (gaya baris 55 dipakai untuk baris tambahan)
    const gaya = ['D', 'E', 'F', 'G'].map((k) => gayaSel(x, `${k}55`));
    const nMa = Math.max(6, e.ma.length);
    for (let i = 0; i < nMa; i++) {
      const r = 55 + i, m = e.ma[i];
      ['D', 'E', 'F', 'G'].forEach((k, j) => {
        const v = m ? [m.nama, m.plan, m.fincoy, m.historis][j].toUpperCase() : '';
        x = isiSel(x, `${k}${r}`, v || null, i >= 6 ? gaya[j] : undefined);
      });
    }
    return x;
  });
  aturLink(b, S, 'F47', e.link.aop);
  aturLink(b, S, 'F49', e.link.fpd);

  // Dokumentasi & Nota/Struk: nota di kolom A, dokumentasi di kolom F, bersusun ke bawah
  ubah(b, 'xl/worksheets/sheet3.xml', (x) => isiSel(x, 'A40', null));
  const susun = (list: FotoData[], kol: number, lebar: number, maksTinggi: number): Gambar[] => {
    let baris = 3;
    return list.map((f) => {
      let cx = lebar, cy = (lebar * f.h) / Math.max(1, f.w);
      if (cy > maksTinggi) { cx = (cx * maksTinggi) / cy; cy = maksTinggi; }
      const g: Gambar = { data: f.data, ext: f.ext, kol, baris, cx, cy };
      baris += Math.ceil(cy / 190_500) + 2;
      return g;
    });
  };
  pasangGambar(b, 'xl/drawings/drawing3.xml', [...susun(foto.nota, 0, 5_900_000, 8_500_000), ...susun(foto.dokumentasi, 5, 6_900_000, 5_200_000)]);
  hitungUlang(b);
  return tutupZip(b);
}

/* ---------- Konfirmasi Saldo AOP ---------- */
export async function isiSaldoAop(tpl: ArrayBuffer, e: Entertain): Promise<Uint8Array> {
  const b = await bukaZip(tpl);
  const total = totalEnt(e);
  ubah(b, 'xl/worksheets/sheet3.xml', (x0) => {
    let x = x0;
    x = isiSel(x, 'B3', nomorIM(e));
    x = isiSel(x, 'B4', `: ${e.aop.perihal}`);
    x = isiSel(x, 'B5', total);
    x = isiSel(x, 'B6', `: ${e.aop.beban}`);
    x = isiSel(x, 'B12', e.aop.aopTahun || null);
    x = isiSel(x, 'B13', e.aop.aopDeviasi || null);
    x = isiSel(x, 'B14', e.aop.aopTerpakai || null);
    x = isiSel(x, 'B15', e.aop.aopProses || null);
    x = nilaiRumus(x, 'B16', sisaAop(e));
    x = isiSel(x, 'B22', e.aop.danaAnggaran || null);
    x = isiSel(x, 'B23', e.aop.danaTerpakai || null);
    x = isiSel(x, 'B24', e.aop.danaProses || null);
    x = nilaiRumus(x, 'B25', total);
    x = nilaiRumus(x, 'B26', sisaDana(e));
    x = isiSel(x, 'B28', namaFileEnt(e));
    e.aop.disiapkan.slice(0, 2).forEach((a, i) => {
      const r = 32 + i;
      x = isiSel(x, `A${r}`, a.nama); x = isiSel(x, `B${r}`, a.jabatan); x = isiSel(x, `C${r}`, a.status || null);
      x = isiSel(x, `D${r}`, a.tgl ? serialTgl(a.tgl) : null);
    });
    return x;
  });
  hitungUlang(b);
  return tutupZip(b);
}

/* ---------- FPD (F-109) ---------- */
export async function isiFpd(tpl: ArrayBuffer, e: Entertain): Promise<Uint8Array> {
  const b = await bukaZip(tpl);
  const total = totalEnt(e);
  ubah(b, 'xl/worksheets/sheet1.xml', (x0) => {
    let x = x0;
    const f = e.fpd;
    x = isiSel(x, 'A6', nomorFpd(e));
    x = isiSel(x, 'E8', f.dari);
    x = isiSel(x, 'O8', f.lokasi);
    x = isiSel(x, 'E10', pembayaranFpd(e));
    x = isiSel(x, 'G20', total);
    x = nilaiRumus(x, 'G23', total);
    x = isiSel(x, 'P20', e.rekening.nomor);
    x = isiSel(x, 'P21', e.rekening.nama.toUpperCase());
    x = isiSel(x, 'P22', e.rekening.bank.toUpperCase());
    x = isiSel(x, 'P23', e.rekening.cabangBank.toUpperCase());
    x = isiSel(x, 'E26', f.totalAnggaran);
    x = nilaiRumus(x, 'E27', total);
    x = isiSel(x, 'E28', f.proses);
    x = nilaiRumus(x, 'E29', total);
    x = isiSel(x, 'E35', f.dibuat.nama);
    x = isiSel(x, 'E36', f.dibuat.jabatan);
    x = isiSel(x, 'E37', f.dibuat.status || null);
    x = isiSel(x, 'E38', f.dibuat.tgl ? serialTgl(f.dibuat.tgl) : null);
    x = isiSel(x, 'E39', f.dibuat.telp);
    x = isiSel(x, 'E40', f.dibuat.email);
    x = isiSel(x, 'I35', `: ${f.diperiksa.nama}`);
    x = isiSel(x, 'I36', `: ${f.diperiksa.jabatan}`);
    const [s1, s2] = f.disetujui;
    x = isiSel(x, 'A44', `Nama                                                :   ${s1?.nama || ''}`);
    x = isiSel(x, 'A45', `Jabatan                                             :   ${s1?.jabatan || ''}`);
    x = isiSel(x, 'I44', `: ${s2?.nama || ''}`);
    x = isiSel(x, 'I45', `: ${s2?.jabatan || ''}`);
    return x;
  });
  hitungUlang(b);
  return tutupZip(b);
}

/* ---------- Ketiganya sekaligus ---------- */
export async function buatBerkasEntertain(e: Entertain, foto: { nota: FotoData[]; dokumentasi: FotoData[] }, ambil: (path: string) => Promise<ArrayBuffer>): Promise<HasilFile[]> {
  const [te, ta, tf] = await Promise.all([ambil('/template/entertain.xlsx'), ambil('/template/saldo-aop.xlsx'), ambil('/template/fpd.xlsx')]);
  const [fe, fa, ff] = await Promise.all([isiFormEntertain(te, e, foto), isiSaldoAop(ta, e), isiFpd(tf, e)]);
  return [
    { nama: `${namaFileEnt(e)}.xlsx`, data: fe },
    { nama: `${namaFileAop(e)}.xlsx`, data: fa },
    { nama: `${namaFileFpd(e)}.xlsx`, data: ff },
  ];
}
