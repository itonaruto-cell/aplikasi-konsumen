// Gambar laporan (PNG) untuk dibagikan: achievement cabang + Mobilku/Motorku, dan aktivitas CMO/MAO.
// Digambar langsung ke <canvas> (lebar 1080 px, cocok untuk WhatsApp), tanpa pustaka tambahan.
import type { Orang, Sales } from '../../lib/performa-types';
import { brandOf, cekData, hariKerjaSisa, namaBulan, type Ctx } from '../../lib/performa-calc';

type G = CanvasRenderingContext2D;
type BrandId = 'mobilku' | 'motorku';

const W = 1080, P = 56;
const C = {
  bg: '#F4F2EE', card: '#FFFFFF', ink: '#121212', muted: '#6E6A64', line: '#E6E2DB', track: '#ECE9E3',
  gold: '#F5C451', dark: '#121212', good: '#1FA463', mid: '#E0A800', bad: '#E5484D',
  brand: { mobilku: '#1B2F5B', motorku: '#1D6A4B' } as Record<BrandId, string>,
  brandSoft: { mobilku: '#E9EEF8', motorku: '#E4F2EB' } as Record<BrandId, string>,
};
const LABEL: Record<BrandId, string> = { mobilku: 'MOBILKU', motorku: 'MOTORKU' };

/* ---------- Format ---------- */
const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const cf = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const angka = (v?: number | null) => (isNum(v) ? nf.format(v) : '–');
const rp = (v?: number | null) => (isNum(v) ? 'Rp ' + cf.format(v) : '–');
const pct = (v?: number | null) => (isNum(v) ? `${Math.round(v * 100)}%` : '–');
const tone = (v?: number | null) => (!isNum(v) ? C.muted : v >= 1 ? C.good : v >= 0.5 ? C.mid : C.bad);
const NAMA_SKIP = /^(MUHAMMAD|MUHAMAD|MOHAMMAD|MOH\.?|MOCH\.?|M\.?)$/i;
const pendek = (n: string) => {
  const w = String(n || '').trim().split(/\s+/);
  const x = w.find((s) => !NAMA_SKIP.test(s)) || w[0] || '';
  return x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();
};
const tglPanjang = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/* ---------- Alat gambar ---------- */
let FONT = 'system-ui, sans-serif';
export function pakaiFont(fam: string) { if (fam) FONT = fam; }
const font = (g: G, size: number, weight = 400) => { g.font = `${weight} ${size}px ${FONT}`; };
function tulis(g: G, s: string, x: number, y: number, o: { size: number; weight?: number; color?: string; align?: CanvasTextAlign; maks?: number; spasi?: number }) {
  font(g, o.size, o.weight ?? 400);
  g.fillStyle = o.color ?? C.ink;
  g.textAlign = o.align ?? 'left';
  g.textBaseline = 'alphabetic';
  if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = `${o.spasi ?? 0}px`;
  let t = s;
  if (o.maks) while (t.length > 1 && g.measureText(t).width > o.maks) t = t.slice(0, -2) + '…';
  g.fillText(t, x, y);
  if ('letterSpacing' in g) (g as unknown as { letterSpacing: string }).letterSpacing = '0px';
}
function kotak(g: G, x: number, y: number, w: number, h: number, r: number, fill: string, bayang = false) {
  g.save();
  if (bayang) { g.shadowColor = 'rgba(0,0,0,0.08)'; g.shadowBlur = 24; g.shadowOffsetY = 6; }
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  g.fillStyle = fill; g.fill();
  g.restore();
}
function batang(g: G, x: number, y: number, w: number, h: number, v: number | null | undefined, warna: string, track: string) {
  kotak(g, x, y, w, h, h / 2, track);
  const f = isNum(v) ? Math.max(0, Math.min(1, v)) : 0;
  if (f > 0) kotak(g, x, y, Math.max(h, w * f), h, h / 2, warna);
}
function chip(g: G, s: string, x: number, y: number, o: { bg: string; color: string; size?: number; align?: 'left' | 'right' }) {
  const size = o.size ?? 22;
  font(g, size, 700);
  const w = g.measureText(s).width + size * 1.1, h = size * 1.75;
  const x0 = o.align === 'right' ? x - w : x;
  kotak(g, x0, y, w, h, h / 2, o.bg);
  tulis(g, s, x0 + w / 2, y + h * 0.68, { size, weight: 700, color: o.color, align: 'center' });
  return w;
}

/* ---------- Kepala & kaki ---------- */
function kepala(g: G, logo: HTMLImageElement | null, label: string, judul: string, sub: string) {
  g.fillStyle = C.dark; g.fillRect(0, 0, W, 300);
  if (logo) {
    g.save(); g.beginPath(); g.arc(P + 40, 92, 40, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.clip();
    g.drawImage(logo, P + 4, 56, 72, 72); g.restore();
  }
  tulis(g, label, P + 100, 80, { size: 22, weight: 700, color: C.gold, spasi: 3 });
  tulis(g, judul, P + 100, 128, { size: 46, weight: 700, color: '#fff', maks: W - P * 2 - 100 });
  tulis(g, sub, P, 196, { size: 24, color: 'rgba(255,255,255,0.65)', maks: W - P * 2 });
}
function kaki(g: G, y: number, dibuat: string) {
  tulis(g, 'Marketing Kendal', P, y + 46, { size: 22, weight: 700, color: C.muted });
  tulis(g, `Dibuat ${dibuat}`, W - P, y + 46, { size: 22, color: C.muted, align: 'right' });
}
const KAKI = 90;

/* ---------- Data ---------- */
type Info = { judulBulan: string; sub: string; dibuat: string };
function info(c: Ctx): Info {
  const cek = cekData(c.data);
  const bulan = cek.bedaBulan && cek.bulanData ? cek.bulanData : c.today.slice(0, 7);
  const cab = String(c.data.cabang || 'Kendal').toLowerCase().replace(/\b\w/g, (h) => h.toUpperCase());
  const upd = c.data.updated ? `Data per ${tglPanjang(c.data.updated)}` : 'Data pantauan terakhir';
  const sisa = hariKerjaSisa(c.today);
  const dibuat = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return {
    judulBulan: `${cab} · ${namaBulan(bulan)} ${bulan.slice(0, 4)}`,
    sub: [upd, cek.bedaBulan ? `masih data ${namaBulan(bulan)}` : sisa > 0 ? `sisa ${sisa} hari kerja` : 'bulan selesai'].join(' · '),
    dibuat,
  };
}
type Total = { amount: Sales | null; unit: Sales | null };
function totalBrand(c: Ctx, b: BrandId): Total {
  const blok = (t: string) => (c.data.blok || []).find((x) => x.s === 'cabang' && x.t.toLowerCase() === t)?.r
    .find((r) => String(r[0] ?? '').trim().toLowerCase() === b);
  const dari = (r: unknown[] | undefined): Sales | null => {
    if (!r) return null;
    const n = (v: unknown) => (isNum(v) ? v : null);
    return { lalu: n(r[2]), ini: n(r[3]), target: n(r[4]), ach: n(r[5]), diffLalu: n(r[6]), diffTarget: null };
  };
  const jumlah = (w: 'unit' | 'amount'): Sales | null => {
    const l = c.sales.filter((o) => brandOf(o) === b).map((o) => o[w]).filter(Boolean) as Sales[];
    if (!l.length) return null;
    const ini = l.reduce((s, x) => s + (x.ini || 0), 0), target = l.reduce((s, x) => s + (x.target || 0), 0);
    return { lalu: null, ini, target, ach: target ? ini / target : null, diffLalu: null, diffTarget: null };
  };
  return { amount: dari(blok('sales amount per brand')) || jumlah('amount'), unit: dari(blok('sales account per brand')) || jumlah('unit') };
}

/* ---------- Laporan achievement ---------- */
const orangBrand = (c: Ctx, b: BrandId, spv: Orang | null) =>
  c.sales.filter((o) => brandOf(o) === b && o !== spv && (o.amount || o.unit))
    .sort((a, x) => (x.amount?.ach ?? -1) - (a.amount?.ach ?? -1));

export function tinggiAchievement(c: Ctx, spv: Orang | null) {
  const n = (b: BrandId) => orangBrand(c, b, spv).length;
  return 250 + 300 + 40 + (['mobilku', 'motorku'] as const).reduce((s, b) => s + 330 + n(b) * 104 + 40, 0) + KAKI;
}

function duaAngka(g: G, x: number, y: number, w: number, t: Total, terang: boolean) {
  const kol = (w - 40) / 2;
  ([['Amount', t.amount, true], ['Unit', t.unit, false]] as const).forEach(([l, s, uang], i) => {
    const x0 = x + i * (kol + 40);
    tulis(g, l, x0, y + 30, { size: 24, color: terang ? 'rgba(255,255,255,0.7)' : C.muted });
    tulis(g, pct(s?.ach), x0, y + 118, { size: 84, weight: 700, color: terang ? '#fff' : C.ink });
    batang(g, x0, y + 146, kol, 14, s?.ach, terang ? C.gold : tone(s?.ach), terang ? 'rgba(255,255,255,0.18)' : C.track);
    tulis(g, s ? (uang ? `${rp(s.ini)} / ${rp(s.target).replace('Rp ', '')}` : `${angka(s.ini)} / ${angka(s.target)} unit`) : '–',
      x0, y + 200, { size: 26, weight: 600, color: terang ? '#fff' : C.ink, maks: kol });
    const lalu = s && isNum(s.lalu) ? s.lalu : s && isNum(s.ini) && isNum(s.diffLalu) ? s.ini - s.diffLalu : null;
    if (isNum(lalu)) tulis(g, `Bulan lalu ${uang ? rp(lalu) : `${angka(lalu)} unit`}`, x0, y + 234, { size: 22, color: terang ? 'rgba(255,255,255,0.6)' : C.muted, maks: kol });
  });
}

export function gambarAchievement(g: G, c: Ctx, spv: Orang | null, logo: HTMLImageElement | null) {
  const H = tinggiAchievement(c, spv);
  const inf = info(c);
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  kepala(g, logo, 'LAPORAN ACHIEVEMENT', inf.judulBulan, inf.sub);

  // Cabang
  let y = 250;
  kotak(g, P, y, W - P * 2, 300, 32, C.card, true);
  tulis(g, 'CABANG', P + 40, y + 52, { size: 22, weight: 700, color: C.muted, spasi: 3 });
  duaAngka(g, P + 40, y + 56, W - P * 2 - 80, { amount: c.data.cabangTotal?.amount || null, unit: c.data.cabangTotal?.unit || null }, false);
  y += 300 + 40;

  // Mobilku & Motorku
  for (const b of ['mobilku', 'motorku'] as const) {
    const list = orangBrand(c, b, spv);
    const h = 330 + list.length * 104;
    kotak(g, P, y, W - P * 2, h, 32, C.brand[b], true);
    tulis(g, LABEL[b], P + 40, y + 56, { size: 24, weight: 700, color: 'rgba(255,255,255,0.8)', spasi: 3 });
    duaAngka(g, P + 40, y + 60, W - P * 2 - 80, totalBrand(c, b), true);
    let yy = y + 330;
    list.forEach((o) => {
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(P + 24, yy - 6, W - P * 2 - 48, 1);
      tulis(g, pendek(o.nama), P + 40, yy + 40, { size: 30, weight: 700, color: '#fff', maks: 300 });
      tulis(g, `Unit ${angka(o.unit?.ini)}/${angka(o.unit?.target)} · ${pct(o.unit?.ach)}`, P + 40, yy + 78, { size: 22, color: 'rgba(255,255,255,0.7)' });
      tulis(g, rp(o.amount?.ini), W - P - 170, yy + 40, { size: 26, weight: 600, color: '#fff', align: 'right' });
      tulis(g, pct(o.amount?.ach), W - P - 40, yy + 42, { size: 36, weight: 700, color: C.gold, align: 'right' });
      batang(g, P + 380, yy + 64, W - P * 2 - 420, 10, o.amount?.ach, C.gold, 'rgba(255,255,255,0.18)');
      yy += 104;
    });
    y += h + 40;
  }
  kaki(g, y - 40, inf.dibuat);
  return H;
}

/* ---------- Laporan aktivitas ---------- */
type Akt = { o: Orang; cmo: boolean; mao: boolean };
const orangAktivitas = (c: Ctx, b: BrandId, spv: Orang | null): Akt[] =>
  (c.data.orang || []).filter((o) => brandOf(o) === b && o !== spv && (o.visit || o.maintain || o.rekrut))
    .map((o) => ({ o, cmo: !!o.visit, mao: !!(o.maintain || o.rekrut) }))
    .sort((a, x) => Number(a.mao) - Number(x.mao) || a.o.nama.localeCompare(x.o.nama));
const tinggiOrang = (a: Akt) => 92 + (a.cmo ? 140 : 0) + (a.mao ? 172 : 0) + 8;

export function tinggiAktivitas(c: Ctx, spv: Orang | null) {
  return 250 + (['mobilku', 'motorku'] as const).reduce((s, b) =>
    s + 100 + 230 + orangAktivitas(c, b, spv).reduce((t, a) => t + tinggiOrang(a) + 20, 0) + 30, 0) + KAKI;
}

function statKecil(g: G, x: number, y: number, w: number, label: string, nilai: string, warna = C.ink) {
  tulis(g, nilai, x, y + 44, { size: 40, weight: 700, color: warna, maks: w });
  tulis(g, label, x, y + 78, { size: 21, color: C.muted, maks: w });
}

export function gambarAktivitas(g: G, c: Ctx, spv: Orang | null, logo: HTMLImageElement | null) {
  const H = tinggiAktivitas(c, spv);
  const inf = info(c);
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  kepala(g, logo, 'LAPORAN AKTIVITAS CMO & MAO', inf.judulBulan, inf.sub);
  let y = 250;
  const lebar = W - P * 2;

  for (const b of ['mobilku', 'motorku'] as const) {
    // Judul brand
    kotak(g, P, y, lebar, 84, 24, C.brand[b]);
    tulis(g, LABEL[b], P + 32, y + 54, { size: 28, weight: 700, color: '#fff', spasi: 3 });
    const mt = c.data.aktivitas?.maintain?.[b];
    if (mt?.ma) tulis(g, `Maintain ${mt.sudah}/${mt.ma} MA · ${pct(mt.sudah / mt.ma)}`, W - P - 32, y + 52, { size: 24, weight: 600, color: 'rgba(255,255,255,0.85)', align: 'right' });
    y += 100;

    // Cakupan visit konsumen prioritas (cabang, per brand)
    kotak(g, P, y, lebar, 214, 28, C.card, true);
    tulis(g, 'Visit konsumen prioritas', P + 32, y + 46, { size: 24, weight: 700, color: C.ink });
    const kol = (lebar - 64 - 48) / 3;
    ([1, 2, 3] as const).forEach((p, i) => {
      const x = c.data.aktivitas?.visit?.[b]?.[`p${p}` as 'p1'];
      const x0 = P + 32 + i * (kol + 24);
      const v = x?.database ? x.tervisit / x.database : null;
      tulis(g, `P${p}`, x0, y + 92, { size: 22, weight: 700, color: C.muted });
      tulis(g, x ? `${angka(x.tervisit)}/${angka(x.database)}` : '–', x0 + kol, y + 94, { size: 30, weight: 700, color: C.ink, align: 'right' });
      batang(g, x0, y + 112, kol, 12, v, C.brand[b], C.brandSoft[b]);
      tulis(g, x ? `${pct(v)} dikunjungi · ${angka(x.ditemui)} bertemu` : 'belum ada data', x0, y + 156, { size: 20, color: C.muted, maks: kol });
    });
    tulis(g, 'dikunjungi / database', P + 32, y + 196, { size: 18, color: C.muted });
    y += 230;

    // Per orang
    for (const a of orangAktivitas(c, b, spv)) {
      const h = tinggiOrang(a);
      kotak(g, P, y, lebar, h, 28, C.card, true);
      const o = a.o;
      tulis(g, pendek(o.nama), P + 32, y + 56, { size: 32, weight: 700, maks: 520 });
      let cx = W - P - 32;
      if (a.mao) cx -= chip(g, 'MAO', cx, y + 26, { bg: C.brandSoft[b], color: C.brand[b], align: 'right' }) + 10;
      if (a.cmo) chip(g, 'CMO', cx, y + 26, { bg: C.brandSoft[b], color: C.brand[b], align: 'right' });
      let yy = y + 84;
      if (a.cmo && o.visit) {
        const v = o.visit;
        const w3 = (lebar - 64) / 3;
        statKecil(g, P + 32, yy, w3, 'konsumen dikunjungi', angka(v.konsumen));
        statKecil(g, P + 32 + w3, yy, w3, `bertemu · ${pct(v.konsumen ? v.ditemui / v.konsumen : null)}`, angka(v.ditemui), C.good);
        statKecil(g, P + 32 + w3 * 2, yy, w3, 'total kali visit', angka(v.total));
        // P1–P3: konsumen yang dikunjungi per prioritas, dan yang bertemu
        let px = P + 32;
        ([1, 2, 3] as const).forEach((p) => {
          const l = (v.list || []).filter((k) => k.p === p);
          const teks = l.length ? `P${p} · ${l.length} dikunjungi · ${l.filter((k) => k.m).length} bertemu` : `P${p} · ${angka(v[`p${p}` as 'p1'] ?? 0)} dikunjungi`;
          px += chip(g, teks, px, yy + 100, { bg: C.brandSoft[b], color: C.brand[b], size: 18 }) + 10;
        });
        yy += 140;
      }
      if (a.mao) {
        const m = o.maintain, r = o.rekrut;
        if (m?.ma) {
          tulis(g, 'Maintain MA', P + 32, yy + 30, { size: 22, weight: 700, color: C.muted });
          tulis(g, `${m.sudah}/${m.ma} · ${pct(m.sudah / m.ma)}`, W - P - 32, yy + 30, { size: 26, weight: 700, align: 'right' });
          batang(g, P + 32, yy + 48, lebar - 64, 14, m.sudah / m.ma, tone(m.sudah / m.ma), C.track);
          tulis(g, `Minimal 2X: ${m.x2} · 3X: ${m.x3} · 4X: ${m.x4}${m.belum ? ` · ${m.belum} belum` : ''}`, P + 32, yy + 96, { size: 22, color: C.muted, maks: lebar - 64 });
        } else {
          tulis(g, 'Maintain MA: belum ada data', P + 32, yy + 30, { size: 22, color: C.muted });
        }
        let x = P + 32;
        ([['Rekrut', r?.rekrut], ['Regist', r?.regist]] as const).forEach(([l, t]) => {
          const ok = !!t?.target && t.jumlah >= t.target;
          x += chip(g, `${l} ${t ? t.jumlah : '–'}/${t?.target ?? '–'}`, x, yy + 118, {
            bg: ok ? '#E3F5EB' : '#FDECEC', color: ok ? '#12663D' : '#9B1C1C', size: 24,
          }) + 12;
        });
        yy += 172;
      }
      y += h + 20;
    }
    y += 30;
  }
  kaki(g, y - 30, inf.dibuat);
  return H;
}
