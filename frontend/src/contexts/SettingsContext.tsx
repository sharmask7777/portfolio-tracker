import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';
type PerformanceMode = 'XIRR' | 'ABS';

interface Settings {
  theme: Theme;
  performanceMode: PerformanceMode;
  realityCheckMode: boolean;
  cpiInflationRate: number;
  marginalTaxBracket: number;
}

interface SettingsContextType extends Settings {
  toggleTheme: () => void;
  setPerformanceMode: (mode: PerformanceMode) => void;
  setRealityCheckMode: (enabled: boolean) => void;
  setCpiInflationRate: (rate: number) => void;
  setMarginalTaxBracket: (bracket: number) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'portfolio_tracker_settings';

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  performanceMode: 'XIRR',
  realityCheckMode: false,
  cpiInflationRate: 0.06,
  marginalTaxBracket: 0.30,
};

function isValidTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

function isValidPerformanceMode(value: unknown): value is PerformanceMode {
  return value === 'XIRR' || value === 'ABS';
}

function isValidInflation(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 1;
}

function isValidTaxBracket(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0 && value <= 0.5;
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_SETTINGS;

      const parsed: unknown = JSON.parse(stored);
      if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS;

      const p = parsed as Record<string, unknown>;
      return {
        theme: isValidTheme(p.theme) ? p.theme : DEFAULT_SETTINGS.theme,
        performanceMode: isValidPerformanceMode(p.performanceMode)
          ? p.performanceMode
          : DEFAULT_SETTINGS.performanceMode,
        realityCheckMode:
          typeof p.realityCheckMode === 'boolean'
            ? p.realityCheckMode
            : DEFAULT_SETTINGS.realityCheckMode,
        cpiInflationRate: isValidInflation(p.cpiInflationRate)
          ? p.cpiInflationRate
          : DEFAULT_SETTINGS.cpiInflationRate,
        marginalTaxBracket: isValidTaxBracket(p.marginalTaxBracket)
          ? p.marginalTaxBracket
          : DEFAULT_SETTINGS.marginalTaxBracket,
      };
    } catch (err) {
      console.warn('Failed to read settings from localStorage, falling back to defaults:', err);
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.warn('Failed to persist settings to localStorage:', err);
    }
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings]);

  const toggleTheme = () => {
    setSettings((prev) => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light',
    }));
  };

  const setPerformanceMode = (mode: PerformanceMode) => {
    setSettings((prev) => ({
      ...prev,
      performanceMode: mode,
    }));
  };

  const setRealityCheckMode = (enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      realityCheckMode: enabled,
    }));
  };

  const setCpiInflationRate = (rate: number) => {
    if (isValidInflation(rate)) {
      setSettings((prev) => ({
        ...prev,
        cpiInflationRate: rate,
      }));
    }
  };

  const setMarginalTaxBracket = (bracket: number) => {
    if (isValidTaxBracket(bracket)) {
      setSettings((prev) => ({
        ...prev,
        marginalTaxBracket: bracket,
      }));
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        toggleTheme,
        setPerformanceMode,
        setRealityCheckMode,
        setCpiInflationRate,
        setMarginalTaxBracket,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
