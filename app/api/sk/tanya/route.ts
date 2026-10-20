import { NextResponse, type NextRequest } from 'next/server';
import { sesiProspek } from '../../../../lib/prospek-store';
import { indeksSK } from '../../../../lib/sk-store';
import { cari, type Sumber } from '../../../../lib/sk-cari';
import { jawabAI } from '../../../../lib/sk-jawab';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Riwayat = { q: string; a: string }[];

// Tanya jawab berdasarkan ringkasan SK. Selalu mengembalikan bagian SK yang relevan;
// kalau ANTHROPIC_API_KEY terpasang, juga jawaban yang disusun hanya dari bagian-bagian itu.
export async function POST(req: NextRequest) {
  const x = await sesiProspek(req);
  if (!x) return NextResponse.json({ error: 'Silakan login dulu.' }, { status: 401 });
  const b = await req.json().catch(() => null) as { q?: unknown; riwayat?: unknown } | null;
  const q = typeof b?.q === 'string' ? b.q.trim().slice(0, 1000) : '';
  if (q.length < 3) return NextResponse.json({ error: 'Tulis pertanyaannya dulu.' }, { status: 400 });
  const riwayat: Riwayat = Array.isArray(b?.riwayat)
    ? (b!.riwayat as Riwayat).filter((r) => r && typeof r.q === 'string' && typeof r.a === 'string').slice(-2).map((r) => ({ q: r.q.slice(0, 600), a: r.a.slice(0, 2000) }))
    : [];
  try {
    const { ix, pot } = await indeksSK();
    if (!pot.length) return NextResponse.json({ error: 'Dokumen SK belum dimuat. Minta owner memperbarui dokumen SK dulu.' }, { status: 404 });
    // Pertanyaan lanjutan ("kalau motor?") ikut memakai kata dari pertanyaan sebelumnya
    let sumber: Sumber[] = cari(ix, q, 12);
    if (riwayat.length) {
      const lanjut = cari(ix, `${riwayat[riwayat.length - 1].q} ${q}`, 12);
      const ada = new Set(sumber.map((s) => s.dok + s.hal + s.isi.slice(0, 40)));
      sumber = [...sumber.slice(0, 8), ...lanjut.filter((s) => !ada.has(s.dok + s.hal + s.isi.slice(0, 40)))].slice(0, 12).map((s, i) => ({ ...s, n: i + 1 }));
    }
    if (!sumber.length) return NextResponse.json({ jawaban: '', sumber: [], ai: false, catatan: 'Tidak ada bagian SK yang cocok. Coba pakai istilah lain (misalnya kode deviasi, nama dokumen, atau nama program).' });
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const jawaban = await jawabAI(q, sumber, riwayat);
        const dipakai = new Set([...jawaban.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1])));
        const tampil = sumber.filter((s) => dipakai.has(s.n));
        return NextResponse.json({ jawaban, sumber: tampil.length ? tampil : sumber.slice(0, 3), ai: true });
      } catch (err) {
        console.error('Jawaban AI gagal, tampilkan bagian SK saja:', err);
        return NextResponse.json({ jawaban: '', sumber: sumber.slice(0, 4), ai: false, catatan: 'Penyusun jawaban sedang bermasalah, jadi ini bagian SK yang paling sesuai.' });
      }
    }
    return NextResponse.json({ jawaban: '', sumber: sumber.slice(0, 4), ai: false });
  } catch (err) {
    console.error('Gagal menjawab pertanyaan SK:', err);
    return NextResponse.json({ error: 'Pertanyaan belum bisa dijawab. Coba lagi sebentar.' }, { status: 500 });
  }
}
