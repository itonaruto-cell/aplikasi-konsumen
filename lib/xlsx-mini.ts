// Pembuat file Excel (.xlsx) sederhana tanpa library: satu lembar, semua sel berupa TEKS.
// Sengaja teks, supaya nomor kontrak 16 digit tidak dibulatkan / berubah jadi 1,06E+15 saat dibuka di Excel atau Google Sheets.

const enc = new TextEncoder();
const TABEL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABEL[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// ZIP tanpa kompresi (metode "stored")
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const bagian: Uint8Array[] = [];
  const pusat: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const lokal = new Uint8Array(30 + name.length);
    const v = new DataView(lokal.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(8, 0, true);
    v.setUint16(10, 0, true); v.setUint16(12, 0x21, true);   // jam 00:00, tanggal 1 Jan 1980
    v.setUint32(14, crc, true); v.setUint32(18, f.data.length, true); v.setUint32(22, f.data.length, true);
    v.setUint16(26, name.length, true);
    lokal.set(name, 30);
    const cd = new Uint8Array(46 + name.length);
    const w = new DataView(cd.buffer);
    w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true);
    w.setUint16(14, 0x21, true);
    w.setUint32(16, crc, true); w.setUint32(20, f.data.length, true); w.setUint32(24, f.data.length, true);
    w.setUint16(28, name.length, true); w.setUint32(42, offset, true);
    cd.set(name, 46);
    bagian.push(lokal, f.data); pusat.push(cd);
    offset += lokal.length + f.data.length;
  }
  const ukuranPusat = pusat.reduce((s, x) => s + x.length, 0);
  const akhir = new Uint8Array(22);
  const e = new DataView(akhir.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, ukuranPusat, true); e.setUint32(16, offset, true);
  const semua = [...bagian, ...pusat, akhir];
  const out = new Uint8Array(semua.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of semua) { out.set(x, p); p += x.length; }
  return out;
}

const esc = (s: string) => String(s ?? '')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const kolom = (i: number) => { let s = ''; for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

// rows[0] = judul kolom. lebar = lebar tiap kolom (satuan karakter).
export function buatXlsx(rows: string[][], sheet = 'Sheet1', lebar: number[] = []): Uint8Array {
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const cols = lebar.length
    ? `<cols>${lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const data = rows.map((r, i) => `<row r="${i + 1}">${r.map((v, j) =>
    `<c r="${kolom(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join('')}</row>`).join('');
  const nama = esc(sheet.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1');
  const f = (name: string, text: string) => ({ name, data: enc.encode(text) });
  return zip([
    f('[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    f('_rels/.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    f('xl/workbook.xml', `${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets><sheet name="${nama}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    f('xl/_rels/workbook.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    f('xl/worksheets/sheet1.xml', `${XML}<worksheet xmlns="${NS}">${cols}<sheetData>${data}</sheetData></worksheet>`),
  ]);
}

export const TIPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
