// Surat IM / Berita Acara → file Word (.docx) tanpa library. Susunan mengikuti format kantor:
// kop (judul, perihal, nomor), tabel approval, A–C isi baku, D data konsumen (halaman baru), E lampiran + foto (halaman baru).
import { zip, esc } from './xlsx-mini';
import { PEMBUAT, PENYETUJU, nomorSurat, perihalSurat, templateSurat, type Surat } from './surat-types';

export type FotoDocx = { data: Uint8Array; ext: 'jpeg' | 'png'; w: number; h: number; ket: string; lampiran: number };
export const TIPE_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const enc = new TextEncoder();
const FONT = 'Arial Narrow';
const EMU = 914400; // per inci

type Run = { t: string; b?: boolean; i?: boolean; sz?: number; tab?: boolean };
type ParOpt = { jc?: 'left' | 'center' | 'both'; left?: number; hanging?: number; after?: number; before?: number; pageBreak?: boolean; keepNext?: boolean; tabs?: number[] };

const run = (x: Run) => {
  const rpr = `<w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/>${x.b ? '<w:b/><w:bCs/>' : ''}${x.i ? '<w:i/>' : ''}${x.sz ? `<w:sz w:val="${x.sz}"/><w:szCs w:val="${x.sz}"/>` : ''}</w:rPr>`;
  return `<w:r>${rpr}${x.tab ? '<w:tab/>' : ''}<w:t xml:space="preserve">${esc(x.t)}</w:t></w:r>`;
};
const par = (runs: Run[] | string, o: ParOpt = {}) => {
  const ppr = [
    o.pageBreak ? '<w:pageBreakBefore/>' : '',
    o.keepNext ? '<w:keepNext/>' : '',
    o.tabs?.length ? `<w:tabs>${o.tabs.map((t) => `<w:tab w:val="left" w:pos="${t}"/>`).join('')}</w:tabs>` : '',
    `<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 0}" w:line="252" w:lineRule="auto"/>`,
    o.left || o.hanging ? `<w:ind w:left="${o.left || 0}" w:hanging="${o.hanging || 0}"/>` : '',
    `<w:jc w:val="${o.jc || 'both'}"/>`,
  ].join('');
  const isi = typeof runs === 'string' ? run({ t: runs }) : runs.map(run).join('');
  return `<w:p><w:pPr>${ppr}</w:pPr>${isi}</w:p>`;
};

/* ---------- Tabel approval ---------- */
const LEBAR = [1470, 1635, 1605, 1515, 2025, 2400];
const sel = (teks: string, w: number, o: { b?: boolean; jc?: 'left' | 'center'; vMerge?: 'restart' | 'continue' } = {}) =>
  `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.vMerge ? `<w:vMerge${o.vMerge === 'restart' ? ' w:val="restart"' : ''}/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${par([{ t: teks, b: o.b, sz: 20 }], { jc: o.jc || 'left', before: 40, after: 40 })}</w:tc>`;
const baris = (cells: string[]) => `<w:tr><w:trPr><w:trHeight w:val="400"/></w:trPr>${cells.join('')}</w:tr>`;
function tabelApproval(s: Surat): string {
  const garis = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
  const rows = [
    baris(['', 'Nama', 'Jabatan', 'Approval', 'Tanggal', 'Ket'].map((t, i) => sel(t, LEBAR[i], { jc: i ? 'center' : 'left' }))),
    baris([PEMBUAT.peran, PEMBUAT.nama, PEMBUAT.jabatan, s.approval, tglPendek(s.tglApproval), s.ket].map((t, i) => sel(t, LEBAR[i]))),
  ];
  PENYETUJU.forEach((p, i) => {
    const sebelum = PENYETUJU[i - 1];
    const lanjut = sebelum && sebelum.peran === p.peran;
    const mulai = !lanjut && PENYETUJU[i + 1]?.peran === p.peran;
    rows.push(baris([
      sel(lanjut ? '' : p.peran, LEBAR[0], { vMerge: lanjut ? 'continue' : mulai ? 'restart' : undefined }),
      sel(p.nama, LEBAR[1]), sel(p.jabatan, LEBAR[2]), sel('', LEBAR[3]), sel('', LEBAR[4]), sel('', LEBAR[5]),
    ]));
  });
  return `<w:tbl><w:tblPr><w:tblW w:w="${LEBAR.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblInd w:w="-420" w:type="dxa"/><w:tblBorders>${garis}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${LEBAR.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

/* ---------- Data konsumen: label : isi, rata ---------- */
function tabelData(s: Surat): string {
  const t = templateSurat(s.template);
  const W = [360, 2200, 240, 6200];
  const tanpaGaris = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="nil"/>`).join('');
  const c = (teks: string, w: number, b = false) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${par([{ t: teks, b, sz: 21 }], { jc: 'left', after: 20 })}</w:tc>`;
  const rows = t.data.map((d, i) => `<w:tr>${c(i === 0 ? '1.' : '', W[0])}${c(d.label, W[1])}${c(':', W[2])}${c(s.data[d.k] || '', W[3])}</w:tr>`);
  return `<w:tbl><w:tblPr><w:tblW w:w="${W.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblInd w:w="240" w:type="dxa"/><w:tblBorders>${tanpaGaris}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${W.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

/* ---------- Foto ---------- */
function gambar(rid: string, n: number, f: FotoDocx): string {
  const maxW = 6.0 * EMU, maxH = 4.3 * EMU; // dua foto per halaman
  const k = Math.min(maxW / f.w, maxH / f.h);
  const cx = Math.round(f.w * k), cy = Math.round(f.h * k);
  return `<w:p><w:pPr><w:spacing w:before="120" w:after="60"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Gambar ${n}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="foto${n}.${f.ext}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

export const tglPendek = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '';
};

const daftar = (huruf: string, judul: string, isi: string[], pageBreak = false) => [
  par([{ t: `${huruf}.`, b: true }, { t: judul, b: true, tab: true }], { left: 720, hanging: 360, tabs: [720], before: 200, after: 60, pageBreak, keepNext: true }),
  ...isi.map((t, i) => par([{ t: `${i + 1}.` }, { t, tab: true }], { left: 1080, hanging: 360, tabs: [1080], after: 40 })),
];

export function documentXml(s: Surat, fotos: FotoDocx[]): { xml: string; rels: string[] } {
  const t = templateSurat(s.template);
  const rels: string[] = [];
  const isi: string[] = [
    par([{ t: s.judul, b: true }], { jc: 'center' }),
    par([{ t: perihalSurat(s), b: true }], { jc: 'center' }),
    par([{ t: nomorSurat(s), b: true }], { jc: 'center', after: 240 }),
    tabelApproval(s),
    par('', { after: 120 }),
    ...daftar('A', 'LATAR BELAKANG', t.latar),
    ...daftar('B', 'TUJUAN', t.tujuan),
    ...daftar('C', 'PENGAJUAN', t.pengajuan),
    par([{ t: 'D. DATA KONSUMEN', b: true }], { pageBreak: true, after: 120, keepNext: true }),
    tabelData(s),
    par([{ t: 'E. LAMPIRAN', b: true }], { pageBreak: true, after: 120, keepNext: true }),
  ];
  let n = 0;
  s.lampiran.forEach((l, li) => {
    isi.push(par([{ t: `${li + 1}.`, b: true }, { t: l.judul || `Lampiran ${li + 1}`, b: true, tab: true }], { left: 720, hanging: 360, tabs: [720], before: li ? 240 : 0, after: 60, keepNext: true }));
    for (const f of fotos.filter((x) => x.lampiran === li)) {
      n++;
      const rid = `rIdFoto${n}`;
      rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/foto${n}.${f.ext}"/>`);
      isi.push(gambar(rid, n, f));
      if (f.ket.trim()) isi.push(par([{ t: f.ket.trim(), i: true, sz: 19 }], { jc: 'center', after: 120 }));
    }
  });
  const sect = '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${isi.join('')}${sect}</w:body></w:document>`;
  return { xml, rels };
}

export function buatDocxSurat(s: Surat, fotos: FotoDocx[]): Uint8Array {
  const { xml, rels } = documentXml(s, fotos);
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}" w:eastAsia="${FONT}"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${rels.join('')}</Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const root = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(perihalSurat(s))}</dc:title><dc:creator>${esc(PEMBUAT.nama)}</dc:creator></cp:coreProperties>`;
  const files: { name: string; data: Uint8Array }[] = [
    { name: '[Content_Types].xml', data: enc.encode(types) },
    { name: '_rels/.rels', data: enc.encode(root) },
    { name: 'docProps/core.xml', data: enc.encode(core) },
    { name: 'word/document.xml', data: enc.encode(xml) },
    { name: 'word/styles.xml', data: enc.encode(styles) },
    { name: 'word/settings.xml', data: enc.encode(settings) },
    { name: 'word/_rels/document.xml.rels', data: enc.encode(docRels) },
  ];
  let n = 0;
  s.lampiran.forEach((_, li) => { for (const f of fotos.filter((x) => x.lampiran === li)) { n++; files.push({ name: `word/media/foto${n}.${f.ext}`, data: f.data }); } });
  return zip(files);
}
