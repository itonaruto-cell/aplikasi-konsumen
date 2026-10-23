'use client';
// Proyeksi sales: pencapaian + bahan (sedang diproses & bahan survey) dibanding target dan bulan lalu.
import { useEffect, useMemo, useState } from 'react';
import type { Orang } from '../../lib/performa-types';
import type { Bahan } from '../../lib/bahan-types';
import { hariKerjaSisa, type Ctx } from '../../lib/performa-calc';
import type { Angka, Proyeksi } from '../../lib/proyeksi';
import { ambilBahanProyeksi, hitungSemua, plus, type Mode } from './proyeksi-data';
import { shortName } from './parts';

type Akun = { email: string; name?: string; role: 'owner' | 'spv' | 'konsumen' | 'tim'; perfName?: string | null };

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

// Angka ketikan (hanya untuk simulasi di layar, tidak disimpan)
const digit = (s: string) => Number(s.replace(/\D/g, '')) || 0;

function SimKolom({ jenis, now, after, target }: { jenis: 'amount' | 'unit'; now: number; after: number; target: number | null }) {
  const f = jenis === 'amount' ? rp : unit;
  const kurang = target === null ? null : target - after;
  return (
    <div className="min-w-0">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">{jenis === 'amount' ? 'Amount' : 'Unit'}</p>
      <p className="mt-0.5 text-[12px] text-neutral-500">dari {f(now)}</p>
      <p className="text-[22px] font-bold leading-tight">{f(after)}</p>
      <p className="text-[12px] text-neutral-500">{target ? `${pct(after, target)} dari target` : 'Target belum ada'}</p>
      <p className={`mt-1.5 rounded-lg px-2 py-1 text-[12px] font-bold ${!target ? 'bg-neutral-100 dark:bg-neutral-900' : kurang! > 0 ? 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300' : 'bg-green-50 text-green-800 dark:bg-green-950/60 dark:text-green-300'}`}>
        {kurang === null ? 'Target –' : kurang > 0 ? `Kurang ${f(kurang)}` : `Lebih ${f(-kurang)} dari target`}
      </p>
    </div>
  );
}

// Satu blok hasil simulasi: angka sekarang → setelah tambahan, dibanding target
function SimBlok({ judul, sub, now, after, target }: { judul: string; sub: string; now: Angka; after: Angka; target: Angka | null }) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-3 dark:bg-neutral-900">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[15px] font-bold">{judul}</p>
        <p className="min-w-0 truncate text-right text-[12px] text-neutral-500">{sub}</p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <SimKolom jenis="amount" now={now.amount} after={after.amount} target={target?.amount ?? null} />
        <SimKolom jenis="unit" now={now.unit} after={after.unit} target={target?.unit ?? null} />
      </div>
    </div>
  );
}

type Jenis = 'mobil' | 'motor';
const JENIS: { k: Jenis; label: string; brand: 'mobilku' | 'motorku' }[] = [
  { k: 'mobil', label: 'Mobil', brand: 'mobilku' },
  { k: 'motor', label: 'Motor', brand: 'motorku' },
];
const NOL: Angka = { amount: 0, unit: 0 };

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

// Semua akun (owner & tim) melihat proyeksi lengkap: cabang, brand, per orang, dan simulasi.
export default function ProyeksiPage({ c, me, onFoto }: { c: Ctx; me: Orang | null; akun?: Akun; onFoto?: () => void }) {
  const [bahan, setBahan] = useState<Bahan[] | null>(null);
  const [err, setErr] = useState('');
  const [mode, setMode] = useState<Mode>('maksimal');
  const [pesan, setPesan] = useState('');
  const [simId, setSimId] = useState('');
  const [tamb, setTamb] = useState<Record<Jenis, Angka>>({ mobil: NOL, motor: NOL });
  const ubahTamb = (k: Jenis, f: keyof Angka, v: number) => setTamb((x) => ({ ...x, [k]: { ...x[k], [f]: v } }));

  useEffect(() => {
    let hidup = true;
    ambilBahanProyeksi().then((list) => { if (hidup) setBahan(list); })
      .catch((e) => { if (hidup) { setErr((e as Error)?.message || 'Koneksi bermasalah.'); setBahan([]); } });
    return () => { hidup = false; };
  }, []);

  const data = useMemo(() => (bahan ? hitungSemua(c, bahan, mode) : null), [bahan, c, mode]);

  // Simulasi per PIC: tambahan mobil & motor dipisah. Owner juga bisa tanpa PIC (langsung ke brand & cabang).
  const opsi: { id: string; judul: string; p: Proyeksi | null }[] = data ? [
    ...data.orang.map((x) => ({ id: x.o.nama, judul: shortName(x.o.nama), p: x.p })),
    { id: 'tanpa-pic', judul: 'Tanpa PIC (langsung brand & cabang)', p: null },
  ] : [];
  const pilih = opsi.find((o) => o.id === simId) ?? opsi.find((o) => !!me && o.id === me.nama) ?? opsi[0];
  const adaTamb = !!(tamb.mobil.amount || tamb.mobil.unit || tamb.motor.amount || tamb.motor.unit);
  const total = plus(tamb.mobil, tamb.motor);
  const sim = pilih && data ? {
    pic: pilih.p ? { judul: pilih.judul, now: pilih.p[mode], after: plus(pilih.p[mode], total), target: pilih.p.target } : null,
    brand: JENIS.map((j) => { const p = data.brand.find((x) => x.b === j.brand)!.p; return { j, now: p[mode], after: plus(p[mode], tamb[j.k]), target: p.target }; }),
    cabang: { now: data.cabang[mode], after: plus(data.cabang[mode], total), target: data.cabang.target },
    bahan: pilih.p ? data.bahanOrang.get(pilih.id) ?? null : null,
  } : null;
  const satu = (a: Angka) => `${rp(a.amount)} (${nf.format(a.unit)} unit)`;
  const subTamb = (a: Angka) => (a.amount || a.unit ? `+ ${satu(a)}` : 'tanpa tambahan');

  const salin = async () => {
    if (!data) return;
    const baris = [{ judul: 'CABANG', p: data.cabang }, ...data.brand.map((x) => ({ judul: x.b === 'mobilku' ? 'MOBILKU' : 'MOTORKU', p: x.p })), ...data.orang.map((x) => ({ judul: shortName(x.o.nama).toUpperCase(), p: x.p }))];
    let t = teksWa(baris, mode, c.data.cabang || 'Kendal', c.today);
    if (sim && adaTamb) {
      const hasil = (judul: string, x: { after: Angka; target: Angka | null }) =>
        `${judul} → ${satu(x.after)}${x.target?.amount ? ` · ${pct(x.after.amount, x.target.amount)} dari target` : ''}`;
      const out = ['', '', `*SIMULASI${sim.pic ? ` ${sim.pic.judul.toUpperCase()}` : ''}*`];
      for (const j of JENIS) if (tamb[j.k].amount || tamb[j.k].unit) out.push(`+ ${j.label} ${satu(tamb[j.k])}`);
      if (sim.pic) out.push(hasil(sim.pic.judul, sim.pic));
      for (const b of sim.brand) if (tamb[b.j.k].amount || tamb[b.j.k].unit) out.push(hasil(b.j.brand === 'mobilku' ? 'Mobilku' : 'Motorku', b));
      if (sim.cabang) out.push(hasil('Cabang', sim.cabang));
      t += out.join('\n');
    }
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
          <Kartu judul="Cabang" sub={`${data.nAktif} bahan aktif`} p={data.cabang} mode={mode} gelap />
          {data.brand.map((x) => <Kartu key={x.b} judul={x.b === 'mobilku' ? 'Mobilku' : 'Motorku'} p={x.p} mode={mode} />)}
          {data.orang.length > 0 && <p className="pt-2 text-[15px] font-bold">Per orang</p>}
          {data.orang.map((x) => <Kartu key={x.o.nama} judul={`${shortName(x.o.nama)}${x.o === me ? ' (kamu)' : ''}`} sub={`${x.p.proses.unit + x.p.survey.unit} bahan`} p={x.p} mode={mode} />)}
          {sim && (
            <section className="rounded-3xl border border-dashed border-neutral-400 p-4 dark:border-neutral-600">
              <h3 className="text-[16px] font-bold">Simulasi estimasi</h3>
              <p className="mt-0.5 text-[12px] text-neutral-500">Pilih PIC, ketik tambahan mobil dan motor. Angkanya tidak disimpan, buat bahan briefing tim.</p>
              <label className="mt-3 block text-[12px] font-semibold text-neutral-500" htmlFor="sim-pilih">PIC</label>
              <select id="sim-pilih" value={pilih!.id} onChange={(e) => setSimId(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[15px] dark:border-neutral-700 dark:bg-neutral-950">
                {opsi.map((o) => <option key={o.id} value={o.id}>{o.judul}</option>)}
              </select>
              {JENIS.map((j) => (
                <fieldset key={j.k} className="mt-3">
                  <legend className="text-[13px] font-bold">Tambahan {j.label}</legend>
                  {sim.bahan && (
                    <p className="text-[12px] text-neutral-500">
                      Bahan {j.label.toLowerCase()} {sim.pic?.judul} sekarang: {sim.bahan[j.k].unit ? satu(sim.bahan[j.k]) : 'belum ada'}
                    </p>
                  )}
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[12px] font-semibold text-neutral-500">Amount (Rp)</span>
                      <input inputMode="numeric" aria-label={`Tambahan ${j.label} amount (Rp)`} value={tamb[j.k].amount ? tamb[j.k].amount.toLocaleString('id-ID') : ''} placeholder="0"
                        onChange={(e) => ubahTamb(j.k, 'amount', digit(e.target.value))}
                        className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[15px] dark:border-neutral-700 dark:bg-neutral-950" />
                    </label>
                    <label className="block">
                      <span className="text-[12px] font-semibold text-neutral-500">Unit</span>
                      <input inputMode="numeric" aria-label={`Tambahan ${j.label} unit`} value={tamb[j.k].unit || ''} placeholder="0"
                        onChange={(e) => ubahTamb(j.k, 'unit', digit(e.target.value))}
                        className="mt-1 min-h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[15px] dark:border-neutral-700 dark:bg-neutral-950" />
                    </label>
                  </div>
                </fieldset>
              ))}
              <div className="mt-4 space-y-2">
                {sim.pic && <SimBlok judul={sim.pic.judul} sub={subTamb(total)} now={sim.pic.now} after={sim.pic.after} target={sim.pic.target} />}
                {sim.brand.map((b) => <SimBlok key={b.j.k} judul={b.j.brand === 'mobilku' ? 'Mobilku' : 'Motorku'} sub={subTamb(tamb[b.j.k])} now={b.now} after={b.after} target={b.target} />)}
                {sim.cabang && <SimBlok judul="Cabang" sub={subTamb(total)} now={sim.cabang.now} after={sim.cabang.after} target={sim.cabang.target} />}
              </div>
              {adaTamb && (
                <button onClick={() => setTamb({ mobil: NOL, motor: NOL })} className="mt-3 min-h-10 text-[13px] font-semibold text-neutral-600 underline dark:text-neutral-400">Atur ulang simulasi</button>
              )}
            </section>
          )}
          {data.tanpaPemilik > 0 &&<p className="text-[12px] text-neutral-500">{data.tanpaPemilik} bahan dibuat oleh akun yang tidak ada di pantauan dan belum diisi jenis kendaraan; ikut di total cabang, tidak masuk per brand.</p>}
          <div className={`grid gap-2 ${onFoto ? 'grid-cols-2' : ''}`}>
            <button onClick={salin} className="min-h-12 rounded-2xl bg-[#0F8048] px-2 text-[15px] font-bold text-white">Salin ringkasan WA</button>
            {onFoto && <button onClick={onFoto} className="min-h-12 rounded-2xl bg-neutral-900 px-2 text-[15px] font-bold text-white dark:bg-white dark:text-neutral-900">Foto laporan</button>}
          </div>
          {pesan && <p role="status" className="text-[13px] text-neutral-600 dark:text-neutral-400">{pesan}</p>}
        </div>
      )}
    </div>
  );
}
