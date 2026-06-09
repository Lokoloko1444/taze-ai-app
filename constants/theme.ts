/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), or Unistyles.
 */

import { Platform } from 'react-native';

export const Brand = {
  primary: '#0f766e',
  primaryStrong: '#0b5f58',
  accent: '#2563eb',
  accentSoft: '#dbeafe',
  surface: '#f5f8fc',
  surfaceMuted: '#ecfdf8',
  panel: '#ffffff',
  panelBorder: '#d9e3ee',
  ink: '#07111f',
  inkMuted: '#5b6878',
  white: '#ffffff',
  dark: '#050816',
  glow: '#dffbf8',
  canvas: '#eef4fa',
  canvasAlt: '#eaf2ff',
  halo: '#c7d2fe',
};

export const BrandIdentity = {
  appName: 'Taze',
  reportName: 'TAZE',
  inventoryLabel: 'AI voorraad',
  invoiceLabel: 'Taze factuurconcept',
} as const;

export const StatusColors = {
  pending: {
    background: '#f8fafc',
    border: '#dbe4ee',
    text: '#475569',
  },
  opened: {
    background: '#eff6ff',
    border: '#bfdbfe',
    text: '#1d4ed8',
  },
  applied: {
    background: '#ecfeff',
    border: '#99f6e4',
    text: '#0f766e',
  },
  success: {
    background: '#dcfce7',
    border: '#86efac',
    text: '#166534',
  },
  failed: {
    background: '#fef2f2',
    border: '#fecaca',
    text: '#b91c1c',
  },
  warning: {
    background: '#fff7ed',
    border: '#fdba74',
    text: '#c2410c',
  },
  info: {
    background: '#eff6ff',
    border: '#c7d2fe',
    text: '#4338ca',
  },
} as const;

const tintColorLight = Brand.primary;
const tintColorDark = '#7de8df';

export const Colors = {
  light: {
    text: '#07111f',
    background: Brand.canvas,
    tint: tintColorLight,
    icon: '#66758a',
    tabIconDefault: '#66758a',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#eff6ff',
    background: Brand.dark,
    tint: tintColorDark,
    icon: '#8aa3b8',
    tabIconDefault: '#8aa3b8',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    body: 'Avenir Next',
    display: 'Avenir Next',
    mono: 'SF Mono',
  },
  android: {
    body: 'sans-serif-medium',
    display: 'sans-serif-condensed',
    mono: 'monospace',
  },
  web: {
    body: "'Avenir Next', 'Segoe UI Variable Text', 'Helvetica Neue', 'Trebuchet MS', sans-serif",
    display: "'Avenir Next', 'Segoe UI Variable Display', 'Helvetica Neue', 'Trebuchet MS', sans-serif",
    mono: "'SFMono-Regular', 'Menlo', 'Consolas', monospace",
  },
  default: {
    body: 'Avenir Next',
    display: 'Avenir Next',
    mono: 'monospace',
  },
});
