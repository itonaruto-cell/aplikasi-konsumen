'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Orang } from '../../lib/performa-types';
import { brandOf, keyOf, todayJkt, type Ctx } from '../../lib/performa-calc';
import {
  JENIS_LABEL, KOSONG, butuhUntuk, denganNbq, hitung, langkahNaik, plafon, tambah, targetBawaan,
  type Jenis, type Masukan, type Skema,
} from '../../lib/insentif';
import { rp } from './ui';
import { Ico, Kosong, PillSeg, shortName } from './parts';
import { AngkaInput, Stepper, rupiah } from './form';
import { useBahan } from './Bahan';

// Simulasi insentif: pencapaian bulan ini (dari pantauan, bisa dikoreksi) dihitung dengan skema dari server.
// Koreksi angka hanya disimpan di HP ini (ck_insentif), tidak dikirim ke mana pun.

type Akun = { email: string; name?: string; role: 'owner' | 'konsumen' | 'tim' };
type Simpanan = { bulan: string; isi: Record<string, Partial<Masukan>>; tetap: Partial<Masukan>; jenis: Record<string, Jenis> };
const KEY = 'ck_insentif';
const CABANG = '__cabang';
const URUT: Jenis[] = ['bmh', 'cmo', 'mao', 'maoBaru'];
const TETAP: (keyof Masukan)[] = ['kategori', 'targetAmount', 'targetUnit'];   // BMH: berlaku lintas bulan

const baca = (bulan: string): Simpanan => {
  const kosong: Simpanan = { bulan, isi: {}, tetap: {}, jenis: {} };
  try {
    const j = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<Simpanan> | null;
    if (!j || typeof j !== 'object') return kosong;
    return { bulan, isi: j.bulan === bulan && j.isi ? j.isi : {}, tetap: j.tetap || {}, jenis: j.jenis || {} };
  } catch { return kosong; }
};
const tulis = (s: Simpanan) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* abaikan */ } };

const persen = (v: number) => (Math.round(v * 100) / 100).toLocaleString('id-ID') + '%';
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : undefined);
const buang = (o: Partial<Masukan>): Partial<Masukan> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<Masukan>;

// Angka yang bisa diambil dari pantauan: sales amount & unit bulan berjalan
function dariPantauan(c: Ctx | null, key: string): Partial<Masukan> {
  if (!c) return {};
  if (key === CABANG) {
    const mob = c.sales.filter((o) => brandOf(o) === 'mobilku');
    const sum = (w: 'amount' | 'unit') => mob.reduce((s, o) => s + (o[w]?.ini || 0), 0);
    const baris = (t: string) => (c.data.blok || []).find((b) => b.s === 'cabang' && b.t.toLowerCase() === t)
      ?.r.find((r) => String(r[0] ?? '').trim().toLowerCase() === 'mobilku');
    const a = baris('sales amount per brand'), u = baris('sales account per brand');
    return buang({
      amount: num(a?.[3]) ?? sum('amount'), unit: num(u?.[3]) ?? sum('unit'),
      targetAmount: num(a?.[4]), targetUnit: num(u?.[4]),
    });
  }
  const o = (c.data.orang || []).find((x) => x.nama === key);
  if (!o) return {};
  return buang({ amount: num(o.amount?.ini), unit: num(o.unit?.ini) });
}

function Baris({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex min-h-14 items-center gap-3 border-b border-neutral-200 px-4 py-2 last:border-0 dark:border-neutral-800">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-[13px] text-neutral-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export default function Insentif({ c, me, akun, reloadKey = 0, onBahan }: {
  c: Ctx | null; me: Orang | null; akun: Akun; reloadKey?: number; onBahan: () => void;
}) {
  const isOwner = akun.role === 'owner';
  const bulan = (c?.today || todayJkt()).slice(0, 7);

  /* ---------- Skema dari server ---------- */
  const [skema, setSkema] = useState<Skema | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [coba, setCoba] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = await fetch('/api/insentif', { cache: 'no-store' });
        if (res.status === 401) { window.location.href = '/login'; return; }
        const json = await res.json();
        if (!alive) return;
        if (res.ok) setSkema((json?.skema as Skema | null) || null);
        else setErr(json?.error || 'Skema insentif gagal dimuat.');
      } catch {
        if (alive) setErr('Koneksi bermasalah. Periksa internet lalu coba lagi.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey, coba]);

  /* ---------- Siapa & skema mana ---------- */
  const orang = useMemo(() => (c?.data.orang || []).filter((o) => brandOf(o) !== 'motorku'), [c]);
  const [siapa, setSiapa] = useState<string>(isOwner ? CABANG : me?.nama || '');
  useEffect(() => { if (!isOwner) setSiapa(me?.nama || ''); }, [isOwner, me?.nama]);
  const o = siapa && siapa !== CABANG ? orang.find((x) => x.nama === siapa) || null : null;

  const [simpanan, setSimpanan] = useState<Simpanan>({ bulan, isi: {}, tetap: {}, jenis: {} });
  useEffect(() => { setSimpanan(baca(bulan)); }, [bulan]);
  const simpan = (next: Simpanan) => { setSimpanan(next); tulis(next); };

  const boleh = URUT.filter((j) => skema?.[j] && (siapa === CABANG ? j === 'bmh' : j !== 'bmh'));
  const tebak: Jenis = siapa === CABANG ? 'bmh' : o && (o.maintain || o.rekrut) ? 'mao' : 'cmo';
  const dipilih = simpanan.jenis[siapa];
  const jenis: Jenis | null = dipilih && boleh.includes(dipilih) ? dipilih : boleh.includes(tebak) ? tebak : boleh[0] || null;

  /* ---------- Angka bulan ini ---------- */
  const kunci = `${siapa}|${jenis}`;
  const manual = useMemo(() => simpanan.isi[kunci] || {}, [simpanan.isi, kunci]);
  const dasar: Masukan = useMemo(() => {
    if (!skema || !jenis) return KOSONG;
    const m: Masukan = {
      ...KOSONG, ...targetBawaan(skema, jenis), ...dariPantauan(c, siapa),
      ...(jenis === 'bmh' ? simpanan.tetap : {}), ...manual,
    };
    if (manual.survey === undefined) m.survey = m.unit;
    return m;
  }, [skema, jenis, c, siapa, simpanan.tetap, manual]);

  const ubah = (f: keyof Masukan, v: number | string) => {
    if (jenis === 'bmh' && TETAP.includes(f)) simpan({ ...simpanan, tetap: { ...simpanan.tetap, [f]: v } });
    else simpan({ ...simpanan, isi: { ...simpanan.isi, [kunci]: { ...manual, [f]: v } } });
  };
  // BMH: target yang diketik sendiri berlaku lintas bulan. Kalau pantauan punya targetnya, target itu juga bisa dikembalikan.
  const targetPantauan = useMemo(() => {
    const p = jenis === 'bmh' ? dariPantauan(c, siapa) : {};
    return !!p.targetAmount && !!p.targetUnit;
  }, [jenis, c, siapa]);
  const targetDiketik = jenis === 'bmh' && targetPantauan && (simpanan.tetap.targetAmount !== undefined || simpanan.tetap.targetUnit !== undefined);
  const adaKoreksi = Object.keys(manual).length > 0 || targetDiketik;
  const kembalikan = () => {
    const isi = { ...simpanan.isi };
    delete isi[kunci];
    const tetap = { ...simpanan.tetap };
    if (targetDiketik) { delete tetap.targetAmount; delete tetap.targetUnit; }
    simpan({ ...simpanan, isi, tetap });
  };

  /* ---------- Bahan survey orang ini ---------- */
  const bahan = useBahan(reloadKey);
  const punya = useMemo(() => {
    const aktif = bahan.list.filter((b) => b.status === 'aktif');
    // Bahan dihitung untuk PIC survey-nya (bahan lama tanpa PIC: untuk pembuatnya)
    const list = siapa === CABANG || !siapa ? aktif : aktif.filter((b) => keyOf(b.pic || b.nama) === keyOf(siapa));
    const agg = list.filter((b) => b.agg);   // dari MA aggregator
    return {
      n: list.length, amt: list.reduce((s, b) => s + b.nominal, 0),
      nAgg: agg.length, amtAgg: agg.reduce((s, b) => s + b.nominal, 0),
    };
  }, [bahan.list, siapa]);

  /* ---------- Simulasi ---------- */
  // unit / jt: tambahan biasa (MAO: sales retail). unitAgg / jtAgg: tambahan dari MA aggregator (hanya MAO)
  const SIM0 = { unit: 0, jt: 0, ma: 0, unitAgg: 0, jtAgg: 0 };
  const [sim, setSim] = useState(SIM0);
  const [pakai, setPakai] = useState(false);
  const [nbq, setNbq] = useState<number | null>(null);   // persen; null = bawaan skema
  const [target, setTarget] = useState(2_000_000);
  const [buka, setBuka] = useState(false);
  useEffect(() => { setSim({ unit: 0, jt: 0, ma: 0, unitAgg: 0, jtAgg: 0 }); setPakai(false); setNbq(null); }, [siapa, jenis]);
  // BMH: kategori & target dari HO wajib diisi dulu. Isian dibuka dan tetap terbuka selama diisi.
  const perluTarget = jenis === 'bmh' && (!dasar.kategori || !dasar.targetAmount || !dasar.targetUnit);
  useEffect(() => { if (perluTarget) setBuka(true); }, [perluTarget]);

  const hasil = useMemo(() => {
    if (!skema || !jenis) return null;
    // MAO: bahan dari MA aggregator dihitung terpisah (tanpa pencari order dan extra)
    const pisah = jenis === 'mao' || jenis === 'maoBaru';
    const bAgg = pakai && pisah ? { n: punya.nAgg, amt: punya.amtAgg } : { n: 0, amt: 0 };
    const x = {
      unit: sim.unit + (pakai ? punya.n - bAgg.n : 0), amount: sim.jt * 1e6 + (pakai ? punya.amt - bAgg.amt : 0), ma: sim.ma,
      unitAgg: pisah ? sim.unitAgg + bAgg.n : 0, amountAgg: pisah ? sim.jtAgg * 1e6 + bAgg.amt : 0,
    };
    const m = tambah(jenis, dasar, x);
    const aktual = hitung(skema, jenis, dasar);
    if (!aktual) return null;
    const nbqBawaan = Math.round(aktual.nbq * 100);
    const sk = nbq === null || nbq === nbqBawaan ? skema : denganNbq(skema, jenis, nbq / 100);
    const kini = hitung(sk, jenis, m);
    if (!kini) return null;
    const perUnit = m.unit > 0 ? m.amount / m.unit : m.targetUnit > 0 ? m.targetAmount / m.targetUnit : 150_000_000;
    return {
      m, aktual, kini, perUnit,
      nbqBawaan,
      berubah: x.unit !== 0 || x.amount !== 0 || x.ma !== 0 || x.unitAgg !== 0 || x.amountAgg !== 0 || sk !== skema,
      naik: langkahNaik(sk, jenis, m),
      butuh: butuhUntuk(sk, jenis, m, target, perUnit),
      plafon: plafon(sk, jenis, m),
    };
  }, [skema, jenis, dasar, sim, pakai, punya, target, nbq]);

  /* ---------- Tampilan ---------- */
  if (loading && !skema) {
    return (
      <div className="space-y-3 px-4 pt-4">
        <div className="h-40 animate-pulse rounded-[22px] bg-neutral-200/70 dark:bg-neutral-800/70" />
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-[20px] bg-neutral-200/70 dark:bg-neutral-800/70" />)}
      </div>
    );
  }
  if (err) {
    return (
      <div className="mx-4 mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
        {err}
        <button onClick={() => setCoba((n) => n + 1)} className="mt-3 block min-h-11 rounded-full bg-red-700 px-5 font-semibold text-white">Coba lagi</button>
      </div>
    );
  }
  if (!skema || !jenis || !hasil) {
    return (
      <Kosong art="bendera" title="Skema insentif belum diatur"
        text={isOwner
          ? 'Isi Environment Variable INSENTIF_SKEMA di Vercel, lalu deploy ulang. Setelah itu simulasi langsung bisa dipakai.'
          : 'Minta owner mengisi skema insentif dulu. Setelah itu simulasi langsung bisa dipakai.'} />
    );
  }

  const { m, aktual, kini, naik, butuh } = hasil;
  const selisih = kini.total - aktual.total;
  const label = siapa === CABANG ? 'CABANG' : siapa ? shortName(siapa).toUpperCase() : 'KAMU';
  const namaBulan = new Date(bulan + '-01T00:00:00Z').toLocaleDateString('id-ID', { month: 'long', timeZone: 'UTC' }).toUpperCase();
  const mao = jenis === 'mao' || jenis === 'maoBaru';
  const kMao = jenis === 'mao' ? skema.mao : jenis === 'maoBaru' ? skema.maoBaru : undefined;
  const tMa = kMao?.target.ma ?? 0;
  const kategori = jenis === 'bmh' && skema.bmh ? Object.keys(skema.bmh.tarif).sort() : [];
  const isian = 'h-11 shrink-0 text-right text-[15px]';
  // MAO: selama sales retail belum dipisahkan, semua sales terhitung aggregator (pencari order dan extra = 0)
  const perluPisah = mao && dasar.unit > 0 && manual.pencari === undefined && manual.nonAggregator === undefined;
  const aggUnit = dasar.unit - dasar.pencari, aggAmount = dasar.amount - dasar.nonAggregator;
  const ret = mao ? ' retail' : '';

  return (
    <div className="pb-8">
      {isOwner && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
          {[{ key: CABANG, label: 'Cabang' }, ...orang.map((x) => ({ key: x.nama, label: shortName(x.nama) }))].map((p) => (
            <button key={p.key} onClick={() => setSiapa(p.key)} aria-pressed={siapa === p.key}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${siapa === p.key
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                : 'border-neutral-300 dark:border-neutral-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      {boleh.length > 1 && (
        <div className="px-4 pt-3">
          <PillSeg value={jenis} full onChange={(j) => simpan({ ...simpanan, jenis: { ...simpanan.jenis, [siapa]: j } })}
            options={boleh.map((j) => [j, JENIS_LABEL[j]] as [Jenis, string])} />
        </div>
      )}

      {/* Kartu utama */}
      <section className="mx-4 mt-3 flex flex-col gap-2.5 rounded-[22px] bg-neutral-900 p-[18px] text-white dark:ring-1 dark:ring-neutral-800">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-bold tracking-wide text-white/80">{label} · {JENIS_LABEL[jenis].toUpperCase()} · {hasil.berubah ? 'SIMULASI' : namaBulan}</span>
          <span className="whitespace-nowrap rounded-full bg-[#F5C451] px-2.5 py-1 text-xs font-bold text-[#3A2A00]">Perf {persen(kini.perf)}</span>
        </div>
        <p className="text-[34px] font-bold leading-none tracking-tight">{rupiah(kini.total)}</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
          <div className={`h-full rounded-full ${kini.total > 0 ? 'bg-[#F5C451]' : 'bg-[#FF8A8A]'}`} style={{ width: `${Math.max(0, Math.min(100, kini.perf))}%` }} />
        </div>
        <p className="text-xs text-white/70">
          {hasil.berubah
            ? `Aktual ${rupiah(aktual.total)} · ${Math.abs(selisih) < 1 ? 'belum berubah' : `selisih ${selisih > 0 ? '+' : '−'}${rupiah(Math.abs(selisih))}`}`
            : 'Dari angka bulan ini. Hasil akhir mengikuti hitungan HO.'}
        </p>
      </section>

      {perluTarget && (
        <div role="status" className="mx-4 mt-3 rounded-2xl bg-[#FFF4E0] px-3.5 py-3 text-sm leading-snug text-[#5C2F00] dark:bg-[#2A1E0C] dark:text-[#F7C98A]">
          Isi kategori cabang dan target dari HO dulu di bagian <b>Angka bulan ini</b>, supaya hitungannya benar.
        </div>
      )}

      {perluPisah && (
        <button onClick={() => setBuka(true)} role="status"
          className="mx-4 mt-3 block w-[calc(100%-32px)] rounded-2xl bg-[#FFF4E0] px-3.5 py-3 text-left text-sm leading-snug text-[#5C2F00] dark:bg-[#2A1E0C] dark:text-[#F7C98A]">
          <b>Pisahkan sales retail dan aggregator dulu.</b> Selama unit retail dan sales retail belum diisi di <b>Angka bulan ini</b>, semua sales dianggap dari aggregator, jadi insentif pencari order dan extra dihitung Rp 0.
        </button>
      )}

      {/* Rincian */}
      <div className="mx-4 mt-3 overflow-hidden rounded-[20px] border border-neutral-200 dark:border-neutral-800">
        <p className="px-4 pb-1 pt-3 text-[13px] font-semibold text-neutral-500">{kini.bagian.map((b) => `${b.label} ${persen(b.nilai)}`).join(' + ')}</p>
        {kini.rincian.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 border-t border-neutral-100 px-4 py-2.5 text-sm dark:border-neutral-800">
            <span className="text-neutral-500">{r.label}</span>
            <span className="whitespace-nowrap font-semibold">{rupiah(r.nilai)}</span>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 border-t border-neutral-100 px-4 py-2.5 text-sm dark:border-neutral-800">
          <span className="text-neutral-500">Faktor NBQ</span>
          <span className="whitespace-nowrap font-semibold">× {Math.round(kini.nbq * 100)}%</span>
        </div>
      </div>

      {/* Supaya naik */}
      <div className="mx-4 mt-3 flex items-start gap-3 rounded-2xl bg-[#FFF8E8] px-3.5 py-3 text-[#4A3A12] dark:bg-[#1E1A10] dark:text-[#F7DFA6]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5C451] text-[#6B4A00]"><Ico n="up" className="h-5 w-5" sw={2.2} /></span>
        <div className="text-sm leading-snug">
          <b>Supaya naik</b>
          <p>{naik.amount ? `Tambah ${rp(naik.amount.tambah)} amount${ret} → ${rupiah(naik.amount.total)}` : 'Amount saja belum cukup untuk naik.'}</p>
          <p>{naik.unit ? `Tambah ${naik.unit.tambah} unit${ret} → ${rupiah(naik.unit.total)}` : 'Unit saja belum cukup untuk naik.'}</p>
        </div>
      </div>

      {/* Angka bulan ini */}
      <div className="px-4 pt-6">
        <button onClick={() => setBuka((v) => !v)} aria-expanded={buka}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
          <span>
            <span className="block text-[17px] font-bold tracking-tight">Angka bulan ini</span>
            <span className="block text-[13px] text-neutral-500">
              {`${rp(dasar.amount)} · ${dasar.unit} unit`}
              {adaKoreksi ? ' · dikoreksi' : c ? ' · dari pantauan' : ''}
            </span>
          </span>
          <Ico n={buka ? 'up' : 'down'} className="h-[18px] w-[18px] shrink-0 text-neutral-500" sw={2} />
        </button>
      </div>
      {buka && (
        <div className="mx-4 mt-2 overflow-hidden rounded-[20px] border border-neutral-200 dark:border-neutral-800">
          {jenis === 'bmh' && (
            <>
              <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
                <p className="text-[15px]">Kategori cabang</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {kategori.map((k) => (
                    <button key={k} onClick={() => ubah('kategori', k)} aria-pressed={dasar.kategori === k}
                      className={`min-h-10 min-w-12 rounded-full border px-4 text-sm font-semibold ${dasar.kategori === k
                        ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                        : 'border-neutral-300 dark:border-neutral-700'}`}>{k}</button>
                  ))}
                </div>
              </div>
              <Baris label="Target amount" hint={targetPantauan ? (targetDiketik ? 'diketik sendiri' : 'dari pantauan') : undefined}><AngkaInput value={dasar.targetAmount} onChange={(v) => ubah('targetAmount', v)} lebar="w-[150px]" className={isian} /></Baris>
              <Baris label="Target unit"><AngkaInput value={dasar.targetUnit} onChange={(v) => ubah('targetUnit', v)} lebar="w-[84px]" className={isian} /></Baris>
            </>
          )}
          <Baris label="Sales amount" hint={mao ? 'semua: retail + aggregator' : undefined}><AngkaInput value={dasar.amount} onChange={(v) => ubah('amount', v)} lebar="w-[150px]" className={isian} /></Baris>
          <Baris label="Sales unit" hint={mao ? 'semua: retail + aggregator' : undefined}><AngkaInput value={dasar.unit} onChange={(v) => ubah('unit', v)} lebar="w-[84px]" className={isian} /></Baris>
          {jenis === 'bmh' && (
            <Baris label="Sales tgl 1–15" hint="untuk bonus tengah bulan"><AngkaInput value={dasar.tengahBulan} onChange={(v) => ubah('tengahBulan', v)} lebar="w-[150px]" className={isian} /></Baris>
          )}
          {jenis !== 'bmh' && (
            <Baris label="Jumlah survey"><AngkaInput value={dasar.survey} onChange={(v) => ubah('survey', v)} lebar="w-[84px]" className={isian} /></Baris>
          )}
          {mao && (
            <>
              <Baris label="Unit retail" hint="non aggregator, dasar insentif pencari order"><AngkaInput value={dasar.pencari} onChange={(v) => ubah('pencari', v)} lebar="w-[84px]" className={isian} /></Baris>
              <Baris label="Sales retail" hint="non aggregator, dasar extra insentif"><AngkaInput value={dasar.nonAggregator} onChange={(v) => ubah('nonAggregator', v)} lebar="w-[150px]" className={isian} /></Baris>
              <p className={`border-b border-neutral-200 px-4 py-2.5 text-[13px] leading-snug dark:border-neutral-800 ${aggUnit < 0 || aggAmount < 0 ? 'text-red-700 dark:text-red-400' : 'text-neutral-500'}`}>
                {aggUnit < 0 || aggAmount < 0
                  ? 'Angka retail melebihi total sales. Periksa lagi isiannya.'
                  : `Sisanya dari aggregator: ${aggUnit} unit · ${rupiah(aggAmount)}. Ikut dihitung di performa dan survey, tanpa pencari order dan extra.`}
              </p>
              <Baris label="MA produktif" hint={`target ${tMa} · MA aggregator tidak dihitung`}><AngkaInput value={dasar.ma} onChange={(v) => ubah('ma', v)} lebar="w-[84px]" className={isian} /></Baris>
              <Baris label="MA produktif non leasing"><AngkaInput value={dasar.maNonLeasing} onChange={(v) => ubah('maNonLeasing', v)} lebar="w-[84px]" className={isian} /></Baris>
            </>
          )}
          {adaKoreksi && (
            <button onClick={kembalikan} className="flex min-h-12 w-full items-center justify-center text-sm font-semibold text-neutral-600 dark:text-neutral-300">
              Kembalikan ke data pantauan
            </button>
          )}
        </div>
      )}

      {/* Simulasi */}
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2.5 pt-6">
        <h2 className="text-[17px] font-bold tracking-tight">Simulasi</h2>
        {hasil.berubah && (
          <button onClick={() => { setSim(SIM0); setPakai(false); setNbq(null); }}
            className="-my-2 -mr-3 min-h-11 px-3 text-[13px] font-semibold text-neutral-500">Reset</button>
        )}
      </div>
      <div className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex min-h-[60px] items-center gap-3 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Ikutkan bahan survey</p>
            <p className="truncate text-[13px] text-neutral-500">
              {bahan.loading ? 'Memuat…' : punya.n ? `${punya.n} bahan · ${rp(punya.amt)}${mao && punya.nAgg ? ` · ${punya.nAgg} aggregator` : ''}` : 'Belum ada bahan aktif'}
            </p>
          </div>
          {punya.n > 0 ? (
            <button role="switch" aria-checked={pakai} aria-label="Ikutkan bahan survey" onClick={() => setPakai((v) => !v)}
              className="flex h-11 w-[52px] shrink-0 items-center">
              <span className={`flex h-[30px] w-[52px] items-center rounded-full p-[3px] transition ${pakai ? 'bg-[#1FA463]' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                <span className={`h-6 w-6 rounded-full bg-white transition ${pakai ? 'translate-x-[22px]' : ''}`} />
              </span>
            </button>
          ) : (
            <button onClick={onBahan} className="min-h-10 shrink-0 rounded-full border border-neutral-300 px-4 text-sm font-semibold dark:border-neutral-700">Isi bahan</button>
          )}
        </div>
        <Stepper label={mao ? 'Tambah unit retail' : 'Tambah unit'} sub={mao ? `Non aggregator · jadi ${m.pencari} unit retail` : `Jadi ${m.unit} dari target ${m.targetUnit} unit`} value={String(sim.unit)}
          onMinus={() => setSim((s) => ({ ...s, unit: Math.max(0, s.unit - 1) }))} onPlus={() => setSim((s) => ({ ...s, unit: s.unit + 1 }))} />
        <Stepper label={mao ? 'Tambah amount retail' : 'Tambah amount'} sub={mao ? `Non aggregator · jadi ${rp(m.nonAggregator)}` : `Jadi ${rp(m.amount)} dari ${rp(m.targetAmount)}`} value={sim.jt ? `+${sim.jt} jt` : '0'}
          onMinus={() => setSim((s) => ({ ...s, jt: Math.max(0, s.jt - 25) }))} onPlus={() => setSim((s) => ({ ...s, jt: s.jt + 25 }))} />
        {mao && (
          <>
            <Stepper label="Tambah unit aggregator" sub="Performa dan survey saja" value={String(sim.unitAgg)}
              onMinus={() => setSim((s) => ({ ...s, unitAgg: Math.max(0, s.unitAgg - 1) }))} onPlus={() => setSim((s) => ({ ...s, unitAgg: s.unitAgg + 1 }))} />
            <Stepper label="Tambah amount aggregator" sub={`Total jadi ${m.unit} unit · ${rp(m.amount)}`} value={sim.jtAgg ? `+${sim.jtAgg} jt` : '0'}
              onMinus={() => setSim((s) => ({ ...s, jtAgg: Math.max(0, s.jtAgg - 25) }))} onPlus={() => setSim((s) => ({ ...s, jtAgg: s.jtAgg + 25 }))} />
          </>
        )}
        {mao && (
          <Stepper label="Tambah MA produktif" sub={`MA retail · jadi ${m.ma} dari target ${tMa}`} value={String(sim.ma)}
            onMinus={() => setSim((s) => ({ ...s, ma: Math.max(0, s.ma - 1) }))} onPlus={() => setSim((s) => ({ ...s, ma: s.ma + 1 }))} />
        )}
        <Stepper label="Faktor NBQ" sub={`Bawaan skema ${hasil.nbqBawaan}%`} value={`${nbq ?? hasil.nbqBawaan}%`}
          onMinus={() => setNbq((v) => Math.max(0, (v ?? hasil.nbqBawaan) - 5))} onPlus={() => setNbq((v) => Math.min(100, (v ?? hasil.nbqBawaan) + 5))} />
      </div>

      {/* Target insentif */}
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2.5 pt-6">
        <h2 className="text-[17px] font-bold tracking-tight">Target insentif</h2>
        <span className="text-[13px] text-neutral-500">butuh berapa lagi</span>
      </div>
      <div className="px-4">
        <AngkaInput value={target} onChange={setTarget} label="Target insentif (rupiah)" placeholder="mis. 2.000.000" className="h-12" />
        <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {[1_000_000, 2_000_000, 3_000_000, 5_000_000].map((v) => (
            <button key={v} onClick={() => setTarget(v)} aria-pressed={target === v}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${target === v
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                : 'border-neutral-300 dark:border-neutral-700'}`}>
              Rp {v / 1e6} jt
            </button>
          ))}
        </div>
      </div>
      <div className="mx-4 mt-3 flex flex-col gap-1 rounded-[20px] border border-neutral-200 px-4 py-3.5 dark:border-neutral-800">
        <p className="text-xl font-bold tracking-tight">
          {!target ? 'Isi target dulu' : butuh ? (butuh.unit === 0 ? 'Sudah tercapai' : `Butuh ${butuh.unit} unit${ret} lagi`) : 'Belum terjangkau'}
        </p>
        <p className="text-sm leading-snug text-neutral-600 dark:text-neutral-400">
          {!target ? 'Ketik nominal insentif yang ingin dicapai.'
            : butuh
              ? (butuh.unit === 0
                ? `Dengan angka di atas insentif sudah ${rupiah(butuh.hasil.total)}.`
                : `Sekitar ${rp(butuh.unit * hasil.perUnit)}, dihitung ${rp(hasil.perUnit)} per unit. Perf jadi ${persen(butuh.hasil.perf)} dan insentif ${rupiah(butuh.hasil.total)}.`)
              : hasil.plafon !== null
                ? `Batas atas skema ini ${rupiah(hasil.plafon)}.`
                : `Tambah 40 unit pun belum sampai. Naikkan nilai per unit${mao ? ' atau jumlah MA produktif' : ''}.`}
        </p>
      </div>

      <p className="px-4 pt-4 text-[13px] leading-relaxed text-neutral-500">
        {mao
          ? 'Di bawah batas minimal performa, insentif MAO belum keluar. Performa dihitung dari semua sales (retail + aggregator); insentif pencari order dan extra hanya dari sales retail. Unit tambahan dihitung ikut disurvey, dan saran di atas memakai unit retail.'
          : jenis === 'cmo'
            ? 'Unit tambahan dihitung ikut disurvey. Bonus Booking Mandiri belum termasuk.'
            : 'Bonus tengah bulan mengikuti sales tanggal 1–15 dan tidak ikut berubah di simulasi.'}
        {' '}Koreksi angka hanya tersimpan di HP ini.
      </p>
    </div>
  );
}
