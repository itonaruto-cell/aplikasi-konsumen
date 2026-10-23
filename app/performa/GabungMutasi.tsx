'use client';
// Gabung beberapa PDF mutasi rekening (biasanya konsumen kirim per bulan) jadi satu PDF, langsung di HP.
// Urutan otomatis dari bulan terlama (kalau periodenya terbaca), bisa digeser manual.
import { useState } from 'react';
import { bacaMutasi, labelBulan } from '../../lib/mutasi';
import { bacaPdf, gabungPdf } from './pdf-alat';

type Item = { id: string; file: File; label: string; urut: string; password?: string };
const mb = (n: number) => `${(n / 1_048_576).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;

async function bagikan(file: File) {
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

export default function GabungMutasi({ nama }: { nama: string }) {
  const [list, setList] = useState<Item[]>([]);
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState('');

  const tambah = async (files: File[]) => {
    setPesan('');
    const baru: Item[] = [];
    for (const [i, f] of files.entries()) {
      setSibuk(`Membaca ${i + 1}/${files.length}: ${f.name}…`);
      let label = '', urut = '', password: string | undefined;
      try {
        const r = await bacaPdf(f);
        password = r.password;
        const h = bacaMutasi(r.baris);
        if (h?.bulan.length) {
          const a = h.bulan[0].bulan, z = h.bulan[h.bulan.length - 1].bulan;
          urut = a;
          label = `${h.bank} · ${labelBulan(a)} ${a.slice(0, 4)}${z !== a ? ` – ${labelBulan(z)} ${z.slice(0, 4)}` : ''}`;
        }
      } catch (e) {
        // PDF dikunci dan password tidak diisi: lewati file ini. Selain itu tetap boleh digabung (urutan manual).
        if (/password/i.test((e as Error)?.message || '')) { setPesan(`${f.name} dilewati: ${(e as Error).message}`); continue; }
      }
      baru.push({ id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`, file: f, label, urut, password });
    }
    setSibuk('');
    // Urutkan dari bulan terlama; yang periodenya tidak terbaca di belakang (urutan pilih)
    setList((x) => [...x, ...baru].map((it, i) => ({ it, i })).sort((a, b) => (a.it.urut || '9999').localeCompare(b.it.urut || '9999') || a.i - b.i).map((x) => x.it));
  };
  const geser = (i: number, d: -1 | 1) => setList((x) => { const y = [...x]; const j = i + d; if (j < 0 || j >= y.length) return x; [y[i], y[j]] = [y[j], y[i]]; return y; });
  const hapus = (id: string) => setList((x) => x.filter((it) => it.id !== id));
  const gabung = async () => {
    setPesan('');
    try {
      const judul = `MUTASI REKENING${nama.trim() ? ` - ${nama.trim().toUpperCase()}` : ''}`;
      const bytes = await gabungPdf(list.map((it) => ({ file: it.file, password: it.password })), judul, setSibuk);
      const file = new File([bytes.buffer as ArrayBuffer], `${judul}.pdf`.replace(/[\\/:*?"<>|]+/g, ' '), { type: 'application/pdf' });
      setSibuk('');
      await bagikan(file);
      setPesan(`PDF gabungan siap: ${file.name} (${mb(file.size)})${file.size > 10_000_000 ? ' — lebih dari 10 MB, mungkin terlalu besar untuk sebagian aplikasi.' : ''}`);
    } catch (e) { setSibuk(''); setPesan((e as Error)?.message || 'PDF gagal digabung. Coba lagi.'); }
  };

  return (
    <section className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-[15px] font-bold">Gabung PDF mutasi rekening</p>
      <p className="mt-0.5 text-[12px] leading-snug text-neutral-500">Pilih PDF mutasi per bulan dari konsumen, jadikan 1 PDF. Urutan otomatis dari bulan terlama.</p>
      {list.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {list.map((it, i) => (
            <li key={it.id} className="flex items-center gap-2 rounded-xl bg-neutral-100 px-2 py-1.5 dark:bg-neutral-900">
              <span className="w-5 shrink-0 text-center text-[12px] font-bold text-neutral-500">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{it.file.name}</span>
                <span className="block text-[12px] text-neutral-500">{it.label || 'Periode tidak terbaca'}{it.password ? ' · berpassword' : ''}</span>
              </span>
              <button onClick={() => geser(i, -1)} disabled={i === 0 || !!sibuk} aria-label={`Naikkan ${it.file.name}`} className="h-9 w-8 rounded-lg text-[16px] disabled:opacity-25">↑</button>
              <button onClick={() => geser(i, 1)} disabled={i === list.length - 1 || !!sibuk} aria-label={`Turunkan ${it.file.name}`} className="h-9 w-8 rounded-lg text-[16px] disabled:opacity-25">↓</button>
              <button onClick={() => hapus(it.id)} disabled={!!sibuk} aria-label={`Hapus ${it.file.name}`} className="h-9 w-8 rounded-lg text-[15px] text-red-700 disabled:opacity-25 dark:text-red-400">✕</button>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 flex gap-2">
        <label className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border border-neutral-300 text-[14px] font-semibold dark:border-neutral-700 ${sibuk ? 'pointer-events-none opacity-50' : ''}`}>
          + Pilih PDF
          <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" aria-label="Pilih PDF mutasi untuk digabung"
            onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; if (fs.length) tambah(fs); }} />
        </label>
        {list.length > 1 && (
          <button onClick={gabung} disabled={!!sibuk} className="min-h-11 flex-1 rounded-xl bg-neutral-900 px-3 text-[14px] font-bold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900">
            Gabung {list.length} PDF jadi 1
          </button>
        )}
      </div>
      {(sibuk || pesan) && <p role="status" className="mt-2 rounded-xl bg-neutral-100 px-3 py-2 text-[13px] leading-snug dark:bg-neutral-900">{sibuk || pesan}</p>}
    </section>
  );
}
