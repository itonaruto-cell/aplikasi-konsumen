// Database prospek: calon konsumen baru (input manual owner atau impor hasil scrape Google Maps)
// yang di-follow up CMO. Terpisah dari database konsumen (Cari): nomor HP prospek memang untuk dihubungi tim.
// Dipakai bersama oleh server (app/api/prospek) dan halaman (app/performa/Prospek.tsx).

// Hasil follow up: minat (termasuk yang jadi order), tidak minat, atau tidak ada respon.
// "Sudah dihubungi" = minat + order + tidak minat + tidak ada respon.
export const STATUS_PROSPEK = ['baru', 'minat', 'order', 'tidak', 'norespon'] as const;
export type StatusProspek = (typeof STATUS_PROSPEK)[number];
export const STATUS_LABEL: Record<StatusProspek, string> = {
  baru: 'Belum dihubungi', minat: 'Minat', order: 'Jadi order', tidak: 'Tidak minat', norespon: 'Tidak ada respon',
};
// Nilai lama di sheet (sebelum Oktober 2026) dibaca dengan arti barunya
export const bacaStatus = (v: string): StatusProspek =>
  v === 'tertarik' ? 'minat' : v === 'dihubungi' ? 'norespon' : (STATUS_PROSPEK as readonly string[]).includes(v) ? (v as StatusProspek) : 'baru';
export const FU_TARGET_HARIAN = 10;   // prospek dihubungi per orang per hari

/* ---------- Laporan follow up harian ---------- */
export type HitungFU = { dihubungi: number; minat: number; order: number; tidak: number; norespon: number; foto: number };
export type LaporanFU = {
  tgl: string;
  target: number;        // per orang per hari
  total: HitungFU;
  orang: (HitungFU & { nama: string })[];
  minat: { nama: string; tempat: string; oleh: string; hasil: string; order: boolean }[];
  db: { baruHariIni: number; belumDihubungi: number; orderBulanIni: number };
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
  foto: string;        // ID foto bukti follow up terakhir (tab FOTO), kosong = belum ada
  maps: string;        // link Google Maps tempat usaha (dari impor scrape atau diisi manual)
  privat: boolean;     // true = hanya owner (dan PIC-nya, kalau sudah diberi PIC) yang melihat
};

// Link maps yang diterima: http(s) saja
export const rapikanMaps = (v: unknown) => { const t = String(v ?? '').trim(); return /^https?:\/\/\S+$/i.test(t) ? t.slice(0, 300) : ''; };

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

// Judul kolom yang dikenali, urut dari yang paling tepat (mis. "address" didahulukan dari "street"/"city").
// Cocok untuk hasil Apify Google Maps Scraper (title, phone, categoryName, address, url) dan tabel buatan sendiri.
type Kol = 'nama' | 'hp' | 'profesi' | 'alamat' | 'maps';
const KOLOM: [Kol, RegExp[]][] = [
  ['nama', [/^(nama|nama usaha|nama tempat|nama toko|name|title|judul|place ?name|business( name)?)$/i, /^(nama|name|title)/i]],
  ['hp', [/^(no\.?\s*)?(hp|wa|whatsapp|telp|telepon|telephone|phone|phone ?number|nomor( hp| telepon)?|no\.? ?telp)$/i, /^(phone|telp|telepon|kontak|contact|nomor|no\.? ?hp)/i]],
  ['profesi', [/^(profesi|pekerjaan|kategori|category|category ?name|jenis usaha|bidang usaha|bidang)$/i, /^(categor|kategori|jenis|type|bidang)/i]],
  ['alamat', [/^(alamat|alamat lengkap|address|full ?address)$/i, /^(alamat|address)/i, /^(street|lokasi|location|kecamatan|kota|city)/i]],
  ['maps', [/^(url|maps|maps ?url|link|link maps|google ?maps( ?url| ?link)?|gmaps|lokasi maps)$/i]],
];
export type HasilImpor = { baris: Pick<Prospek, 'nama' | 'hp' | 'profesi' | 'alamat' | 'maps'>[]; tanpaHp: number; kepala: boolean };
export function bacaImpor(teks: string): HasilImpor {
  const rows = pisahBaris(teks);
  if (!rows.length) return { baris: [], tanpaHp: 0, kepala: false };
  // Baris pertama dianggap judul kolom kalau ada nama kolom yang dikenali
  const idx: Partial<Record<Kol, number>> = {};
  const dipakai = new Set<number>();
  for (const [k, pola] of KOLOM) {
    for (const re of pola) {
      const i = rows[0].findIndex((h, j) => !dipakai.has(j) && re.test(h.trim()));
      if (i >= 0) { idx[k] = i; dipakai.add(i); break; }
    }
  }
  const kepala = idx.nama !== undefined || idx.hp !== undefined;
  const pos: typeof idx = kepala ? idx : { nama: 0, hp: 1, profesi: 2, alamat: 3, maps: 4 };
  const ambil = (r: string[], i?: number) => (i === undefined ? '' : String(r[i] ?? '').trim());
  let tanpaHp = 0;
  const baris: HasilImpor['baris'] = [];
  for (const r of kepala ? rows.slice(1) : rows) {
    const nama = ambil(r, pos.nama).slice(0, 100);
    const hp = rapikanHp(ambil(r, pos.hp));
    if (!nama && !hp) continue;
    if (!hp) { tanpaHp++; continue; }
    baris.push({ nama: nama || '(tanpa nama)', hp, profesi: ambil(r, pos.profesi).slice(0, 80), alamat: ambil(r, pos.alamat).slice(0, 160), maps: rapikanMaps(ambil(r, pos.maps)) });
  }
  return { baris, tanpaHp, kepala };
}
