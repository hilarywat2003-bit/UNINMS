import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { ColorPalette, DARK_OVERLAY, PRESETS, ThemePreset } from './colors';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  colors: ColorPalette;
  preset: ThemePreset;
  mode: ThemeMode;
  isDark: boolean;
  setPreset: (preset: ThemePreset, custom?: Partial<ColorPalette>) => void;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = '@uninms_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preset, setPresetState] = useState<ThemePreset>('blue');
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [customColors, setCustomColors] = useState<Partial<ColorPalette>>({});

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!stored) return;
      try {
        const { preset: p, mode: m, custom } = JSON.parse(stored);
        if (p) setPresetState(p);
        if (m) setModeState(m);
        if (custom) setCustomColors(custom);
      } catch {}
    });
  }, []);

  const isDark =
    mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const base: ColorPalette =
    preset === 'custom'
      ? { ...PRESETS.blue, ...customColors }
      : PRESETS[preset];

  const colors: ColorPalette = isDark ? { ...base, ...DARK_OVERLAY } : base;

  const setPreset = (p: ThemePreset, custom?: Partial<ColorPalette>) => {
    setPresetState(p);
    if (custom) setCustomColors(custom);
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ preset: p, mode, custom: custom ?? customColors })
    );
  };

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ preset, mode: m, custom: customColors })
    );
  };

  return (
    <ThemeContext.Provider value={{ colors, preset, mode, isDark, setPreset, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
