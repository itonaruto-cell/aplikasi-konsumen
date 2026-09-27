'use client';
import { useEffect, useRef, useState } from 'react';
import type { Orang } from '../../lib/performa-types';
import { relDay, type Ctx, type Story } from '../../lib/performa-calc';
import { angka, nama, persen } from './ui';
import { Avatar, Ico, twoNames } from './parts';

type Slide = { key: string; label: string; big: string; text: string; list?: [string, string][]; foot?: string; tone?: 'up' | 'down' };

function slidesOf(s: Story, c: Ctx): Slide[] {
  const when = relDay(c, s.d);
  const WHEN = when === 'hari ini' ? 'HARI INI' : when === 'kemarin' ? 'KEMARIN' : new Date(s.d + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).toUpperCase();
  const out: Slide[] = [];
  if (s.visits.length) {
    out.push({
      key: 'v', label: `VISIT ${WHEN}`, big: String(s.visits.length),
      text: `konsumen dikunjungi, ${s.met ? `${s.met} berhasil bertemu.` : 'belum ada yang bertemu.'}`,
      list: s.kec.slice(0, 4).map(([k, n]) => [k === 'Tanpa kecamatan' ? k : `Kec. ${nama(k)}`, `${n} visit`]),
    });
  }
  if (s.maint.length) {
    out.push({
      key: 'm', label: `MAINTAIN ${WHEN}`, big: String(s.maint.length), text: 'MA dimaintain.',
      list: s.maint.slice(0, 4).map((m) => [nama(m.m.n), m.m.job ? nama(m.m.job) : '']),
    });
  }
  const o: Orang = s.o;
  if (s.amountRank) {
    out.push({
      key: 'r', label: 'PAPAN JUARA', big: `#${s.amountRank}`, text: `amount bulan ini · ${persen(o.amount?.ach)} dari target`,
      list: [['Unit', `${angka(o.unit?.ini)} / ${angka(o.unit?.target)}`], ...(o.visit ? [['Konsumen bertemu', angka(o.visit.ditemui)] as [string, string]] : []),
        ...(o.maintain ? [['MA dimaintain', `${o.maintain.sudah}/${o.maintain.ma}`] as [string, string]] : [])],
      foot: s.amountMove === 'up' ? 'Naik peringkat dari kemarin' : s.amountMove === 'down' ? 'Turun peringkat dari kemarin' : undefined,
      tone: s.amountMove === 'up' ? 'up' : s.amountMove === 'down' ? 'down' : undefined,
    });
  }
  return out;
}

const DUR = 5000;

export default function Sorotan({ list, start, c, onSeen, onClose, onProfile }: {
  list: Story[]; start: number; c: Ctx; onSeen: (s: Story) => void; onClose: () => void; onProfile: (o: Orang) => void;
}) {
  const [si, setSi] = useState(start);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [t, setT] = useState(0);
  const story = list[si];
  const slides = story ? slidesOf(story, c) : [];
  const slide = slides[Math.min(idx, slides.length - 1)];
  const last = useRef(0);

  useEffect(() => { if (story) onSeen(story); }, [si]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    setT(0);
    if (idx < slides.length - 1) setIdx(idx + 1);
    else if (si < list.length - 1) { setSi(si + 1); setIdx(0); }
    else onClose();
  };
  const prev = () => {
    setT(0);
    if (idx > 0) setIdx(idx - 1);
    else if (si > 0) { setSi(si - 1); setIdx(0); }
  };

  useEffect(() => {
    if (paused) return;
    last.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      setT((x) => x + (now - last.current));
      last.current = now;
    }, 50);
    return () => clearInterval(id);
  }, [paused, si, idx]);
  useEffect(() => { if (t >= DUR) next(); }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!story || !slide) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black" role="dialog" aria-label={`Sorotan ${twoNames(story.o.nama)}`}>
      <div className="relative flex h-full w-full max-w-xl select-none flex-col bg-neutral-950 text-white"
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerCancel={() => setPaused(false)}>
        <div className="grid gap-1 px-3 pt-[calc(env(safe-area-inset-top)+10px)]" style={{ gridTemplateColumns: `repeat(${slides.length}, minmax(0, 1fr))` }}>
          {slides.map((s, i) => (
            <span key={s.key} className="h-[3px] overflow-hidden rounded-full bg-white/30">
              <span className="block h-full bg-white" style={{ width: `${i < idx ? 100 : i === idx ? Math.min(100, (t / DUR) * 100) : 0}%` }} />
            </span>
          ))}
        </div>
        <div className="relative z-10 flex items-center gap-2.5 pl-4 pr-1 pt-2.5">
          <button onClick={() => onProfile(story.o)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            <Avatar o={story.o} size={36} className="!bg-neutral-800 !text-white" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold">{twoNames(story.o.nama)}</span>
              <span className="block text-[13px] text-neutral-300">{relDay(c, story.d)} · {si + 1} dari {list.length}</span>
            </span>
          </button>
          <button onClick={onClose} aria-label="Tutup sorotan" className="flex h-12 w-12 items-center justify-center"><Ico n="x" className="h-6 w-6" sw={2} /></button>
        </div>

        <div className="relative flex flex-1 flex-col justify-center gap-[18px] px-6">
          <span className="w-max rounded-full bg-neutral-800 px-2.5 py-1 text-[13px] font-bold text-[#F2A33A]">{slide.label}</span>
          <span className="text-[88px] font-bold leading-[0.9] tracking-tighter">{slide.big}</span>
          <span className="text-2xl font-bold leading-tight">{slide.text}</span>
          {slide.list && slide.list.length > 0 && (
            <div className="flex flex-col gap-2 rounded-2xl bg-neutral-900 p-3.5">
              {slide.list.map(([a, b]) => (
                <div key={a} className="flex justify-between gap-3 text-sm"><span className="truncate text-neutral-300">{a}</span><span className="shrink-0 font-bold">{b}</span></div>
              ))}
            </div>
          )}
          {slide.foot && (
            <span className={`flex items-center gap-1.5 text-sm font-semibold ${slide.tone === 'down' ? 'text-red-300' : 'text-green-300'}`}>
              <Ico n={slide.tone === 'down' ? 'down' : 'up'} className="h-3.5 w-3.5" sw={2.6} />{slide.foot}
            </span>
          )}
          {/* Area ketuk kiri / kanan ala story */}
          <button aria-label="Sebelumnya" onClick={prev} className="absolute inset-y-0 left-0 w-1/3" />
          <button aria-label="Berikutnya" onClick={next} className="absolute inset-y-0 right-0 w-2/3" />
        </div>
        <p className="px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] text-center text-[13px] text-neutral-400">Ketuk kanan untuk lanjut · tahan untuk jeda</p>
      </div>
    </div>
  );
}
