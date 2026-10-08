import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { setSetting } from '../db/database';
import { darkColors, lightColors, type Colors } from './theme';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  colors: Colors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  isDark: false,
  preference: 'system',
  setPreference: () => {},
});

export const THEME_SETTING_KEY = 'theme';

export function AppThemeProvider({
  initialPreference,
  children,
}: {
  initialPreference: ThemePreference;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>(initialPreference);

  const setPreference = useCallback((p: ThemePreference) => {
    setPref(p);
    setSetting(THEME_SETTING_KEY, p);
  }, []);

  const isDark = preference === 'dark' || (preference === 'system' && system === 'dark');

  const value = useMemo(
    () => ({ colors: isDark ? darkColors : lightColors, isDark, preference, setPreference }),
    [isDark, preference, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}

/**
 * Erstellt Styles abhängig vom aktuellen Farbschema.
 * Die Factory sollte außerhalb der Komponente definiert sein (stabile Referenz).
 */
export function useStyles<T>(factory: (c: Colors) => T): T {
  const colors = useColors();
  return useMemo(() => factory(colors), [factory, colors]);
}
