// Menyusun jawaban dari potongan SK lewat AI. Dipakai kalau kunci dipasang di Vercel:
//  GEMINI_API_KEY (Google AI Studio, ada jatah gratis) diutamakan, lalu ANTHROPIC_API_KEY (Claude).
// Tanpa kunci, aplikasi hanya menampilkan kutipan SK.
import type { Sumber } from './sk-cari';

const SISTEM = `Kamu asisten kebijakan untuk tim marketing cabang perusahaan pembiayaan (WOM Finance).
Jawab pertanyaan HANYA berdasarkan kutipan ringkasan SK yang diberikan. Aturan:
- Jangan menambah aturan, angka, kode, atau jabatan yang tidak ada di kutipan. Kalau kutipan tidak cukup untuk menjawab, katakan terus terang bahwa hal itu tidak diatur di ringkasan SK yang tersedia, lalu sarankan konfirmasi ke Credit/Risk Policy.
- Tulis dalam bahasa Indonesia yang ringkas dan praktis untuk orang lapangan. Mulai dengan jawaban langsung (1–2 kalimat), lalu poin-poin penting bila perlu (pakai "- " di awal baris). Maksimal sekitar 200 kata.
- Setiap aturan atau angka yang kamu sebut wajib diberi rujukan nomor kutipan seperti [2]. Sebut juga nomor SK/bab bila jelas dari kutipan.
- Kalau kutipan menyebut ada pertentangan antar-SK, perubahan oleh SK lain (misalnya SK 094), atau hal yang perlu dikonfirmasi, sampaikan.
- Kalau dua kutipan berbeda, pegang ketentuan yang lebih baru dan lebih khusus (perhatikan tanda DIUBAH/DICABUT, mis. SK 111 mengubah SK 021 dan mencabut SK 094), dan sebutkan perubahannya.
- Pakai **tebal** hanya untuk angka/keputusan kunci. Jangan memakai judul (#) atau tabel.`;

export const adaAI = () => !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);

type Pesan = { role: 'user' | 'assistant'; content: string };

async function kirimJson(url: string, headers: Record<string, string>, body: unknown) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 45_000);
  try {
    const r = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    return { r, j: await r.json().catch(() => null) };
  } finally { clearTimeout(t); }
}

// Gemini: model utama, lalu model cadangan kalau model utama tidak tersedia / jatah habis
async function gemini(messages: Pesan[]): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const daftar = [...new Set([model, 'gemini-3.5-flash-lite'])];
  let terakhir = '';
  for (const m of daftar) {
    const { r, j } = await kirimJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`,
      { 'x-goog-api-key': process.env.GEMINI_API_KEY || '' }, {
        systemInstruction: { parts: [{ text: SISTEM }] },
        contents: messages.map((x) => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] })),
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      });
    if (r.ok) {
      const teks = ((j?.candidates?.[0]?.content?.parts || []) as { text?: string; thought?: boolean }[]).filter((p) => !p.thought).map((p) => p.text || '').join('').trim();
      if (teks) return teks;
      terakhir = `Gemini ${m}: jawaban kosong (${j?.candidates?.[0]?.finishReason || j?.promptFeedback?.blockReason || '-'})`;
    } else terakhir = `Gemini ${m} ${r.status}: ${j?.error?.message || ''}`;
    if (r.ok || ![404, 429, 500, 503].includes(r.status)) break;
  }
  throw new Error(terakhir);
}

async function claude(messages: Pesan[]): Promise<string> {
  const { r, j } = await kirimJson('https://api.anthropic.com/v1/messages',
    { 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' },
    { model: process.env.SK_MODEL || 'claude-sonnet-5-5', max_tokens: 1200, system: SISTEM, messages });
  if (!r.ok) throw new Error(`Claude API ${r.status}: ${j?.error?.message || ''}`);
  const teks = ((j?.content || []) as { type: string; text?: string }[]).filter((c) => c.type === 'text').map((c) => c.text || '').join('').trim();
  if (!teks) throw new Error('Jawaban kosong');
  return teks;
}

export async function jawabAI(q: string, sumber: Sumber[], riwayat: { q: string; a: string }[]): Promise<string> {
  const kutipan = sumber.map((s) => `[${s.n}] ${s.judul} · ${s.bagian} · hal. ${s.hal}\n${s.isi.replace(/[ \t]{3,}/g, '  ')}`).join('\n\n---\n\n');
  const messages: Pesan[] = [];
  for (const r of riwayat) { messages.push({ role: 'user', content: r.q }); messages.push({ role: 'assistant', content: r.a }); }
  messages.push({ role: 'user', content: `Kutipan ringkasan SK:\n\n${kutipan}\n\n===\nTanggal hari ini: ${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })}\nPertanyaan: ${q}` });
  return process.env.GEMINI_API_KEY ? gemini(messages) : claude(messages);
}
