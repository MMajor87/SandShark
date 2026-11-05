import { useContext } from 'react';
import { ThemeProviderContext } from './context';

export const useTheme = () => useContext(ThemeProviderContext);
