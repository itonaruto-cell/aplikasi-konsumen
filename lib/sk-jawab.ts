// Menyusun jawaban dari potongan SK lewat Claude API (hanya aktif kalau ANTHROPIC_API_KEY dipasang di Vercel).
import type { Sumber } from './sk-cari';

const SISTEM = `Kamu asisten kebijakan untuk tim marketing cabang perusahaan pembiayaan (WOM Finance).
Jawab pertanyaan HANYA berdasarkan kutipan ringkasan SK yang diberikan. Aturan:
- Jangan menambah aturan, angka, kode, atau jabatan yang tidak ada di kutipan. Kalau kutipan tidak cukup untuk menjawab, katakan terus terang bahwa hal itu tidak diatur di ringkasan SK yang tersedia, lalu sarankan konfirmasi ke Credit/Risk Policy.
- Tulis dalam bahasa Indonesia yang ringkas dan praktis untuk orang lapangan. Mulai dengan jawaban langsung (1–2 kalimat), lalu poin-poin penting bila perlu (pakai "- " di awal baris). Maksimal sekitar 200 kata.
- Setiap aturan atau angka yang kamu sebut wajib diberi rujukan nomor kutipan seperti [2]. Sebut juga nomor SK/bab bila jelas dari kutipan.
- Kalau kutipan menyebut ada pertentangan antar-SK, perubahan oleh SK lain (misalnya SK 094), atau hal yang perlu dikonfirmasi, sampaikan.
- Pakai **tebal** hanya untuk angka/keputusan kunci. Jangan memakai judul (#) atau tabel.`;

export async function jawabAI(q: string, sumber: Sumber[], riwayat: { q: string; a: string }[]): Promise<string> {
  const kutipan = sumber.map((s) => `[${s.n}] ${s.judul} · ${s.bagian} · hal. ${s.hal}\n${s.isi.replace(/[ \t]{3,}/g, '  ')}`).join('\n\n---\n\n');
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const r of riwayat) { messages.push({ role: 'user', content: r.q }); messages.push({ role: 'assistant', content: r.a }); }
  messages.push({ role: 'user', content: `Kutipan ringkasan SK:\n\n${kutipan}\n\n===\nTanggal hari ini: ${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })}\nPertanyaan: ${q}` });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45_000);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.SK_MODEL || 'claude-sonnet-5-5', max_tokens: 1200, system: SISTEM, messages }),
    });
    const j = await r.json().catch(() => null) as { content?: { type: string; text?: string }[]; error?: { message?: string } } | null;
    if (!r.ok) throw new Error(`Claude API ${r.status}: ${j?.error?.message || ''}`);
    const teks = (j?.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('').trim();
    if (!teks) throw new Error('Jawaban kosong');
    return teks;
  } finally { clearTimeout(t); }
}
