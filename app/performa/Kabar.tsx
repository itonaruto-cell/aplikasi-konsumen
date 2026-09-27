'use client';
import { useMemo, useState, type ReactNode } from 'react';
import type { KonsumenFull, MaFull, Metric, Orang, Performa, Sales } from '../../lib/performa-types';
import {
  belumVisit, brandOf, feed, isNum, konsumenOf, perluUlang, ranking, relDay, rivalry,
  type BrandKey, type Ctx, type FeedItem, type Story,
} from '../../lib/performa-calc';
import { angka, nama, persen, rp, tanggal, waktu, type Push } from './ui';
import { Avatar, Card, Ico, Line, PillSeg, Podium, SectionTitle, shortName, twoNames } from './parts';

const BR: ['mobilku' | 'motorku', string][] = [['mobilku', 'Mobilku'], ['motorku', 'Motorku']];
const brands = (b: BrandKey) => (b === 'semua' ? BR.map((x) => x[0]) : [b]);

// Detail lengkap MA / konsumen milik satu orang (dipakai daftar di panel)
export function maItemsOf(o: Orang, data: Performa): MaFull[] {
  return (o.maintain?.list || []).map((x) =>
    (x.b && isNum(x.i) && data.aktivitas?.ma?.[x.b]?.[x.i]) ||
    { n: x.n, job: x.job, cat: '', reason: '', f: x.f, tgl: [], t: x.t, pic: o.nama, inj: '', hasil: '', sales: null });
}

function totalOf(c: Ctx, brand: BrandKey, what: 'amount' | 'unit'): Sales | null {
  if (brand === 'semua') return c.data.cabangTotal?.[what] || null;
  const list = c.sales.filter((o) => brandOf(o) === brand).map((o) => o[what]).filter(Boolean) as Sales[];
  if (!list.length) return null;
  const ini = list.reduce((s, x) => s + (x.ini || 0), 0), target = list.reduce((s, x) => s + (x.target || 0), 0);
  return { lalu: null, ini, target, ach: target ? ini / target : null, diffLalu: null, diffTarget: target ? ini - target : null };
}

function sisaHari(today: string) {
  const [y, m, d] = today.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const n = last - d;
  return n > 0 ? `Sisa ${n} hari` : 'Hari terakhir';
}
const bulanPanjang = (today: string) =>
  new Date(today + 'T00:00:00Z').toLocaleDateString('id-ID', { month: 'long', timeZone: 'UTC' });

/* ---------- Sorotan (story) ---------- */
function Stories({ list, me, seen, open }: { list: Story[]; me: Orang | null; seen: (s: Story) => boolean; open: (i: number) => void }) {
  if (!list.length) return null;
  return (
    <div className="flex gap-2.5 overflow-x-auto border-b border-neutral-200 px-4 py-3.5 [scrollbar-width:none] dark:border-neutral-800">
      {list.map((s, i) => {
        const done = seen(s);
        return (
          <button key={s.o.nama} onClick={() => open(i)} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 active:scale-95">
            <span className={`relative flex h-16 w-16 rounded-full border-[2.5px] p-[3px] ${done ? 'border-neutral-300 dark:border-neutral-700' : 'border-neutral-900 dark:border-white'}`}>
              <Avatar o={s.o} size={52} className="text-base" />
              {s.count > 0 && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-white bg-[#F5C451] px-1 text-xs font-bold text-neutral-900 dark:border-neutral-950">
                  {s.count}
                </span>
              )}
            </span>
            <span className={`max-w-full truncate text-[13px] ${done ? 'font-medium text-neutral-500' : 'font-bold'}`}>
              {me && s.o === me ? 'Kamu' : shortName(s.o.nama)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Kartu feed ---------- */
function Post({ o, tag, time, children, onAvatar, icon }: {
  o?: Orang; tag: string; time: string; children: ReactNode; onAvatar?: () => void; icon?: ReactNode;
}) {
  return (
    <article className="flex gap-3 border-b border-neutral-200 px-4 py-3.5 last:border-0 dark:border-neutral-800">
      {o ? (
        <button onClick={onAvatar} aria-label={`Profil ${nama(o.nama)}`} className="h-10 shrink-0"><Avatar o={o} /></button>
      ) : icon}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-[15px] font-bold">{o ? twoNames(o.nama) : 'Juara minggu lalu'} <span className="font-normal text-neutral-500">· {tag}</span></p>
          <span className="shrink-0 text-sm text-neutral-500">{time}</span>
        </div>
        {children}
      </div>
    </article>
  );
}

const METRIC_LABEL: Record<Metric, string> = { amount: 'amount', unit: 'unit', visit: 'visit', bertemu: 'bertemu', maintain: 'maintain' };

function FeedCard({ f, c, push, openK }: { f: FeedItem; c: Ctx; push: Push; openK: (k: KonsumenFull, pic?: string) => void }) {
  const time = relDay(c, f.d);
  const who = (o: Orang) => () => push({ t: 'orang', o });
  if (f.t === 'target') {
    return (
      <Post o={f.o} tag="pencapaian" time={time} onAvatar={who(f.o)}>
        <p className="text-[15px] leading-snug">Tembus target {f.what} bulan ini.</p>
        <div className="flex items-center gap-3 rounded-2xl bg-neutral-900 p-3.5 text-white dark:bg-neutral-900 dark:ring-1 dark:ring-neutral-800">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-[#F5C451]"><Ico n="trophy" className="h-6 w-6" sw={1.8} /></span>
          <span className="min-w-0">
            <span className="block text-[19px] font-bold capitalize">{f.what} {persen(f.ach)}</span>
            <span className="block text-[13px] text-neutral-300">
              {f.what === 'amount' ? `${rp(f.ini)} dari ${rp(f.target)}` : `${angka(f.ini)} dari ${angka(f.target)} unit`}
            </span>
          </span>
        </div>
      </Post>
    );
  }
  if (f.t === 'naik') {
    return (
      <Post o={f.o} tag="peringkat" time={time} onAvatar={who(f.o)}>
        <p className="text-[15px] leading-snug">Naik ke posisi {f.to} papan juara {METRIC_LABEL[f.metric]}.</p>
        <span className="flex w-max items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-sm font-semibold text-green-800 dark:bg-green-400/15 dark:text-green-300">
          <Ico n="up" className="h-3.5 w-3.5" sw={2.6} />#{f.from} ke #{f.to}
        </span>
      </Post>
    );
  }
  if (f.t === 'visit') {
    const shown = f.met.slice(0, 2);
    return (
      <Post o={f.o} tag="visit" time={time} onAvatar={who(f.o)}>
        <p className="text-[15px] leading-snug">
          Visit {f.visits.length} konsumen{f.met.length ? `, ${f.met.length} bertemu.` : ', belum ada yang bertemu.'}
        </p>
        {shown.map((v) => (
          <button key={v.k.n + v.row.ke} onClick={() => openK(v.k, f.o.nama)}
            className="flex min-h-14 items-center gap-3 rounded-2xl border border-neutral-200 px-3.5 py-2.5 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-bold">{nama(v.k.n)}</span>
              <span className="block truncate text-[13px] text-neutral-500">{[v.k.k && `Kec. ${nama(v.k.k)}`, `P${v.k.p}`].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="shrink-0 rounded-full bg-green-50 px-2.5 py-1 text-[13px] font-bold text-green-800 dark:bg-green-400/15 dark:text-green-300">Bertemu V{v.row.ke}</span>
          </button>
        ))}
        {f.visits.length > shown.length && (
          <button onClick={() => push({ t: 'kList', title: `Visit ${shortName(f.o.nama)} · ${tanggal(f.d, true)}`, sub: `${f.visits.length} konsumen`, items: f.visits.map((v) => v.k), mode: 'orang', p0: 0, pic: f.o.nama })}
            className="flex min-h-11 w-max items-center text-sm font-semibold text-neutral-500">
            Lihat semua {f.visits.length} konsumen ›
          </button>
        )}
      </Post>
    );
  }
  if (f.t === 'maint') {
    return (
      <Post o={f.o} tag="maintain" time={time} onAvatar={who(f.o)}>
        <p className="text-[15px] leading-snug">Maintain {f.maint.length} MA.</p>
        <div className="flex flex-wrap gap-1.5">
          {f.maint.slice(0, 4).map((m) => (
            <button key={m.m.n} onClick={() => push({ t: 'ma', m: m.m })}
              className="min-h-9 rounded-full border border-neutral-200 px-3 text-[13px] font-semibold active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
              {nama(m.m.n)}
            </button>
          ))}
          {f.maint.length > 4 && <span className="flex min-h-9 items-center px-1 text-[13px] text-neutral-500">+{f.maint.length - 4} lainnya</span>}
        </div>
      </Post>
    );
  }
  return (
    <Post tag="rekap" time={time} icon={
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[#F5C451] dark:bg-neutral-800"><Ico n="trophy" className="h-5 w-5" sw={2} /></span>
    }>
      <p className="text-[15px] leading-snug">Selamat buat para juara!</p>
      <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        {f.juara.map((j) => (
          <button key={j.label} onClick={() => push({ t: 'orang', o: j.o })}
            className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-neutral-200 px-3.5 text-left text-sm last:border-0 dark:border-neutral-800">
            <span className="text-neutral-500">{j.label}</span>
            <span className="font-bold">{shortName(j.o.nama)} · {j.n}</span>
          </button>
        ))}
      </div>
    </Post>
  );
}

/* ---------- Halaman Kabar ---------- */
export default function Kabar({ c, me, brand, push, storyList, seen, openStory, goJuara, goRute }: {
  c: Ctx; me: Orang | null; brand: BrandKey; push: Push;
  storyList: Story[]; seen: (s: Story) => boolean; openStory: (i: number) => void;
  goJuara: () => void; goRute: (mode: 'belum' | 'ulang', b: BrandKey) => void;
}) {
  const data = c.data;
  const [metric, setMetric] = useState<'amount' | 'unit' | 'visit'>('amount');
  const [limit, setLimit] = useState(12);
  const rows = useMemo(() => ranking(c, metric, 'bulan', brand), [c, metric, brand]);
  const riv = rivalry(rows);
  const items = useMemo(() => feed(c, brand), [c, brand]);
  const openK = (k: KonsumenFull, pic?: string) => push({ t: 'k', k, pic });

  /* Misi hari ini */
  const myBrand: BrandKey = me && brandOf(me) ? brandOf(me) as BrandKey : brand;
  const kons = konsumenOf(data, myBrand);
  const nBelum = kons.filter((x) => belumVisit(x.k)).length;
  const nUlang = kons.filter((x) => perluUlang(x.k)).length;
  const topKec = (() => {
    const m = new Map<string, number>();
    kons.filter((x) => belumVisit(x.k) && x.k.k).forEach((x) => m.set(nama(x.k.k), (m.get(nama(x.k.k)) || 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1])[0];
  })();
  const isMao = !!me?.maintain;
  const isCmo = !me || !!me.visit || !isMao;
  const maMine = me && isMao ? maItemsOf(me, data) : brands(brand).flatMap((b) => data.aktivitas?.ma?.[b] || []);
  const maBelum = maMine.filter((m) => !m.f);

  const today = c.today;
  const hari = new Date(today + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });

  /* Misi tim (ringkasan cabang) */
  const a = data.aktivitas;
  const mt = brands(brand).reduce((s, b) => ({ ma: s.ma + (a?.maintain?.[b]?.ma || 0), sudah: s.sudah + (a?.maintain?.[b]?.sudah || 0) }), { ma: 0, sudah: 0 });
  const rk = brands(brand).reduce((s, b) => {
    const r = a?.rekrut?.[b];
    return { rj: s.rj + (r?.rekrut?.jumlah || 0), rt: s.rt + (r?.rekrut?.target || 0), gj: s.gj + (r?.regist?.jumlah || 0), gt: s.gt + (r?.regist?.target || 0) };
  }, { rj: 0, rt: 0, gj: 0, gt: 0 });
  const pv = ([1, 2, 3] as const).map((p) => brands(brand).reduce((s, b) => {
    const x = a?.visit?.[b]?.[`p${p}` as 'p1'];
    return { db: s.db + (x?.database || 0), tv: s.tv + (x?.tervisit || 0), dt: s.dt + (x?.ditemui || 0) };
  }, { db: 0, tv: 0, dt: 0 }));
  const allKons = brands(brand).flatMap((b) => a?.konsumen?.[b] || []);
  const allMa = brands(brand).flatMap((b) => a?.ma?.[b] || []);
  const brandLabel = brand === 'semua' ? 'cabang' : brand === 'mobilku' ? 'Mobilku' : 'Motorku';

  const amount = totalOf(c, brand, 'amount'), unit = totalOf(c, brand, 'unit');
  const rest = rows.filter((r) => r.rank > 3).slice(0, 2);

  // Target pribadi (badge Unit / Amount tembus)
  const goal = me && (me.unit || me.amount) ? (() => {
    const u = me.unit, am = me.amount;
    if (u && isNum(u.ach) && u.ach < 1 && isNum(u.target) && isNum(u.ini)) {
      const kurang = Math.max(1, Math.ceil(u.target - u.ini));
      return { title: 'Badge Unit tembus', val: `${angka(u.ini)}/${angka(u.target)}`, ach: u.ach, sub: `Tinggal ${kurang} unit lagi` };
    }
    if (am && isNum(am.ach) && am.ach < 1) {
      return { title: 'Badge Target tembus', val: persen(am.ach), ach: am.ach, sub: `Kurang ${rp(isNum(am.diffTarget) ? -am.diffTarget : null)} lagi` };
    }
    return { title: 'Target tembus semua', val: '100%', ach: 1, sub: 'Mantap! Pertahankan sampai akhir bulan' };
  })() : null;

  return (
    <div className="pb-6">
      <Stories list={storyList} me={me} seen={seen} open={openStory} />

      {/* Rekap cabang */}
      <Card className="mx-4 mt-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-bold">{brand === 'semua' ? nama(data.cabang) : brandLabel} · {bulanPanjang(today)}</p>
          <span className="whitespace-nowrap rounded-full bg-neutral-900 px-2.5 py-1 text-[13px] font-bold text-white dark:bg-white dark:text-neutral-900">{sisaHari(today)}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          {([['Amount', amount, true], ['Unit', unit, false]] as const).map(([label, s, money]) => (
            <div key={label} className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm text-neutral-500">{label}</span>
              <span className="text-[32px] font-bold leading-none tracking-tight">{persen(s?.ach)}</span>
              <Line v={s?.ach} />
              <span className="truncate text-[13px] text-neutral-500">
                {s ? (money ? `${rp(s.ini).replace('Rp ', 'Rp')} / ${rp(s.target).replace('Rp ', '')}` : `${angka(s.ini)} / ${angka(s.target)} unit`) : '–'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Papan juara */}
      <SectionTitle right={<button onClick={goJuara} className="flex min-h-11 items-center text-sm font-bold">Lihat semua ›</button>}>Papan juara</SectionTitle>
      <div className="px-4 pt-2">
        <PillSeg value={metric} onChange={setMetric} full options={[['amount', 'Amount'], ['unit', 'Unit'], ['visit', 'Visit']]} />
      </div>
      <div className="px-4 pt-4">
        <Podium rows={rows} onOpen={(o) => push({ t: 'orang', o })} reached={(r) => r.pct && (r.val || 0) >= 1} />
      </div>
      {rest.map((r) => (
        <button key={r.o.nama} onClick={() => push({ t: 'orang', o: r.o })}
          className="mx-4 mt-2.5 flex min-h-16 w-[calc(100%-32px)] items-center gap-3 rounded-2xl border border-neutral-200 px-3.5 py-2.5 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
          <span className="w-5 text-center text-[15px] font-bold text-neutral-500">{r.rank}</span>
          <Avatar o={r.o} size={36} />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex justify-between gap-2 text-[15px] font-bold"><span className="truncate">{twoNames(r.o.nama)}</span><span>{r.val === null ? '–' : r.pct ? persen(r.val) : angka(r.val)}</span></span>
            <Line v={r.ach} className="h-[5px]" color="bg-neutral-400 dark:bg-neutral-500" />
          </span>
        </button>
      ))}

      {riv && riv.gap <= (riv.up.pct ? 0.1 : 5) && (() => {
        const { up, down, gap } = riv;
        const need = metric === 'amount' && isNum(down.o.amount?.target) ? `Kurang ${rp(gap * (down.o.amount!.target as number))}`
          : metric === 'unit' && isNum(down.o.unit?.target) ? `${Math.max(1, Math.ceil(gap * (down.o.unit!.target as number)))} unit lagi`
            : `${Math.floor(gap) + 1} visit lagi`;
        return (
          <div className="mx-4 mt-2.5 flex flex-col gap-2.5 rounded-2xl bg-[#FFF4E0] p-3.5 text-[#5C2F00] dark:bg-[#2A1E0C] dark:text-[#F7C98A]">
            <div className="flex items-center gap-2">
              <Ico n="flame" className="h-[18px] w-[18px] text-[#E08A1E]" fill="#F2A33A" sw={1.6} />
              <span className="text-[15px] font-bold">Persaingan ketat</span>
              <span className="ml-auto text-[13px] font-semibold">selisih {up.pct ? persen(gap) : angka(gap)}</span>
            </div>
            <div className="flex justify-between gap-2 text-sm font-bold">
              <span className="truncate">#{up.rank} {shortName(up.o.nama)} · {up.pct ? persen(up.val) : angka(up.val)}</span>
              <span className="truncate">{down.pct ? persen(down.val) : angka(down.val)} · {shortName(down.o.nama)} #{down.rank}</span>
            </div>
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white dark:bg-neutral-900">
              <span className="bg-neutral-900 dark:bg-white" style={{ width: `${(100 * (up.val || 0)) / ((up.val || 0) + (down.val || 0) || 1)}%` }} />
              <span className="flex-1 bg-[#F2A33A]" />
            </div>
            <span className="text-sm">{need}, {shortName(down.o.nama)} bisa rebut posisi #{up.rank}.</span>
          </div>
        );
      })()}

      {/* Misi hari ini */}
      <div className="mx-4 mt-6 flex flex-col gap-2.5 rounded-[20px] bg-neutral-900 p-4 text-white dark:ring-1 dark:ring-neutral-800">
        <div className="flex items-center justify-between">
          <span className="text-[17px] font-bold">Misi hari ini</span>
          <span className="text-[13px] capitalize text-neutral-300">{hari}</span>
        </div>
        {isCmo && nBelum > 0 && (
          <button onClick={() => goRute('belum', myBrand)} className="flex min-h-16 items-center gap-3 rounded-2xl bg-neutral-800 p-3 text-left active:bg-neutral-700">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3A2A12] text-[#F2A33A]"><Ico n="pin" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{nBelum} konsumen belum visit</span>
              <span className="block truncate text-[13px] text-neutral-300">{topKec ? `Terbanyak di Kec. ${topKec[0]} (${topKec[1]})` : myBrand === 'semua' ? 'Mobilku & Motorku' : nama(myBrand)}</span>
            </span>
            <span className="shrink-0 rounded-full bg-white px-3 py-2 text-[13px] font-bold text-neutral-900">Rute</span>
          </button>
        )}
        {isCmo && nUlang > 0 && (
          <button onClick={() => goRute('ulang', myBrand)} className="flex min-h-16 items-center gap-3 rounded-2xl bg-neutral-800 p-3 text-left active:bg-neutral-700">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-700"><Ico n="refresh" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{nUlang} perlu visit ulang</span>
              <span className="block text-[13px] text-neutral-300">Sudah didatangi, belum bertemu</span>
            </span>
            <Ico n="right" className="h-[18px] w-[18px] text-neutral-400" sw={2} />
          </button>
        )}
        {(isMao || !me) && maMine.length > 0 && (
          <button onClick={() => push({ t: 'maList', title: me ? 'MA yang kamu pegang' : `MA ${brandLabel}`, sub: `${maMine.length} MA`, items: maMine })}
            className="flex min-h-16 items-center gap-3 rounded-2xl bg-neutral-800 p-3 text-left active:bg-neutral-700">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-700"><Ico n="users" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{maBelum.length ? `${maBelum.length} MA belum dimaintain` : 'Semua MA sudah dimaintain'}</span>
              <span className="block text-[13px] text-neutral-300">{maMine.length - maBelum.length} dari {maMine.length} MA bulan ini</span>
            </span>
            <Ico n="right" className="h-[18px] w-[18px] text-neutral-400" sw={2} />
          </button>
        )}
        {me?.rekrut?.rekrut?.target ? (
          <div className="flex items-center gap-3 rounded-2xl bg-neutral-800 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-700 text-[#F5C451]"><Ico n="user" /></span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex justify-between text-[15px] font-semibold"><span>Rekrut MA</span><span>{me.rekrut.rekrut.jumlah}/{me.rekrut.rekrut.target}</span></span>
              <Line v={me.rekrut.rekrut.jumlah / me.rekrut.rekrut.target} color="bg-[#F5C451]" track="bg-neutral-700" />
              <span className="text-[13px] text-neutral-300">Regist {me.rekrut.regist?.jumlah ?? 0}/{me.rekrut.regist?.target ?? '–'}</span>
            </span>
          </div>
        ) : null}
        {goal && (
          <div className="flex items-center gap-3 rounded-2xl bg-neutral-800 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-700 text-[#F5C451]"><Ico n="trophy" /></span>
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex justify-between gap-2 text-[15px] font-semibold"><span className="truncate">{goal.title}</span><span>{goal.val}</span></span>
              <Line v={goal.ach} color="bg-[#F5C451]" track="bg-neutral-700" />
              <span className="text-[13px] text-neutral-300">{goal.sub}</span>
            </span>
          </div>
        )}
      </div>

      {/* Misi tim */}
      <SectionTitle right={<span className="text-[13px] text-neutral-500">ketuk untuk lihat nama</span>}>Misi tim</SectionTitle>
      <Card className="mx-4 mt-2.5 overflow-hidden">
        <button disabled={!allMa.length} onClick={() => push({ t: 'maList', title: `MA ${brandLabel}`, sub: `${mt.ma} MA`, items: allMa })}
          className="flex w-full flex-col gap-2 border-b border-neutral-200 px-4 py-3.5 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
          <span className="flex items-baseline justify-between"><span className="text-[15px] font-bold">Maintain MA</span><span><b className="text-xl">{mt.sudah}</b><span className="text-neutral-500">/{mt.ma}</span></span></span>
          <Line v={mt.ma ? mt.sudah / mt.ma : null} color="bg-green-600 dark:bg-green-500" />
          <span className="text-[13px] text-neutral-500">
            {BR.filter(([b]) => brands(brand).includes(b)).map(([b, l]) => `${l} ${a?.maintain?.[b]?.sudah ?? 0}/${a?.maintain?.[b]?.ma ?? 0}`).join(' · ')}
          </span>
        </button>
        {(rk.rt > 0 || rk.gt > 0) && (
          <div className="grid grid-cols-2 gap-4 border-b border-neutral-200 px-4 py-3.5 dark:border-neutral-800">
            {([['Rekrut', rk.rj, rk.rt], ['Regist', rk.gj, rk.gt]] as const).map(([l, j, t]) => (
              <span key={l} className="flex flex-col gap-2">
                <span className="flex items-baseline justify-between"><span className="text-[15px] font-bold">{l}</span><span><b className="text-xl">{j}</b><span className="text-neutral-500">/{t}</span></span></span>
                <Line v={t ? j / t : null} />
              </span>
            ))}
          </div>
        )}
        <button disabled={!allKons.length}
          onClick={() => push({ t: 'kList', title: `Konsumen prioritas ${brandLabel}`, sub: 'Ketuk nama untuk detail', items: allKons, mode: 'cabang', p0: 0 })}
          className="flex w-full flex-col gap-2.5 px-4 py-3.5 text-left active:bg-neutral-50 dark:active:bg-neutral-900">
          <span className="text-[15px] font-bold">Visit prioritas</span>
          <span className="grid grid-cols-3 gap-3">
            {pv.map((x, i) => (
              <span key={i} className="flex flex-col gap-1.5">
                <span><b className="text-lg">{x.tv}</b><span className="text-neutral-500">/{x.db}</span></span>
                <Line v={x.db ? x.tv / x.db : null} className="h-[5px]" />
                <span className="text-[13px] text-neutral-500">P{i + 1} · {x.dt} temu</span>
              </span>
            ))}
          </span>
        </button>
      </Card>

      {/* Kabar terbaru */}
      <div className="mt-2 border-b border-neutral-200 dark:border-neutral-800"><SectionTitle>Kabar terbaru</SectionTitle><div className="h-2" /></div>
      {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-neutral-500">Belum ada kabar minggu ini.</p>}
      {items.slice(0, limit).map((f) => <FeedCard key={f.key} f={f} c={c} push={push} openK={openK} />)}
      {items.length > limit && (
        <div className="px-4 py-3">
          <button onClick={() => setLimit((n) => n + 12)} className="min-h-12 w-full rounded-2xl border border-neutral-200 text-[15px] font-semibold dark:border-neutral-800">Lihat kabar sebelumnya</button>
        </div>
      )}
      <p className="px-4 pt-4 text-[13px] text-neutral-500">
        Data per {tanggal(data.updated)} · diperbarui {waktu(data.dikirim)}. Tarik layar ke bawah untuk memuat ulang.
      </p>
    </div>
  );
}
