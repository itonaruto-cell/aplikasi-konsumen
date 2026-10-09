'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { Orang } from '../../lib/performa-types';
import type { Calon } from '../../lib/inject-types';
import { addDays, belumVisit, brandOf, keyOf, konsumenOf, perluUlang, todayJkt, type BrandKey, type Ctx } from '../../lib/performa-calc';
import {
  JENIS, JENIS_LABEL, MIN_AKTIVITAS, ringkas, tanggalPanjang, tanggalPendek, teksPlan, urutkan,
  type Jenis, type PlanItem, type StatusPlan,
} from '../../lib/plan-types';
import { BrandChip, Ico, Kosong, PillSeg, UnderTabs, shareText, shortName, type BrandId } from './parts';
import { FIELD, Lembar } from './form';
import BahanSurvey, { sumberLabel, useBahan } from './Bahan';
import { tahapOf, type Bahan } from '../../lib/bahan-types';
import { rp } from './ui';

// Plan aktivitas: rencana pagi (minimal 5 aktivitas per staff), realisasi dicentang sepanjang hari,
// dan report sore siap kirim ke WhatsApp. Semua diisi manual di aplikasi, jadi langsung terlihat owner.

type Akun = { email: string; name?: string; role: 'owner' | 'konsumen' | 'tim' };
type Tab = 'tim' | 'saya' | 'bahan' | 'report';
type Pilihan = { jenis: Jenis; siapa: string; lokasi: string; request?: boolean };
// Staff yang ditagih plan: semua anggota di pantauan, Mobilku maupun Motorku
export type Staf = { nama: string; brand: BrandId | '' };
const CHIP = 'rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300';
const CHIP_AMBER = 'rounded-full bg-[#FFF4E0] px-2 py-0.5 text-xs font-semibold text-[#8A4700] dark:bg-[#2A1E0C] dark:text-[#F7C98A]';
const CHIP_HIJAU = 'rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-400/15 dark:text-green-300';
const CHIP_MERAH = 'rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-400/15 dark:text-red-300';
const PILIH = (on: boolean) => `min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${on
  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
  : 'border-neutral-300 dark:border-neutral-700'}`;
const URUT_BRAND: Record<BrandId | '', number> = { mobilku: 0, motorku: 1, '': 2 };
const kunci = (x: { jenis: string; siapa: string }) => `${x.jenis}|${keyOf(x.siapa)}`;

/* ---------- Kirim ke WhatsApp ---------- */
// Tautan langsung ke WhatsApp (pilih kontak / grup di sana). Sengaja berupa tautan biasa, bukan lembar bagikan HP,
// supaya selalu terbuka di WhatsApp dan tidak terhalang pemblokir jendela baru.
const waUrl = (teks: string) => `https://wa.me/?text=${encodeURIComponent(teks)}`;
// Sebelum ada yang dicentang yang dikirim plan pagi; sesudahnya report
const modeOtomatis = (items: PlanItem[]): 'plan' | 'report' => (items.some((x) => x.status !== 'rencana') ? 'report' : 'plan');
// Tautan yang terlalu panjang bisa ditolak WhatsApp: teks panjang dikirim lewat lembar bagikan HP, atau disalin
const MAKS_TAUTAN = 6000;
function TombolWa({ teks, label, onInfo }: { teks: string; label: string; onInfo?: (pesan: string) => void }) {
  const panjang = waUrl(teks).length > MAKS_TAUTAN;
  const kirimPanjang = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (!panjang) return;
    e.preventDefault();
    try {
      if (navigator.share) { await navigator.share({ text: teks }); return; }
      await navigator.clipboard.writeText(teks);
      onInfo?.('Teksnya panjang, jadi sudah disalin. Tempel di WhatsApp.');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') onInfo?.('Teksnya terlalu panjang. Pakai Salin teks di tab Report.');
    }
  };
  return (
    <a href={panjang ? 'https://wa.me/' : waUrl(teks)} onClick={kirimPanjang} target="_blank" rel="noopener noreferrer"
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0F8048] px-4 text-[15px] font-bold text-white active:scale-[0.99]">
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
      </svg>
      {label}
    </a>
  );
}

/* ---------- Bahan survey di dalam report ---------- */
// Dua blok: bahan yang belum disurvey dan yang sedang diproses. Tiap blok dikelompokkan per PIC survey
// (jumlah bahan dan nominal tiap PIC), dengan total blok di baris paling atas. Yang belum punya PIC di paling bawah.
function teksBahan(list: Bahan[]): string {
  const total = (x: Bahan[]) => `${x.length} bahan · ${rp(x.reduce((s, b) => s + b.nominal, 0))}`;
  const blok = (judul: string, isi: Bahan[]) => {
    const grup = new Map<string, { nama: string; items: Bahan[] }>();
    isi.forEach((b) => {
      const k = keyOf(b.pic);
      const g = grup.get(k) || { nama: b.pic ? shortName(b.pic) : '', items: [] };
      g.items.push(b); grup.set(k, g);
    });
    const urut = [...grup.values()].sort((a, b) => Number(!a.nama) - Number(!b.nama) || a.nama.localeCompare(b.nama));
    return [
      `*${judul}* · ${total(isi)}`,
      ...urut.map((g) => [
        `*PIC ${g.nama || 'belum diisi'}* · ${total(g.items)}`,
        ...[...g.items].sort((a, b) => a.konsumen.localeCompare(b.konsumen)).map((b, i) => [
          `${i + 1}. ${b.konsumen} · ${b.nominal ? rp(b.nominal) : 'nominal belum diisi'}`,
          `   Sumber: ${sumberLabel(b)}`,
          `   Step: ${b.step || 'belum diisi'}`,
        ].join('\n')),
      ].join('\n')),
    ].join('\n\n');
  };
  const survey = list.filter((b) => tahapOf(b) === 'survey'), proses = list.filter((b) => tahapOf(b) === 'proses');
  return [
    survey.length ? blok('BAHAN SURVEY', survey) : '',
    proses.length ? blok('SEDANG DIPROSES', proses) : '',
  ].filter(Boolean).join('\n\n');
}

/* ---------- Muat plan satu hari ---------- */
export function usePlan(tgl: string, reloadKey = 0) {
  // Daftar disimpan bersama tanggalnya, supaya saat pindah hari isi hari sebelumnya tidak sempat tampil
  const [isi, setIsi] = useState<{ tgl: string; list: PlanItem[]; spv: string[] }>({ tgl: '', list: [], spv: [] });
  const list = useMemo(() => (isi.tgl === tgl ? isi.list : []), [isi, tgl]);
  const setList = useCallback((f: (prev: PlanItem[]) => PlanItem[]) => setIsi((p) => ({ ...p, list: f(p.list) })), []);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr('');
      try {
        const res = await fetch(`/api/plan?tgl=${tgl}`, { cache: 'no-store' });
        if (res.status === 401) { window.location.href = '/login'; return; }
        const json = await res.json();
        if (!alive) return;
        if (res.ok && Array.isArray(json?.list)) setIsi({ tgl, list: json.list as PlanItem[], spv: Array.isArray(json.spv) ? (json.spv as string[]) : [] });
        else setErr(json?.error || 'Plan aktivitas gagal dimuat.');
      } catch {
        if (alive) setErr('Koneksi bermasalah. Periksa internet lalu coba lagi.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tgl, reloadKey, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  // Saat baru pindah hari, daftar hari itu belum ada: dianggap masih memuat (supaya "belum diisi" tidak sempat berkedip)
  return { list, spv: isi.spv, setList, loading: loading || (isi.tgl !== tgl && !err), err, reload };
}

/* ---------- Kartu ringkas di halaman Pantau ---------- */
export function PlanKartu({ akun, reloadKey = 0, onOpen }: { akun: Akun; reloadKey?: number; onOpen: () => void }) {
  const { list, loading, err } = usePlan(todayJkt(), reloadKey);
  if (err) return null;
  const isOwner = akun.role === 'owner';
  const timList = list.filter((x) => !x.spv);   // owner (SPV) tidak ikut dihitung
  const r = ringkas(isOwner ? timList : list.filter((x) => x.punyaku));
  const staff = new Set(timList.filter((x) => x.status !== 'batal').map((x) => x.nama)).size;
  const kosong = !loading && r.total === 0;
  const teks = loading && !list.length ? 'Memuat plan hari ini…'
    : isOwner ? (kosong ? 'Belum ada staff yang mengisi plan.' : `${staff} staff sudah isi · ${r.selesai}/${r.total} aktivitas selesai`)
      : kosong ? `Belum diisi. Minimal ${MIN_AKTIVITAS} aktivitas.`
        : `${r.selesai}/${r.total} selesai${r.total < MIN_AKTIVITAS ? ` · kurang ${MIN_AKTIVITAS - r.total} aktivitas` : ''}`;
  return (
    <button onClick={onOpen}
      className="mx-4 mt-3 flex w-[calc(100%-32px)] items-center gap-3 rounded-2xl border border-neutral-200 px-3.5 py-3 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
        <Ico n="list" className="h-5 w-5" sw={2} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-sm">{isOwner ? 'Plan tim hari ini' : 'Plan hari ini'}</b>
        <span className="block truncate text-[13px] text-neutral-500">{teks}</span>
      </span>
      <Ico n="right" className="h-[18px] w-[18px] shrink-0 text-neutral-400" sw={2} />
    </button>
  );
}

/* ---------- Satu aktivitas ---------- */
function Baris({ x, onCentang, onBuka }: { x: PlanItem; onCentang?: () => void; onBuka?: () => void }) {
  const selesai = x.status === 'selesai', batal = x.status === 'batal';
  return (
    <div className={`flex items-stretch rounded-[20px] border ${x.wajib && !selesai && !batal
      ? 'border-[#F2A33A] bg-[#FFF8E8] dark:border-[#8A5A12] dark:bg-[#1E1A10]' : 'border-neutral-200 dark:border-neutral-800'}`}>
      <button onClick={onCentang} disabled={!onCentang || batal}
        aria-label={selesai ? `Batalkan centang ${x.siapa}` : `Tandai selesai ${x.siapa}`} aria-pressed={selesai}
        className="flex w-14 shrink-0 items-center justify-center disabled:opacity-60">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 ${selesai
          ? 'border-[#1FA463] bg-[#1FA463] text-white' : batal ? 'border-neutral-300 text-neutral-400 dark:border-neutral-700' : 'border-neutral-400 dark:border-neutral-500'}`}>
          {selesai ? <Ico n="check" className="h-4 w-4" sw={3} /> : batal ? <Ico n="x" className="h-3.5 w-3.5" sw={2.6} /> : null}
        </span>
      </button>
      <button onClick={onBuka} disabled={!onBuka} className="flex min-w-0 flex-1 flex-col gap-1 py-3 pr-4 text-left">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={x.wajib ? CHIP_AMBER : CHIP}>{JENIS_LABEL[x.jenis]}</span>
          {x.wajib && <span className={CHIP_AMBER}>Wajib</span>}
          {x.request && <span className={CHIP}>By request CMO</span>}
          {batal && <span className={CHIP}>Batal</span>}
        </span>
        <span className={`truncate text-[15px] font-bold ${batal ? 'text-neutral-400 line-through' : ''}`}>{x.siapa}</span>
        {(x.lokasi || x.catatan) && <span className="text-[13px] leading-snug text-neutral-500">{[x.lokasi, x.catatan].filter(Boolean).join(' · ')}</span>}
        {x.hasil && <span className="text-[13px] leading-snug text-green-700 dark:text-green-300">Hasil: {x.hasil}</span>}
      </button>
    </div>
  );
}

/* ---------- Tambah aktivitas ---------- */
type Saran = { siapa: string; lokasi: string; ket: string };
function TambahSheet({ c, me, tgl, hariIni, sudah, reloadKey, onClose, onSaved }: {
  c: Ctx | null; me: Orang | null; tgl: string; hariIni: string; sudah: Set<string>; reloadKey: number;
  onClose: () => void; onSaved: (pesan: string) => void;
}) {
  const mao = !!me?.maintain, cmo = !!me?.visit;
  const daftarJenis: Jenis[] = mao && !cmo ? ['maintain', 'rekrut', 'regist', 'survey', 'map', 'lainnya']
    : cmo && !mao ? ['visit', 'survey', 'map', 'lainnya'] : [...JENIS];
  const [jenis, setJenis] = useState<Jenis>(daftarJenis[0]);
  const [q, setQ] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [pilih, setPilih] = useState<Map<string, Pilihan>>(new Map());
  const [db, setDb] = useState<Calon[]>([]);
  const [mencari, setMencari] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const urut = useRef(0);
  const bahan = useBahan(reloadKey);
  const manual = jenis === 'rekrut' || jenis === 'regist' || jenis === 'lainnya';

  // Saran dari data yang sudah ada: MA pegangan, konsumen prioritas, bahan survey
  const saran: Saran[] = useMemo(() => {
    if (jenis === 'maintain') {
      return [...(me?.maintain?.list || [])].sort((a, b) => a.f - b.f || a.n.localeCompare(b.n))
        .map((m) => ({ siapa: m.n, lokasi: '', ket: m.f ? `${m.f}× bulan ini${m.job ? ` · ${m.job}` : ''}` : `Belum dimaintain bulan ini${m.job ? ` · ${m.job}` : ''}` }));
    }
    if (jenis === 'visit' && c) {
      const brand = ((me && brandOf(me)) || 'semua') as BrandKey;
      const nilai = (k: Parameters<typeof belumVisit>[0]) => (belumVisit(k) ? 0 : perluUlang(k) ? 1 : 2);
      return konsumenOf(c.data, brand).map((x) => x.k).sort((a, b) => nilai(a) - nilai(b) || a.p - b.p || a.n.localeCompare(b.n))
        .map((k) => ({ siapa: k.n, lokasi: k.k, ket: `P${k.p} · ${belumVisit(k) ? 'belum visit' : perluUlang(k) ? 'perlu visit ulang' : 'sudah bertemu'}` }));
    }
    if (jenis === 'survey' || jenis === 'map') {
      // Survey: bahan yang belum disurvey; map pencairan: bahan yang sedang diproses
      return bahan.list.filter((b) => b.status === 'aktif' && tahapOf(b) === (jenis === 'survey' ? 'survey' : 'proses'))
        .map((b) => ({ siapa: b.konsumen, lokasi: '', ket: b.step || (jenis === 'survey' ? 'Bahan survey' : 'Sedang diproses') }));
    }
    return [];
  }, [jenis, me, c, bahan.list]);

  const kata = q.toLowerCase().split(/\s+/).filter(Boolean);
  const cocok = saran.filter((s) => kata.every((k) => `${s.siapa} ${s.lokasi}`.toLowerCase().includes(k)));
  const tampil = cocok.slice(0, 30);

  // Visit: konsumen di luar daftar prioritas dicari di database Cari konsumen
  const cariDb = jenis === 'visit' && q.replace(/\s/g, '').length >= 3;
  useEffect(() => {
    if (!cariDb) { setDb([]); setMencari(false); return; }
    const no = ++urut.current;
    setMencari(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/inject/cari?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' });
        const j = await res.json();
        if (no === urut.current) setDb(res.ok && Array.isArray(j?.list) ? (j.list as Calon[]) : []);
      } catch {
        if (no === urut.current) setDb([]);
      } finally {
        if (no === urut.current) setMencari(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, cariDb]);
  const dariDb: Saran[] = db.filter((d) => !cocok.some((s) => keyOf(s.siapa) === keyOf(d.nama)))
    .map((d) => ({ siapa: d.nama, lokasi: d.kecamatan, ket: ['Cari konsumen', d.unit].filter(Boolean).join(' · ') }));

  const toggle = (p: Pilihan) => setPilih((prev) => {
    const next = new Map(prev);
    const k = kunci(p);
    if (next.has(k)) next.delete(k); else next.set(k, p);
    return next;
  });
  const tulisSendiri = () => {
    const siapa = q.replace(/\s+/g, ' ').trim();
    if (!siapa) { setErr('Isi dulu siapa / apa aktivitasnya.'); return; }
    setErr('');
    // Visit yang diketik sendiri = by request CMO (konsumennya belum ada di database)
    setPilih((prev) => new Map(prev).set(kunci({ jenis, siapa }), { jenis, siapa: jenis === 'visit' ? siapa.toUpperCase() : siapa, lokasi: lokasi.trim(), ...(jenis === 'visit' ? { request: true } : {}) }));
    setQ(''); setLokasi('');
  };
  const ganti = (j: Jenis) => { setJenis(j); setQ(''); setLokasi(''); setErr(''); };

  const simpan = async () => {
    if (!pilih.size) { setErr('Pilih aktivitas dulu.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tgl, items: [...pilih.values()] }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j?.error || 'Gagal menyimpan.'); return; }
      onSaved(`${j.ditambah} aktivitas ditambahkan${j.dilewati ? `, ${j.dilewati} sudah ada` : ''}`);
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };

  const barisSaran = (s: Saran, key: string) => {
    const p = { jenis, siapa: s.siapa, lokasi: s.lokasi };
    const on = pilih.has(kunci(p)), ada = sudah.has(kunci(p));
    return (
      <li key={key} className="border-b border-neutral-200 last:border-0 dark:border-neutral-800">
        <button onClick={() => toggle(p)} disabled={ada} aria-pressed={on} className="flex min-h-14 w-full items-center gap-3 py-2 text-left disabled:opacity-55">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on
            ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900' : 'border-neutral-300 dark:border-neutral-600'}`}>
            {on && <Ico n="check" className="h-4 w-4" sw={3} />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{s.siapa}</span>
            <span className="block truncate text-[13px] text-neutral-500">{[s.lokasi, s.ket].filter(Boolean).join(' · ')}</span>
          </span>
          {ada && <span className={`${CHIP} shrink-0`}>Sudah di plan</span>}
        </button>
      </li>
    );
  };

  return (
    <Lembar judul={`Tambah aktivitas · ${tanggalPendek(tgl, hariIni)}`} onClose={onClose}>
      <div className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-1 pt-2 [scrollbar-width:none]">
        {daftarJenis.map((j) => <button key={j} onClick={() => ganti(j)} aria-pressed={j === jenis} className={PILIH(j === jenis)}>{JENIS_LABEL[j]}</button>)}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
        {manual ? (
          <>
            <label className="mt-3 block text-[13px] font-semibold text-neutral-500">{jenis === 'lainnya' ? 'Aktivitas' : 'Nama calon MA'}
              <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={80}
                placeholder={jenis === 'lainnya' ? 'mis. Kanvasing pasar Weleri' : 'mis. Pak Slamet (bengkel)'} className={`${FIELD} mt-1.5 h-12`} />
            </label>
            <label className="mt-3 block text-[13px] font-semibold text-neutral-500">Lokasi
              <input value={lokasi} onChange={(e) => setLokasi(e.target.value)} maxLength={60} placeholder="Kecamatan / desa" className={`${FIELD} mt-1.5 h-12`} />
            </label>
            <button onClick={tulisSendiri}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 text-sm font-semibold text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
              <span className="text-lg leading-none">+</span> Masukkan ke pilihan
            </button>
          </>
        ) : (
          <>
            <label className="mt-2 flex h-12 items-center gap-2 rounded-xl bg-neutral-100 px-3 dark:bg-neutral-800">
              <Ico n="search" className="h-5 w-5 shrink-0 text-neutral-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" autoComplete="off" maxLength={80}
                aria-label="Cari atau tulis nama"
                placeholder={jenis === 'visit' ? 'Cari nama konsumen' : jenis === 'maintain' ? 'Cari atau tulis nama MA' : 'Cari atau tulis nama konsumen'}
                className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-neutral-400" />
              {q && <button onClick={() => setQ('')} aria-label="Hapus pencarian" className="flex h-9 w-9 items-center justify-center text-neutral-500"><Ico n="x" className="h-4 w-4" sw={2.2} /></button>}
            </label>

            {tampil.length > 0 && (
              <>
                <p className="pt-3 text-[13px] font-semibold text-neutral-500">
                  {jenis === 'maintain' ? 'MA pegangan kamu' : jenis === 'visit' ? 'Konsumen prioritas' : 'Dari bahan survey'}
                </p>
                <ul>{tampil.map((s) => barisSaran(s, s.siapa + s.lokasi))}</ul>
                {cocok.length > tampil.length && <p className="py-2 text-center text-[13px] text-neutral-500">Masih ada {cocok.length - tampil.length} lagi. Ketik nama supaya lebih tepat.</p>}
              </>
            )}

            {jenis === 'visit' ? (
              <>
                {dariDb.length > 0 && (
                  <>
                    <p className="pt-3 text-[13px] font-semibold text-neutral-500">Di luar daftar prioritas (dari Cari konsumen)</p>
                    <ul className={mencari ? 'opacity-50' : ''}>{dariDb.map((s) => barisSaran(s, `db-${s.siapa}${s.lokasi}`))}</ul>
                  </>
                )}
                {!tampil.length && !dariDb.length && (
                  <p className="px-1 py-6 text-center text-sm leading-relaxed text-neutral-500">
                    {!cariDb ? 'Ketik minimal 3 huruf untuk mencari di database Cari konsumen.'
                      : mencari ? 'Mencari…' : 'Tidak ada di database. Kalau ini permintaan CMO, masukkan sebagai by request di bawah.'}
                  </p>
                )}
                {cariDb && !mencari && ![...cocok, ...dariDb].some((s) => keyOf(s.siapa) === keyOf(q)) && (
                  <div className="mt-3 rounded-2xl border border-dashed border-neutral-300 p-3 dark:border-neutral-700">
                    <p className="text-[13px] font-semibold text-neutral-500">Belum ada di database? Tambahkan by request CMO</p>
                    <input value={lokasi} onChange={(e) => setLokasi(e.target.value)} maxLength={60} aria-label="Lokasi by request" placeholder="Lokasi (kecamatan / desa)" className={`${FIELD} mt-2 h-11`} />
                    <button onClick={tulisSendiri}
                      className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-neutral-100 px-3 text-sm font-semibold dark:bg-neutral-800">
                      <span className="text-lg leading-none">+</span><span className="truncate">Pakai “{q.trim().toUpperCase()}” · by request CMO</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {q.trim() && !saran.some((s) => keyOf(s.siapa) === keyOf(q)) && (
                  <button onClick={tulisSendiri}
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-neutral-300 px-3 text-sm font-semibold text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                    <span className="text-lg leading-none">+</span><span className="truncate">Pakai “{q.trim()}”</span>
                  </button>
                )}
                {!tampil.length && !q.trim() && (
                  <p className="px-1 py-6 text-center text-sm leading-relaxed text-neutral-500">
                    {jenis === 'maintain' ? 'Daftar MA belum ada di pantauan. Tulis nama MA di kotak cari.' : 'Belum ada bahan survey. Tulis nama konsumen di kotak cari.'}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-200 px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 dark:border-neutral-800">
        {pilih.size > 0 && (
          <div className="mb-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {[...pilih.entries()].map(([k, p]) => (
              <button key={k} onClick={() => toggle(p)} aria-label={`Buang ${p.siapa} dari pilihan`}
                className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 pl-3 pr-2 text-[13px] font-semibold dark:bg-neutral-800">
                <span className="max-w-[160px] truncate">{JENIS_LABEL[p.jenis]} · {p.siapa}</span><Ico n="x" className="h-3.5 w-3.5 text-neutral-500" sw={2.4} />
              </button>
            ))}
          </div>
        )}
        {err && <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={simpan} disabled={busy || !pilih.size}
          className="min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">
          {busy ? 'Menyimpan…' : pilih.size ? `Tambah ${pilih.size} aktivitas` : 'Pilih aktivitas dulu'}
        </button>
      </div>
    </Lembar>
  );
}

/* ---------- Detail: hasil, catatan, status ---------- */
function DetailSheet({ x, onClose, onSaved }: { x: PlanItem; onClose: () => void; onSaved: (pesan: string) => void }) {
  const [status, setStatus] = useState<StatusPlan>(x.status);
  const [hasil, setHasil] = useState(x.hasil);
  const [catatan, setCatatan] = useState(x.wajib && x.id.startsWith('wajib:') ? '' : x.catatan);
  const [siapa, setSiapa] = useState(x.siapa);
  const [lokasi, setLokasi] = useState(x.lokasi);
  // Nama visit dari database dan map pencairan wajib tidak diketik ulang; visit by request CMO boleh diperbaiki
  const namaBisaDiubah = (x.jenis !== 'visit' || x.request) && !x.wajib;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const cepat = x.jenis === 'visit' ? ['Bertemu', 'Tidak bertemu'] : x.jenis === 'maintain' ? ['Ada bahan order', 'Belum ada order'] : [];
  const simpan = async () => {
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          id: x.id, status, hasil, catatan,
          ...(namaBisaDiubah && siapa.trim() && siapa.trim() !== x.siapa ? { siapa: siapa.trim() } : {}),
          ...(lokasi.trim() !== x.lokasi ? { lokasi: lokasi.trim() } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j?.error || 'Gagal menyimpan.'); return; }
      onSaved('Aktivitas tersimpan');
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };
  const hapus = async () => {
    if (!confirm(`Hapus ${x.siapa} dari plan?`)) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/plan?id=${encodeURIComponent(x.id)}`, { method: 'DELETE' });
      if (!res.ok) { setErr((await res.json())?.error || 'Gagal menghapus.'); return; }
      onSaved('Aktivitas dihapus');
    } catch { setErr('Koneksi bermasalah.'); } finally { setBusy(false); }
  };
  return (
    <Lembar judul={x.punyaku ? JENIS_LABEL[x.jenis] : `${JENIS_LABEL[x.jenis]} · ${shortName(x.nama)}`} onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        {namaBisaDiubah ? (
          <label className="mt-1 block text-[13px] font-semibold text-neutral-500">{x.jenis === 'lainnya' ? 'Aktivitas' : 'Nama'}
            <input value={siapa} onChange={(e) => setSiapa(e.target.value)} maxLength={80} className={`${FIELD} mt-1.5 h-12`} />
          </label>
        ) : <p className="mt-1 text-[17px] font-bold">{x.siapa}</p>}
        <label className="mt-3 block text-[13px] font-semibold text-neutral-500">Lokasi
          <input value={lokasi} onChange={(e) => setLokasi(e.target.value)} maxLength={60} placeholder="Kecamatan / desa" className={`${FIELD} mt-1.5 h-12`} />
        </label>
        {x.wajib && <p className="mt-2 rounded-xl bg-[#FFF4E0] p-3 text-[13px] leading-relaxed text-[#5C2F00] dark:bg-[#2A1E0C] dark:text-[#F7C98A]">Survey konsumen ini sudah selesai, jadi map pencairannya wajib dilengkapi pagi ini.</p>}

        <p className="mt-4 text-[13px] font-semibold text-neutral-500">Status</p>
        <div className="mt-1.5"><PillSeg full value={status} onChange={setStatus} options={[['rencana', 'Rencana'], ['selesai', 'Selesai'], ['batal', 'Batal']]} /></div>

        <label className="mt-4 block text-[13px] font-semibold text-neutral-500">Hasil
          <textarea value={hasil} onChange={(e) => setHasil(e.target.value)} maxLength={200} rows={2}
            placeholder={status === 'batal' ? 'Kenapa batal?' : 'mis. Bertemu, minat top up'} className={`${FIELD} mt-1.5 resize-none py-2.5`} />
        </label>
        {cepat.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {cepat.map((t) => (
              <button key={t} onClick={() => { setHasil(t); setStatus('selesai'); }} className={PILIH(hasil === t)}>{t}</button>
            ))}
          </div>
        )}
        <label className="mt-3 block text-[13px] font-semibold text-neutral-500">Catatan rencana
          <input value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={200} placeholder="mis. Jam 10 pagi" className={`${FIELD} mt-1.5 h-12`} />
        </label>

        {err && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">{err}</p>}
        <button onClick={simpan} disabled={busy}
          className="mt-4 min-h-12 w-full rounded-2xl bg-neutral-900 text-[15px] font-bold text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900">
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
        {!x.wajib && (
          <button onClick={hapus} disabled={busy} className="mt-1 min-h-11 w-full rounded-full text-sm font-semibold text-red-700 disabled:opacity-60 dark:text-red-400">Hapus dari plan</button>
        )}
      </div>
    </Lembar>
  );
}

/* ---------- Pilih hari ---------- */
function PilihHari({ tgl, hariIni, onChange }: { tgl: string; hariIni: string; onChange: (t: string) => void }) {
  const maks = addDays(hariIni, 7);
  return (
    <div className="flex items-center justify-between gap-2 px-2 pt-2">
      <button onClick={() => onChange(addDays(tgl, -1))} aria-label="Hari sebelumnya" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-neutral-100 dark:active:bg-neutral-900">
        <Ico n="left" className="h-5 w-5" sw={2} />
      </button>
      <button onClick={() => onChange(hariIni)} className="flex min-h-11 min-w-0 flex-col items-center justify-center px-2">
        <span className="text-[15px] font-bold">{tanggalPendek(tgl, hariIni)}</span>
        <span className="text-xs text-neutral-500">{tanggalPanjang(tgl)}</span>
      </button>
      <button onClick={() => onChange(addDays(tgl, 1))} disabled={tgl >= maks} aria-label="Hari berikutnya" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-neutral-100 disabled:opacity-30 dark:active:bg-neutral-900">
        <Ico n="right" className="h-5 w-5" sw={2} />
      </button>
    </div>
  );
}

/* ---------- Halaman ---------- */
export default function Plan({ c, me, akun, tim = [], staf = [], cabang = 'KENDAL', reloadKey = 0, onInsentif }: {
  c: Ctx | null; me: Orang | null; akun: Akun; tim?: string[]; staf?: Staf[]; cabang?: string; reloadKey?: number; onInsentif: () => void;
}) {
  const isOwner = akun.role === 'owner';
  const hariIni = todayJkt();
  const [tab, setTab] = useState<Tab>(isOwner ? 'tim' : 'saya');
  const [tgl, setTgl] = useState(hariIni);
  const { list, spv, setList, loading, err, reload } = usePlan(tgl, reloadKey);
  const bahan = useBahan(reloadKey);
  const [tambah, setTambah] = useState(false);
  const [detail, setDetail] = useState<PlanItem | null>(null);
  const [buka, setBuka] = useState<string | null>(null);
  const [modePilih, setMode] = useState<'plan' | 'report' | null>(null);   // null = otomatis
  const [ubahan, setUbahan] = useState<{ kunci: string; teks: string } | null>(null);   // teks report yang diketik ulang
  const [toast, setToast] = useState('');
  const [mengingatkan, setMengingatkan] = useState(false);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const mine = useMemo(() => urutkan(list.filter((x) => x.punyaku)), [list]);
  const r = ringkas(mine);
  const bisaUbah = tgl >= addDays(hariIni, -1);
  const sudah = useMemo(() => new Set(mine.map(kunci)), [mine]);
  const wajibBelum = mine.some((x) => x.wajib && x.status === 'rencana');
  const surveyBelum = mine.some((x) => x.jenis === 'survey' && x.status === 'rencana');
  const petunjuk = wajibBelum ? 'Selesaikan map pencairan dulu pagi ini.'
    : surveyBelum ? 'Ada survey. Dahulukan survey sebelum aktivitas lain.'
      : r.total < MIN_AKTIVITAS ? `Minimal ${MIN_AKTIVITAS} aktivitas sehari.`
        : r.selesai >= r.total ? 'Semua aktivitas selesai. Mantap!' : 'Centang tiap aktivitas begitu selesai.';

  const centang = async (x: PlanItem) => {
    const status: StatusPlan = x.status === 'selesai' ? 'rencana' : 'selesai';
    setList((prev) => prev.map((y) => (y.id === x.id ? { ...y, status } : y)));
    try {
      const res = await fetch('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: x.id, status }) });
      if (!res.ok) { setToast((await res.json())?.error || 'Gagal menyimpan.'); reload(); return; }
      if (x.id.startsWith('wajib:')) reload();
    } catch { setToast('Koneksi bermasalah.'); reload(); }
  };

  /* Tim (owner). Owner adalah SPV: aktivitas dan namanya tidak masuk plan tim, pengingat, maupun report. */
  const timList = useMemo(() => list.filter((x) => !x.spv), [list]);
  const staff = useMemo(() => {
    const bukan = new Set([...spv, ...list.filter((x) => x.spv).map((x) => x.nama)].map(keyOf));
    const m = new Map<string, { nama: string; brand: BrandId | ''; items: PlanItem[] }>();
    staf.filter((o) => !bukan.has(keyOf(o.nama))).forEach((o) => m.set(keyOf(o.nama), { ...o, items: [] }));
    timList.forEach((x) => {
      const k = keyOf(x.nama);
      const s = m.get(k) || { nama: x.nama, brand: '' as const, items: [] };
      s.items.push(x); m.set(k, s);
    });
    return [...m.values()].map((s) => ({ ...s, items: urutkan(s.items), r: ringkas(s.items) }))
      .sort((a, b) => URUT_BRAND[a.brand] - URUT_BRAND[b.brand] || a.nama.localeCompare(b.nama));
  }, [list, timList, staf, spv]);
  const rTim = ringkas(timList);
  const belumLengkap = staff.filter((s) => s.r.total < MIN_AKTIVITAS);
  const ingatkan = async (nama: string[]) => {
    setMengingatkan(true);
    try {
      const res = await fetch('/api/plan/ingat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nama }) });
      const j = await res.json();
      setToast(!res.ok ? j?.error || 'Pengingat gagal dikirim.' : j.terkirim ? `Pengingat terkirim ke ${j.terkirim} HP` : 'Belum ada HP staff ini yang menyalakan notifikasi');
    } catch { setToast('Koneksi bermasalah.'); } finally { setMengingatkan(false); }
  };

  /* Report */
  const sumber = isOwner ? timList : mine;
  const mode = modePilih ?? modeOtomatis(sumber);
  // Bahan survey aktif (keadaan sekarang) ikut di plan & report mulai kemarin: report kemarin sering baru dikirim
  // lewat tengah malam. Hari-hari yang lebih lama tidak, karena isi bahannya sudah berubah.
  // (staff: bahan miliknya / yang ia PIC; owner: semua)
  const bahanAktif = useMemo(() => (tgl >= addDays(hariIni, -1) ? bahan.list.filter((b) => b.status === 'aktif') : []), [bahan.list, tgl, hariIni]);
  const denganBahan = (plan: string) => [
    plan || (bahanAktif.length ? `*BAHAN SURVEY · ${cabang.toUpperCase()}*\n${tanggalPanjang(tgl)}` : ''),
    bahanAktif.length ? teksBahan(bahanAktif) : '',
  ].filter(Boolean).join('\n\n');
  const teksAsli = denganBahan(sumber.length ? teksPlan(sumber, tgl, cabang, mode, shortName) : '');
  // Teks boleh diubah dulu sebelum dikirim. Ubahan berlaku untuk hari dan jenis (plan / report) yang sedang dibuka.
  const kunciTeks = `${tgl}|${mode}`;
  const diubah = ubahan?.kunci === kunciTeks;
  const teks = diubah && ubahan ? ubahan.teks : teksAsli;
  const teksOtomatis = (items: PlanItem[]) => denganBahan(teksPlan(items, tgl, cabang, modeOtomatis(items), shortName));
  const labelWa = (items: PlanItem[]) => `Kirim ${modeOtomatis(items) === 'plan' ? 'plan' : 'report'} ke WhatsApp`;
  const salin = async () => {
    try { await navigator.clipboard.writeText(teks); setToast('Teks disalin'); } catch { setToast('Tidak bisa menyalin. Pakai Kirim ke WhatsApp.'); }
  };

  const TABS: [Tab, string][] = [...(isOwner ? [['tim', 'Tim'] as [Tab, string]] : []), ['saya', 'Plan saya'], ['bahan', 'Bahan'], ['report', 'Report']];
  const muat = (
    <div className="space-y-3 px-4 pt-4">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-[20px] bg-neutral-200/70 dark:bg-neutral-800/70" />)}
    </div>
  );
  const galat = (
    <div className="mx-4 mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
      {err}
      <button onClick={reload} className="mt-3 block min-h-11 rounded-full bg-red-700 px-5 font-semibold text-white">Coba lagi</button>
    </div>
  );

  return (
    <div className="pb-8">
      <UnderTabs value={tab} options={TABS} onChange={setTab} />
      {tab !== 'bahan' && <PilihHari tgl={tgl} hariIni={hariIni} onChange={setTgl} />}

      {tab === 'bahan' ? (
        <BahanSurvey akun={akun} me={me} tim={tim} reloadKey={reloadKey} onInsentif={onInsentif} />
      ) : err ? galat : loading && !list.length ? muat : tab === 'saya' ? (
        <>
          <section className="mx-4 mt-2 flex flex-col gap-2.5 rounded-[22px] bg-neutral-900 p-[18px] text-white dark:ring-1 dark:ring-neutral-800">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-bold tracking-wide text-white/80">PLAN · {tanggalPendek(tgl, hariIni).toUpperCase()}</span>
              <span className="whitespace-nowrap rounded-full bg-[#F5C451] px-2.5 py-1 text-xs font-bold text-[#3A2A00]">
                {r.total >= MIN_AKTIVITAS ? 'Plan lengkap' : `Kurang ${MIN_AKTIVITAS - r.total} aktivitas`}
              </span>
            </div>
            <p className="flex items-baseline gap-2"><span className="text-[32px] font-bold leading-none tracking-tight">{r.selesai}/{r.total}</span><span className="text-sm text-white/70">selesai</span></p>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#F5C451] transition-all" style={{ width: `${r.total ? Math.round((100 * r.selesai) / r.total) : 0}%` }} /></div>
            <p className="border-t border-white/15 pt-2.5 text-[13px] leading-snug text-white/80">{petunjuk}</p>
          </section>

          {mine.length === 0 ? (
            <Kosong art="bendera" title="Plan belum diisi"
              text={bisaUbah ? `Isi minimal ${MIN_AKTIVITAS} aktivitas: siapa yang mau didatangi dan di mana. Kalau ada survey, dahulukan survey.` : 'Tidak ada plan di hari ini.'} />
          ) : (
            <div className="flex flex-col gap-2.5 px-4 pt-4">
              {mine.map((x) => <Baris key={x.id} x={x} onCentang={bisaUbah ? () => centang(x) : undefined} onBuka={bisaUbah ? () => setDetail(x) : undefined} />)}
            </div>
          )}
          {bisaUbah && (
            <div className="px-4 pt-3">
              <button onClick={() => setTambah(true)}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-[15px] font-bold text-white active:scale-[0.99] dark:bg-white dark:text-neutral-900">
                <span className="text-lg leading-none">+</span> Tambah aktivitas
              </button>
            </div>
          )}
          {mine.length > 0 && (
            <div className="px-4 pt-2.5">
              <TombolWa teks={teksOtomatis(mine)} label={labelWa(mine)} onInfo={setToast} />
              {!isOwner && <button onClick={() => setTab('report')} className="mx-auto mt-1 flex min-h-11 items-center px-3 text-[13px] font-semibold text-neutral-600 underline underline-offset-4 dark:text-neutral-300">Ubah teksnya dulu</button>}
            </div>
          )}
        </>
      ) : tab === 'tim' ? (
        <>
          <section className="mx-4 mt-2 flex flex-col gap-2.5 rounded-[22px] bg-neutral-900 p-[18px] text-white dark:ring-1 dark:ring-neutral-800">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-bold tracking-wide text-white/80">PLAN TIM · {tanggalPendek(tgl, hariIni).toUpperCase()}</span>
              <span className="whitespace-nowrap rounded-full bg-[#F5C451] px-2.5 py-1 text-xs font-bold text-[#3A2A00]">{staff.length - belumLengkap.length}/{staff.length} staff lengkap</span>
            </div>
            <p className="flex items-baseline gap-2"><span className="text-[32px] font-bold leading-none tracking-tight">{rTim.selesai}/{rTim.total}</span><span className="text-sm text-white/70">aktivitas selesai</span></p>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-[#F5C451] transition-all" style={{ width: `${rTim.total ? Math.round((100 * rTim.selesai) / rTim.total) : 0}%` }} /></div>
            {tgl === hariIni && belumLengkap.length > 0 && (
              <button onClick={() => ingatkan(belumLengkap.map((s) => s.nama))} disabled={mengingatkan}
                className="mt-1 min-h-11 rounded-full bg-white px-4 text-sm font-bold text-neutral-900 disabled:opacity-60">
                {mengingatkan ? 'Mengirim…' : `Ingatkan ${belumLengkap.length} staff yang belum lengkap`}
              </button>
            )}
          </section>

          {staff.length > 0 && bisaUbah && <p className="px-4 pt-3 text-[13px] leading-snug text-neutral-500">Buka nama staff, lalu ketuk aktivitasnya untuk merevisi: centang, hasil, catatan, atau hapus.</p>}
          {staff.length === 0 ? (
            <Kosong art="bendera" title="Belum ada plan" text="Plan staff muncul di sini begitu mereka mengisinya." />
          ) : (
            <div className="flex flex-col gap-2.5 px-4 pt-4">
              {staff.map((s) => {
                const on = buka === s.nama;
                return (
                  <div key={s.nama} className="overflow-hidden rounded-[20px] border border-neutral-200 dark:border-neutral-800">
                    <button onClick={() => setBuka(on ? null : s.nama)} aria-expanded={on} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-50 dark:active:bg-neutral-900">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5"><span className="truncate text-[15px] font-bold">{shortName(s.nama)}</span><BrandChip b={s.brand} /></span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {s.r.total === 0 ? <span className={CHIP_MERAH}>Belum isi plan</span>
                            : s.r.total < MIN_AKTIVITAS ? <span className={CHIP_AMBER}>Kurang {MIN_AKTIVITAS - s.r.total} aktivitas</span>
                              : <span className={CHIP_HIJAU}>Plan lengkap</span>}
                          {s.items.some((x) => x.wajib && x.status === 'rencana') && <span className={CHIP_AMBER}>Map pencairan belum</span>}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[17px] font-bold leading-none">{s.r.selesai}/{s.r.total}</span>
                        <span className="text-xs text-neutral-500">selesai</span>
                      </span>
                      <Ico n={on ? 'up' : 'down'} className="h-[18px] w-[18px] shrink-0 text-neutral-500" sw={2} />
                    </button>
                    {on && (
                      <div className="flex flex-col gap-2 border-t border-neutral-200 p-3 dark:border-neutral-800">
                        {s.items.length ? s.items.map((x) => <Baris key={x.id} x={x} onCentang={bisaUbah ? () => centang(x) : undefined} onBuka={bisaUbah ? () => setDetail(x) : undefined} />)
                          : <p className="px-1 py-2 text-sm text-neutral-500">Belum ada aktivitas di hari ini.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {timList.length > 0 && (
            <div className="px-4 pt-3">
              <TombolWa teks={teksOtomatis(timList)} label={`${labelWa(timList).replace(' ke WhatsApp', '')} tim ke WhatsApp`} onInfo={setToast} />
              <button onClick={() => setTab('report')} className="mx-auto mt-1 flex min-h-11 items-center px-3 text-[13px] font-semibold text-neutral-600 underline underline-offset-4 dark:text-neutral-300">Ubah teksnya dulu</button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-center px-4 pt-2">
            <PillSeg value={mode} onChange={setMode} options={[['plan', 'Plan pagi'], ['report', 'Report sore']]} />
          </div>
          {!teksAsli ? (
            <Kosong art="bendera" title="Belum ada yang bisa dilaporkan" text="Report dibuat otomatis dari plan, centang realisasi, dan bahan survey di hari ini." />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 px-4 pt-3">
                <p className="text-[13px] leading-snug text-neutral-500">{diubah ? 'Teks sudah kamu ubah. Yang dikirim adalah teks di bawah ini.' : 'Ketuk teksnya kalau mau diubah dulu sebelum dikirim.'}</p>
                {diubah && <button onClick={() => setUbahan(null)} className="-my-2 min-h-11 shrink-0 px-1 text-[13px] font-semibold text-neutral-600 underline underline-offset-4 dark:text-neutral-300">Kembalikan</button>}
              </div>
              <div className="px-4 pt-2">
                <textarea value={teks} onChange={(e) => setUbahan({ kunci: kunciTeks, teks: e.target.value })} aria-label="Teks report"
                  rows={Math.min(40, Math.max(6, teks.split('\n').length + 2))} spellCheck={false}
                  style={{ fieldSizing: 'content' } as CSSProperties}
                  className="block w-full resize-none rounded-[20px] border border-neutral-200 bg-transparent p-4 text-sm leading-relaxed outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-300 dark:border-neutral-800 dark:focus:border-neutral-600 dark:focus:ring-neutral-700" />
              </div>
              <div className="px-4 pt-3"><TombolWa teks={teks} label="Kirim ke WhatsApp" onInfo={setToast} /></div>
              <div className="flex gap-2 px-4 pt-2.5">
                <button onClick={salin} className="min-h-12 flex-1 rounded-2xl border border-neutral-300 px-5 text-[15px] font-bold dark:border-neutral-700">Salin teks</button>
                <button onClick={() => shareText(teks)}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-neutral-300 px-5 text-[15px] font-bold dark:border-neutral-700">
                  <Ico n="share" className="h-[18px] w-[18px]" sw={2} />Aplikasi lain
                </button>
              </div>
            </>
          )}
        </>
      )}

      {tambah && (
        <TambahSheet c={c} me={me} tgl={tgl} hariIni={hariIni} sudah={sudah} reloadKey={reloadKey} onClose={() => setTambah(false)}
          onSaved={(pesan) => { setTambah(false); setToast(pesan); reload(); }} />
      )}
      {detail && <DetailSheet x={detail} onClose={() => setDetail(null)} onSaved={(pesan) => { setDetail(null); setToast(pesan); reload(); }} />}
      {toast && (
        <div className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-5">
          <div className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900">{toast}</div>
        </div>
      )}
    </div>
  );
}
