import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';

const TestSettingsConsumer = () => {
  const {
    theme,
    performanceMode,
    realityCheckMode,
    cpiInflationRate,
    marginalTaxBracket,
    toggleTheme,
    setPerformanceMode,
    setRealityCheckMode,
    setCpiInflationRate,
    setMarginalTaxBracket,
  } = useSettings();

  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="performance-mode">{performanceMode}</div>
      <div data-testid="reality-check-mode">{realityCheckMode ? 'true' : 'false'}</div>
      <div data-testid="cpi-rate">{cpiInflationRate}</div>
      <div data-testid="tax-bracket">{marginalTaxBracket}</div>

      <button onClick={toggleTheme}>Toggle Theme</button>
      <button onClick={() => setPerformanceMode('ABS')}>Set ABS</button>
      <button onClick={() => setRealityCheckMode(true)}>Enable Reality Check</button>
      <button onClick={() => setCpiInflationRate(0.08)}>Set CPI 8%</button>
      <button onClick={() => setMarginalTaxBracket(0.20)}>Set Tax 20%</button>
    </div>
  );
};

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('provides sensible default settings', () => {
    render(
      <SettingsProvider>
        <TestSettingsConsumer />
      </SettingsProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(screen.getByTestId('performance-mode')).toHaveTextContent('XIRR');
    expect(screen.getByTestId('reality-check-mode')).toHaveTextContent('false');
    expect(screen.getByTestId('cpi-rate')).toHaveTextContent('0.06');
    expect(screen.getByTestId('tax-bracket')).toHaveTextContent('0.3');
  });

  it('updates realityCheckMode, cpiInflationRate, and marginalTaxBracket correctly', () => {
    render(
      <SettingsProvider>
        <TestSettingsConsumer />
      </SettingsProvider>
    );

    act(() => {
      screen.getByText('Enable Reality Check').click();
      screen.getByText('Set CPI 8%').click();
      screen.getByText('Set Tax 20%').click();
    });

    expect(screen.getByTestId('reality-check-mode')).toHaveTextContent('true');
    expect(screen.getByTestId('cpi-rate')).toHaveTextContent('0.08');
    expect(screen.getByTestId('tax-bracket')).toHaveTextContent('0.2');

    const stored = JSON.parse(localStorage.getItem('portfolio_tracker_settings') || '{}');
    expect(stored.realityCheckMode).toBe(true);
    expect(stored.cpiInflationRate).toBe(0.08);
    expect(stored.marginalTaxBracket).toBe(0.2);
  });

  it('restores stored settings from localStorage on initial render', () => {
    localStorage.setItem(
      'portfolio_tracker_settings',
      JSON.stringify({
        theme: 'dark',
        performanceMode: 'ABS',
        realityCheckMode: true,
        cpiInflationRate: 0.07,
        marginalTaxBracket: 0.15,
      })
    );

    render(
      <SettingsProvider>
        <TestSettingsConsumer />
      </SettingsProvider>
    );

    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(screen.getByTestId('performance-mode')).toHaveTextContent('ABS');
    expect(screen.getByTestId('reality-check-mode')).toHaveTextContent('true');
    expect(screen.getByTestId('cpi-rate')).toHaveTextContent('0.07');
    expect(screen.getByTestId('tax-bracket')).toHaveTextContent('0.15');
  });

  it('gracefully handles QuotaExceededError when persisting to localStorage', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    render(
      <SettingsProvider>
        <TestSettingsConsumer />
      </SettingsProvider>
    );

    act(() => {
      screen.getByText('Enable Reality Check').click();
    });

    // In-memory state still updates without throwing or crashing
    expect(screen.getByTestId('reality-check-mode')).toHaveTextContent('true');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to persist settings to localStorage:',
      expect.any(DOMException)
    );
  });

  it('falls back to default settings when localStorage contains corrupted JSON', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('portfolio_tracker_settings', 'INVALID_JSON_CORRUPTED');

    render(
      <SettingsProvider>
        <TestSettingsConsumer />
      </SettingsProvider>
    );

    expect(screen.getByTestId('reality-check-mode')).toHaveTextContent('false');
    expect(screen.getByTestId('cpi-rate')).toHaveTextContent('0.06');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to read settings from localStorage, falling back to defaults:',
      expect.any(SyntaxError)
    );
  });
});
