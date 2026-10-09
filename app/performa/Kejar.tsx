'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Orang } from '../../lib/performa-types';
import { brandOf, keyOf, todayJkt, type CekData, type Ctx } from '../../lib/performa-calc';
import { kurangAktivitas, tunjanganCMO, type Skema } from '../../lib/insentif';
import { useBahan } from './Bahan';
import { CABANG, dariPantauan } from './Insentif';
import { rp } from './ui';
import { Ico, Line, shortName } from './parts';

// Kartu "Kejar bulan ini" di Pantau:
// - sisa target unit & amount dibanding bahan survey yang masih aktif (per PIC, dan cabang Mobilku untuk owner)
// - progres tunjangan: CMO dari aktivitas visit + OI, MAO dari MA retail yang ordernya sudah cair (bahan survey)
// Owner melihat semua staff Mobilku; staff hanya dirinya sendiri. Tidak tampil kalau data pantauan masih bulan lalu.

type Baris = {
  key: string; nama: string; peran: 'CMO' | 'MAO' | 'Cabang';
  sisaUnit: number | null; sisaAmt: number | null;
  bahan: { n: number; amt: number };
  tunjangan?: { teks: string; v: number; maks: boolean };
};

const sisa = (target?: number | null, ini?: number | null) =>
  typeof target === 'number' && target > 0 ? Math.max(0, target - (ini || 0)) : null;

export default function Kejar({ c, me, spv, isOwner, reloadKey = 0, cek, onBahan }: {
  c: Ctx; me: Orang | null; spv: Orang | null; isOwner: boolean; reloadKey?: number; cek: CekData; onBahan: () => void;
}) {
  const [skema, setSkema] = useState<Skema | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/insentif', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setSkema((j?.skema as Skema | null) || null); }).catch(() => {});
    return () => { alive = false; };
  }, [reloadKey]);
  const bahan = useBahan(reloadKey);

  const baris = useMemo<Baris[]>(() => {
    const bulan = c.today.slice(0, 7);
    const aktif = bahan.list.filter((b) => b.status === 'aktif');
    const punya = (nama: string) => (b: { pic: string; nama: string }) => keyOf(b.pic || b.nama) === keyOf(nama);
    const jumlah = (list: { nominal: number }[]) => ({ n: list.length, amt: list.reduce((s, b) => s + (b.nominal || 0), 0) });
    const orang = (c.data.orang || []).filter((o) => brandOf(o) === 'mobilku' && o !== spv && (isOwner || o === me));
    const out: Baris[] = orang.map((o) => {
      const mao = !!(o.maintain || o.rekrut);
      let tunjangan: Baris['tunjangan'];
      if (!mao && skema?.cmo?.tunjangan) {
        const tj = skema.cmo.tunjangan;
        const akt = o.visit ? (o.visit.total || 0) + (o.oi?.total || 0) : null;
        if (akt !== null) {
          const lagi = kurangAktivitas(skema.cmo, akt);
          const kini = tunjanganCMO(skema.cmo, akt);
          tunjangan = {
            v: akt / tj.target, maks: !lagi,
            teks: `Aktivitas ${akt}/${tj.target}` + (lagi ? ` · +${lagi.kurang} lagi → tunjangan ${rp(lagi.nilai)}` : ` · tunjangan ${rp(kini)}`)
              + (lagi && kini ? ` (sekarang ${rp(kini)})` : ''),
          };
        }
      }
      if (mao && skema?.mao?.maProduktif?.length) {
        // MA retail (bukan aggregator) yang ordernya sudah cair bulan ini, dihitung sekali per MA
        const ma = new Set(bahan.list.filter((b) => b.status === 'cair' && b.sumber === 'Agent' && !b.agg && punya(o.nama)(b)
          && todayJkt(new Date(b.diubah)).slice(0, 7) === bulan).map((b) => keyOf(b.ket) || b.id));
        const tier = [...skema.mao.maProduktif].sort((a, b) => a.min - b.min);
        const n = ma.size;
        const kini = tier.filter((t) => n >= t.min).pop();
        const next = tier.find((t) => n < t.min);
        const puncak = tier[tier.length - 1];
        tunjangan = {
          v: puncak ? n / puncak.min : 0, maks: !next,
          teks: `MA retail order cair ${n}` + (next ? ` · +${next.min - n} lagi → tunjangan ${rp(next.bonus)}` : ` · tunjangan ${rp(kini?.bonus)}`)
            + ' · syarat performa 80%',
        };
      }
      return {
        key: o.nama, nama: shortName(o.nama), peran: mao ? 'MAO' : 'CMO',
        sisaUnit: sisa(o.unit?.target, o.unit?.ini), sisaAmt: sisa(o.amount?.target, o.amount?.ini),
        bahan: jumlah(aktif.filter(punya(o.nama))), tunjangan,
      };
    });
    if (isOwner) {
      // Target cabang Mobilku dari tabel pantauan; kalau tidak ada, jumlah target anggota Mobilku
      const t = dariPantauan(c, CABANG);
      const mob = (c.data.orang || []).filter((o) => brandOf(o) === 'mobilku');
      const tot = (w: 'unit' | 'amount') => mob.reduce((s, o) => s + (o[w]?.target || 0), 0) || null;
      out.unshift({
        key: CABANG, nama: 'Cabang Mobilku', peran: 'Cabang',
        sisaUnit: sisa(t.targetUnit ?? tot('unit'), t.unit), sisaAmt: sisa(t.targetAmount ?? tot('amount'), t.amount), bahan: jumlah(aktif),
      });
    }
    return out;
  }, [c, me, spv, isOwner, skema, bahan.list]);

  if (cek.bedaBulan || !baris.length) return null;

  return (
    <section className="mx-4 mt-3 overflow-hidden rounded-[20px] border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between gap-2 pl-4 pr-1 pt-2">
        <h2 className="text-[15px] font-bold">Kejar bulan ini</h2>
        <button onClick={onBahan} className="flex min-h-10 items-center gap-0.5 px-3 text-[13px] font-semibold text-neutral-500">
          Bahan survey<Ico n="right" className="h-4 w-4" sw={2} />
        </button>
      </div>
      {baris.map((b) => {
        const kurangBahan = b.sisaUnit !== null ? Math.max(0, Math.ceil(b.sisaUnit) - b.bahan.n) : null;
        const status = b.sisaUnit === null ? null
          : b.sisaUnit === 0 ? { t: 'Unit tercapai', c: 'bg-green-50 text-green-800 dark:bg-green-400/15 dark:text-green-300' }
            : kurangBahan === 0 ? { t: 'Cukup kalau semua cair', c: 'bg-green-50 text-green-800 dark:bg-green-400/15 dark:text-green-300' }
              : { t: `Kurang ${kurangBahan} bahan`, c: 'bg-[#FFF4E0] text-[#8A4700] dark:bg-[#2A1E0C] dark:text-[#F7C98A]' };
        const amtKurang = b.sisaAmt !== null && b.sisaAmt > b.bahan.amt ? b.sisaAmt - b.bahan.amt : 0;
        return (
          <div key={b.key} className="border-t border-neutral-100 px-4 py-3 first-of-type:border-t-0 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <b className="truncate text-[15px]">{b.nama}</b>
                {b.peran !== 'Cabang' && <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{b.peran}</span>}
              </span>
              {status && !bahan.loading && <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${status.c}`}>{status.t}</span>}
            </div>
            {b.sisaUnit !== null && b.sisaUnit > 0 && (
              <p className="mt-1 text-[13px] leading-snug text-neutral-600 dark:text-neutral-400">
                Sisa target {Math.ceil(b.sisaUnit)} unit{b.sisaAmt ? ` · ${rp(b.sisaAmt)}` : ''}
                {bahan.loading ? '' : <> · bahan aktif <b className="text-neutral-900 dark:text-white">{b.bahan.n}</b>{b.bahan.n ? ` · ${rp(b.bahan.amt)}` : ''}</>}
                {!bahan.loading && amtKurang > 0 && b.bahan.n > 0 && <span className="text-[#8A4700] dark:text-[#F7C98A]"> · amount masih kurang {rp(amtKurang)}</span>}
              </p>
            )}
            {b.tunjangan && (
              <div className="mt-2">
                <Line v={b.tunjangan.v} className="h-[5px]" color={b.tunjangan.maks ? 'bg-[#1FA463]' : 'bg-[#E0A800]'} />
                <p className="mt-1 text-[12px] leading-snug text-neutral-500">{b.tunjangan.teks}</p>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
