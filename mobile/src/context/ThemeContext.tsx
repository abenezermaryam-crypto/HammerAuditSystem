import React, { createContext, useContext } from 'react';

// ─── Permanent Light Palette ────────────────────────────────────────────────────────────
export const LIGHT: ThemeColors = {
  bg:           '#F0F4FF',
  card:         '#FFFFFF',
  cardBorder:   '#E2E8F0',
  surface:      '#F8FAFC',
  surfaceBorder:'#CBD5E1',
  text:         '#0F172A',
  textSub:      '#475569',
  textMuted:    '#94A3B8',
  accent:       '#0284C7',
  accentSub:    '#DBEAFE',
  income:       '#059669',
  expense:      '#DC2626',
  bank:         '#2563EB',
  header:       '#FFFFFF',
  headerBorder: '#E2E8F0',
  sidebar:      '#FFFFFF',
  sidebarBorder:'#E2E8F0',
  inputBg:      '#F8FAFC',
  inputBorder:  '#CBD5E1',
  statusBar:    'dark-content' as const,
  chartBg:      '#FFFFFF',
  chartGrid:    'rgba(30,58,138,0.1)',
  chartGlow:    '#0284C7',
  isDark: false,
};

// Alias DARK to LIGHT so any remaining dark references cleanly resolve to LIGHT
export const DARK: ThemeColors = LIGHT;

export interface ThemeColors {
  bg: string;
  card: string;
  cardBorder: string;
  surface: string;
  surfaceBorder: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
  accentSub: string;
  income: string;
  expense: string;
  bank: string;
  header: string;
  headerBorder: string;
  sidebar: string;
  sidebarBorder: string;
  inputBg: string;
  inputBorder: string;
  statusBar: 'dark-content' | 'light-content';
  chartBg: string;
  chartGrid: string;
  chartGlow: string;
  isDark: boolean;
}

interface ThemeContextType {
  theme: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: LIGHT,
  isDark: false,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThemeContext.Provider value={{ theme: LIGHT, isDark: false, toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
