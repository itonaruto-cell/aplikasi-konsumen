// Halaman login: "Masuk dengan Google"
export const dynamic = 'force-dynamic';

const MESSAGES: Record<string, string> = {
  akses: 'Email ini belum terdaftar. Minta owner menambahkan email Anda ke daftar akses.',
  gagal: 'Login gagal. Coba lagi.',
  config: 'Login Google belum diatur di Vercel (GOOGLE_OAUTH_CLIENT_ID). Hubungi owner.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string; keluar?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? MESSAGES[sp.error] || MESSAGES.gagal : '';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#1F4E78] px-6 text-white">
      <div className="w-full max-w-sm">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10">
          <img src="/icon-192.png" alt="" className="h-16 w-16 rounded-2xl" />
        </div>
        <h1 className="mt-6 text-center text-3xl font-semibold tracking-tight">Cari Konsumen</h1>
        <p className="mt-2 text-center text-sm text-white/70">Masuk dengan akun Google yang sudah didaftarkan owner.</p>

        {sp.keluar && !error && (
          <p className="mt-6 rounded-2xl bg-white/10 px-4 py-3 text-center text-sm">Anda sudah keluar.</p>
        )}
        {error && (
          <div className="mt-6 rounded-2xl bg-red-500/20 px-4 py-3 text-center text-sm text-red-100">
            <p>{error}</p>
            {sp.email && <p className="mt-1 font-mono text-xs text-red-200">{sp.email}</p>}
          </div>
        )}

        <a href="/api/auth/login"
          className="mt-8 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-white text-base font-semibold text-slate-800 active:scale-[0.99]">
          <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          Masuk dengan Google
        </a>
      </div>
    </main>
  );
}
