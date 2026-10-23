'use client';
// Proyeksi sales: pencapaian + bahan (sedang diproses & bahan survey) dibanding target dan bulan lalu.
import { useEffect, useMemo, useState } from 'react';
import type { Orang } from '../../lib/performa-types';
import type { Bahan } from '../../lib/bahan-types';
import { brandOf, hariKerjaSisa, type Ctx } from '../../lib/performa-calc';
import { samaNama } from '../../lib/sales-brand';
import { hitungProyeksi, type Angka, type Proyeksi } from '../../lib/proyeksi';
import { posisiKosong } from '../../lib/kesehatan-data';
import { totalBrand } from './laporan-gambar';
import { shortName } from './parts';

type Akun = { email: string; name?: string; role: 'owner' | 'konsumen' | 'tim'; perfName?: string | null };
type Mode = 'realistis' | 'maksimal';

const cf = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const rp = (v: number) => `Rp ${cf.format(Math.abs(v))}`;
const unit = (v: number) => `${nf.format(Math.abs(v))} unit`;
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '–');

function Baris({ label, isi, kelas = '' }: { label: string; isi: string; kelas?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-2 text-[13px] ${kelas}`}>
      <span className="min-w-0 truncate text-neutral-500">{label}</span><span className="whitespace-nowrap text-right font-semibold">{isi}</span>
    </div>
  );
}

function Kolom({ jenis, p, mode }: { jenis: 'amount' | 'unit'; p: Proyeksi; mode: Mode }) {
  const f = jenis === 'amount' ? rp : unit;
  const pro = p[mode][jenis], t = p.target?.[jenis] ?? 0, l = p.lalu?.[jenis] ?? null;
  const kurang = t - pro, sel = l === null ? null : pro - l;
  const lebar = Math.max(t, p.maksimal[jenis], 1);
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / lebar) * 100))}%`;
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">{jenis === 'amount' ? 'Amount' : 'Unit'}</p>
      <p className="mt-0.5 text-[24px] font-bold leading-tight">{f(pro)}</p>
      <p className="text-[12px] text-neutral-500">{t ? `${pct(pro, t)} dari target ${f(t)}` : 'Target belum ada'}</p>
      <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 bg-amber-300 dark:bg-amber-700" style={{ width: w(p.maksimal[jenis]) }} />
        <span className="absolute inset-y-0 left-0 bg-sky-500" style={{ width: w(p.realistis[jenis]) }} />
        <span className="absolute inset-y-0 left-0 bg-neutral-900 dark:bg-white" style={{ width: w(p.tercapai[jenis]) }} />
        {t > 0 && <span className="absolute inset-y-0 w-0.5 bg-red-600" style={{ left: w(t) }} />}
      </div>
      <div className="mt-2 space-y-0.5">
        <Baris label="Tercapai" isi={f(p.tercapai[jenis])} />
        <Baris label="+ Diproses" isi={f(p.proses[jenis])} />
        <Baris label="+ Bahan survey" isi={f(p.survey[jenis])} kelas={mode === 'realistis' ? 'opacity-50' : ''} />
      </div>
      <p className={`mt-2 rounded-lg px-2 py-1 text-[13px] font-bold ${!t ? 'bg-neutral-100 dark:bg-neutral-900' : kurang > 0 ? 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300' : 'bg-green-50 text-green-800 dark:bg-green-950/60 dark:text-green-300'}`}>
        {!t ? 'Target –' : kurang > 0 ? `Kurang ${f(kurang)}` : `Lebih ${f(-kurang)} dari target`}
      </p>
      <p className="mt-1 text-[12px] text-neutral-600 dark:text-neutral-400">
        {sel === null ? 'Bulan lalu –' : `${sel >= 0 ? '▲' : '▼'} ${f(sel)} dibanding bulan lalu (${f(l!)})`}
      </p>
    </div>
  );
}

function Kartu({ judul, sub, p, mode, gelap = false }: { judul: string; sub?: string; p: Proyeksi; mode: Mode; gelap?: boolean }) {
  return (
    <section className={`rounded-3xl border p-4 ${gelap ? 'border-neutral-900 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-950' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-bold">{judul}</h3>
        {sub && <span className="text-[12px] text-neutral-500">{sub}</span>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Kolom jenis="amount" p={p} mode={mode} />
        <Kolom jenis="unit" p={p} mode={mode} />
      </div>
    </section>
  );
}

function teksWa(baris: { judul: string; p: Proyeksi }[], mode: Mode, cabang: string, today: string): string {
  const tgl = new Date(today + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const satu = (a: Angka) => `${rp(a.amount)} (${nf.format(a.unit)} unit)`;
  const out = [`*PROYEKSI SALES ${cabang.toUpperCase()} · ${tgl}*`, `_${mode === 'maksimal' ? 'Tercapai + sedang diproses + bahan survey' : 'Tercapai + sedang diproses'} · sisa ${hariKerjaSisa(today)} hari kerja_`];
  for (const { judul, p } of baris) {
    const pro = p[mode];
    const t = p.target, l = p.lalu;
    out.push('', `*${judul}*`, `Tercapai ${satu(p.tercapai)}`, `+ Diproses ${satu(p.proses)}`);
    if (mode === 'maksimal') out.push(`+ Bahan survey ${satu(p.survey)}`);
    out.push(`= Proyeksi ${satu(pro)}${t?.amount ? ` · ${pct(pro.amount, t.amount)}` : ''}`);
    if (t) out.push(`Target ${satu(t)} → ${t.amount - pro.amount > 0 ? `kurang ${rp(t.amount - pro.amount)}` : `lebih ${rp(pro.amount - t.amount)}`}, ${t.unit - pro.unit > 0 ? `kurang ${unit(t.unit - pro.unit)}` : `lebih ${unit(pro.unit - t.unit)}`}`);
    if (l) out.push(`Bulan lalu ${satu(l)} → ${pro.amount >= l.amount ? '+' : '−'}${rp(pro.amount - l.amount)}, ${pro.unit >= l.unit ? '+' : '−'}${unit(pro.unit - l.unit)}`);
  }
  return out.join('\n');
}

export default function ProyeksiPage({ c, me, akun }: { c: Ctx; me: Orang | null; akun: Akun }) {
  const [bahan, setBahan] = useState<Bahan[] | null>(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<Mode>('maksimal');
  const [pesan, setPesan] = useState('');
  const isOwner = akun.role === 'owner';

  useEffect(() => {
    let hidup = true;
    fetch('/api/bahan', { cache: 'no-store' }).then(async (r) => {
      const j = await r.json().catch(() => null);
      if (!hidup) return;
      if (r.ok && Array.isArray(j?.list)) setBahan(j.list); else { setErr(j?.error || 'Bahan gagal dimuat.'); setBahan([]); }
    }).catch(() => { if (hidup) { setErr('Koneksi bermasalah.'); setBahan([]); } });
    return () => { hidup = false; };
  }, []);

  const data = useMemo(() => {
    if (!bahan) return null;
    const aktif = bahan.filter((b) => b.status === 'aktif');
    const pemilik = (b: Bahan) => c.sales.find((o) => samaNama(o.nama, b.nama)) || null;
    const brandBahan = (b: Bahan) => { const o = pemilik(b); return o ? brandOf(o) : ''; };
    const orang = c.sales.filter((o) => !posisiKosong(o.nama) && (isOwner || o === me))
      .map((o) => ({ o, p: hitungProyeksi(o, aktif.filter((b) => samaNama(o.nama, b.nama))) }))
      .sort((a, b) => b.p[mode].amount - a.p[mode].amount);
    const brand = (['mobilku', 'motorku'] as const).map((b) => ({ b, p: hitungProyeksi(totalBrand(c, b), aktif.filter((x) => brandBahan(x) === b)) }));
    const tanpaPemilik = aktif.filter((b) => !pemilik(b)).length;
    return { cabang: hitungProyeksi(c.data.cabangTotal || {}, aktif), brand, orang, tanpaPemilik, nAktif: aktif.length };
  }, [bahan, c, me, isOwner, mode]);

  const salin = async () => {
    if (!data) return;
    const baris = isOwner
      ? [{ judul: 'CABANG', p: data.cabang }, ...data.brand.map((x) => ({ judul: x.b === 'mobilku' ? 'MOBILKU' : 'MOTORKU', p: x.p })), ...data.orang.map((x) => ({ judul: shortName(x.o.nama).toUpperCase(), p: x.p }))]
      : data.orang.map((x) => ({ judul: shortName(x.o.nama).toUpperCase(), p: x.p }));
    const t = teksWa(baris, mode, c.data.cabang || 'Kendal', c.today);
    try { await navigator.clipboard.writeText(t); setPesan('Ringkasan proyeksi tersalin. Tempel di WhatsApp.'); } catch { setPesan('Tidak bisa menyalin otomatis di HP ini.'); }
  };

  return (
    <div className="px-4 pb-10 pt-4">
      <p className="text-[14px] leading-snug text-neutral-600 dark:text-neutral-400">
        Proyeksi = sales yang sudah tercapai + bahan yang masih berjalan, dibanding target dan bulan lalu. Sisa {hariKerjaSisa(c.today)} hari kerja.
      </p>
      <div role="group" aria-label="Cara hitung" className="mt-3 flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
        {([['maksimal', '+ Diproses + Bahan survey'], ['realistis', '+ Sedang diproses saja']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k}
            className={`min-h-10 flex-1 rounded-lg px-2 text-[13px] font-semibold ${mode === k ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white' : 'text-neutral-500'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-500" aria-hidden="true">
        <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm bg-neutral-900 dark:bg-white" />Tercapai</span>
        <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm bg-sky-500" />Diproses</span>
        <span className="flex items-center gap-1"><i className="h-2 w-3 rounded-sm bg-amber-300 dark:bg-amber-700" />Bahan survey</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-0.5 bg-red-600" />Target</span>
      </div>

      {err && <p className="mt-3 text-[13px] text-red-700 dark:text-red-300">{err}</p>}
      {!data ? <p className="mt-4 text-[13px] text-neutral-500">Memuat bahan…</p> : (
        <div className="mt-4 space-y-3">
          {isOwner && <Kartu judul="Cabang" sub={`${data.nAktif} bahan aktif`} p={data.cabang} mode={mode} gelap />}
          {isOwner && data.brand.map((x) => <Kartu key={x.b} judul={x.b === 'mobilku' ? 'Mobilku' : 'Motorku'} p={x.p} mode={mode} />)}
          {data.orang.length > 0 && <p className="pt-2 text-[15px] font-bold">{isOwner ? 'Per orang' : 'Proyeksi kamu'}</p>}
          {data.orang.map((x) => <Kartu key={x.o.nama} judul={shortName(x.o.nama)} sub={`${x.p.proses.unit + x.p.survey.unit} bahan`} p={x.p} mode={mode} />)}
          {!isOwner && !data.orang.length && <p className="text-[14px] text-neutral-500">Akun ini belum tertaut ke nama di pantauan, jadi proyeksi pribadi belum bisa dihitung.</p>}
          {isOwner && data.tanpaPemilik > 0 && <p className="text-[12px] text-neutral-500">{data.tanpaPemilik} bahan dibuat oleh akun yang tidak ada di pantauan (mis. owner); ikut di total cabang, tidak masuk per brand.</p>}
          <button onClick={salin} className="min-h-12 w-full rounded-2xl bg-[#0F8048] text-[15px] font-bold text-white">Salin ringkasan untuk WA</button>
          {pesan && <p role="status" className="text-[13px] text-neutral-600 dark:text-neutral-400">{pesan}</p>}
        </div>
      )}
    </div>
  );
}
