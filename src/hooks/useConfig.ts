import { useState, useEffect, useCallback } from 'react';
import { getConfig, setConfig, getAllConfig } from '@/lib/db';

export type Theme = 'crt' | 'amber' | 'mono' | 'matrix' | 'solarized' | 'dracula' | 'nord' | 'cyberpunk';

export const AVAILABLE_THEMES: Theme[] = ['crt', 'amber', 'mono', 'matrix', 'solarized', 'dracula', 'nord', 'cyberpunk'];

export interface AppConfig {
  theme: Theme;
  scanlines: boolean;
  autosave: boolean;
  dateFormat: string;
}

const DEFAULT_CONFIG: AppConfig = {
  theme: 'crt',
  scanlines: true,
  autosave: true,
  dateFormat: 'short'
};

export function useConfig() {
  const [config, setConfigState] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      const stored = await getAllConfig();
      setConfigState({
        theme: (stored.theme as Theme) || 'crt',
        scanlines: stored.scanlines !== 'false',
        autosave: stored.autosave !== 'false',
        dateFormat: stored.dateFormat || 'short'
      });
      setLoading(false);
    };
    loadConfig();
  }, []);

  // Update a config value
  const updateConfig = useCallback(async (key: keyof AppConfig, value: string | boolean) => {
    const strValue = String(value);
    await setConfig(key, strValue);
    setConfigState(prev => ({
      ...prev,
      [key]: typeof value === 'boolean' ? value : value
    }));
  }, []);

  // Refresh config from DB
  const refreshConfig = useCallback(async () => {
    const stored = await getAllConfig();
    setConfigState({
      theme: (stored.theme as Theme) || 'crt',
      scanlines: stored.scanlines !== 'false',
      autosave: stored.autosave !== 'false',
      dateFormat: stored.dateFormat || 'short'
    });
  }, []);

  return { config, loading, updateConfig, refreshConfig };
}

// Theme CSS variable mappings
export const THEME_VARS: Record<Theme, Record<string, string>> = {
  crt: {
    '--background': '220 15% 6%',
    '--foreground': '120 60% 75%',
    '--primary': '120 60% 50%',
    '--terminal-prompt': '120 80% 55%',
    '--terminal-command': '180 80% 60%',
    '--terminal-output': '120 50% 70%',
    '--terminal-glow': '120 100% 50%',
    '--terminal-dim': '120 15% 40%',
    '--terminal-error': '0 70% 60%',
    '--terminal-warning': '45 90% 60%',
    '--terminal-info': '210 80% 60%',
    '--success': '120 70% 45%',
    '--border': '120 30% 20%',
    '--ring': '120 60% 50%',
  },
  amber: {
    '--background': '30 15% 6%',
    '--foreground': '40 90% 70%',
    '--primary': '40 100% 50%',
    '--terminal-prompt': '40 100% 55%',
    '--terminal-command': '45 90% 65%',
    '--terminal-output': '40 80% 65%',
    '--terminal-glow': '40 100% 50%',
    '--terminal-dim': '40 30% 40%',
    '--terminal-error': '0 80% 55%',
    '--terminal-warning': '50 90% 55%',
    '--terminal-info': '30 70% 60%',
    '--success': '80 70% 45%',
    '--border': '40 40% 25%',
    '--ring': '40 100% 50%',
  },
  mono: {
    '--background': '0 0% 5%',
    '--foreground': '0 0% 80%',
    '--primary': '0 0% 90%',
    '--terminal-prompt': '0 0% 90%',
    '--terminal-command': '0 0% 85%',
    '--terminal-output': '0 0% 75%',
    '--terminal-glow': '0 0% 100%',
    '--terminal-dim': '0 0% 45%',
    '--terminal-error': '0 60% 55%',
    '--terminal-warning': '45 50% 55%',
    '--terminal-info': '0 0% 70%',
    '--success': '0 0% 80%',
    '--border': '0 0% 25%',
    '--ring': '0 0% 90%',
  },
  matrix: {
    '--background': '120 20% 3%',
    '--foreground': '120 100% 50%',
    '--primary': '120 100% 45%',
    '--terminal-prompt': '120 100% 55%',
    '--terminal-command': '120 100% 60%',
    '--terminal-output': '120 100% 50%',
    '--terminal-glow': '120 100% 50%',
    '--terminal-dim': '120 50% 30%',
    '--terminal-error': '0 80% 50%',
    '--terminal-warning': '60 100% 45%',
    '--terminal-info': '150 80% 45%',
    '--success': '120 100% 40%',
    '--border': '120 50% 15%',
    '--ring': '120 100% 50%',
  },
  solarized: {
    '--background': '195 25% 8%',
    '--foreground': '180 7% 60%',
    '--primary': '175 60% 45%',
    '--terminal-prompt': '175 60% 50%',
    '--terminal-command': '205 70% 55%',
    '--terminal-output': '180 7% 60%',
    '--terminal-glow': '175 60% 50%',
    '--terminal-dim': '195 15% 40%',
    '--terminal-error': '1 70% 55%',
    '--terminal-warning': '45 100% 50%',
    '--terminal-info': '205 70% 55%',
    '--success': '68 100% 35%',
    '--border': '195 20% 20%',
    '--ring': '175 60% 45%',
  },
  dracula: {
    '--background': '231 15% 10%',
    '--foreground': '230 15% 80%',
    '--primary': '265 90% 70%',
    '--terminal-prompt': '265 90% 75%',
    '--terminal-command': '190 95% 70%',
    '--terminal-output': '230 15% 80%',
    '--terminal-glow': '265 90% 70%',
    '--terminal-dim': '230 15% 45%',
    '--terminal-error': '0 100% 67%',
    '--terminal-warning': '65 92% 76%',
    '--terminal-info': '225 100% 75%',
    '--success': '135 95% 65%',
    '--border': '230 20% 25%',
    '--ring': '265 90% 70%',
  },
  nord: {
    '--background': '220 16% 12%',
    '--foreground': '220 15% 75%',
    '--primary': '195 65% 60%',
    '--terminal-prompt': '195 65% 65%',
    '--terminal-command': '180 50% 60%',
    '--terminal-output': '220 15% 75%',
    '--terminal-glow': '195 65% 60%',
    '--terminal-dim': '220 15% 45%',
    '--terminal-error': '350 65% 60%',
    '--terminal-warning': '40 70% 65%',
    '--terminal-info': '210 50% 65%',
    '--success': '92 40% 55%',
    '--border': '220 20% 25%',
    '--ring': '195 65% 60%',
  },
  cyberpunk: {
    '--background': '280 20% 5%',
    '--foreground': '300 100% 75%',
    '--primary': '180 100% 50%',
    '--terminal-prompt': '180 100% 55%',
    '--terminal-command': '300 100% 70%',
    '--terminal-output': '300 100% 75%',
    '--terminal-glow': '180 100% 50%',
    '--terminal-dim': '300 40% 40%',
    '--terminal-error': '350 100% 60%',
    '--terminal-warning': '55 100% 55%',
    '--terminal-info': '200 100% 60%',
    '--success': '160 100% 45%',
    '--border': '280 50% 25%',
    '--ring': '180 100% 50%',
  }
};

// Apply theme to document
export function applyTheme(theme: Theme) {
  const vars = THEME_VARS[theme];
  const root = document.documentElement;
  
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}
