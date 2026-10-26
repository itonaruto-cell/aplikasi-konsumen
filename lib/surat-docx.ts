// Surat IM / Berita Acara → file Word (.docx) tanpa library. Susunan diambil dari susunSurat (sama dengan pratinjau).
import { zip, esc } from './xlsx-mini';
import { NIKO_NAMA, potongTebal, perihalSurat, susunSurat, templateSurat, type BlokJadi, type Surat } from './surat-types';

export type FotoDocx = { data: Uint8Array; ext: 'jpeg' | 'png'; w: number; h: number; ket: string; lampiran: number };
export const TIPE_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const enc = new TextEncoder();
const EMU = 914400; // per inci

type Run = { t: string; b?: boolean; i?: boolean; u?: boolean; sz?: number; font?: string; tab?: boolean; br?: boolean };
type ParOpt = { jc?: 'left' | 'center' | 'both'; left?: number; hanging?: number; after?: number; before?: number; pageBreak?: boolean; keepNext?: boolean; tabs?: number[] };

function buat(fontUtama: string) {
  const run = (x: Run) => {
    const f = x.font || fontUtama;
    const rpr = `<w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}" w:eastAsia="${f}"/>${x.b ? '<w:b/><w:bCs/>' : ''}${x.i ? '<w:i/>' : ''}${x.u ? '<w:u w:val="single"/>' : ''}${x.sz ? `<w:sz w:val="${x.sz}"/><w:szCs w:val="${x.sz}"/>` : ''}</w:rPr>`;
    return `<w:r>${rpr}${x.br ? '<w:br/>' : ''}${x.tab ? '<w:tab/>' : ''}<w:t xml:space="preserve">${esc(x.t)}</w:t></w:r>`;
  };
  const par = (runs: Run[] | string, o: ParOpt = {}) => {
    const ppr = [
      o.pageBreak ? '<w:pageBreakBefore/>' : '',
      o.keepNext ? '<w:keepNext/>' : '',
      o.tabs?.length ? `<w:tabs>${o.tabs.map((t) => `<w:tab w:val="left" w:pos="${t}"/>`).join('')}</w:tabs>` : '',
      `<w:spacing w:before="${o.before ?? 0}" w:after="${o.after ?? 0}" w:line="264" w:lineRule="auto"/>`,
      o.left || o.hanging ? `<w:ind w:left="${o.left || 0}" w:hanging="${o.hanging || 0}"/>` : '',
      `<w:jc w:val="${o.jc || 'both'}"/>`,
    ].join('');
    const isi = typeof runs === 'string' ? run({ t: runs }) : runs.map(run).join('');
    return `<w:p><w:pPr>${ppr}</w:pPr>${isi}</w:p>`;
  };
  // Teks beberapa baris (\n) dalam satu paragraf
  const baris = (teks: string, x: Omit<Run, 't'> = {}): Run[] => teks.split('\n').flatMap((t, i) => potongTebal(t || ' ').map((p, j) => ({ ...x, t: p.t, b: x.b || p.b, br: i > 0 && j === 0 })));
  return { run, par, baris };
}

const garis = (v: 'single' | 'nil') => ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="${v}"${v === 'single' ? ' w:sz="4" w:space="0" w:color="000000"' : ''}/>`).join('');

function gambar(rid: string, n: number, f: FotoDocx, lebarHalaman: number): string {
  const maxW = Math.min(6.0, lebarHalaman) * EMU, maxH = 4.3 * EMU; // dua foto per halaman
  const k = Math.min(maxW / f.w, maxH / f.h);
  const cx = Math.round(f.w * k), cy = Math.round(f.h * k);
  return `<w:p><w:pPr><w:spacing w:before="120" w:after="60"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Gambar ${n}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="foto${n}.${f.ext}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

export function documentXml(s: Surat, fotos: FotoDocx[]): { xml: string; rels: string[] } {
  const t = templateSurat(s.template);
  const { par, baris } = buat(t.font);
  const a4 = t.kertas === 'a4';
  const margin = t.margin || (a4 ? 1134 : 1440);
  const lebarTeks = (a4 ? 11906 : 12240) - 2 * margin;
  const rels: string[] = [];
  const isi: string[] = [];
  let halamanBaru = false;
  const p = (runs: Run[] | string, o: ParOpt = {}) => { isi.push(par(runs, { ...o, pageBreak: o.pageBreak || halamanBaru })); halamanBaru = false; };
  let nFoto = 0;
  const blok = susunSurat(s);

  const tabelApproval = (b: Extract<BlokJadi, { t: 'approval' }>) => {
    const total = b.lebar.reduce((x, y) => x + y, 0);
    const k = Math.min(1, (lebarTeks + 840) / total);
    const lebar = b.lebar.map((w) => Math.round(w * k));
    const sel = (teks: string, w: number, o: { b?: boolean; fill?: string; tengah?: boolean; span?: number; vMerge?: 'restart' | 'continue' } = {}) =>
      `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ''}${o.vMerge ? `<w:vMerge${o.vMerge === 'restart' ? ' w:val="restart"' : ''}/>` : ''}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>${par(baris(teks, { b: o.b, sz: t.szTabel, font: t.fontKop }), { jc: o.tengah ? 'center' : 'left', before: 30, after: 30 })}</w:tc>`;
    const tr = (cells: string) => `<w:tr><w:trPr><w:trHeight w:val="380"/></w:trPr>${cells}</w:tr>`;
    const rows: string[] = [];
    if (b.judul) rows.push(tr(sel(b.judul, lebar.reduce((x, y) => x + y, 0), { b: true, fill: b.fill, tengah: true, span: lebar.length })));
    const g = Math.max(1, b.kepalaGabung);
    rows.push(tr([sel(b.kepala[0], lebar.slice(0, g).reduce((x, y) => x + y, 0), { b: b.kepalaTebal, fill: b.fill, tengah: true, span: g > 1 ? g : undefined }),
      ...b.kepala.slice(g).map((l, i) => sel(l, lebar[i + g], { b: b.kepalaTebal, fill: b.fill, tengah: true }))].join('')));
    for (const r of b.baris) {
      rows.push(tr(r.map((c, i) => sel(c.teks, lebar[i], { b: b.peranTebal && i === 0, tengah: b.tengah && i > 0, vMerge: c.lanjut ? 'continue' : c.rowSpan && c.rowSpan > 1 ? 'restart' : undefined })).join('')));
    }
    const ind = Math.round(Math.max(0, lebar.reduce((x, y) => x + y, 0) - lebarTeks) / -2);
    isi.push(`<w:tbl><w:tblPr><w:tblW w:w="${lebar.reduce((x, y) => x + y, 0)}" w:type="dxa"/><w:tblInd w:w="${ind}" w:type="dxa"/><w:tblBorders>${garis('single')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${lebar.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`);
    p('', { after: 160 });
  };

  const tabelData = (b: Extract<BlokJadi, { t: 'data' }>) => {
    const pakaiNo = b.baris.some((r) => r[0]);
    const W = [...(pakaiNo ? [360] : []), b.lebarLabel, 240, Math.max(2000, lebarTeks - b.kiri - (pakaiNo ? 360 : 0) - b.lebarLabel - 240)];
    const c = (teks: string, w: number) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr>${par(baris(teks, { b: b.tebal }), { jc: 'left', after: 20 })}</w:tc>`;
    const rows = b.baris.map(([no, l, v]) => `<w:tr>${pakaiNo ? c(no, W[0]) : ''}${c(l, W[pakaiNo ? 1 : 0])}${c(':', W[pakaiNo ? 2 : 1])}${c(v, W[pakaiNo ? 3 : 2])}</w:tr>`);
    if (halamanBaru) { p('', {}); }
    isi.push(`<w:tbl><w:tblPr><w:tblW w:w="${W.reduce((x, y) => x + y, 0)}" w:type="dxa"/><w:tblInd w:w="${b.kiri}" w:type="dxa"/><w:tblBorders>${garis('nil')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="40" w:type="dxa"/><w:right w:w="40" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${W.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>`);
    isi.push(par('', { after: 120 }));
  };

  for (const b of blok) {
    switch (b.t) {
      case 'kop':
        b.baris.forEach((x, i) => p([{ t: x.teks, b: x.tebal, u: x.garis, sz: b.besar ? t.sz + 4 : undefined, font: t.fontKop }], { jc: b.kiri ? 'left' : 'center', after: i === b.baris.length - 1 ? 240 : 60 }));
        break;
      case 'info': {
        const tab = 1700;
        for (const [l, v] of b.baris) {
          const [awal, ...lain] = v.split('\n');
          p([{ t: l, b: b.tebalLabel }, { t: ': ', tab: true }, ...baris(awal)], { jc: 'left', tabs: [tab], left: tab + 140, hanging: tab + 140, after: lain.length ? 0 : 40 });
          lain.forEach((x, i) => p(baris(x), { jc: 'left', left: tab + 140, after: i === lain.length - 1 ? 40 : 0 }));
        }
        p('', { after: 120 });
        break;
      }
      case 'approval': tabelApproval(b); break;
      case 'p': p(baris(b.teks, { b: b.tebal }), { jc: b.tengah ? 'center' : 'both', left: b.kiri, after: b.spasi, before: 0 }); break;
      case 'bagian': p([{ t: b.no, b: true }, { t: b.judul, b: true, tab: true }], { left: b.kiri + 720, hanging: 360, tabs: [b.kiri + 720], before: 200, after: 60, keepNext: true }); break;
      case 'daftar': b.isi.forEach((x, i) => p([{ t: `${i + 1}.` }, { t: x, tab: true }], { left: b.kiri + 360, hanging: 360, tabs: [b.kiri + 360], after: 40 })); break;
      case 'data': tabelData(b); break;
      case 'halaman': halamanBaru = true; break;
      case 'lampiran':
        if (b.judul) p([{ t: b.judul, b: true }], { after: 160, keepNext: true });
        b.isi.forEach((l, li) => {
          const judul = l.judul.trim();
          if (judul || b.nomor) p(b.nomor ? [{ t: `${li + 1}.`, b: true }, { t: judul || `Lampiran ${li + 1}`, b: true, tab: true }] : [{ t: `${judul} :`, b: true }],
            { left: b.nomor ? 720 : 0, hanging: b.nomor ? 360 : 0, tabs: b.nomor ? [720] : undefined, before: li ? 240 : 0, after: 60, keepNext: true, jc: 'left' });
          for (const f of fotos.filter((x) => x.lampiran === li)) {
            nFoto++;
            const rid = `rIdFoto${nFoto}`;
            rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/foto${nFoto}.${f.ext}"/>`);
            isi.push(gambar(rid, nFoto, f, lebarTeks / 1440));
            if (f.ket.trim()) isi.push(par([{ t: f.ket.trim(), i: true, sz: t.sz - 2 }], { jc: 'center', after: 120 }));
          }
        });
        break;
    }
  }
  const sect = `<w:sectPr><w:pgSz w:w="${a4 ? 11906 : 12240}" w:h="${a4 ? 16838 : 15840}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${isi.join('')}${sect}</w:body></w:document>`;
  return { xml, rels };
}

export function buatDocxSurat(s: Surat, fotos: FotoDocx[]): Uint8Array {
  const t = templateSurat(s.template);
  const { xml, rels } = documentXml(s, fotos);
  const F = t.font;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:cs="${F}" w:eastAsia="${F}"/><w:sz w:val="${t.sz}"/><w:szCs w:val="${t.sz}"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${rels.join('')}</Relationships>`;
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
  const root = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${esc(perihalSurat(s))}</dc:title><dc:creator>${esc(NIKO_NAMA)}</dc:creator></cp:coreProperties>`;
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
