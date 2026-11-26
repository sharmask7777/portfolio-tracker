import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { SettingsProvider, useSettings } from './SettingsContext';

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides default settings and updates theme and inflation rate', () => {
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <SettingsProvider>{children}</SettingsProvider>
    );
    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.cpiInflationRate).toBe(0.06);

    act(() => {
      result.current.setCpiInflationRate(0.07);
      result.current.setMarginalTaxBracket(0.2);
      result.current.toggleTheme();
    });

    expect(result.current.cpiInflationRate).toBe(0.07);
    expect(result.current.marginalTaxBracket).toBe(0.2);
  });
});
