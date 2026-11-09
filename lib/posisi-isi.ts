// Orang yang sudah mengisi posisi yang di sheet pantauan masih tertulis kosong ("MAO MOTOR", "CMO MOTORKU").
// Selama sheet belum memakai namanya, aplikasi menampilkan baris itu atas nama orang tersebut.
// Kalau sheet pantauan sudah memakai nama aslinya, baris kosong itu hilang dan pemetaan ini tidak berpengaruh.
export const ISI_POSISI: Record<string, string> = {
  'MAO MOTOR': 'AGUS',
  'CMO MOTOR': 'YOGA',
};

// Nama pengisi untuk baris posisi kosong, atau null
export function namaPengisi(nama: unknown): string | null {
  const m = /^(CMO|MAO)\s+(MOTOR|MOBIL)(KU)?$/i.exec(String(nama ?? '').trim());
  return m ? ISI_POSISI[`${m[1].toUpperCase()} ${m[2].toUpperCase()}`] ?? null : null;
}

// Selalu jadi pilihan PIC survey (selain anggota Mobilku)
export const PIC_TAMBAHAN = Object.values(ISI_POSISI);

// Tim tetap (urutan tampil). Dipakai melengkapi daftar dari pantauan, mis. awal bulan saat tabel sales file baru
// masih kosong sehingga sebagian nama belum terkirim. Nama dari pantauan tetap diutamakan kalau ada.
export const TIM_TETAP = ['MUHAMMAD NAUFAL RAFLI AL HAFIZ', 'YOGA PRASETYA', 'MUHAMMAD RIZAL HIMAWAN', 'AGUS IRSYAAD TAUFIQURRAHMAN'];
export const NAMA_OWNER = 'NIKO WIDYASMARA';
const BUKAN_KUNCI = /^(MUHAMMAD|MUH|MOH|M\.?|MOCH|MOCHAMAD)$/i;
/** Kata pengenal nama: NAUFAL, YOGA, RIZAL, AGUS, NIKO … */
export const kunciNama = (n: string) => String(n || '').toUpperCase().split(/\s+/).find((w) => w && !BUKAN_KUNCI.test(w)) || '';
/** Gabung daftar nama tanpa dobel (dicocokkan per kata pengenal); urutan mengikuti `urut` lalu sisanya. */
export function gabungTim(dariData: string[], urut: string[]): string[] {
  const pakai = new Map<string, string>();
  for (const n of dariData) { const k = kunciNama(n); if (k && !pakai.has(k)) pakai.set(k, n); }
  const hasil: string[] = [];
  for (const n of urut) { const k = kunciNama(n); hasil.push(pakai.get(k) || n); pakai.delete(k); }
  return [...hasil, ...pakai.values()];
}

// Peran PIC (ditampilkan di simulasi proyeksi). Dicocokkan per kata nama, mis. "MUHAMMAD RIZAL HIMAWAN" → RIZAL.
export const PERAN_PIC: Record<string, 'MAO' | 'CMO'> = { RIZAL: 'MAO', NAUFAL: 'CMO', AGUS: 'MAO', YOGA: 'CMO' };
export function peranDari(nama: string): 'MAO' | 'CMO' | null {
  const kata = String(nama || '').toUpperCase().split(/\s+/);
  for (const k of kata) if (PERAN_PIC[k]) return PERAN_PIC[k];
  return null;
}
