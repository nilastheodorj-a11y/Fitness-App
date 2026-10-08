import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import {
  AppThemeProvider,
  THEME_SETTING_KEY,
  useAppTheme,
  type ThemePreference,
} from '../components/ThemeContext';
import { getSetting, initDatabase } from '../db/database';

export default function RootLayout() {
  const [preference, setPreference] = useState<ThemePreference | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDatabase()
      .then(() => getSetting(THEME_SETTING_KEY))
      .then((p) => setPreference(p === 'light' || p === 'dark' ? p : 'system'))
      .catch((e) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#DC2626' }}>Datenbank-Fehler: {error}</Text>
      </View>
    );
  }

  if (!preference) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AppThemeProvider initialPreference={preference}>
      <AppStack />
    </AppThemeProvider>
  );
}

function AppStack() {
  const { colors, isDark } = useAppTheme();

  const navTheme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [isDark, colors]);

  useEffect(() => {
    // Hintergrund hinter den Screens (z. B. beim Öffnen von Modals)
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          headerStyle: { backgroundColor: colors.card },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="food/new" options={{ title: 'Mahlzeit hinzufügen', presentation: 'modal' }} />
        <Stack.Screen name="food/scan" options={{ title: 'Barcode scannen' }} />
        <Stack.Screen name="activity/new" options={{ title: 'Aktivität hinzufügen', presentation: 'modal' }} />
        <Stack.Screen name="exercise/new" options={{ title: 'Übung erstellen', presentation: 'modal' }} />
        <Stack.Screen name="exercise/[id]" options={{ title: 'Übung' }} />
        <Stack.Screen name="workout/edit" options={{ title: 'Trainingsplan', presentation: 'modal' }} />
        <Stack.Screen name="workout/[id]" options={{ title: 'Trainingsplan' }} />
        <Stack.Screen
          name="workout/session"
          options={{ title: 'Training', gestureEnabled: false, headerBackVisible: false }}
        />
      </Stack>
    </ThemeProvider>
  );
}
