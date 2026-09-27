'use client';
import { useEffect, useState } from 'react';

// Mode terang / gelap. Pilihan disimpan di HP (ck_theme); selama belum memilih, ikut pengaturan HP.
export function useDarkMode(): [boolean, () => void] {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      let chosen: string | null = null;
      try { chosen = localStorage.getItem('ck_theme'); } catch { /* abaikan */ }
      if (chosen) return;
      document.documentElement.classList.toggle('dark', e.matches);
      setDark(e.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('ck_theme', next ? 'dark' : 'light'); } catch { /* abaikan */ }
    setDark(next);
  };
  return [dark, toggle];
}

const SUN = (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
const MOON = <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />;

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [dark, toggle] = useDarkMode();
  return (
    <button onClick={toggle} aria-label={dark ? 'Pakai mode terang' : 'Pakai mode gelap'} title={dark ? 'Mode terang' : 'Mode gelap'}
      className={`flex items-center justify-center rounded-full active:scale-95 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? SUN : MOON}
      </svg>
    </button>
  );
}
