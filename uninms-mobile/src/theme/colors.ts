export type ColorPalette = {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  background: string;
  surface: string;
  card: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  warning: string;
  error: string;
  info: string;
};

export type ThemePreset = 'blue' | 'green' | 'purple' | 'orange' | 'custom';

export const PRESETS: Record<Exclude<ThemePreset, 'custom'>, ColorPalette> = {
  blue: {
    primary: '#1a56db',
    primaryDark: '#1040a0',
    primaryLight: '#e8f0fe',
    accent: '#0ea5e9',
    background: '#f8fafc',
    surface: '#ffffff',
    card: '#ffffff',
    border: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#94a3b8',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    info: '#0ea5e9',
  },
  green: {
    primary: '#16a34a',
    primaryDark: '#14532d',
    primaryLight: '#dcfce7',
    accent: '#10b981',
    background: '#f0fdf4',
    surface: '#ffffff',
    card: '#ffffff',
    border: '#bbf7d0',
    text: '#0f172a',
    textSecondary: '#1e293b',
    textMuted: '#94a3b8',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    info: '#0ea5e9',
  },
  purple: {
    primary: '#7c3aed',
    primaryDark: '#4c1d95',
    primaryLight: '#ede9fe',
    accent: '#a78bfa',
    background: '#faf5ff',
    surface: '#ffffff',
    card: '#ffffff',
    border: '#ddd6fe',
    text: '#0f172a',
    textSecondary: '#1e293b',
    textMuted: '#94a3b8',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    info: '#0ea5e9',
  },
  orange: {
    primary: '#ea580c',
    primaryDark: '#7c2d12',
    primaryLight: '#fff7ed',
    accent: '#f97316',
    background: '#fff7ed',
    surface: '#ffffff',
    card: '#ffffff',
    border: '#fed7aa',
    text: '#0f172a',
    textSecondary: '#1e293b',
    textMuted: '#94a3b8',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    info: '#0ea5e9',
  },
};

export const DARK_OVERLAY: Partial<ColorPalette> = {
  background: '#0f172a',
  surface: '#1e293b',
  card: '#1e293b',
  border: '#334155',
  text: '#f1f5f9',
  textSecondary: '#cbd5e1',
  textMuted: '#475569',
};
