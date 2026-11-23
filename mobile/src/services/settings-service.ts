/**
 * @file settings-service.ts
 * @description SecureStore persistence service and React hook for portfolio performance calculation mode (XIRR vs ABS).
 */

import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { PerformanceMode } from '@portfolio/core-view';

/**
 * Storage key constants for user settings.
 */
export const SETTINGS_STORAGE_KEYS = {
  PERFORMANCE_MODE: 'portfolio_performance_mode',
} as const;

/** Default fallback performance mode */
export const DEFAULT_PERFORMANCE_MODE: PerformanceMode = 'XIRR';

/** In-memory cache for synchronous read fallbacks */
let inMemoryPerformanceMode: PerformanceMode | null = null;

/**
 * Resets the in-memory performance mode cache for testing isolation.
 */
export function _resetInMemoryPerformanceModeForTesting(): void {
  inMemoryPerformanceMode = null;
}

/**
 * Type guard to check if a value is a valid PerformanceMode ('XIRR' | 'ABS').
 *
 * @param value - Value to validate
 * @returns True if value is a valid PerformanceMode
 */
export function isValidPerformanceMode(value: unknown): value is PerformanceMode {
  return value === 'XIRR' || value === 'ABS';
}

/**
 * Retrieves the persisted performance mode from SecureStore, falling back to in-memory or default.
 *
 * @returns Promise resolving to active PerformanceMode ('XIRR' | 'ABS')
 */
export async function getStoredPerformanceMode(): Promise<PerformanceMode> {
  try {
    const stored = await SecureStore.getItemAsync(SETTINGS_STORAGE_KEYS.PERFORMANCE_MODE);
    if (stored !== null) {
      if (isValidPerformanceMode(stored)) {
        inMemoryPerformanceMode = stored;
        return stored;
      }
      inMemoryPerformanceMode = DEFAULT_PERFORMANCE_MODE;
      return DEFAULT_PERFORMANCE_MODE;
    }
  } catch {
    // Fallback on secure store access failure
  }
  return inMemoryPerformanceMode ?? DEFAULT_PERFORMANCE_MODE;
}

/**
 * Persists the specified performance mode into SecureStore and updates in-memory cache.
 *
 * @param mode - The performance mode to store ('XIRR' | 'ABS')
 */
export async function setStoredPerformanceMode(mode: PerformanceMode): Promise<void> {
  inMemoryPerformanceMode = mode;
  try {
    await SecureStore.setItemAsync(SETTINGS_STORAGE_KEYS.PERFORMANCE_MODE, mode);
  } catch {
    // Fallback on secure store access failure
  }
}

/**
 * Custom React hook for accessing and mutating the persistent performance calculation mode.
 *
 * @returns Tuple containing active PerformanceMode and update callback
 */
export function usePerformanceMode(): readonly [PerformanceMode, (mode: PerformanceMode) => void] {
  const [performanceMode, setPerformanceModeState] = useState<PerformanceMode>(
    inMemoryPerformanceMode ?? DEFAULT_PERFORMANCE_MODE
  );

  useEffect(() => {
    let isMounted = true;
    void getStoredPerformanceMode().then((mode) => {
      if (isMounted) {
        setPerformanceModeState(mode);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const setPerformanceMode = useCallback((mode: PerformanceMode) => {
    setPerformanceModeState(mode);
    void setStoredPerformanceMode(mode);
  }, []);

  return [performanceMode, setPerformanceMode] as const;
}
