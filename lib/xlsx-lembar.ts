// Penulis .xlsx yang lebih lengkap dari xlsx-mini: beberapa lembar, gaya sel (font, isi warna, garis,
// perataan), sel gabungan, lebar kolom, tinggi baris, dan gambar (JPEG/PNG) yang menempel di sel.
// Tanpa library, supaya bisa jalan di HP. Gaya didefinisikan sebagai daftar sederhana lalu diubah ke styles.xml.
import { esc, kolom, zip } from './xlsx-mini';

const enc = new TextEncoder();
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';

export type Gaya = {
  size?: number; bold?: boolean; italic?: boolean; color?: string;   // warna 'RRGGBB'
  fill?: string;                                                      // warna latar 'RRGGBB'
  border?: 'thin' | 'thick' | 'bawahTebal';
  h?: 'left' | 'center' | 'right'; v?: 'top' | 'center' | 'bottom'; wrap?: boolean;
};
type Sel = { v: string | number | boolean | null; s: number };
export type Gambar = { baris: number; kolom: number; dx?: number; dy?: number; w: number; h: number; data: Uint8Array; ext: 'jpeg' | 'png'; src?: string };
// Lebar kolom Excel (satuan karakter) → piksel, rumus yang dipakai Excel untuk font standar
export const kolomPx = (w: number) => Math.floor(w * 7 + 0.5);
export const ptKePx = (pt: number) => (pt * 4) / 3;

export class Lembar {
  sel = new Map<number, Map<number, Sel>>();
  tinggi = new Map<number, number>();
  gabung: [number, number, number, number][] = [];
  gambar: Gambar[] = [];
  constructor(public nama: string, public lebar: number[] = [], public fontDasar = 'Arial') {}
  // baris & kolom mulai dari 1
  set(r: number, c: number, v: Sel['v'], s = 0) {
    if (!this.sel.has(r)) this.sel.set(r, new Map());
    this.sel.get(r)!.set(c, { v, s });
    return this;
  }
  // Gabungkan sel; semua sel di dalamnya diberi gaya yang sama supaya garisnya utuh
  gab(r1: number, c1: number, r2: number, c2: number, v: Sel['v'] = null, s = 0) {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) this.set(r, c, r === r1 && c === c1 ? v : null, s);
    if (r2 > r1 || c2 > c1) this.gabung.push([r1, c1, r2, c2]);
    return this;
  }
  t(r: number, pt: number) { this.tinggi.set(r, Math.min(409, Math.max(1, pt))); return this; }
}

const warna = (c?: string) => (c ? `<color rgb="FF${c.replace('#', '').toUpperCase()}"/>` : '');

function gayaXml(gaya: Gaya[], font: string) {
  const fonts: string[] = [], fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders: string[] = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const xfs: string[] = [];
  const idx = (arr: string[], x: string) => { let i = arr.indexOf(x); if (i < 0) { arr.push(x); i = arr.length - 1; } return i; };
  for (const g of [{} as Gaya, ...gaya]) {
    const fo = idx(fonts, `<font>${g.bold ? '<b/>' : ''}${g.italic ? '<i/>' : ''}<sz val="${g.size || 11}"/>${warna(g.color) || '<color theme="1"/>'}<name val="${esc(font)}"/><family val="2"/></font>`);
    const fi = g.fill ? idx(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${g.fill.toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const sisi = (st: string) => `<left style="${st}"><color auto="1"/></left><right style="${st}"><color auto="1"/></right><top style="${st}"><color auto="1"/></top><bottom style="${st}"><color auto="1"/></bottom>`;
    const bo = g.border === 'thin' || g.border === 'thick' ? idx(borders, `<border>${sisi(g.border)}<diagonal/></border>`)
      : g.border === 'bawahTebal' ? idx(borders, '<border><left/><right/><top/><bottom style="thick"><color auto="1"/></bottom><diagonal/></border>') : 0;
    const al = g.h || g.v || g.wrap ? `<alignment${g.h ? ` horizontal="${g.h}"` : ''}${g.v ? ` vertical="${g.v}"` : ''}${g.wrap ? ' wrapText="1"' : ''}/>` : '';
    xfs.push(`<xf numFmtId="0" fontId="${fo}" fillId="${fi}" borderId="${bo}" xfId="0"${fo ? ' applyFont="1"' : ''}${fi ? ' applyFill="1"' : ''}${bo ? ' applyBorder="1"' : ''}${al ? ' applyAlignment="1">' + al + '</xf>' : '/>'}`);
  }
  return `${XML}<styleSheet xmlns="${NS}"><fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

const ref = (r: number, c: number) => `${kolom(c - 1)}${r}`;
const EMU = 9525; // 1 px = 9525 EMU

function lembarXml(l: Lembar, adaGambar: boolean) {
  const cols = l.lebar.length ? `<cols>${l.lebar.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const nomor = [...new Set([...l.sel.keys(), ...l.tinggi.keys()])].sort((a, b) => a - b);
  const rows = nomor.map((r) => {
    const h = l.tinggi.get(r);
    const cells = [...(l.sel.get(r) || new Map()).entries()].sort((a, b) => a[0] - b[0]).map(([c, x]) => {
      const s = x.s ? ` s="${x.s}"` : '';
      if (x.v === null || x.v === '') return `<c r="${ref(r, c)}"${s}/>`;
      if (typeof x.v === 'boolean') return `<c r="${ref(r, c)}"${s} t="b"><v>${x.v ? 1 : 0}</v></c>`;
      if (typeof x.v === 'number') return `<c r="${ref(r, c)}"${s}><v>${x.v}</v></c>`;
      return `<c r="${ref(r, c)}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(x.v)}</t></is></c>`;
    }).join('');
    return `<row r="${r}"${h ? ` ht="${h}" customHeight="1"` : ''}>${cells}</row>`;
  }).join('');
  const merge = l.gabung.length ? `<mergeCells count="${l.gabung.length}">${l.gabung.map(([a, b, c, d]) => `<mergeCell ref="${ref(a, b)}:${ref(c, d)}"/>`).join('')}</mergeCells>` : '';
  return `${XML}<worksheet xmlns="${NS}" xmlns:r="${REL}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData>${merge}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/>${adaGambar ? '<drawing r:id="rId1"/>' : ''}</worksheet>`;
}

function drawingXml(g: Gambar[], awal: number) {
  const XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const isi = g.map((x, i) => `<xdr:oneCellAnchor><xdr:from><xdr:col>${x.kolom - 1}</xdr:col><xdr:colOff>${Math.round((x.dx || 0) * EMU)}</xdr:colOff><xdr:row>${x.baris - 1}</xdr:row><xdr:rowOff>${Math.round((x.dy || 0) * EMU)}</xdr:rowOff></xdr:from><xdr:ext cx="${Math.round(x.w * EMU)}" cy="${Math.round(x.h * EMU)}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="Foto ${i + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`).join('');
  const rels = g.map((x, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/image" Target="../media/foto${awal + i + 1}.${x.ext}"/>`).join('');
  return {
    xml: `${XML}<xdr:wsDr xmlns:xdr="${XDR}" xmlns:a="${A}" xmlns:r="${REL}">${isi}</xdr:wsDr>`,
    rels: `${XML}<Relationships xmlns="${PKG}">${rels}</Relationships>`,
  };
}

export function buatXlsxLembar(lembar: Lembar[], gaya: Gaya[], judul = ''): Uint8Array {
  const f = (name: string, text: string) => ({ name, data: enc.encode(text) });
  const files: { name: string; data: Uint8Array }[] = [];
  const over: string[] = [];
  let nGambar = 0, nDrawing = 0;
  lembar.forEach((l, i) => {
    const n = i + 1;
    const ada = l.gambar.length > 0;
    files.push(f(`xl/worksheets/sheet${n}.xml`, lembarXml(l, ada)));
    over.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    if (ada) {
      nDrawing++;
      const d = drawingXml(l.gambar, nGambar);
      files.push(f(`xl/worksheets/_rels/sheet${n}.xml.rels`, `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/drawing" Target="../drawings/drawing${nDrawing}.xml"/></Relationships>`));
      files.push(f(`xl/drawings/drawing${nDrawing}.xml`, d.xml));
      files.push(f(`xl/drawings/_rels/drawing${nDrawing}.xml.rels`, d.rels));
      over.push(`<Override PartName="/xl/drawings/drawing${nDrawing}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      l.gambar.forEach((g) => { nGambar++; files.push({ name: `xl/media/foto${nGambar}.${g.ext}`, data: g.data }); });
    }
  });
  const namaLembar = (s: string) => esc(s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet');
  return zip([
    f('[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${over.join('')}${judul ? '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' : ''}</Types>`),
    f('_rels/.rels', `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>${judul ? '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' : ''}</Relationships>`),
    ...(judul ? [f('docProps/core.xml', `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(judul)}</dc:title></cp:coreProperties>`)] : []),
    f('xl/workbook.xml', `${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>${lembar.map((l, i) => `<sheet name="${namaLembar(l.nama)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    f('xl/_rels/workbook.xml.rels', `${XML}<Relationships xmlns="${PKG}">${lembar.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${lembar.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`),
    f('xl/styles.xml', gayaXml(gaya, lembar[0]?.fontDasar || 'Arial')),
    ...files,
  ]);
}
