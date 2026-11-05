import {
  getLocalStorageItem,
  LocalStorageKey,
  setLocalStorageItem
} from '@/helpers/storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_ACCENT, isAccent, type TAccent } from './accents';
import { ThemeProviderContext, type Theme } from './context';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: LocalStorageKey;
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

const getStoredAccent = (): TAccent => {
  const stored = getLocalStorageItem(LocalStorageKey.UI_ACCENT);

  return isAccent(stored) ? stored : DEFAULT_ACCENT;
};

function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = LocalStorageKey.VITE_UI_THEME,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    () => (getLocalStorageItem(storageKey) as Theme) || defaultTheme
  );
  const [accent, setAccentState] = useState<TAccent>(getStoredAccent);

  useEffect(() => {
    const root = window.document.documentElement;

    const apply = (mode: 'dark' | 'light') => {
      root.classList.remove('light', 'dark');
      root.classList.add(mode);
    };

    if (theme !== 'system') {
      apply(theme);
      return;
    }

    // follows the system while the app stays open, not only when it starts
    const media = window.matchMedia(DARK_QUERY);

    const applySystem = () => {
      apply(media.matches ? 'dark' : 'light');
    };

    applySystem();
    media.addEventListener('change', applySystem);

    return () => {
      media.removeEventListener('change', applySystem);
    };
  }, [theme]);

  useEffect(() => {
    window.document.documentElement.dataset.accent = accent;
  }, [accent]);

  const setTheme = useCallback(
    (next: Theme) => {
      setLocalStorageItem(storageKey, next);
      setThemeState(next);
    },
    [storageKey]
  );

  const setAccent = useCallback((next: TAccent) => {
    setLocalStorageItem(LocalStorageKey.UI_ACCENT, next);
    setAccentState(next);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, accent, setAccent }),
    [theme, setTheme, accent, setAccent]
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export { ThemeProvider };
