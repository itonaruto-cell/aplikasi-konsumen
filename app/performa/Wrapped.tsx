'use client';
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import type { Orang } from '../../lib/performa-types';
import { brandOf, wrapped, type Ctx, type WrappedData } from '../../lib/performa-calc';
import { useOverlay } from '../overlay';
import { angka, nama, persen, rp } from './ui';
import { Avatar, BRAND, BrandArt, Ico, niceInitials, shortName, twoNames } from './parts';

// Kendal Wrapped: cerita akhir bulan (4 layar, ketuk kanan/kiri) + kartu yang bisa dibagikan ke WA/IG.
const GOLD = '#F5C451';

function Stat({ v, l }: { v: ReactNode; l: string }) {
  return (
    <div className="rounded-[18px] bg-white/10 p-3.5">
      <span className="block text-[34px] font-bold leading-none tracking-tight">{v}</span>
      <span className="mt-1 block text-[13px] text-white/75">{l}</span>
    </div>
  );
}

/* ---------- Gambar kartu jadi PNG (1080×1350) ---------- */
async function drawCard(w: WrappedData, cabang: string, grad: [string, string], b: 'mobilku' | 'motorku' | ''): Promise<Blob | null> {
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  if (!g) return null;
  const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  const F = (px: number, wt = 700) => `${wt} ${px}px ${font}`;
  const rr = (x: number, y: number, w2: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w2, h, r); };

  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  const lg = g.createLinearGradient(0, 0, W, 640);
  lg.addColorStop(0, grad[0]); lg.addColorStop(1, grad[1]);
  g.fillStyle = lg; g.fillRect(0, 0, W, 640);

  g.fillStyle = GOLD; g.font = F(40); g.fillText(`KENDAL WRAPPED · ${w.bulan.toUpperCase()} ${w.tahun}`, 72, 130);
  const who = w.me ? twoNames(w.me.nama) : `Cabang ${nama(cabang)}`;
  const sub = w.me ? `${w.me.brand ? nama(w.me.brand) + ' · ' : ''}${w.amountRank ? `#${w.amountRank} amount` : 'Marketing Kendal'}` : `${w.tim.top.length ? 'Juara: ' + w.tim.top.map((o) => shortName(o.nama)).join(', ') : 'Marketing Kendal'}`;
  // avatar bulat
  g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(150, 300, 78, 0, Math.PI * 2); g.fill();
  g.fillStyle = grad[0]; g.font = F(56); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(w.me ? niceInitials(w.me.nama) : 'KDL', 150, 302);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#FFFFFF'; g.font = F(68); g.fillText(who.length > 18 ? who.slice(0, 17) + '…' : who, 262, 290);
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = F(38, 500); g.fillText(sub.length > 40 ? sub.slice(0, 39) + '…' : sub, 262, 350);

  // gambar mobil / motor tipis di pojok header
  const mobil = ['M6 36v-8q2-6 10-7l18-3 13-9q4-3 10-3h22q6 0 10 4l10 9 11 2q7 2 7 8v7h-8', 'M22 36h56M102 36h3', 'M45 18l10-8q2-1 5-1h10v9zM74 9h9q3 0 5 2l7 7H74z'];
  const motor = ['M24 44l18-16h26l10 16h-18l-8-10', 'M40 22h20q6 0 8 6', 'M78 44l6-24 10-3m-6 3 8 24', 'M84 17l-6-3'];
  const roda: [number, number, number][] = b === 'motorku' ? [[24, 44, 13], [24, 44, 4], [96, 44, 13], [96, 44, 4]] : [[30, 38, 8], [30, 38, 3], [92, 38, 8], [92, 38, 3]];
  g.save(); g.translate(560, 400); g.scale(4.4, 4.4);
  g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round';
  (b === 'motorku' ? motor : mobil).forEach((d) => g.stroke(new Path2D(d)));
  roda.forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); });
  g.restore();

  const ach = w.me ? w.me.amount?.ach : w.tim.amountAch;
  const cells: [string, string][] = [
    [persen(ach), 'amount'],
    [angka(w.visit), 'visit'],
    [angka(w.bertemu), 'bertemu'],
  ];
  cells.forEach(([v, l], i) => {
    const x = 72 + i * 330;
    g.fillStyle = '#111111'; g.font = F(84); g.fillText(v, x, 790);
    g.fillStyle = '#6E6E6E'; g.font = F(38, 500); g.fillText(l, x, 845);
  });
  const quote = w.me
    ? (w.badges.length ? `Badge: ${w.badges.slice(0, 2).join(' · ')}` : `${angka(w.hariAktif)} hari aktif · ${angka(w.kec)} kecamatan`)
    : `${angka(w.hariAktif)} hari aktif · ${angka(w.kec)} kecamatan dijelajah tim`;
  g.fillStyle = '#FFF8E8'; rr(72, 920, W - 144, 170, 44); g.fill();
  g.fillStyle = '#4A3A12'; g.font = F(40, 600); g.fillText(quote.length > 44 ? quote.slice(0, 43) + '…' : quote, 116, 1020);
  g.fillStyle = '#111111'; g.font = F(40); g.fillText('Marketing Kendal', 72, 1250);
  g.fillStyle = grad[0]; rr(W - 72 - 200, 1206, 200, 60, 30); g.fill();
  g.fillStyle = '#FFFFFF'; g.font = F(30); g.textAlign = 'center'; g.fillText(`${w.bulan.slice(0, 3).toUpperCase()} ${w.tahun}`, W - 172, 1247);
  return new Promise((res) => cv.toBlob((b) => res(b), 'image/png'));
}

export default function Wrapped({ c, me, onClose }: { c: Ctx; me: Orang | null; onClose: () => void }) {
  const w = useMemo(() => wrapped(c, me), [c, me]);
  const [i, setI] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useOverlay(true, onClose);

  const b = me ? brandOf(me) : '';
  const grad: [string, string] = b ? BRAND[b].hex : ['#1B2F5B', '#1D6A4B'];
  const name = me ? shortName(me.nama) : 'Tim Kendal';
  const cabang = c.data.cabang || 'Kendal';

  const bagikan = async () => {
    setBusy(true); setMsg('');
    try {
      const blob = await drawCard(w, cabang, grad, b);
      if (!blob) throw new Error('kanvas');
      const file = new File([blob], `kendal-wrapped-${w.bulan.toLowerCase()}.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'Kendal Wrapped', text: `Kendal Wrapped ${w.bulan}` }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        setMsg('Gambar disimpan. Kirim dari galeri ke WA.');
      }
    } catch {
      setMsg('Gambar belum bisa dibuat di HP ini.');
    }
    setBusy(false);
  };

  const slides: { bg: string; body: ReactNode }[] = [];
  slides.push({
    bg: `linear-gradient(160deg, ${grad[0]} 0%, ${grad[1]} 100%)`,
    body: (
      <>
        <div className="flex flex-col gap-1.5 px-6 pt-7">
          <span className="text-[13px] font-bold tracking-[0.1em]" style={{ color: GOLD }}>KENDAL WRAPPED · {w.bulan.toUpperCase()}</span>
          <span className="text-[32px] font-bold leading-[1.08] tracking-tight">
            {me ? `${name}, bulan ini kamu jalan jauh.` : `Bulan ${w.bulan}, tim ${nama(cabang)} jalan jauh.`}
          </span>
        </div>
        <div className="mx-6 mt-6 grid grid-cols-2 gap-2.5">
          <Stat v={angka(w.visit)} l="konsumen dikunjungi" />
          <Stat v={angka(w.bertemu)} l="berhasil bertemu" />
          {me ? <Stat v={angka(w.streak)} l="hari beruntun" /> : <Stat v={angka(w.hariAktif)} l="hari aktif" />}
          <Stat v={angka(w.kec)} l="kecamatan dijelajah" />
        </div>
        {w.topKec && <p className="mx-6 mt-4 text-[15px] text-white/85">Paling sering ke <b className="text-white">{nama(w.topKec)}</b>.</p>}
        <span className="pointer-events-none absolute -left-4 bottom-10 text-white/[0.12]"><BrandArt b={b || 'mobilku'} className="h-40 w-[360px]" /></span>
      </>
    ),
  });
  if (me) {
    const am = me.amount, un = me.unit;
    slides.push({
      bg: grad[1],
      body: (
        <>
          <div className="flex flex-col gap-1.5 px-6 pt-7">
            <span className="text-[13px] font-bold tracking-[0.1em]" style={{ color: GOLD }}>PENCAPAIAN</span>
            <span className="text-[28px] font-bold leading-tight">{w.amountRank ? `Peringkat #${w.amountRank} amount dari ${w.peserta}` : 'Amount bulan ini'}</span>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <span style={{ color: GOLD }}><Ico n="trophy" className="h-20 w-20" sw={1.4} /></span>
            <span className="text-[68px] font-bold leading-none tracking-[-0.04em]">{persen(am?.ach)}</span>
            <span className="text-base text-white/80">{rp(am?.ini)} · {angka(un?.ini)} unit{w.unitRank ? ` · #${w.unitRank} unit` : ''}</span>
          </div>
          <div className="flex flex-wrap gap-2 px-6 pb-8">
            {(am?.ach ?? 0) >= 1 && <span className="rounded-full px-2.5 py-1.5 text-[13px] font-bold text-[#3A2A00]" style={{ background: GOLD }}>Target tembus</span>}
            {w.badges.map((x) => <span key={x} className="rounded-full bg-white/15 px-2.5 py-1.5 text-[13px] font-bold">{x}</span>)}
            {!w.badges.length && (am?.ach ?? 0) < 1 && <span className="rounded-full bg-white/15 px-2.5 py-1.5 text-[13px] font-bold">Bulan depan pasti lebih gas!</span>}
          </div>
        </>
      ),
    });
  }
  slides.push({
    bg: 'linear-gradient(160deg, #1D6A4B 0%, #134B35 100%)',
    body: (
      <>
        <div className="flex flex-col gap-1.5 px-6 pt-7">
          <span className="text-[13px] font-bold tracking-[0.1em]" style={{ color: GOLD }}>SATU TIM</span>
          <span className="text-[28px] font-bold leading-tight">Cabang {nama(cabang)} bulan {w.bulan}</span>
        </div>
        <div className="mx-6 mt-6 grid grid-cols-2 gap-2.5">
          <Stat v={persen(w.tim.amountAch)} l="amount cabang" />
          <Stat v={persen(w.tim.unitAch)} l="unit cabang" />
          <Stat v={angka(w.tim.visit)} l="visit tim" />
          <Stat v={angka(w.tim.bertemu)} l="bertemu" />
        </div>
        {w.tim.top.length > 0 && (
          <div className="mx-6 mt-5">
            <p className="text-[13px] font-bold tracking-[0.08em] text-white/70">JUARA AMOUNT</p>
            <ol className="mt-2 flex flex-col gap-2">
              {w.tim.top.map((o, k) => (
                <li key={o.nama} className="flex items-center gap-3">
                  <span className="w-5 text-lg font-bold" style={{ color: k === 0 ? GOLD : undefined }}>{k + 1}</span>
                  <Avatar o={o} size={36} className="text-xs" />
                  <span className="flex-1 truncate text-[15px] font-semibold">{twoNames(o.nama)}</span>
                  <span className="text-[15px] font-bold">{persen(o.amount?.ach)}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </>
    ),
  });
  slides.push({
    bg: '#F4F4F2',
    body: (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-5 pt-4 text-neutral-900">
        <div className="w-full overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
          <div className="relative flex h-40 flex-col gap-2 overflow-hidden p-5 text-white" style={{ background: `linear-gradient(150deg, ${grad[0]} 0%, ${grad[1]} 100%)` }}>
            <span className="text-xs font-bold tracking-[0.1em]" style={{ color: GOLD }}>KENDAL WRAPPED · {w.bulan.slice(0, 3).toUpperCase()} {w.tahun}</span>
            <span className="mt-1 flex items-center gap-3">
              {me ? <Avatar o={me} size={48} className="text-sm ring-2 ring-[#F5C451]" /> : null}
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-xl font-bold">{me ? twoNames(me.nama) : `Cabang ${nama(cabang)}`}</span>
                <span className="text-[13px] text-white/80">{me && w.amountRank ? `#${w.amountRank} amount` : 'Marketing Kendal'}</span>
              </span>
            </span>
            <span className="pointer-events-none absolute -bottom-3 -right-6 text-white/[0.16]"><BrandArt b={b || 'mobilku'} className="h-20 w-48" /></span>
          </div>
          <div className="grid grid-cols-3 gap-2 px-5 py-4">
            <span className="flex flex-col"><b className="text-2xl">{persen(me ? me.amount?.ach : w.tim.amountAch)}</b><span className="text-xs text-neutral-500">amount</span></span>
            <span className="flex flex-col"><b className="text-2xl">{angka(w.visit)}</b><span className="text-xs text-neutral-500">visit</span></span>
            <span className="flex flex-col"><b className="text-2xl">{angka(w.bertemu)}</b><span className="text-xs text-neutral-500">bertemu</span></span>
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); bagikan(); }} disabled={busy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-[15px] font-bold text-[#073B1C] active:opacity-90 disabled:opacity-60">
          <Ico n="share" className="h-5 w-5" sw={2} />{busy ? 'Menyiapkan…' : 'Bagikan kartu'}
        </button>
        {msg && <p className="text-center text-[13px] text-neutral-600">{msg}</p>}
      </div>
    ),
  });

  const n = slides.length;
  const cur = slides[Math.min(i, n - 1)];
  const tap = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left < r.width * 0.3) setI((x) => Math.max(0, x - 1));
    else if (i < n - 1) setI(i + 1);
  };
  const dark = i === n - 1;

  return (
    <div role="dialog" aria-modal="true" aria-label="Kendal Wrapped" className="fixed inset-0 z-[65] flex justify-center bg-black">
      <div onClick={tap} className="relative flex h-dvh w-full max-w-xl select-none flex-col overflow-hidden text-white" style={{ background: cur.bg }}>
        <div className="grid gap-1 px-3.5 pt-[calc(env(safe-area-inset-top)+12px)]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {slides.map((_, k) => <span key={k} className={`h-[3px] rounded-full ${k <= i ? (dark ? 'bg-neutral-900' : 'bg-white') : dark ? 'bg-neutral-900/20' : 'bg-white/30'}`} />)}
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Tutup"
          className={`absolute right-2 top-[calc(env(safe-area-inset-top)+20px)] z-10 flex h-12 w-12 items-center justify-center rounded-full ${dark ? 'text-neutral-900' : 'text-white'}`}>
          <Ico n="x" className="h-6 w-6" sw={2.2} />
        </button>
        <div key={i} className="ck-in-right relative flex flex-1 flex-col">{cur.body}</div>
        {i < n - 1 && <span className="px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] text-[13px] text-white/70">Ketuk untuk lanjut</span>}
      </div>
    </div>
  );
}
