'use client';
import { useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import type { Blok, KonsumenFull, Orang, Pengumuman, Performa, Sales } from '../../lib/performa-types';
import { brandOf, hariKerjaSisa, isNum, pace, staleInfo, type Ctx } from '../../lib/performa-calc';
import { angka, nama, rp, type Push } from './ui';
import {
  Avatar, BRAND, BrandArt, BrandChip, BrandIcon, CountPct, Ico, Kosong, Line, shortName, type BrandId,
} from './parts';
import { PengumumanList } from './Pengumuman';
import { NotifPrompt } from './Notif';

/* ---------- Tabel dari sheet pantauan ---------- */
const findBlok = (data: Performa, s: string, t: string): Blok | undefined =>
  (data.blok || []).find((b) => b.s === s && b.t.toLowerCase() === t.toLowerCase());
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : null);
const label = (v: unknown) => String(v ?? '').trim();
const isTotal = (v: unknown) => /^(grand\s*)?total$/i.test(label(v));
const tc = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bWom\b/, 'WOM').replace(/\bSoa\b/, 'SOA').replace(/\bMa\b/, 'MA');
const pctTone = (a: number | null | undefined) =>
  !isNum(a) ? 'bg-neutral-300 dark:bg-neutral-700' : a >= 1 ? 'bg-[#1FA463]' : a >= 0.5 ? 'bg-[#E0A800]' : 'bg-[#E5484D]';
const pct = (a: number | null | undefined) => (isNum(a) ? `${Math.round(a * 100)}%` : '–');
const signed = (v: number | null | undefined, money = false) => {
  if (!isNum(v)) return '–';
  const s = v > 0 ? '+' : v < 0 ? '−' : '';
  return s + (money ? rp(Math.abs(v)).replace('Rp ', '') : angka(Math.abs(v)));
};
const bulanLalu = (s: { lalu?: number | null; ini?: number | null; diffLalu?: number | null } | null | undefined): number | null =>
  !s ? null : isNum(s.lalu) ? s.lalu : isNum(s.ini) && isNum(s.diffLalu) ? s.ini - s.diffLalu : null;
const DiffTxt = ({ v, money = false }: { v: number | null | undefined; money?: boolean }) => (
  <span className={isNum(v) && v < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}>{signed(v, money)}</span>
);

function Sec({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="pt-6">
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2.5">
        <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
        {right && <span className="text-[13px] text-neutral-500">{right}</span>}
      </div>
      {children}
    </section>
  );
}

function Stack({ parts, h = 'h-2.5' }: { parts: [number, string][]; h?: string }) {
  const tot = parts.reduce((s, p) => s + p[0], 0);
  return (
    <div className={`${h} flex gap-0.5 overflow-hidden rounded-full bg-neutral-200/80 dark:bg-neutral-800`}>
      {tot > 0 && parts.filter((p) => p[0] > 0).map(([v, c], i) => <span key={i} className={c} style={{ width: `${(100 * v) / tot}%` }} />)}
    </div>
  );
}
function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="flex flex-wrap gap-3 px-4 pb-2 text-xs text-neutral-500">
      {items.map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-[3px] ${c}`} />{l}</span>)}
    </div>
  );
}
const C_GO = 'bg-[#1FA463]', C_PEN = 'bg-[#F2A33A]', C_REJ = 'bg-[#E5484D]', C_CAN = 'bg-neutral-400', C_BAN = 'bg-[#6C8CD5]';

/* ---------- Kartu utama ---------- */
function Hero({ title, amount, unit, today, b }: { title: string; amount: Sales | null; unit: Sales | null; today: string; b?: BrandId }) {
  const pa = pace(amount?.ini, amount?.target, today), pu = pace(unit?.ini, unit?.target, today);
  const hari = hariKerjaSisa(today);
  return (
    <section className={`relative mx-4 mt-3 overflow-hidden rounded-[22px] p-[18px] text-white ${b ? BRAND[b].grad : 'bg-neutral-900 dark:ring-1 dark:ring-neutral-800'}`}>
      {b && <span className="pointer-events-none absolute -right-8 top-2 text-white/15"><BrandArt b={b} className="h-24 w-48" /></span>}
      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-bold tracking-wide text-white/80">{b && <BrandIcon b={b} />}{title}</span>
        <span className="whitespace-nowrap rounded-full bg-[#F5C451] px-2.5 py-1 text-xs font-bold text-[#3A2A00]">{hari > 1 ? `Sisa ${hari} hari kerja` : hari === 1 ? 'Hari kerja terakhir' : 'Bulan selesai'}</span>
      </div>
      <div className="relative mt-3 grid grid-cols-2 gap-4">
        {([['Amount', amount, true], ['Unit', unit, false]] as const).map(([l, s, money]) => (
          <div key={l} className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] text-white/70">{l}</span>
            <span className="text-[34px] font-bold leading-none tracking-tight"><CountPct v={s?.ach} /></span>
            <Line v={s?.ach} color={isNum(s?.ach) && (s!.ach as number) >= 0.5 ? 'bg-[#F5C451]' : 'bg-[#FF8A8A]'} track="bg-white/20" />
            <span className="truncate text-xs text-white/70">{s ? (money ? `${rp(s.ini)} / ${rp(s.target).replace('Rp ', '')}` : `${angka(s.ini)} / ${angka(s.target)} unit`) : '–'}</span>
            {/* Bulan lalu: sekadar informasi, jadi dibuat redup */}
            {s && isNum(bulanLalu(s)) && (
              <span className="truncate text-xs text-white/55">
                Bln lalu {money ? rp(bulanLalu(s)) : `${angka(bulanLalu(s))} unit`}
                {isNum(s.diffLalu) && s.diffLalu !== 0 && (
                  <span className={`ml-1 ${s.diffLalu < 0 ? 'text-[#FFB4B4]' : 'text-[#9FE3BF]'}`} aria-label={s.diffLalu < 0 ? 'bulan ini masih di bawah bulan lalu' : 'bulan ini sudah di atas bulan lalu'}>{s.diffLalu < 0 ? '▼' : '▲'}</span>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
      {(pa || pu) && (
        <div className="relative mt-3 flex gap-3 border-t border-white/15 pt-3 text-xs">
          <span className="flex-1">{pa ? (pa.tercapai ? <b className="text-[#9FE3BF]">Amount tercapai</b> : <>Kejar <b>{rp(pa.kurang)}</b> · ±{rp(pa.perHari).replace('Rp ', '')}/hari</>) : ''}</span>
          <span className="flex-1 text-right">{pu ? (pu.tercapai ? <b className="text-[#9FE3BF]">Unit tercapai</b> : <>Kejar <b>{Math.ceil(pu.kurang)} unit</b> · ±{(Math.ceil(pu.perHari * 10) / 10).toLocaleString('id-ID')}/hari</>) : ''}</span>
        </div>
      )}
    </section>
  );
}

/* ---------- Tab Cabang ---------- */
function PicList({ c, push, filter }: { c: Ctx; push: Push; filter: 'semua' | BrandId }) {
  const rows = c.sales.filter((o) => filter === 'semua' || brandOf(o) === filter)
    .sort((a, b) => (b.amount?.ach ?? -1) - (a.amount?.ach ?? -1));
  const MEDAL = ['bg-[#F5C451]', 'bg-[#BFC3C9]', 'bg-[#D9A37A]'];
  if (!rows.length) return <Kosong art={filter === 'mobilku' ? 'mobil' : 'motor'} title="Belum ada data sales" />;
  return (
    <ul className="border-t border-neutral-200 dark:border-neutral-800">
      {rows.map((o, i) => {
        const b = brandOf(o);
        return (
          <li key={o.nama}>
            <button onClick={() => push({ t: 'orang', o })} className="flex w-full gap-3 border-b border-neutral-200 px-4 py-3.5 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
              <span className="relative h-11 shrink-0">
                <Avatar o={o} size={44} className={b ? `${BRAND[b].soft} ${BRAND[b].text}` : ''} />
                {i < 3 && <span className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[11px] font-extrabold text-[#3A2A00] dark:border-neutral-950 ${MEDAL[i]}`}>{i + 1}</span>}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="flex items-center gap-1.5"><span className="truncate text-[15px] font-bold">{shortName(o.nama)}</span><BrandChip b={b} /></span>
                <span className="grid grid-cols-2 gap-3">
                  {([['unit', o.unit], ['amount', o.amount]] as const).map(([k, s]) => (
                    <span key={k} className="flex min-w-0 flex-col gap-1">
                      <span className="flex justify-between gap-1 text-xs text-neutral-500">
                        <span className="truncate">{s ? (k === 'unit' ? `Unit ${angka(s.ini)}/${angka(s.target)}` : rp(s.ini)) : '–'}</span>
                        <b className="text-neutral-900 dark:text-white">{pct(s?.ach)}</b>
                      </span>
                      <Line v={s?.ach} className="h-[5px]" color={pctTone(s?.ach)} />
                      <span className="truncate text-[11px] text-neutral-400 dark:text-neutral-500">
                        Bln lalu {isNum(bulanLalu(s)) ? (k === 'amount' ? rp(bulanLalu(s)).replace('Rp ', '') : angka(bulanLalu(s))) : '–'}
                        {isNum(s?.diffLalu) && <> (<DiffTxt v={s?.diffLalu} money={k === 'amount'} />)</>}
                      </span>
                    </span>
                  ))}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function brandTotals(c: Ctx) {
  // Dari tabel "Sales … per brand" kalau ada; kalau tidak, dijumlah dari anggota
  const acc = findBlok(c.data, 'cabang', 'Sales account per brand'), amt = findBlok(c.data, 'cabang', 'Sales amount per brand');
  const fromBlok = (bl: Blok | undefined, key: string) => {
    const r = bl?.r.find((x) => label(x[0]).toLowerCase() === key);
    return r ? { ini: num(r[3]), target: num(r[4]), ach: num(r[5]), diffLalu: num(r[6]) } : null;
  };
  const sum = (b: BrandId, w: 'unit' | 'amount') => {
    const list = c.sales.filter((o) => brandOf(o) === b).map((o) => o[w]).filter(Boolean) as Sales[];
    if (!list.length) return null;
    const ini = list.reduce((s, x) => s + (x.ini || 0), 0), target = list.reduce((s, x) => s + (x.target || 0), 0);
    return { ini, target, ach: target ? ini / target : null, diffLalu: list.reduce((s, x) => s + (x.diffLalu || 0), 0) };
  };
  const get = (b: BrandId, w: 'unit' | 'amount') => (w === 'unit' ? fromBlok(acc, b) : fromBlok(amt, b)) || sum(b, w);
  return (b: BrandId) => ({ unit: get(b, 'unit'), amount: get(b, 'amount') });
}

function Cabang({ c, push, goBrand }: { c: Ctx; push: Push; goBrand: (b: BrandId) => void }) {
  const [f, setF] = useState<'semua' | BrandId>('semua');
  const tot = brandTotals(c);
  const oi = c.sales.filter((o) => o.oi && isNum(o.oi.total) && (o.oi.total as number) > 0)
    .sort((a, b) => (b.oi!.successRate ?? 0) - (a.oi!.successRate ?? 0));
  const ap = c.sales.filter((o) => o.approval && (o.approval.total || 0) > 0);
  const oiTot = oi.reduce((s, o) => ({ go: s.go + (o.oi!.golive || 0), t: s.t + (o.oi!.total || 0), tg: s.tg + (o.oi!.target || 0) }), { go: 0, t: 0, tg: 0 });
  const flag = findBlok(c.data, 'cabang', 'Sales per flag approval');
  const flagTot = flag?.r.find((r) => isTotal(r[0])) || null;
  const flagHead = (flag?.h || []).slice(1, 5).map((h) => tc(label(h)));

  return (
    <>
      <Sec title="Sales per PIC" right="urut % amount">
        <div className="px-4 pb-2.5">
          <div className="flex w-max gap-0.5 rounded-full bg-neutral-100 p-[3px] dark:bg-neutral-900">
            {([['semua', 'Semua'], ['mobilku', 'Mobilku'], ['motorku', 'Motorku']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setF(k)} aria-pressed={f === k}
                className={`min-h-10 rounded-full px-3.5 text-sm ${f === k ? 'bg-white font-bold shadow-sm dark:bg-neutral-700' : 'font-semibold text-neutral-500'}`}>{l}</button>
            ))}
          </div>
        </div>
        <PicList c={c} push={push} filter={f} />
      </Sec>

      <Sec title="Sales per brand" right="ketuk untuk detail">
        <div className="grid grid-cols-2 gap-2.5 px-4">
          {(['mobilku', 'motorku'] as const).map((b) => {
            const t = tot(b);
            return (
              <button key={b} onClick={() => goBrand(b)} className={`relative min-h-[150px] overflow-hidden rounded-[20px] p-3.5 text-left text-white ${BRAND[b].bg} active:opacity-90`}>
                <span className="relative flex items-center gap-1.5 text-xs font-bold text-white/80"><BrandIcon b={b} className="h-4 w-4" />{BRAND[b].label.toUpperCase()}</span>
                <span className="relative mt-1 block text-[28px] font-bold leading-tight">{pct(t.amount?.ach)}</span>
                <span className="relative block text-xs text-white/75">{t.amount ? `${rp(t.amount.ini)} / ${rp(t.amount.target).replace('Rp ', '')}` : '–'}</span>
                <span className="relative mt-1 block text-xs">Unit <b>{t.unit ? `${angka(t.unit.ini)}/${angka(t.unit.target)}` : '–'}</b> · {pct(t.unit?.ach)}</span>
                <span className="pointer-events-none absolute -bottom-2 -right-5 text-white/20"><BrandArt b={b} className="h-14 w-28" /></span>
              </button>
            );
          })}
        </div>
      </Sec>

      {oi.length > 0 && (
        <Sec title="Order in per CMO" right="success rate">
          <Legend items={[['Golive', C_GO], ['Pending', C_PEN], ['Reject', C_REJ], ['Cancel', C_CAN]]} />
          <div className="border-t border-neutral-200 dark:border-neutral-800">
            {oi.map((o) => (
              <button key={o.nama} onClick={() => push({ t: 'orang', o })} className="flex w-full flex-col gap-1.5 border-b border-neutral-200 px-4 py-2.5 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-bold">{shortName(o.nama)}<BrandChip b={brandOf(o)} /></span>
                  <span className="text-[13px] text-neutral-500"><b className="text-neutral-900 dark:text-white">{angka(o.oi!.golive)}</b> golive / {angka(o.oi!.total)} OI · <b className="text-neutral-900 dark:text-white">{pct(o.oi!.successRate)}</b></span>
                </span>
                <Stack parts={[[o.oi!.golive || 0, C_GO], [(o.oi!.pending || 0) + (o.oi!.poPending || 0), C_PEN], [o.oi!.reject || 0, C_REJ], [o.oi!.cancel || 0, C_CAN]]} />
              </button>
            ))}
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2 px-4">
            {[[angka(oiTot.go), `golive / ${oiTot.t} OI`], [pct(oiTot.t ? oiTot.go / oiTot.t : null), 'success rate'], [pct(oiTot.tg ? oiTot.t / oiTot.tg : null), `OI ${oiTot.t}/${oiTot.tg} target`]].map(([v, l]) => (
              <span key={l} className="flex flex-col rounded-2xl bg-neutral-100 p-2.5 dark:bg-neutral-900"><b className="text-xl">{v}</b><span className="text-xs text-neutral-500">{l}</span></span>
            ))}
          </div>
        </Sec>
      )}

      {ap.length > 0 && (
        <Sec title="Success rate aplikasi" right="% banding">
          <Legend items={[['Approve', C_GO], ['Banding', C_BAN], ['Reject', C_REJ], ['Cancel', C_CAN]]} />
          <div className="border-t border-neutral-200 dark:border-neutral-800">
            {ap.map((o) => {
              const a = o.approval!, t = a.total || 0;
              return (
                <div key={o.nama} className="flex min-h-12 items-center gap-2.5 border-b border-neutral-200 px-4 dark:border-neutral-800">
                  <span className="w-16 shrink-0 truncate text-sm font-bold">{shortName(o.nama)}</span>
                  <span className="flex-1"><Stack parts={[[a.approve || 0, C_GO], [a.banding || 0, C_BAN], [a.reject || 0, C_REJ], [a.cancel || 0, C_CAN]]} /></span>
                  <span className="w-[74px] shrink-0 text-right text-xs text-neutral-500">{t} apl · <b className="text-neutral-900 dark:text-white">{pct(t ? (a.banding || 0) / t : null)}</b></span>
                </div>
              );
            })}
          </div>
        </Sec>
      )}

      {flag && (
        <Sec title="Flag approval" right="bulan ini">
          <div className="grid grid-cols-4 gap-2 px-4">
            {flagHead.map((h, i) => (
              <span key={h + i} className="flex flex-col items-center rounded-2xl border border-neutral-200 px-1 py-2.5 dark:border-neutral-800">
                <b className="text-lg">{angka(num(flagTot?.[i + 1]) ?? 0)}</b><span className="truncate text-[11px] text-neutral-500">{h || '–'}</span>
              </span>
            ))}
          </div>
        </Sec>
      )}
    </>
  );
}

/* ---------- Tab Mobilku / Motorku ---------- */
function BrandTab({ c, b, push }: { c: Ctx; b: BrandId; push: Push }) {
  const data = c.data, a = data.aktivitas, B = BRAND[b];
  const tot = brandTotals(c)(b);
  const mt = a?.maintain?.[b], rk = a?.rekrut?.[b];
  const sv = findBlok(data, b, 'Status visit'), hv = findBlok(data, b, 'Hasil visit');
  const mtB = findBlok(data, b, 'Maintain');
  const chA = findBlok(data, b, 'Sales account per channel'), chM = findBlok(data, b, 'Sales amount per channel');
  const ois = findBlok(data, b, 'Order in per status');
  const soaC = findBlok(data, b, 'Cek data SOA'), soaH = findBlok(data, b, 'Hitungan SOA');
  const kons: KonsumenFull[] = a?.konsumen?.[b] || [];
  const maAll = a?.ma?.[b] || [];

  // Visit P1–P3: dari tabel Status visit, atau hitung dari aktivitas
  const pv = ([1, 2, 3] as const).map((p) => {
    const col = p;
    const get = (re: RegExp) => num(sv?.r.find((r) => re.test(label(r[0])))?.[col]);
    const bt = get(/^bertemu$/i), tb = get(/^tidak\s*bertemu$/i), bl = get(/^belum\s*visit$/i), gt = get(/^grand\s*total$/i);
    if (gt !== null) return { bt: bt || 0, tb: tb || 0, bl: bl || 0, tot: gt };
    const x = a?.visit?.[b]?.[`p${p}` as 'p1'];
    return { bt: x?.ditemui || 0, tb: (x?.tervisit || 0) - (x?.ditemui || 0), bl: (x?.database || 0) - (x?.tervisit || 0), tot: x?.database || 0 };
  });
  const hasil = (hv?.r || []).filter((r) => label(r[0]) && !isTotal(r[0]) && !/belum\s*visit/i.test(label(r[0])))
    .map((r) => [tc(label(r[0])), (num(r[1]) || 0) + (num(r[2]) || 0) + (num(r[3]) || 0)] as [string, number]);
  const mtRows = (mtB?.r || []).filter((r) => /maintain\s*\dx/i.test(label(r[0])))
    .map((r) => [label(r[0]).replace(/maintain\s*/i, '').toUpperCase(), num(r[1]) || 0, num(r[2])] as [string, number, number | null]);
  const channels = (chA?.r || []).filter((r) => label(r[0]) && !isTotal(r[0])).map((r) => {
    const m = chM?.r.find((x) => label(x[0]) === label(r[0]));
    return { n: tc(label(r[0])), u: num(r[3]), tu: num(r[4]), au: num(r[5]), amt: num(m?.[3]), tm: num(m?.[4]), am: num(m?.[5]) };
  });
  const oiStat = (ois?.r || []).filter((r) => label(r[0]) && !isTotal(r[0])).map((r) => [tc(label(r[0])), num(r[2]) ?? num(r[1]) ?? 0] as [string, number]);
  const soa = (soaC?.r || []).filter((r) => label(r[0]) && !isTotal(r[0])).map((r) => {
    const h = soaH?.r.find((x) => label(x[0]) === label(r[0]));
    return [tc(label(r[0])), num(r[3]) ?? num(r[2]), num(h?.[2]) ?? num(h?.[1])] as [string, number | null, number | null];
  });
  const OI_C: Record<string, string> = { Golive: 'text-[#1FA463]', Cancel: 'text-neutral-500', Reject: 'text-[#E5484D]', Pending: 'text-[#E08A1E]' };

  return (
    <>
      <Hero title={`${B.label.toUpperCase()} · ${new Date(c.today + 'T00:00:00Z').toLocaleDateString('id-ID', { month: 'long', timeZone: 'UTC' }).toUpperCase()}`}
        amount={tot.amount as Sales | null} unit={tot.unit as Sales | null} today={c.today} b={b} />

      <div className="mt-3 grid grid-cols-3 gap-2 px-4">
        <button disabled={!maAll.length} onClick={() => push({ t: 'maList', title: `MA ${B.label}`, sub: `${mt?.ma || 0} MA`, items: maAll })}
          className={`flex flex-col gap-0.5 rounded-[18px] p-3 text-left ${B.soft} ${B.text}`}>
          <span className="text-xs font-bold">Maintain</span>
          <b className="text-2xl leading-tight">{mt?.ma ? pct(mt.sudah / mt.ma) : '–'}</b>
          <span className="text-[11px] leading-tight">{mt ? `${mt.sudah}/${mt.ma} MA${mt.belum ? ` · ${mt.belum} belum` : ''}` : '–'}</span>
        </button>
        {([['Rekrut', rk?.rekrut], ['Regist', rk?.regist]] as const).map(([l, x]) => {
          const ok = x?.target && x.jumlah >= x.target;
          return (
            <div key={l} className={`flex flex-col gap-0.5 rounded-[18px] p-3 ${ok ? 'bg-green-50 text-green-800 dark:bg-green-400/15 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-400/15 dark:text-red-300'}`}>
              <span className="text-xs font-bold">{l}</span>
              <b className="text-2xl leading-tight">{x ? x.jumlah : '–'}<span className="text-sm">/{x?.target ?? '–'}</span></b>
              <span className="text-[11px] leading-tight">{x?.target ? (ok ? 'Target tercapai' : `kurang ${x.target - x.jumlah}`) : '–'}</span>
            </div>
          );
        })}
      </div>

      <Sec title="Visit prioritas" right="ketuk untuk nama">
        <div className="grid grid-cols-3 gap-2 px-4">
          {pv.map((x, i) => (
            <button key={i} disabled={!kons.length} onClick={() => push({ t: 'kList', title: `Konsumen P${i + 1} ${B.label}`, sub: 'Ketuk nama untuk detail', items: kons, mode: 'cabang', p0: (i + 1) as 1 })}
              className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-3 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
              <span className="flex items-baseline justify-between"><b className="text-[15px]">P{i + 1}</b><span className="text-xs text-neutral-500">{x.tot} data</span></span>
              <span className="text-2xl font-bold leading-none">{x.tot - x.bl}<span className="text-[13px] font-medium text-neutral-500">/{x.tot}</span></span>
              <Stack h="h-2" parts={[[x.bt, C_GO], [x.tb, C_PEN], [x.bl, 'bg-neutral-200 dark:bg-neutral-700']]} />
              <span className="text-[11px] leading-snug text-neutral-600 dark:text-neutral-400">
                <b className="text-green-700 dark:text-green-400">{x.bt}</b> bertemu<br /><b className="text-[#8A4700] dark:text-[#F2A33A]">{x.tb}</b> tidak bertemu<br /><b className="text-red-700 dark:text-red-400">{x.bl}</b> belum visit
              </span>
            </button>
          ))}
        </div>
        {hasil.length > 0 && (
          <>
            <p className="px-4 pt-3 text-[13px] font-bold">Hasil visit</p>
            <div className="flex flex-wrap gap-1.5 px-4 pt-2">
              {hasil.map(([l, n]) => (
                <span key={l} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold ${n ? `${B.soft} ${B.text}` : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900'}`}>{l} <b>{n}</b></span>
              ))}
            </div>
          </>
        )}
      </Sec>

      {(mtRows.length > 0 || mt) && (
        <Sec title="Maintain MA" right="frekuensi bulan ini">
          <div className="mx-4 flex flex-col gap-2.5 rounded-[18px] border border-neutral-200 p-3.5 dark:border-neutral-800">
            {mtRows.length ? mtRows.map(([l, n, p]) => (
              <div key={l} className="flex items-center gap-2.5">
                <span className="w-8 text-[13px] font-bold">{l}</span>
                <span className="flex-1"><Line v={p ?? (mt?.ma ? n / mt.ma : 0)} className="h-2" color={B.line} /></span>
                <span className="w-[78px] text-right text-[13px]"><b>{n}</b><span className="text-neutral-500">/{mt?.ma ?? '–'} · {pct(p ?? (mt?.ma ? n / mt.ma : null))}</span></span>
              </div>
            )) : <p className="text-sm text-neutral-500">{mt?.sudah}/{mt?.ma} MA sudah dimaintain bulan ini.</p>}
          </div>
        </Sec>
      )}

      {channels.length > 0 && (
        <Sec title="Sales per channel" right="unit · amount">
          <div className="border-t border-neutral-200 dark:border-neutral-800">
            {channels.map((x) => (
              <div key={x.n} className="flex flex-col gap-1.5 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
                <span className="flex justify-between gap-2 text-sm"><span className="font-semibold">{x.n}</span><span><b>{angka(x.u)}</b><span className="text-neutral-500">/{angka(x.tu)} unit</span> · <b>{pct(x.au)}</b></span></span>
                <Line v={x.au} className="h-[5px]" color={B.line} />
                <span className="text-xs text-neutral-500">Amount {isNum(x.amt) ? rp(x.amt) : '–'}{isNum(x.am) ? ` · ${pct(x.am)} target` : ''}</span>
              </div>
            ))}
          </div>
        </Sec>
      )}

      {oiStat.length > 0 && (
        <Sec title="Order in per status" right="bulan ini">
          <div className="grid grid-cols-4 gap-1.5 px-4">
            {oiStat.slice(0, 8).map(([l, n]) => (
              <span key={l} className="flex flex-col items-center rounded-2xl bg-neutral-100 px-1 py-2.5 dark:bg-neutral-900">
                <b className={`text-xl ${OI_C[l] || ''}`}>{angka(n)}</b><span className="truncate text-xs text-neutral-500">{l}</span>
              </span>
            ))}
          </div>
        </Sec>
      )}

      {soa.length > 0 && (
        <Sec title="Data SOA" right="cek data · hitungan">
          <div className="border-t border-neutral-200 dark:border-neutral-800">
            {soa.map(([l, a1, a2]) => (
              <div key={l} className="flex min-h-11 items-center justify-between border-b border-neutral-200 px-4 text-sm dark:border-neutral-800">
                <span>{l}</span><span className="flex gap-5"><b className="w-9 text-right">{angka(a1)}</b><span className="w-9 text-right text-neutral-500">{angka(a2)}</span></span>
              </div>
            ))}
          </div>
        </Sec>
      )}

      {!data.blok && (
        <Kosong art={b === 'mobilku' ? 'mobil' : 'motor'} title="Tabel lengkap belum dikirim"
          text="Channel, order in, dan SOA muncul setelah Apps Script terbaru (Code.gs) terpasang dan mengirim data." />
      )}
    </>
  );
}

/* ---------- Halaman Pantau ---------- */
type Tab = 'cabang' | BrandId;
const TABS: Tab[] = ['cabang', 'mobilku', 'motorku'];

export default function Pantau({ c, me, akun, push, pengumuman, isOwner, onPengumuman, buatPengumuman, openWrapped, plan }: {
  c: Ctx; me: Orang | null; akun: { name?: string }; push: Push;
  pengumuman: Pengumuman[]; isOwner: boolean; onPengumuman: () => void; buatPengumuman: () => void; openWrapped: () => void; plan?: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>('cabang');
  const [dir, setDir] = useState<'kanan' | 'kiri'>('kanan');
  const start = useRef<{ x: number; y: number } | null>(null);
  const go = (t: Tab) => { setDir(TABS.indexOf(t) >= TABS.indexOf(tab) ? 'kanan' : 'kiri'); setTab(t); };
  const onTS = (e: TouchEvent) => { start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTE = (e: TouchEvent) => {
    const s = start.current; start.current = null;
    if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45) return;
    const i = TABS.indexOf(tab) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < TABS.length) go(TABS[i]);
  };

  const data = c.data;
  const stale = staleInfo(data);
  const jam = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date()));
  const salam = jam < 11 ? 'Pagi' : jam < 15 ? 'Siang' : jam < 18 ? 'Sore' : 'Malam';
  const panggil = me ? shortName(me.nama) : (akun.name || '').split(' ')[0];
  const sapa = useMemo(() => {
    const u = me?.unit, am = me?.amount;
    if (me && u && isNum(u.ini) && isNum(u.target) && u.ini < u.target) {
      const k = Math.ceil(u.target - u.ini);
      return k === 1 ? 'Tinggal 1 unit lagi buat badge Unit tembus. Gas!' : `Kurang ${k} unit lagi bulan ini. Satu-satu, pasti bisa!`;
    }
    if (me && am && isNum(am.ach) && am.ach >= 1) return 'Target tembus! Pertahankan sampai akhir bulan.';
    const t = data.cabangTotal?.unit;
    if (t && isNum(t.ini) && isNum(t.target)) return `Cabang kurang ${Math.max(0, Math.ceil(t.target - t.ini))} unit, ${hariKerjaSisa(c.today)} hari kerja lagi.`;
    return 'Semangat hari ini!';
  }, [me, data, c.today]);
  const tgl = Number(c.today.slice(8, 10));
  const showWrapped = tgl >= 20;

  return (
    <div className="pb-6" onTouchStart={onTS} onTouchEnd={onTE}>
      <div role="tablist" className="sticky top-[calc(env(safe-area-inset-top)+58px)] z-20 grid grid-cols-3 border-b border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        {TABS.map((t) => {
          const on = t === tab;
          const col = t === 'cabang' ? '' : BRAND[t].text;
          return (
            <button key={t} role="tab" aria-selected={on} onClick={() => go(t)}
              className={`flex min-h-12 items-center justify-center gap-1.5 text-[15px] transition ${on ? `font-bold ${col || 'text-neutral-900 dark:text-white'} shadow-[inset_0_-2.5px_0_currentColor]` : 'font-semibold text-neutral-500'}`}>
              {t !== 'cabang' && <BrandIcon b={t} />}{t === 'cabang' ? 'Cabang' : BRAND[t].label}
            </button>
          );
        })}
      </div>

      {stale && (
        <div role="status" className="flex items-start gap-2 bg-[#FFF4E0] px-4 py-2.5 text-[13px] leading-snug text-[#5C2F00] dark:bg-[#2A1E0C] dark:text-[#F7C98A]">
          <Ico n="refresh" className="mt-px h-4 w-4 shrink-0" sw={2} />{stale}
        </div>
      )}

      <div key={tab} className={dir === 'kanan' ? 'ck-in-right' : 'ck-in-left'}>
        {tab === 'cabang' ? (
          <>
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-[#FFF8E8] px-3.5 py-3 text-[#4A3A12] dark:bg-[#1E1A10] dark:text-[#F7DFA6]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5C451] text-[#6B4A00]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
              </span>
              <span className="text-sm leading-snug"><b>{salam}{panggil ? `, ${panggil}` : ''}!</b> {sapa}</span>
            </div>
            {plan}
            <PengumumanList list={pengumuman} brand="semua" isOwner={isOwner} onChanged={onPengumuman} onCreate={buatPengumuman} />
            <NotifPrompt nama={me?.nama || ''} />
            {showWrapped && (
              <button onClick={openWrapped} className="relative mx-4 mt-3 flex w-[calc(100%-32px)] items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#1B2F5B] to-[#1D6A4B] px-4 py-3.5 text-left text-white active:opacity-90">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#F5C451]"><Ico n="trophy" className="h-5 w-5" sw={2} /></span>
                <span className="flex-1"><b className="block text-[15px]">Kendal Wrapped {new Date(c.today + 'T00:00:00Z').toLocaleDateString('id-ID', { month: 'long', timeZone: 'UTC' })}</b><span className="text-[13px] text-white/80">Rangkuman bulanmu, siap dibagikan</span></span>
                <Ico n="right" className="h-5 w-5" sw={2} />
              </button>
            )}
            <Hero title={`${nama(data.cabang).toUpperCase()} · ${new Date(c.today + 'T00:00:00Z').toLocaleDateString('id-ID', { month: 'long', timeZone: 'UTC' }).toUpperCase()}`}
              amount={data.cabangTotal?.amount || null} unit={data.cabangTotal?.unit || null} today={c.today} />
            <Cabang c={c} push={push} goBrand={go} />
          </>
        ) : (
          <BrandTab c={c} b={tab} push={push} />
        )}
      </div>
      <p className="px-4 pt-5 text-[13px] text-neutral-500">Geser kiri–kanan untuk pindah Cabang · Mobilku · Motorku. Tarik ke bawah untuk memuat ulang.</p>
    </div>
  );
}

