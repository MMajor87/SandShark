import { createContext } from 'react';
import { DEFAULT_ACCENT, type TAccent } from './accents';

type Theme = 'dark' | 'light' | 'system';

type TThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  accent: TAccent;
  setAccent: (accent: TAccent) => void;
};

const initialState: TThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  accent: DEFAULT_ACCENT,
  setAccent: () => null
};

const ThemeProviderContext = createContext<TThemeProviderState>(initialState);

export { ThemeProviderContext, type Theme };
