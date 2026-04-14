'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Renderiza placeholder idêntico até hidratar — evita mismatch server/client
  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl bg-surface-alt" aria-hidden />
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-alt hover:bg-border transition-colors text-black dark:text-white"
      aria-label="Alternar tema"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
