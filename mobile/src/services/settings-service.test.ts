/**
 * @file settings-service.test.ts
 * @description Unit tests for settings service and performance mode persistence.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  setupReactHookDispatcher,
  resetHookState,
  render,
  waitFor,
} from '../e2e/test-harness';
import {
  getStoredPerformanceMode,
  setStoredPerformanceMode,
  usePerformanceMode,
  isValidPerformanceMode,
  _resetInMemoryPerformanceModeForTesting,
  SETTINGS_STORAGE_KEYS,
} from './settings-service';
import type { PerformanceMode } from '@portfolio/core-view';

const { mockStorage } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string): Promise<string | null> => {
    return mockStorage.get(key) ?? null;
  }),
  setItemAsync: vi.fn(async (key: string, value: string): Promise<void> => {
    mockStorage.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string): Promise<void> => {
    mockStorage.delete(key);
  }),
}));

describe('settings-service', () => {
  beforeEach(() => {
    setupReactHookDispatcher();
    resetHookState();
    mockStorage.clear();
    _resetInMemoryPerformanceModeForTesting();
    vi.clearAllMocks();
  });

  describe('isValidPerformanceMode', () => {
    it('returns true for XIRR and ABS and false for other values', () => {
      expect(isValidPerformanceMode('XIRR')).toBe(true);
      expect(isValidPerformanceMode('ABS')).toBe(true);
      expect(isValidPerformanceMode('OTHER')).toBe(false);
      expect(isValidPerformanceMode(null)).toBe(false);
      expect(isValidPerformanceMode(undefined)).toBe(false);
    });
  });

  describe('getStoredPerformanceMode', () => {
    it('returns default XIRR when storage is empty', async () => {
      const mode = await getStoredPerformanceMode();
      expect(mode).toBe('XIRR');
    });

    it('returns stored ABS mode', async () => {
      mockStorage.set(SETTINGS_STORAGE_KEYS.PERFORMANCE_MODE, 'ABS');
      const mode = await getStoredPerformanceMode();
      expect(mode).toBe('ABS');
    });

    it('returns default XIRR when stored value is invalid', async () => {
      mockStorage.set(SETTINGS_STORAGE_KEYS.PERFORMANCE_MODE, 'INVALID_MODE');
      const mode = await getStoredPerformanceMode();
      expect(mode).toBe('XIRR');
    });

    it('handles SecureStore read errors gracefully', async () => {
      vi.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('Hardware failure'));
      const mode = await getStoredPerformanceMode();
      expect(mode).toBe('XIRR');
    });
  });

  describe('setStoredPerformanceMode', () => {
    it('persists performance mode into storage', async () => {
      await setStoredPerformanceMode('ABS');
      expect(mockStorage.get(SETTINGS_STORAGE_KEYS.PERFORMANCE_MODE)).toBe('ABS');

      const mode = await getStoredPerformanceMode();
      expect(mode).toBe('ABS');
    });

    it('persists XIRR mode into storage', async () => {
      await setStoredPerformanceMode('ABS');
      await setStoredPerformanceMode('XIRR');
      expect(mockStorage.get(SETTINGS_STORAGE_KEYS.PERFORMANCE_MODE)).toBe('XIRR');
    });

    it('handles SecureStore write errors gracefully and retains in-memory value', async () => {
      vi.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('Write failure'));
      await setStoredPerformanceMode('ABS');
      const mode = await getStoredPerformanceMode();
      expect(mode).toBe('ABS');
    });
  });

  describe('usePerformanceMode', () => {
    it('initializes with stored value and updates state and storage on change', async () => {
      mockStorage.set(SETTINGS_STORAGE_KEYS.PERFORMANCE_MODE, 'ABS');

      let currentMode: PerformanceMode | null = null;
      let setModeFn: ((m: PerformanceMode) => void) | null = null;

      function HookConsumer(): React.ReactElement {
        const [mode, setMode] = usePerformanceMode();
        currentMode = mode;
        setModeFn = setMode;
        return React.createElement(View, { testID: 'hook-consumer' });
      }

      render(() => React.createElement(HookConsumer));

      await waitFor(() => {
        expect(currentMode).toBe('ABS');
      });

      // Update to XIRR
      setModeFn!('XIRR');

      await waitFor(() => {
        expect(currentMode).toBe('XIRR');
        expect(mockStorage.get(SETTINGS_STORAGE_KEYS.PERFORMANCE_MODE)).toBe('XIRR');
      });
    });
  });
});
