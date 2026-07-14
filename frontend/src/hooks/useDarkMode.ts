import { useState, useEffect } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved ? saved === 'dark' : prefersDark;
    setIsDark(shouldBeDark);
    applyTheme(shouldBeDark);
    setIsLoaded(true);
  }, []);

  const setDark = (value: boolean) => {
    setIsDark(value);
    localStorage.setItem('theme', value ? 'dark' : 'light');
    applyTheme(value);
  };

  const toggle = () => setDark(!isDark);

  return { isDark, toggle, setDark, isLoaded };
}

function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
}
