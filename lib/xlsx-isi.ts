// Mengisi template .xlsx yang sudah ada (format kantor tetap utuh): buka zip, ubah sel di XML, pasang gambar, tutup zip.
// Berjalan di browser (dan Node 18+) memakai DecompressionStream / CompressionStream bawaan.

export type Berkas = Map<string, Uint8Array>;
const enc = new TextEncoder(), dec = new TextDecoder();
export const teksDari = (b: Berkas, nama: string) => dec.decode(b.get(nama) || new Uint8Array());
export const tulisTeks = (b: Berkas, nama: string, isi: string) => { b.set(nama, enc.encode(isi)); };

async function alir(data: Uint8Array, aliran: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const keluar = new Blob([data as BlobPart]).stream().pipeThrough(aliran as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(keluar).arrayBuffer());
}

export async function bukaZip(buf: ArrayBuffer | Uint8Array): Promise<Berkas> {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const v = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let eocd = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 70_000); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Template rusak (zip).');
  const jumlah = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const hasil: Berkas = new Map();
  for (let n = 0; n < jumlah; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Template rusak (direktori zip).');
    const metode = v.getUint16(p + 10, true), ukuran = v.getUint32(p + 20, true);
    const pjNama = v.getUint16(p + 28, true), pjEkstra = v.getUint16(p + 30, true), pjKomen = v.getUint16(p + 32, true);
    const lokal = v.getUint32(p + 42, true);
    const nama = dec.decode(u.subarray(p + 46, p + 46 + pjNama));
    p += 46 + pjNama + pjEkstra + pjKomen;
    const mulai = lokal + 30 + v.getUint16(lokal + 26, true) + v.getUint16(lokal + 28, true);
    const mentah = u.subarray(mulai, mulai + ukuran);
    if (nama.endsWith('/')) continue;
    hasil.set(nama, metode === 0 ? mentah.slice() : await alir(mentah, new DecompressionStream('deflate-raw')));
  }
  return hasil;
}

const TABEL_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TABEL_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export async function tutupZip(b: Berkas): Promise<Uint8Array> {
  const bagian: Uint8Array[] = [], pusat: Uint8Array[] = [];
  let posisi = 0;
  // [Content_Types].xml paling depan seperti file Office pada umumnya
  const urut = [...b.keys()].sort((x, y) => (x === '[Content_Types].xml' ? -1 : y === '[Content_Types].xml' ? 1 : 0));
  for (const nama of urut) {
    const data = b.get(nama)!;
    const padat = /\.(png|jpe?g)$/i.test(nama) ? null : await alir(data, new CompressionStream('deflate-raw'));
    const isi = padat || data, metode = padat ? 8 : 0, crc = crc32(data), nm = enc.encode(nama);
    const lh = new Uint8Array(30 + nm.length), lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, metode, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, isi.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nm.length, true); lh.set(nm, 30);
    const ch = new Uint8Array(46 + nm.length), cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, metode, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, isi.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, nm.length, true); cv.setUint32(42, posisi, true); ch.set(nm, 46);
    bagian.push(lh, isi); pusat.push(ch);
    posisi += lh.length + isi.length;
  }
  const pjPusat = pusat.reduce((a, x) => a + x.length, 0);
  const akhir = new Uint8Array(22), av = new DataView(akhir.buffer);
  av.setUint32(0, 0x06054b50, true); av.setUint16(8, pusat.length, true); av.setUint16(10, pusat.length, true); av.setUint32(12, pjPusat, true); av.setUint32(16, posisi, true);
  const semua = [...bagian, ...pusat, akhir];
  const out = new Uint8Array(semua.reduce((a, x) => a + x.length, 0));
  let o = 0; for (const x of semua) { out.set(x, o); o += x.length; }
  return out;
}

/* ---------- Sel ---------- */
export const escXml = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // karakter kendali tidak boleh ada di XML
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const angkaKolom = (k: string) => k.split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0);
const pecahRef = (ref: string) => { const m = /^([A-Z]+)(\d+)$/.exec(ref)!; return { kol: m[1], baris: +m[2] }; };
export type Nilai = string | number | null | { f: string; v?: number | string };

function selBaru(ref: string, gaya: string, nilai: Nilai): string {
  const s = gaya ? ` s="${gaya}"` : '';
  if (nilai === null || nilai === '') return `<c r="${ref}"${s}/>`;
  if (typeof nilai === 'number') return `<c r="${ref}"${s}><v>${nilai}</v></c>`;
  if (typeof nilai === 'object') {
    const v = nilai.v === undefined ? '' : typeof nilai.v === 'number' ? `<v>${nilai.v}</v>` : `<v>${escXml(nilai.v)}</v>`;
    return `<c r="${ref}"${s}${typeof nilai.v === 'string' ? ' t="str"' : ''}><f>${escXml(nilai.f)}</f>${v}</c>`;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escXml(nilai)}</t></is></c>`;
}

// Isi satu sel (gaya sel lama dipertahankan, atau pakai `gaya` bila diberikan). Sel/baris yang belum ada dibuat.
export function isiSel(xml: string, ref: string, nilai: Nilai, gaya?: string): string {
  const { kol, baris } = pecahRef(ref);
  const reBaris = new RegExp(`<row r="${baris}"([^>]*?)(/>|>([\\s\\S]*?)</row>)`);
  const mb = reBaris.exec(xml);
  if (!mb) {
    // baris belum ada: sisipkan sebelum baris pertama yang nomornya lebih besar
    const sel = selBaru(ref, gaya || '', nilai);
    const re = /<row r="(\d+)"/g; let m: RegExpExecArray | null; let pos = -1;
    while ((m = re.exec(xml))) if (+m[1] > baris) { pos = m.index; break; }
    const rowXml = `<row r="${baris}">${sel}</row>`;
    if (pos < 0) return xml.replace('</sheetData>', `${rowXml}</sheetData>`);
    return xml.slice(0, pos) + rowXml + xml.slice(pos);
  }
  const isiBaris = mb[3] || '';
  const reSel = new RegExp(`<c r="${ref}"([^>]*?)(/>|>[\\s\\S]*?</c>)`);
  const ms = reSel.exec(isiBaris);
  let baru: string;
  if (ms) {
    const g = gaya ?? (/ s="(\d+)"/.exec(ms[1])?.[1] || '');
    baru = isiBaris.slice(0, ms.index) + selBaru(ref, g, nilai) + isiBaris.slice(ms.index + ms[0].length);
  } else {
    const target = angkaKolom(kol);
    const re = /<c r="([A-Z]+)\d+"/g; let m: RegExpExecArray | null; let pos = isiBaris.length;
    while ((m = re.exec(isiBaris))) if (angkaKolom(m[1]) > target) { pos = m.index; break; }
    baru = isiBaris.slice(0, pos) + selBaru(ref, gaya || '', nilai) + isiBaris.slice(pos);
  }
  const rowXml = `<row r="${baris}"${mb[1]}>${baru}</row>`;
  return xml.slice(0, mb.index) + rowXml + xml.slice(mb.index + mb[0].length);
}
// Perbarui nilai tersimpan sebuah sel rumus (rumusnya tetap), supaya tampilan sebelum dihitung ulang sudah benar
export function nilaiRumus(xml: string, ref: string, v: number | string): string {
  const re = new RegExp(`(<c r="${ref}"[^>]*>)(<f[^>]*?(?:/>|>[\\s\\S]*?</f>))(?:<v>[\\s\\S]*?</v>)?(</c>)`);
  return xml.replace(re, (_, a: string, f: string, z: string) => `${a}${f}<v>${typeof v === 'number' ? v : escXml(v)}</v>${z}`);
}
export const gayaSel = (xml: string, ref: string) => new RegExp(`<c r="${ref}"[^>]*? s="(\\d+)"`).exec(xml)?.[1] || '';

// Tinggi baris (pt), supaya teks banyak baris terlihat
export function tinggiBaris(xml: string, baris: number, pt: number): string {
  return xml.replace(new RegExp(`<row r="${baris}"([^>]*?)(/?)>`), (_, attr: string, tutup: string) => {
    const a = attr.replace(/ ht="[^"]*"/, '').replace(/ customHeight="[^"]*"/, '');
    return `<row r="${baris}"${a} ht="${pt}" customHeight="1"${tutup}>`;
  });
}

// Excel menghitung ulang semua rumus saat file dibuka (nilai tersimpan dari template bisa usang)
export const hitungUlang = (b: Berkas) => {
  const w = teksDari(b, 'xl/workbook.xml');
  tulisTeks(b, 'xl/workbook.xml', /<calcPr[^>]*\/>/.test(w) ? w.replace(/<calcPr[^>]*\/>/, '<calcPr fullCalcOnLoad="1"/>') : w.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>'));
};

/* ---------- Gambar di satu drawing (menggantikan isinya) ---------- */
export type Gambar = { data: Uint8Array; ext: 'jpeg' | 'png'; kol: number; baris: number; cx: number; cy: number };
export function pasangGambar(b: Berkas, drawing: string, gambar: Gambar[], awalan = 'foto') {
  const relPath = drawing.replace(/drawings\/(drawing\d+\.xml)$/, 'drawings/_rels/$1.rels');
  const rels: string[] = [];
  const anchor = gambar.map((g, i) => {
    const media = `${awalan}${i + 1}.${g.ext === 'png' ? 'png' : 'jpeg'}`;
    b.set(`xl/media/${media}`, g.data);
    rels.push(`<Relationship Id="rIdF${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${media}"/>`);
    return `<xdr:oneCellAnchor><xdr:from><xdr:col>${g.kol}</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>${g.baris}</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from>`
      + `<xdr:ext cx="${Math.round(g.cx)}" cy="${Math.round(g.cy)}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="${media}"/><xdr:cNvPicPr preferRelativeResize="0"/></xdr:nvPicPr>`
      + `<xdr:blipFill><a:blip r:embed="rIdF${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`
      + `<xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></xdr:spPr></xdr:pic><xdr:clientData fLocksWithSheet="0"/></xdr:oneCellAnchor>`;
  }).join('');
  tulisTeks(b, drawing, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' + anchor + '</xdr:wsDr>');
  tulisTeks(b, relPath, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>');
  let ct = teksDari(b, '[Content_Types].xml');
  for (const [ext, tipe] of [['jpeg', 'image/jpeg'], ['png', 'image/png']]) {
    if (!new RegExp(`Extension="${ext}"`, 'i').test(ct)) ct = ct.replace('<Default ', `<Default ContentType="${tipe}" Extension="${ext}"/><Default `);
  }
  tulisTeks(b, '[Content_Types].xml', ct);
}

// Ganti alamat hyperlink (rId di rels lembar). Kosong = hyperlink di sel itu dihapus, teksnya tetap.
export function aturLink(b: Berkas, sheet: string, ref: string, url: string) {
  const relPath = sheet.replace(/worksheets\/(sheet\d+\.xml)$/, 'worksheets/_rels/$1.rels');
  let xml = teksDari(b, sheet);
  const m = new RegExp(`<hyperlink r:id="([^"]+)" ref="${ref}"/>`).exec(xml) || new RegExp(`<hyperlink ref="${ref}" r:id="([^"]+)"/>`).exec(xml);
  if (!m) return;
  if (!url) {
    xml = xml.replace(m[0], '');
    if (!/<hyperlink /.test(xml)) xml = xml.replace(/<hyperlinks>\s*<\/hyperlinks>/, '');
    tulisTeks(b, sheet, xml);
    return;
  }
  const rels = teksDari(b, relPath).replace(new RegExp(`(<Relationship Id="${m[1]}"[^>]*Target=")[^"]*(")`), `$1${escXml(url)}$2`);
  tulisTeks(b, relPath, rels);
}

// Tanggal Excel (serial) dari YYYY-MM-DD
export const serialTgl = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s); return m ? (Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86_400_000 : null; };
