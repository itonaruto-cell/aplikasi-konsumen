'use client';
import { useMemo, useState } from 'react';
import type { Metric, Orang } from '../../lib/performa-types';
import { badges, ranking, shareJuara, type Ctx, type Period, type RankRow } from '../../lib/performa-calc';
import { angka, persen, rp, type Push } from './ui';
import { Avatar, Ico, Line, MoveMark, PillSeg, Podium, ShareBtn, UnderTabs, rankVal, salesDetail, shareText, shortName, twoNames } from './parts';

const TABS: [Metric, string][] = [['amount', 'Amount'], ['unit', 'Unit'], ['visit', 'Visit'], ['bertemu', 'Temu'], ['maintain', 'Maintain']];
const UNIT: Record<Metric, string> = { amount: '', unit: '', visit: 'visit', bertemu: 'bertemu', maintain: 'maintain' };

function subOf(r: RankRow, rows: RankRow[], metric: Metric) {
  const brand = r.o.brand ? r.o.brand.charAt(0) + r.o.brand.slice(1).toLowerCase() : '';
  if (r.rank === 1) {
    if (metric === 'amount') return [brand, `${rp(r.o.amount?.ini)} / ${rp(r.o.amount?.target).replace('Rp ', '')}`].filter(Boolean).join(' · ');
    if (metric === 'unit') return [brand, `${angka(r.o.unit?.ini)} / ${angka(r.o.unit?.target)} unit`].filter(Boolean).join(' · ');
    return [brand, 'teratas'].filter(Boolean).join(' · ');
  }
  const nilai = metric === 'amount' ? rp(r.o.amount?.ini) : metric === 'unit' ? `${angka(r.o.unit?.ini)} unit` : '';
  const up = rows[r.rank - 2];
  if (!up || r.val === null || up.val === null) return [brand, nilai].filter(Boolean).join(' · ');
  const gap = up.val - r.val;
  return [brand, nilai, `kurang ${r.pct ? persen(gap) : angka(gap) + ' ' + UNIT[metric]} ke #${up.rank}`].filter(Boolean).join(' · ');
}

export default function Juara({ c, me, push }: { c: Ctx; me: Orang | null; push: Push }) {
  const [metric, setMetric] = useState<Metric>('amount');
  const [period, setPeriod] = useState<Period>('bulan');
  const pct = metric === 'amount' || metric === 'unit';
  const per: Period = pct ? 'bulan' : period;
  const rows = useMemo(() => ranking(c, metric, per), [c, metric, per]);
  const bs = useMemo(() => badges(c), [c]);
  const mine = me ? rows.find((r) => r.o === me) : undefined;
  const open = (o: Orang) => push({ t: 'orang', o });

  return (
    <div className="pb-28">
      <div className="px-4 pt-3">
        <PillSeg value={per} onChange={setPeriod} full
          options={[['bulan', 'Bulan ini'], ['minggu', 'Minggu ini', pct]]} />
        {pct && <p className="px-1 pt-1.5 text-[13px] text-neutral-500">Amount & unit dihitung per bulan.</p>}
      </div>
      <div className="mt-2"><UnderTabs value={metric} onChange={setMetric} options={TABS} small /></div>

      <div className="px-4 pb-2 pt-4">
        <Podium rows={rows} onOpen={open} reached={(r) => r.pct && (r.val || 0) >= 1} detail={pct ? salesDetail(metric) : undefined} />
      </div>
      <div className="flex justify-between gap-2 border-b border-neutral-200 px-4 py-2 text-[13px] text-neutral-500 dark:border-neutral-800">
        <span>{pct ? '% dari target' : per === 'minggu' ? `Jumlah ${UNIT[metric]} minggu ini` : `Jumlah ${UNIT[metric]} bulan ini`}</span>
        <span>panah = vs kemarin</span>
      </div>
      <div className="flex justify-end border-b border-neutral-200 px-2 dark:border-neutral-800">
        <ShareBtn label="Bagikan ke WA" onClick={() => shareText(shareJuara(c, metric, typeof location !== 'undefined' ? location.origin : undefined))} />
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.o.nama}>
            <button onClick={() => open(r.o)}
              className={`flex min-h-[72px] w-full items-center gap-3 border-b border-neutral-200 px-4 py-3 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900 ${r.o === me ? 'bg-neutral-50 dark:bg-neutral-900' : ''}`}>
              <span className="flex w-5 flex-col items-center gap-0.5">
                <span className="text-base font-bold">{r.rank || '–'}</span>
                <MoveMark r={r} />
              </span>
              <Avatar o={r.o} />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-bold">{twoNames(r.o.nama)}{r.o === me && <span className="font-normal text-neutral-500"> · kamu</span>}</span>
                  <span className="text-base font-bold">{rankVal(r)}</span>
                </span>
                <Line v={r.ach} className="h-[5px]" color={r.pct && (r.val || 0) >= 1 || r.rank === 1 ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-400 dark:bg-neutral-500'} />
                <span className="truncate text-[13px] text-neutral-500">{subOf(r, rows, metric)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!rows.length && <p className="px-4 py-8 text-center text-sm text-neutral-500">Belum ada yang punya data {UNIT[metric] || metric}.</p>}

      <div className="pt-5">
        <p className="px-4 text-[17px] font-bold">Badge bulan ini</p>
        <div className="mt-2.5 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {bs.map((b) => {
            const on = b.holders.length > 0;
            return (
              <div key={b.id} className={`flex w-[132px] shrink-0 flex-col gap-1.5 rounded-2xl p-3 ${on
                ? 'bg-neutral-900 text-white dark:ring-1 dark:ring-neutral-800'
                : 'border border-dashed border-neutral-300 text-neutral-500 dark:border-neutral-700'}`}>
                <span className={on ? 'text-[#F5C451]' : ''}>
                  <Ico n={on ? (b.id === 'visit' ? 'flame' : b.id === 'bertemu' || b.id === 'maintain' ? 'users' : 'trophy') : 'lock'} className="h-6 w-6" sw={1.8} />
                </span>
                <span className="text-sm font-bold">{b.label}</span>
                <span className={`text-[13px] ${on ? 'text-neutral-300' : ''}`}>{on ? b.holders.map((h) => shortName(h.nama)).join(', ') : b.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {mine && mine.rank > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 mx-auto max-w-xl px-3">
          <button onClick={() => open(mine.o)}
            className="pointer-events-auto flex w-full items-center gap-3 rounded-[18px] bg-neutral-900 px-3.5 py-3 text-left text-white shadow-xl dark:bg-white dark:text-neutral-900">
            <Avatar o={mine.o} className="!bg-neutral-700 !text-white dark:!bg-neutral-200 dark:!text-neutral-900" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold">Kamu #{mine.rank} {TABS.find((t) => t[0] === metric)?.[1].toLowerCase()}</span>
              <span className="block truncate text-[13px] opacity-75">
                {mine.rank === 1 ? 'Pertahankan posisimu!' : subOf(mine, rows, metric).split(' · ').pop()}
              </span>
            </span>
            <span className="shrink-0 text-lg font-bold">{rankVal(mine)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
