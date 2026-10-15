// Database prospek: calon konsumen baru (input manual owner atau impor hasil scrape Google Maps)
// yang di-follow up CMO. Terpisah dari database konsumen (Cari): nomor HP prospek memang untuk dihubungi tim.
// Dipakai bersama oleh server (app/api/prospek) dan halaman (app/performa/Prospek.tsx).

export const STATUS_PROSPEK = ['baru', 'dihubungi', 'tertarik', 'tidak', 'order'] as const;
export type StatusProspek = (typeof STATUS_PROSPEK)[number];
export const STATUS_LABEL: Record<StatusProspek, string> = {
  baru: 'Belum dihubungi', dihubungi: 'Sudah dihubungi', tertarik: 'Tertarik', tidak: 'Tidak minat', order: 'Jadi order',
};

export type Prospek = {
  id: string;
  nama: string;
  hp: string;          // hanya angka, diawali 0
  profesi: string;     // profesi / kategori usaha
  alamat: string;
  sumber: string;      // Manual, Google Maps, …
  catatan: string;     // catatan dari owner
  pic: string;         // CMO yang memegang (nama seperti di pantauan); kosong = belum ada yang pegang
  status: StatusProspek;
  hasil: string;       // catatan follow up terakhir
  fu: string;          // waktu follow up terakhir (ISO)
  dibuat: string;
  diubah: string;
  oleh: string;        // email yang menambahkan
};

// Nomor HP Indonesia: hanya angka, +62/62 diubah ke 0. Kosong kalau terlalu pendek.
export function rapikanHp(v: string): string {
  let d = String(v || '').replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  else if (d.startsWith('8')) d = '0' + d;
  return d.length >= 9 && d.length <= 15 ? d : '';
}
export const keWa = (hp: string) => (hp.startsWith('0') ? '62' + hp.slice(1) : hp);

/* ---------- Baca teks CSV / salinan tabel (hasil scrape Google Maps, Excel, Google Sheets) ---------- */
function pisahBaris(teks: string): string[][] {
  const t = teks.replace(/\r\n?/g, '\n');
  const pertama = t.split('\n').find((l) => l.trim()) || '';
  const sep = pertama.includes('\t') ? '\t' : (pertama.match(/;/g) || []).length > (pertama.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], cell = '', kutip = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (kutip) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') kutip = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') kutip = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some(Boolean));
}

const KOLOM: [keyof Pick<Prospek, 'nama' | 'hp' | 'profesi' | 'alamat'>, RegExp][] = [
  ['hp', /^(no\.?\s*)?(hp|wa|whatsapp|telp|telepon|telephone|phone|phone ?number|nomor|no\.? ?telp|kontak|contact)/i],
  ['nama', /^(nama|name|title|judul|business|nama usaha|nama tempat|place ?name)/i],
  ['profesi', /^(profesi|pekerjaan|kategori|category|categoryname|categories|jenis|type|bidang)/i],
  ['alamat', /^(alamat|address|full ?address|street|lokasi|location|kecamatan|kota|city)/i],
];
export type HasilImpor = { baris: Pick<Prospek, 'nama' | 'hp' | 'profesi' | 'alamat'>[]; tanpaHp: number; kepala: boolean };
export function bacaImpor(teks: string): HasilImpor {
  const rows = pisahBaris(teks);
  if (!rows.length) return { baris: [], tanpaHp: 0, kepala: false };
  // Baris pertama dianggap judul kolom kalau ada nama kolom yang dikenali
  const idx: Partial<Record<'nama' | 'hp' | 'profesi' | 'alamat', number>> = {};
  rows[0].forEach((h, i) => {
    for (const [k, re] of KOLOM) if (idx[k] === undefined && re.test(h)) { idx[k] = i; break; }
  });
  const kepala = idx.nama !== undefined || idx.hp !== undefined;
  const pos = kepala ? idx : { nama: 0, hp: 1, profesi: 2, alamat: 3 };
  const ambil = (r: string[], i?: number) => (i === undefined ? '' : String(r[i] ?? '').trim());
  let tanpaHp = 0;
  const baris: HasilImpor['baris'] = [];
  for (const r of kepala ? rows.slice(1) : rows) {
    const nama = ambil(r, pos.nama).slice(0, 100);
    const hp = rapikanHp(ambil(r, pos.hp));
    if (!nama && !hp) continue;
    if (!hp) { tanpaHp++; continue; }
    baris.push({ nama: nama || '(tanpa nama)', hp, profesi: ambil(r, pos.profesi).slice(0, 80), alamat: ambil(r, pos.alamat).slice(0, 160) });
  }
  return { baris, tanpaHp, kepala };
}
