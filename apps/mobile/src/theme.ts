import { StyleSheet } from 'react-native';

// Dark mode for the app (Profile › Display & Language).
//
// Screens build their styles once from the light palette. `themedStyles`
// keeps that light sheet and derives a dark one on demand by mapping each
// colour by its role (background, text, line), the same rules the web
// portal uses (apps/web/src/app/dark-theme.css). `themedColors` does the
// same for colours used directly in JSX, such as icon colours.
// The root layout remounts the screens when the mode changes.

export type ThemeMode = 'light' | 'dark';

let mode: ThemeMode = 'light';
export function setThemeMode(next: ThemeMode) { mode = next; }
export function getThemeMode(): ThemeMode { return mode; }

const norm = (c: string) => c.trim().toUpperCase();

// Dark palette (from the dark mockups).
export const DARK = {
  page: '#0F172A',
  panel: '#272E3F',
  raised: '#3F4555',
  line: '#3F4555',
  text: '#F1F5F9',
  text2: '#CBD5E1',
  text3: '#94A3B8',
  accent: '#C7D2FE',
};

const BG: Record<string, string> = {
  '#FFFFFF': DARK.panel, '#FFF': DARK.panel, WHITE: DARK.panel,
  '#F9FAFB': DARK.page, '#F8FAFC': DARK.page, '#F4F6F9': DARK.page, '#CDD6E3': DARK.page,
  '#EEF1F8': DARK.raised, '#F3F4F6': DARK.raised, '#F1F4F9': DARK.raised, '#F5F7FF': DARK.raised,
  '#E5E7EB': '#4B515F', '#D1D5DB': '#4B515F',
  '#DCFCE7': 'rgba(34,197,94,0.16)', '#F0FDF4': 'rgba(34,197,94,0.12)',
  '#FEE2E2': 'rgba(239,68,68,0.16)', '#FEF2F2': 'rgba(239,68,68,0.14)',
  '#FEF3C7': 'rgba(245,158,11,0.16)', '#FEF9C3': 'rgba(245,197,24,0.16)', '#FFFBEB': 'rgba(245,197,24,0.14)', '#FFEDD5': 'rgba(249,115,22,0.16)',
  '#DBEAFE': 'rgba(59,130,246,0.18)', '#F3E8FF': 'rgba(168,85,247,0.18)', '#FFE4E6': 'rgba(244,63,94,0.16)',
};

const TEXT: Record<string, string> = {
  '#111827': DARK.text, '#1F2937': DARK.text, '#374151': DARK.text, '#0F172A': DARK.text, '#000': DARK.text, '#000000': DARK.text,
  '#4B5563': DARK.text2, '#6B7280': DARK.text2,
  '#9CA3AF': DARK.text3, '#D1D5DB': '#64748B',
  '#1B2E6B': DARK.accent, '#1E3A8A': DARK.accent,
  '#15803D': '#4ADE80', '#16A34A': '#4ADE80', '#059669': '#4ADE80',
  '#B45309': '#FBBF24', '#92400E': '#FBBF24', '#A16207': '#FBBF24', '#CA8A04': '#FBBF24',
  '#DC2626': '#F87171', '#B91C1C': '#F87171',
  '#1D4ED8': '#93C5FD', '#7E22CE': '#D8B4FE', '#EA580C': '#FDBA74',
};

const LINE: Record<string, string> = {
  '#E5E7EB': DARK.line, '#F3F4F6': DARK.line, '#EEF1F8': DARK.line, '#D1D5DB': '#4B515F', '#FFFFFF': DARK.panel,
};

const BG_KEYS = ['backgroundColor'];
const TEXT_KEYS = ['color', 'tintColor', 'textDecorationColor'];
const LINE_KEYS = ['borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'];

function mapValue(table: Record<string, string>, v: unknown) {
  return typeof v === 'string' ? table[norm(v)] ?? v : v;
}

function darkStyle(style: Record<string, unknown>, keepText: boolean) {
  const out: Record<string, unknown> = { ...style };
  for (const k of BG_KEYS) if (k in out) out[k] = mapValue(BG, out[k]);
  for (const k of LINE_KEYS) if (k in out) out[k] = mapValue(LINE, out[k]);
  if (!keepText) for (const k of TEXT_KEYS) if (k in out) out[k] = mapValue(TEXT, out[k]);
  return out;
}

const YELLOW = '#F5C518';

/**
 * StyleSheet.create with a derived dark variant. `keepText` lists styles whose
 * text colour must not change (e.g. navy text on a yellow button); styles that
 * set a yellow background keep their text colour automatically.
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T>>(defs: T, opts: { keepText?: (keyof T)[] } = {}): T {
  const light = StyleSheet.create(defs);
  let dark: T | null = null;
  const keep = new Set(opts.keepText ?? []);
  const build = (): T => {
    const d: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(light as unknown as Record<string, Record<string, unknown>>)) {
      const onYellow = typeof v?.backgroundColor === 'string' && norm(v.backgroundColor as string) === YELLOW;
      d[k] = v && typeof v === 'object' ? darkStyle(v, keep.has(k as keyof T) || onYellow) : v;
    }
    return d as T;
  };
  return new Proxy(light as object, {
    get(target, key) {
      if (mode === 'light') return (target as Record<string | symbol, unknown>)[key];
      dark ??= build();
      return (dark as Record<string | symbol, unknown>)[key];
    },
  }) as T;
}

// Colours used directly in JSX (icons, spinners, inline styles). White and
// yellow stay; navy and greys lighten; light surfaces darken.
const JSX: Record<string, string> = {
  ...TEXT,
  '#EEF1F8': DARK.raised, '#F3F4F6': DARK.raised,
  '#F9FAFB': DARK.page, '#F8FAFC': DARK.page,
  '#E5E7EB': DARK.line,
};

/** A palette object whose values follow the current mode. */
export function themedColors<T extends Record<string, string>>(light: T): T {
  return new Proxy(light, {
    get(target, key) {
      const v = (target as Record<string | symbol, string>)[key];
      if (mode === 'light' || typeof v !== 'string') return v;
      return JSX[norm(v)] ?? v;
    },
  });
}

/** Maps a single literal colour for the current mode (for inline JSX styles). */
export function tc(color: string, role: 'bg' | 'text' | 'line' = 'text'): string {
  if (mode === 'light') return color;
  return (role === 'bg' ? BG : role === 'line' ? LINE : JSX)[norm(color)] ?? color;
}
