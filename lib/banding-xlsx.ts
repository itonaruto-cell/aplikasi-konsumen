// Excel F-761 Form Analisa Banding Branch Head, susunan mengikuti template kantor (kolom B–H, judul biru muda,
// checklist dokumen, analisa 6C+1EP, SWOT, reason, lampiran foto 3 kolom, lembar persetujuan, lembar SLIK).
import { Lembar, buatXlsxLembar, kolomPx, type Gaya } from './xlsx-lembar';
import { DOK_CEK, KAT_FOTO, bacaSlik, teks6C, teksSwot, tglPanjang, type Banding, type Cek, type KatFoto } from './banding-types';

export type FotoFile = { kat: KatFoto; ket: string; data: Uint8Array; ext: 'jpeg' | 'png'; w: number; h: number; src?: string };

const GAYA: Gaya[] = [
  /* 1 judul */ { size: 20, bold: true, fill: '00FFFF', border: 'thick', h: 'center', v: 'center' },
  /* 2 label */ { size: 12, bold: true },
  /* 3 kepala bagian */ { size: 14, bold: true, color: '000000', fill: 'CFE2F3', border: 'thin', h: 'left', v: 'center' },
  /* 4 kotak teks */ { size: 14, bold: true, color: '000000', fill: 'FFFFFF', border: 'thin', h: 'left', v: 'top', wrap: true },
  /* 5 catatan merah */ { size: 11, bold: true, color: 'FF0000' },
  /* 6 kepala tabel */ { size: 13, bold: true, fill: 'CCCCCC', border: 'thin', h: 'center', v: 'center', wrap: true },
  /* 7 grup tabel */ { size: 13, bold: true, border: 'thin', v: 'center', wrap: true },
  /* 8 sel tabel */ { size: 12, border: 'thin', v: 'center' },
  /* 9 cek tabel */ { size: 12, border: 'thin', h: 'center', v: 'center' },
  /* 10 keterangan miring */ { size: 10, italic: true, wrap: true, v: 'top' },
  /* 11 lampiran judul */ { size: 13, bold: true, color: '0000FF' },
  /* 12 lampiran kepala */ { size: 14, bold: true, fill: 'D9D9D9', border: 'thin', h: 'center', v: 'center', wrap: true },
  /* 13 lampiran sel */ { size: 11, border: 'thin', h: 'left', v: 'top', wrap: true },
  /* 14 persetujuan kepala */ { size: 14, bold: true, fill: 'BDD7EE', border: 'thin', v: 'center' },
  /* 15 persetujuan sel */ { size: 13, border: 'thin', v: 'center' },
  /* 16 persetujuan tengah */ { size: 13, border: 'thin', h: 'center', v: 'center' },
  /* 17 disclaimer */ { size: 10, bold: true, border: 'bawahTebal', h: 'left' },
  /* 18 slik kepala */ { size: 10, bold: true, fill: 'D9D9D9', border: 'thin', h: 'center', v: 'center', wrap: true },
  /* 19 slik sel */ { size: 10, border: 'thin', v: 'center' },
  /* 20 label tebal 13 */ { size: 13, bold: true },
];
const S = { judul: 1, label: 2, kepala: 3, teks: 4, merah: 5, kTabel: 6, grup: 7, sel: 8, cek: 9, ket: 10, lJudul: 11, lKepala: 12, lSel: 13, pKepala: 14, pSel: 15, pTengah: 16, disc: 17, sKepala: 18, sSel: 19, label13: 20 };
const LEBAR = [1.25, 1.88, 36.25, 37, 68.88, 25.13, 129, 1.88];
const C = 3, D = 4, E = 5, F = 6, G = 7;

// Area lampiran per kategori: kolom awal, kolom akhir (gabungan) dan lebar dalam piksel
const lebarKolom = (dari: number, sampai: number) => LEBAR.slice(dari - 1, sampai).reduce((s, w) => s + kolomPx(w), 0);
export const AREA_FOTO: Record<KatFoto, { col: number; gab?: number; lebar: number }> = {
  mandatory: { col: C, gab: D, lebar: lebarKolom(C, D) },
  ots: { col: E, lebar: lebarKolom(E, E) },
  tambahan: { col: F, gab: G, lebar: lebarKolom(F, G) },
};
// Posisi x di dalam area → kolom & geseran (oneCellAnchor menempel ke kolom tempat foto mulai)
function jangkar(col: number, x: number) {
  let c = col, sisa = x;
  while (c < LEBAR.length && sisa >= kolomPx(LEBAR[c - 1])) { sisa -= kolomPx(LEBAR[c - 1]); c++; }
  return { kolom: c, dx: sisa };
}

export type Posisi = { baris: number; x: number; w: number; h: number };
const JARAK = 8, MAKS_BARIS = 4;
// Susun foto berderet menyamping dengan tinggi sama; pindah baris kalau tidak muat
export function deret(foto: { w: number; h: number }[], lebar: number, H: number): Posisi[] {
  const out: Posisi[] = [];
  let x = JARAK, baris = 0;
  for (const f of foto) {
    let h = H, w = Math.round((f.w / f.h) * H);
    const maks = lebar - JARAK * 2;
    if (w > maks) { w = maks; h = Math.round((f.h / f.w) * w); }
    if (x > JARAK && x + w > lebar - JARAK) { baris++; x = JARAK; }
    out.push({ baris, x, w, h });
    x += w + JARAK;
  }
  return out;
}
// Cari tinggi foto terbesar (maks. 400 px) yang membuat semua kategori muat dalam 4 baris
export function tataLampiran(per: Record<KatFoto, { w: number; h: number }[]>) {
  const susun = (h: number) => Object.fromEntries(KAT_FOTO.map(([k]) => [k, deret(per[k], AREA_FOTO[k].lebar, h)])) as Record<KatFoto, Posisi[]>;
  const nBaris = (p: Record<KatFoto, Posisi[]>) => Math.max(0, ...KAT_FOTO.map(([k]) => (p[k].length ? p[k][p[k].length - 1].baris + 1 : 0)));
  // Utamakan baris sesedikit mungkin (foto menyamping) selama foto masih terbaca (tinggi ≥ 260 px),
  // lalu pilih foto terbesar untuk jumlah baris itu.
  let H = 400, posisi = susun(H), terbaik = nBaris(posisi);
  for (let h = 390; h >= 260; h -= 10) {
    const p = susun(h), n = nBaris(p);
    if (n < terbaik) { H = h; posisi = p; terbaik = n; }
  }
  while (H > 90 && nBaris(posisi) > MAKS_BARIS) { H -= 10; posisi = susun(H); }
  const tinggi = Math.max(120, ...KAT_FOTO.flatMap(([k]) => posisi[k].map((p) => p.h)));
  return { posisi, baris: Math.max(1, nBaris(posisi)), tinggi };
}

// Perkiraan tinggi kotak teks (font 14 tebal, lebar C–G ≈ 170 karakter per baris)
export function tinggiTeks(t: string, perBaris = 170, min = 24): number {
  const baris = String(t || '').split('\n').reduce((s, p) => s + Math.max(1, Math.ceil(p.length / perBaris)), 0);
  return Math.max(min, baris * 19 + 10);
}

// Kotak teks gabungan C..G; tinggi lebih dari batas satu baris Excel (409 pt) dibagi ke beberapa baris
function blok(l: Lembar, r: number, t: string, min = 24): number {
  const h = tinggiTeks(t, 170, min);
  const n = Math.max(1, Math.ceil(h / 400));
  l.gab(r, C, r + n - 1, G, t, S.teks);
  for (let i = 0; i < n; i++) l.t(r + i, h / n);
  return r + n;
}
const kepala = (l: Lembar, r: number, judul: string) => { l.gab(r, C, r, G, judul, S.kepala).t(r, 24); return r + 1; };
const jarak = (l: Lembar, r: number, h = 7.5) => { l.t(r, h); return r + 1; };

export function lembarBanding(b: Banding, foto: FotoFile[]): Lembar {
  const l = new Lembar('Form Analisa Banding', LEBAR);
  let r = 1;
  r = jarak(l, r);
  l.gab(r, 2, r, 8, 'FORM ANALISA BANDING BRANCH HEAD', S.judul).t(r, 42); r++;
  r = jarak(l, r);
  for (const [k, v] of [['App No.', b.appNo], ['Nama Konsumen', b.nama], ['Brand', b.brand], ['Cabang', b.cabang], ['Nama Branch Head', b.bh], ['Tanggal Banding Aplikasi', tglPanjang(b.tanggal)]]) {
    l.set(r, C, k, S.label).set(r, D, `: ${v || ''}`, S.label); r++;
  }
  r = jarak(l, r);
  r = kepala(l, r, 'REASON REJECT CREDIT');
  r = blok(l, r, b.rejectCredit, 120);
  r = jarak(l, r, 3);
  r = kepala(l, r, 'REASON REJECT AREA CREDIT & AMU MANAGER');
  r = blok(l, r, b.rejectCam, 42);
  r = kepala(l, r, 'REASON REJECT CREDIT DEPT HEAD');
  r = blok(l, r, b.rejectCdh, 24);
  r = kepala(l, r, 'MARKETING HEAD REQUEST BANDING');
  l.set(r, C, '*Dokumen Checklist', S.merah); r++;

  // Checklist dokumen
  l.gab(r, C, r, D, 'Dokumen*', S.kTabel).set(r, E, 'Dokumen Yang Diupload Saat Banding', S.kTabel).set(r, F, 'Valid', S.kTabel).set(r, G, 'Tidak Valid', S.kTabel).t(r, 24); r++;
  const grupLabel: Record<KatFoto, string> = { mandatory: 'Dokumen Mandatory', ots: 'Dokumen & PIC OTS', tambahan: 'Dokumen Tambahan ' };
  for (const [kat] of KAT_FOTO) {
    const isi: [string, Cek][] = DOK_CEK.filter((d) => d.grup === kat).map((d) => [d.label, b.dok[d.k] || '']);
    if (kat === 'tambahan') isi.push([b.dokLain, b.dokLain ? b.dokLainCek : '']);
    l.gab(r, C, r + isi.length - 1, D, grupLabel[kat], S.grup);
    for (const [label, c] of isi) { l.set(r, E, label, S.sel).set(r, F, c === 'valid', S.cek).set(r, G, c === 'tidak', S.cek).t(r, 18); r++; }
  }
  l.gab(r, C, r, G, '*Document yang diupload saat banding adalah Document yang tidak ada / tidak valid saat analisa CAC dan sebagai bukti bahwa dokumen yang dilampirkan sudah dilakukan pengecekan oleh BH dan wajib dipertanggung jawabkan serta "subject to audit"', S.ket).t(r, 30); r++;
  r = jarak(l, r, 3.75);

  r = kepala(l, r, 'ANALISA 6C + 1 EP');
  r = blok(l, r, teks6C(b.c6), 120);
  r = jarak(l, r, 3.75);
  r = kepala(l, r, 'ANALISA SWOT');
  r = blok(l, r, teksSwot(b.swot), 120);
  r = jarak(l, r, 3.75);
  r = kepala(l, r, 'REASON BANDING MARKETING HEAD');
  r = blok(l, r, b.reasonMh, 120);
  r = jarak(l, r, 4.5);
  r = kepala(l, r, 'REASON APPROVE BANDING BRANCH HEAD');
  r = blok(l, r, b.reasonBh, 150);
  r = jarak(l, r, 6);

  // Lampiran foto: tiga kolom (Mandatory C:D, OTS E, Tambahan F:G). Foto disusun menyamping selama muat,
  // maksimal 4 baris ke bawah; tinggi foto disamakan supaya rapi.
  l.set(r, C, 'Lampiran Dokumen', S.lJudul); r++;
  l.gab(r, C, r, D, 'Dokumen Mandatory', S.lKepala).set(r, E, 'Dokumen & PIC OTS', S.lKepala).gab(r, F, r, G, 'Dokumen Tambahan', S.lKepala).t(r, 25.5); r++;
  const tempat = AREA_FOTO;
  const per = Object.fromEntries(KAT_FOTO.map(([k]) => [k, foto.filter((f) => f.kat === k && f.w && f.h)])) as Record<KatFoto, FotoFile[]>;
  const tata = tataLampiran(per);
  for (let i = 0; i < tata.baris; i++) {
    // baris keterangan: nomor + keterangan foto di baris ini
    for (const [k] of KAT_FOTO) {
      const t = tempat[k];
      const teks = tata.posisi[k].map((p, n) => (p.baris === i ? `${n + 1}. ${per[k][n].ket || ''}`.trim() : '')).filter(Boolean).join('   ');
      if (t.gab) l.gab(r, t.col, r, t.gab, teks, S.lSel); else l.set(r, t.col, teks, S.lSel);
    }
    l.t(r, 18); r++;
    for (const [k] of KAT_FOTO) {
      const t = tempat[k];
      if (t.gab) l.gab(r, t.col, r, t.gab, null, S.lSel); else l.set(r, t.col, null, S.lSel);
      tata.posisi[k].forEach((p, n) => {
        if (p.baris !== i) return;
        const f = per[k][n];
        const a = jangkar(t.col, p.x);
        l.gambar.push({ baris: r, kolom: a.kolom, dx: a.dx, dy: 6, w: p.w, h: p.h, data: f.data, ext: f.ext, src: f.src });
      });
    }
    l.t(r, tata.tinggi * 0.75 + 12); r++;
  }
  r = jarak(l, r, 7.5);

  // Lembar persetujuan
  l.gab(r, C, r, G, 'LEMBAR PERSETUJUAN', S.pKepala).t(r, 27); r++;
  l.set(r, C, 'Dibuat Oleh:', S.label13); r++;
  l.set(r, C, b.pembuat, S.pSel).set(r, D, b.jabatan, S.pSel).set(r, E, b.status === 'selesai' ? 'Submitted' : 'Draft', S.pTengah).gab(r, F, r, G, tglPanjang(b.tanggal), S.pTengah).t(r, 20); r++;
  r = jarak(l, r);
  l.set(r, C, 'Disetujui Oleh:', S.label13); r++;
  l.set(r, C, b.bh, S.pSel).set(r, D, 'Branch Head', S.pSel).set(r, E, '', S.pTengah).gab(r, F, r, G, '', S.pTengah).t(r, 20); r++;
  // Approval BU Head opsional: baris hanya dicetak kalau namanya diisi
  if (b.buh.trim()) { l.set(r, C, b.buh, S.pSel).set(r, D, 'BU Head', S.pSel).set(r, E, '', S.pTengah).gab(r, F, r, G, '', S.pTengah).t(r, 20); r++; }
  r = jarak(l, r);
  l.gab(r, C, r, G, '*disclaimer, formulir ini Untuk Kalangan Internal WOM Finance', S.disc).t(r, 15.75);
  return l;
}

export function lembarSlik(b: Banding): Lembar | null {
  const rows = bacaSlik(b.slik);
  if (!rows.length) return null;
  const nKol = Math.max(...rows.map((x) => x.length));
  const lebar = [1.25, ...Array.from({ length: nKol }, (_, j) => Math.min(45, Math.max(8, ...rows.map((x) => (x[j] || '').length + 2))))];
  const l = new Lembar('SLIK', lebar);
  l.set(2, 2, 'Customer', S.label);
  rows.forEach((x, i) => {
    for (let j = 0; j < nKol; j++) {
      const v = x[j] ?? '';
      const angka = i > 0 && /^-?\d+$/.test(v) && v.length < 6 ? Number(v) : v;   // nomor rekening tetap teks
      l.set(i + 3, j + 2, angka, i === 0 ? S.sKepala : S.sSel);
    }
    l.t(i + 3, i === 0 ? 30 : 16);
  });
  return l;
}

export const GAYA_BANDING = GAYA;
export function susunBanding(b: Banding, foto: FotoFile[]): Lembar[] {
  const lembar = [lembarBanding(b, foto)];
  const slik = lembarSlik(b);
  if (slik) lembar.push(slik);
  return lembar;
}
export function buatFormBanding(b: Banding, foto: FotoFile[]): Uint8Array {
  return buatXlsxLembar(susunBanding(b, foto), GAYA, `F-761 ${b.nama}`);
}
