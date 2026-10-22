// Pembuat PDF sederhana tanpa library: satu foto JPEG per halaman A4 (tegak / mendatar mengikuti foto),
// dengan catatan kecil di bawah. Dipakai untuk PDF berkas survey per kategori langsung di HP.

const enc = new TextEncoder();
export type HalamanFoto = { jpeg: Uint8Array; w: number; h: number; catatan?: string };

const A4 = { pendek: 595.28, panjang: 841.89 };
const TEPI = 18, KAKI = 16;

// Teks PDF standar (Helvetica) hanya aman untuk huruf Latin dasar
const aman = (s: string) => String(s || '').replace(/[·•–—]/g, '-').normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/([\\()])/g, '\\$1').slice(0, 160);
const angka = (n: number) => (Math.round(n * 100) / 100).toString();

export function buatPdfFoto(halaman: HalamanFoto[], judul = ''): Uint8Array {
  const bagian: Uint8Array[] = [];
  const offset: number[] = [];
  let pos = 0;
  const tulis = (b: Uint8Array | string) => { const x = typeof b === 'string' ? enc.encode(b) : b; bagian.push(x); pos += x.length; };
  const obj = (n: number, isi: (string | Uint8Array)[]) => { offset[n] = pos; tulis(`${n} 0 obj\n`); isi.forEach(tulis); tulis('\nendobj\n'); };

  tulis('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  // 1 = katalog, 2 = daftar halaman, 3 = font, 4 = info; tiap halaman: halaman, isi, gambar
  const n0 = 5;
  const idHal = halaman.map((_, i) => n0 + i * 3);
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, [`<< /Type /Pages /Count ${halaman.length} /Kids [${idHal.map((n) => `${n} 0 R`).join(' ')}] >>`]);
  obj(3, ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']);
  obj(4, [`<< /Title (${aman(judul)}) /Producer (Marketing Kendal) >>`]);

  halaman.forEach((h, i) => {
    const mendatar = h.w > h.h;
    const pw = mendatar ? A4.panjang : A4.pendek, ph = mendatar ? A4.pendek : A4.panjang;
    const ruangW = pw - TEPI * 2, ruangH = ph - TEPI * 2 - (h.catatan ? KAKI : 0);
    const k = Math.min(ruangW / h.w, ruangH / h.h);
    const iw = h.w * k, ih = h.h * k;
    const x = (pw - iw) / 2, y = (h.catatan ? TEPI + KAKI : TEPI) + (ruangH - ih) / 2;
    const isi = `q ${angka(iw)} 0 0 ${angka(ih)} ${angka(x)} ${angka(y)} cm /Im0 Do Q`
      + (h.catatan ? `\nBT /F1 8 Tf 0.35 g ${angka(TEPI)} ${angka(TEPI + 2)} Td (${aman(h.catatan)}) Tj ET` : '');
    const nHal = idHal[i], nIsi = nHal + 1, nGbr = nHal + 2;
    obj(nHal, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${angka(pw)} ${angka(ph)}] /Resources << /XObject << /Im0 ${nGbr} 0 R >> /Font << /F1 3 0 R >> >> /Contents ${nIsi} 0 R >>`]);
    obj(nIsi, [`<< /Length ${enc.encode(isi).length} >>\nstream\n`, isi, '\nendstream']);
    obj(nGbr, [`<< /Type /XObject /Subtype /Image /Width ${h.w} /Height ${h.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${h.jpeg.length} >>\nstream\n`, h.jpeg, '\nendstream']);
  });

  const total = n0 + halaman.length * 3;
  const xref = pos;
  let t = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) t += `${String(offset[n]).padStart(10, '0')} 00000 n \n`;
  tulis(t);
  tulis(`trailer\n<< /Size ${total} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(pos);
  let p = 0;
  for (const b of bagian) { out.set(b, p); p += b.length; }
  return out;
}
