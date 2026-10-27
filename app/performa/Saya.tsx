'use client';
import type { ReactNode } from 'react';
import { periksaData } from '../../lib/kesehatan-data';
import type { Orang } from '../../lib/performa-types';
import { badges, ranking, streak, type Ctx } from '../../lib/performa-calc';
import { ThemeToggle } from '../theme';
import { OrangDetail, nama, type Push } from './ui';
import { Avatar, Card, Ico } from './parts';
import { MONITORING_MOTORKU } from './Rute';
import { NotifSetting } from './Notif';

type Me = { email: string; name?: string; role: 'owner' | 'spv' | 'konsumen' | 'tim' };

export default function Saya({ c, me, akun, push, onCari, onAktivitas, onWrapped, onBahan, onInsentif, onInject, onJuara, onPengumuman, onLaporan, onProspek, onSinkron, onSK, onKesehatan, onBanding, onPdf, onReport, onProyeksi, onMutasi, onSurat, onAlatPdf }: {
  c: Ctx; me: Orang | null; akun: Me; push: Push; onCari?: () => void; onAktivitas?: () => void; onWrapped?: () => void;
  onBahan?: () => void; onInsentif?: () => void; onInject?: () => void; onJuara?: () => void; onPengumuman?: () => void; onLaporan?: () => void; onProspek?: () => void; onSinkron?: () => void; onSK?: () => void; onKesehatan?: () => void; onBanding?: () => void; onPdf?: () => void; onReport?: () => void; onProyeksi?: () => void; onMutasi?: () => void; onSurat?: () => void; onAlatPdf?: () => void;
}) {
  const amount = ranking(c, 'amount');
  const rank = me ? amount.find((r) => r.o === me)?.rank || 0 : 0;
  const st = me ? streak(c, me.nama) : 0;
  const mine = me ? badges(c).map((b) => ({ ...b, on: b.holders.includes(me) })) : [];
  const ico = (n: string) => <Ico n={n} className="h-5 w-5 shrink-0 text-neutral-500" />;
  const sehat = onKesehatan ? periksaData(c.data) : null;
  const masalah = sehat ? sehat.filter((x) => x.tingkat === 'bahaya').length : 0;
  const waspada = sehat ? sehat.filter((x) => x.tingkat === 'waspada').length : 0;
  type Item = { judul: string; sub: string; ico: ReactNode; on?: () => void; badge?: string; badgeCls?: string };
  const GRUP: [string, Item[]][] = [
    ['Kerja harian', [
      { judul: 'Database prospek', sub: 'Input, impor Google Maps, follow up dengan foto bukti', ico: ico('users'), on: onProspek },
      { judul: 'Bahan survey', sub: 'Belum disurvey dan sedang diproses', ico: ico('pin'), on: onBahan },
      { judul: 'Inject P3', sub: 'Ajukan konsumen, unduh daftar untuk HO', ico: ico('users'), on: onInject },
      { judul: 'Tanya SK', sub: 'Tanya jawab & dokumen SK approval, survey, BPKB, MobilKu', ico: ico('list'), on: onSK },
    ]],
    ['Survey & dokumen', [
      { judul: 'Report survey (6C + 1E + 1P)', sub: 'Hasil survey per unsur, salin langsung ke WA', ico: ico('list'), on: onReport },
      { judul: 'PDF berkas survey', sub: 'Foto per kategori → PDF, bagikan sekaligus ke WA', ico: ico('share'), on: onPdf },
      { judul: 'Alat PDF', sub: 'JPG↔PDF, gabung, pisah, putar, kecilkan, buka password', ico: ico('share'), on: onAlatPdf },
      { judul: 'Rekap mutasi rekening', sub: 'PDF Mandiri / BCA / BRI / BNI → kredit per bulan & rata-rata, ke WA', ico: ico('chart'), on: onMutasi },
      { judul: 'Form banding (F-761)', sub: 'Reason, analisa 6C, SWOT & foto → Excel untuk G Suite', ico: ico('edit'), on: onBanding },
      { judul: 'Surat IM / berita acara', sub: 'IM SAKPOLE, Copcan ubah POT, Take Over, Tidak revisi STNK → Word', ico: ico('list'), on: onSurat },
    ]],
    ['Laporan & performa', [
      { judul: 'Proyeksi sales', sub: 'Tercapai + bahan vs target & bulan lalu', ico: ico('up'), on: onProyeksi },
      { judul: 'Laporan bergambar', sub: 'Achievement, aktivitas & follow up, siap unduh', ico: ico('chart'), on: onLaporan },
      { judul: 'Papan juara', sub: 'Peringkat amount, unit, visit, dan maintain', ico: ico('trophy'), on: onJuara },
      { judul: 'Insentif', sub: 'Hasil hitungan HO dan simulasi bulan ini', ico: ico('value'), on: onInsentif },
    ]],
    ['Kelola (owner)', [
      { judul: 'Kesehatan data', sub: masalah || waspada ? 'Ada data pantauan yang perlu dicek' : 'Kiriman, tarikan sales & isi sheet pantauan', ico: ico('check'), on: onKesehatan,
        badge: masalah ? `${masalah} masalah` : waspada ? `${waspada} cek` : 'Aman',
        badgeCls: masalah ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' : waspada ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300' : 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' },
      { judul: 'Perbarui database konsumen', sub: 'Dari tab KA, SALES & MAPS ke Sheet1', ico: ico('edit'), on: onSinkron },
      { judul: 'Buat pengumuman', sub: 'Disematkan di Pantau dan dikirim ke HP tim', ico: ico('share'), on: onPengumuman },
    ]],
  ];
  const role = akun.role === 'owner' ? 'Owner' : akun.role === 'spv' ? 'SPV · plan & bahan tim' : akun.role === 'konsumen' ? 'Tim + database konsumen' : 'Tim';

  return (
    <div className="px-4 pb-10 pt-4">
      {me ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[22px] font-bold leading-tight tracking-tight">{nama(me.nama)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {me.brand && <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[13px] dark:bg-neutral-900">{nama(me.brand)}</span>}
                {rank > 0 && <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[13px] dark:bg-neutral-900">Peringkat {rank} amount</span>}
                {st > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-[#FFF4E0] px-2.5 py-1 text-[13px] font-bold text-[#8A4700] dark:bg-[#2A1E0C] dark:text-[#F7C98A]">
                    <Ico n="flame" className="h-3.5 w-3.5" fill="#F2A33A" sw={1.6} />{st} hari beruntun
                  </span>
                )}
              </div>
            </div>
            <Avatar o={me} size={72} className="text-2xl" />
          </div>

          {c.sales.includes(me) && (<>
          <p className="mt-5 text-[15px] font-bold">Badge kamu</p>
          <div className="mt-2 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {mine.map((b) => (
              <div key={b.id} className={`flex w-[124px] shrink-0 flex-col gap-1.5 rounded-2xl p-3 ${b.on
                ? 'bg-neutral-900 text-white dark:ring-1 dark:ring-neutral-800'
                : 'border border-dashed border-neutral-300 text-neutral-500 dark:border-neutral-700'}`}>
                <span className={b.on ? 'text-[#F5C451]' : ''}><Ico n={b.on ? 'trophy' : 'lock'} className="h-6 w-6" sw={1.8} /></span>
                <span className="text-sm font-bold">{b.label}</span>
                <span className={`text-xs ${b.on ? 'text-neutral-300' : ''}`}>{b.desc}</span>
              </div>
            ))}
          </div>
          </>)}

          <div className="mt-6">
            <OrangDetail o={me} rank={rank} total={amount.filter((r) => r.rank).length} data={c.data} push={push} hideHeader />
          </div>
        </>
      ) : (
        <Card className="p-4">
          <p className="text-[15px] font-bold">{akun.name || akun.email}</p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-500">
            Akun ini belum tertaut ke nama di pantauan cabang, jadi performa pribadi belum bisa ditampilkan.
            {akun.role === 'owner'
              ? ' Isi kolom C (NAMA) di tab AKSES dengan nama persis seperti di sheet pantauan untuk tiap email anggota.'
              : ' Minta owner mengisi nama kamu di kolom C tab AKSES.'}
          </p>
        </Card>
      )}

      {GRUP.map(([judul, isi]) => {
        const ada = isi.filter((x) => x.on);
        if (!ada.length) return null;
        return (
          <section key={judul}>
            <p className="mt-8 text-[15px] font-bold">{judul}</p>
            <Card className="mt-2 overflow-hidden">
              {ada.map((x) => (
                <button key={x.judul} onClick={x.on} className="flex min-h-14 w-full items-center gap-3 border-b border-neutral-200 px-4 py-2 text-left last:border-0 active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
                  {x.ico}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px]">{x.judul}</span>
                    <span className="block text-[13px] text-neutral-500">{x.sub}</span>
                  </span>
                  {!!x.badge && <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${x.badgeCls}`}>{x.badge}</span>}
                  <Ico n="right" className="h-[18px] w-[18px] text-neutral-400" sw={2} />
                </button>
              ))}
            </Card>
          </section>
        );
      })}

      <p className="mt-8 text-[15px] font-bold">Akun</p>
      <Card className="mt-2 overflow-hidden">
        <div className="flex min-h-14 items-center gap-3 border-b border-neutral-200 px-4 py-2.5 dark:border-neutral-800">
          <Ico n="user" className="h-5 w-5 text-neutral-500" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">{akun.email}</span>
            <span className="block text-[13px] text-neutral-500">Akses: {role}</span>
          </span>
        </div>
        <NotifSetting nama={me?.nama || ''} />
        <div className="flex min-h-14 items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
          <span className="flex-1 text-[15px]">Mode terang / gelap</span>
          <ThemeToggle className="h-11 w-11 border border-neutral-200 dark:border-neutral-800" />
        </div>
        {onWrapped && (
          <button onClick={onWrapped} className="flex min-h-14 w-full items-center gap-3 border-b border-neutral-200 px-4 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
            <Ico n="trophy" className="h-5 w-5 text-[#B07A00] dark:text-[#F5C451]" />
            <span className="flex-1 text-[15px]">Kendal Wrapped bulan ini</span>
            <Ico n="right" className="h-[18px] w-[18px] text-neutral-400" sw={2} />
          </button>
        )}
        {onAktivitas && (
          <button onClick={onAktivitas} className="flex min-h-14 w-full items-center gap-3 border-b border-neutral-200 px-4 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
            <Ico n="users" className="h-5 w-5 text-neutral-500" />
            <span className="flex-1 text-[15px]">Aktivitas tim (siapa yang buka aplikasi)</span>
            <Ico n="right" className="h-[18px] w-[18px] text-neutral-400" sw={2} />
          </button>
        )}
        {onCari && (
          <button onClick={onCari} className="flex min-h-14 w-full items-center gap-3 border-b border-neutral-200 px-4 text-left active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
            <Ico n="search" className="h-5 w-5 text-neutral-500" />
            <span className="flex-1 text-[15px]">Cari konsumen</span>
            <Ico n="right" className="h-[18px] w-[18px] text-neutral-400" sw={2} />
          </button>
        )}
        <a href={MONITORING_MOTORKU} target="_blank" rel="noreferrer"
          className="flex min-h-14 items-center gap-3 border-b border-neutral-200 px-4 active:bg-neutral-50 dark:border-neutral-800 dark:active:bg-neutral-900">
          <Ico n="map" className="h-5 w-5 text-neutral-500" />
          <span className="flex-1 text-[15px]">Monitoring Visit Motorku</span>
          <Ico n="right" className="h-[18px] w-[18px] text-neutral-400" sw={2} />
        </a>
        <a href="/api/auth/logout" className="flex min-h-14 items-center gap-3 px-4 text-red-700 active:bg-neutral-50 dark:text-red-400 dark:active:bg-neutral-900">
          <Ico n="logout" className="h-5 w-5" />
          <span className="flex-1 text-[15px] font-semibold">Keluar</span>
        </a>
      </Card>
    </div>
  );
}
