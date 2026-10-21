// Pemeriksaan kesehatan data pantauan untuk owner: kiriman Apps Script, rekap tarikan sales,
// dan sel di sheet pantauan yang kosong / rusak (#REF!, #DIV/0! terkirim sebagai kosong) atau tidak wajar.
import type { Blok, Performa } from './performa-types';
import { cekData } from './performa-calc';

export type Tingkat = 'aman' | 'waspada' | 'bahaya';
export type CekKesehatan = { id: string; judul: string; tingkat: Tingkat; isi: string; saran?: string };

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const rp = (v: number) => 'Rp ' + new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
const jamLalu = (iso: string, now: Date) => {
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return '';
  const m = Math.max(0, Math.round((now.getTime() - t) / 60_000));
  return m < 60 ? `${m} menit lalu` : m < 48 * 60 ? `${Math.floor(m / 60)} jam lalu` : `${Math.floor(m / 1440)} hari lalu`;
};
const BRAND: Record<string, string> = { mobilku: 'Mobilku', motorku: 'Motorku', cabang: 'Cabang' };
const kolom = (b: Blok, re: RegExp) => b.h.findIndex((h) => re.test(String(h ?? '')));

// Posisi CMO/MAO yang belum terisi orang (baris "MAO MOTOR", "CMO MOBIL" di pantauan)
export const posisiKosong = (nama: string) => /^(CMO|MAO)\s+(MOTOR|MOBIL)(KU)?$/i.test(String(nama || '').trim());

export function periksaData(data: Performa | null | undefined, now = new Date()): CekKesehatan[] {
  if (!data) return [{ id: 'kosong', judul: 'Data pantauan', tingkat: 'bahaya', isi: 'Belum ada data pantauan yang masuk ke aplikasi.' }];
  const out: CekKesehatan[] = [];

  // 1. Kiriman otomatis & tanggal data
  const cek = cekData(data, now);
  out.push({
    id: 'kiriman', judul: 'Kiriman pantauan',
    tingkat: cek.tingkat === 'gawat' ? 'bahaya' : cek.tingkat === 'telat' ? 'waspada' : 'aman',
    isi: cek.teks || `Kiriman terakhir ${jamLalu(data.dikirim, now)}, data per ${data.updated || '–'}.`,
    saran: cek.tingkat === 'aman' ? undefined : cek.sebab === 'bulan'
      ? 'Sambungkan file pantauan bulan ini ke Apps Script (SPREADSHEET_ID).'
      : 'Buka Apps Script pantauan → Pemicu: pastikan kirimPerformaLengkap jalan tiap 30 menit, lalu cek Eksekusi.',
  });

  // 2. Rekap tarikan sales (pemisahan motor sukarela)
  const sb = data.salesBrand;
  const cab = data.cabangTotal?.unit?.ini;
  if (!sb || !sb.orang?.length) {
    out.push({ id: 'tarikan', judul: 'Tarikan sales (motor sukarela)', tingkat: 'bahaya',
      isi: 'Kiriman tidak membawa rekap tab TARIKAN SALES, jadi motor sukarela ikut terhitung di achievement Mobilku.',
      saran: 'Di Apps Script, jalankan cekTarikan untuk melihat tab yang terbaca. Pastikan pemicunya kirimPerformaLengkap, bukan kirimPerforma.' });
  } else {
    const mob = sb.orang.reduce((s, o) => s + (o.mobilku?.unit || 0), 0);
    const mot = sb.orang.reduce((s, o) => s + (o.motorku?.unit || 0), 0);
    const ringkas = `Tab "${sb.sumber || 'tarikan'}": ${mob + mot} unit (mobil ${mob}, motor ${mot})${isNum(cab) ? `, pantauan cabang ${cab} unit` : ''}.`;
    if (sb.dipakai === false) {
      out.push({ id: 'tarikan', judul: 'Tarikan sales (motor sukarela)', tingkat: 'bahaya',
        isi: `Rekap tidak dipakai: ${sb.alasan || 'jumlahnya tidak cocok dengan pantauan'}. Motor sukarela belum dipisah.`,
        saran: 'Perbarui tab TARIKAN SALES di file pantauan sampai tanggal yang sama dengan pantauan.' });
    } else if (sb.dibawa) {
      out.push({ id: 'tarikan', judul: 'Tarikan sales (motor sukarela)', tingkat: 'waspada',
        isi: `Kiriman terbaru tidak membawa rekap tarikan, jadi aplikasi memakai rekap sebelumnya${sb.diterima ? ` (${jamLalu(sb.diterima, now)})` : ''}. ${ringkas}`,
        saran: 'Kemungkinan jadwal kirimPerforma lama masih jalan, atau tab tarikan sempat tidak terbaca. Cek Pemicu & Eksekusi di Apps Script.' });
    } else {
      const selisih = isNum(cab) ? Math.abs(mob + mot - cab) : 0;
      out.push({ id: 'tarikan', judul: 'Tarikan sales (motor sukarela)', tingkat: selisih ? 'waspada' : 'aman',
        isi: selisih ? `${ringkas} Selisih ${selisih} unit, tab tarikan mungkin belum diperbarui.` : ringkas,
        saran: selisih ? 'Tempel ulang tab TARIKAN SALES dengan data terbaru.' : undefined });
    }
  }

  // 3. Angka bulan lalu per brand
  if (!data.salesLalu) {
    out.push({ id: 'lalu', judul: 'Sales bulan lalu', tingkat: 'waspada',
      isi: 'Angka bulan lalu per brand tidak terbaca dari file pantauan bulan lalu.',
      saran: 'Pastikan file pantauan bulan lalu (nama sama, beda bulan) ada di Drive dan bisa dibuka akun Apps Script.' });
  }

  // 4. Isi sheet: sel kosong (rumus rusak), persen tidak wajar
  const blok = data.blok || [];
  for (const b of blok) {
    const brand = BRAND[b.s] || b.s;
    if (/rekrut/i.test(b.t)) {
      const j = kolom(b, /^JUMLAH$/i);
      const kosong = b.r.filter((r) => j >= 0 && r[j] == null).map((r) => String(r[0] ?? '').toUpperCase()).filter(Boolean);
      if (kosong.length) out.push({ id: `rekrut-${b.s}`, judul: `Rekrut & regist ${brand}`, tingkat: 'bahaya',
        isi: `Sel JUMLAH ${kosong.join(' & ')} kosong di sheet, jadi aplikasi menampilkan 0.`,
        saran: 'Tab BAHAN REVIEW MKT → kotak REKRUT: cek rumus di kolom JUMLAH (kemungkinan rujukannya rusak atau tab sumbernya belum diisi).' });
    }
    if (/^maintain$/i.test(b.t)) {
      const j = kolom(b, /^JUMLAH$/i), p = kolom(b, /PRESENTASE|%/i);
      if (j >= 0 && p >= 0 && b.r.some((r) => isNum(r[j]) && r[p] == null)) out.push({ id: `maintain-${b.s}`, judul: `Maintain ${brand}`, tingkat: 'waspada',
        isi: 'Kolom PRESENTASE dan DIFF TO TGT kosong padahal JUMLAH terisi. Di sheet biasanya tampil #REF!.',
        saran: 'Tab BAHAN REVIEW MKT → kotak MAINTAIN: perbaiki rujukan rumus PRESENTASE (target MA).' });
    }
    const a = kolom(b, /% ?ACH/i), t = kolom(b, /^TARGET$/i);
    if (a >= 0) {
      const aneh = b.r.filter((r) => isNum(r[a]) && (r[a] as number) > 10 && !/total/i.test(String(r[0] ?? '')));
      if (aneh.length) out.push({ id: `persen-${b.s}-${b.t}`, judul: `${b.t} ${brand}`, tingkat: 'waspada',
        isi: `% ACH tidak wajar: ${aneh.slice(0, 3).map((r) => `${String(r[0] ?? '').toLowerCase()} ${nf.format(Math.round((r[a] as number) * 100))}%`).join(', ')}${t >= 0 && isNum(aneh[0][t]) ? ` (target tertulis ${nf.format(aneh[0][t] as number)})` : ''}.`,
        saran: t >= 0 && isNum(aneh[0][t]) && (aneh[0][t] as number) < 1000 && /ticket/i.test(b.t)
          ? `Target ticket size harus dalam rupiah (mis. ${rp(90_000_000)}), bukan ${nf.format(aneh[0][t] as number)}.`
          : 'Cek satuan TARGET di tabel ini.' });
    }
  }

  // 5. Posisi kosong (info)
  const kosong = (data.orang || []).filter((o) => posisiKosong(o.nama)).map((o) => o.nama);
  if (kosong.length) out.push({ id: 'posisi', judul: 'Posisi kosong', tingkat: 'aman',
    isi: `${kosong.join(', ')} belum terisi orang. Di laporan ditandai "Posisi kosong".` });

  const urut: Record<Tingkat, number> = { bahaya: 0, waspada: 1, aman: 2 };
  return out.sort((x, y) => urut[x.tingkat] - urut[y.tingkat]);
}
