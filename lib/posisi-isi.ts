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
