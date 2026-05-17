import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';
type PerformanceMode = 'XIRR' | 'ABS';

interface Settings {
  theme: Theme;
  performanceMode: PerformanceMode;
}

interface SettingsContextType extends Settings {
  toggleTheme: () => void;
  setPerformanceMode: (mode: PerformanceMode) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const STORAGE_KEY = 'portfolio_tracker_settings';

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  performanceMode: 'XIRR',
};

function isValidTheme(value: any): value is Theme {
  return value === 'light' || value === 'dark';
}

function isValidPerformanceMode(value: any): value is PerformanceMode {
  return value === 'XIRR' || value === 'ABS';
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;

    try {
      const parsed = JSON.parse(stored);
      return {
        theme: isValidTheme(parsed.theme) ? parsed.theme : DEFAULT_SETTINGS.theme,
        performanceMode: isValidPerformanceMode(parsed.performanceMode)
          ? parsed.performanceMode
          : DEFAULT_SETTINGS.performanceMode,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
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

  return (
    <SettingsContext.Provider
      value={{
        ...settings,
        toggleTheme,
        setPerformanceMode,
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
