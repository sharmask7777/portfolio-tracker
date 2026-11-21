import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePortfolioScope,
  serializeScope,
  deserializeScope,
  InMemoryScopeStorageAdapter,
  DEFAULT_SCOPE_STORAGE_KEY,
} from './usePortfolioScope';
import type { PortfolioScope } from './usePortfolioScope';

describe('usePortfolioScope', () => {
  describe('serialization & deserialization', () => {
    it('serializes consolidated scope', () => {
      const scope: PortfolioScope = { type: 'consolidated' };
      expect(serializeScope(scope)).toBe('{"type":"consolidated"}');
    });

    it('serializes member scope', () => {
      const scope: PortfolioScope = {
        type: 'member',
        profileId: 'prof-1',
        pan: 'ABCDE1234F',
        name: 'Aarav Sharma',
      };
      const json = serializeScope(scope);
      expect(JSON.parse(json)).toEqual({
        type: 'member',
        profileId: 'prof-1',
        pan: 'ABCDE1234F',
        name: 'Aarav Sharma',
      });
    });

    it('deserializes member scope correctly', () => {
      const raw = JSON.stringify({
        type: 'member',
        profileId: 'prof-2',
        pan: 'ALPAC1001A',
        name: 'Neha Patel',
      });
      const scope = deserializeScope(raw);
      expect(scope).toEqual({
        type: 'member',
        profileId: 'prof-2',
        pan: 'ALPAC1001A',
        name: 'Neha Patel',
      });
    });

    it('falls back to consolidated on invalid JSON or null', () => {
      expect(deserializeScope(null)).toEqual({ type: 'consolidated' });
      expect(deserializeScope('')).toEqual({ type: 'consolidated' });
      expect(deserializeScope('{invalid json')).toEqual({ type: 'consolidated' });
      expect(deserializeScope('{"type":"unknown"}')).toEqual({ type: 'consolidated' });
    });
  });

  describe('InMemoryScopeStorageAdapter', () => {
    it('stores, retrieves, and removes items', () => {
      const adapter = new InMemoryScopeStorageAdapter();
      expect(adapter.getItem('key1')).toBeNull();

      adapter.setItem('key1', 'value1');
      expect(adapter.getItem('key1')).toBe('value1');

      adapter.removeItem('key1');
      expect(adapter.getItem('key1')).toBeNull();
    });
  });

  describe('usePortfolioScope hook', () => {
    it('initializes with consolidated scope by default', () => {
      const storage = new InMemoryScopeStorageAdapter();
      const { result } = renderHook(() => usePortfolioScope({ storageAdapter: storage }));

      expect(result.current.scope).toEqual({ type: 'consolidated' });
      expect(result.current.isConsolidated).toBe(true);
      expect(result.current.activeProfileId).toBeNull();
      expect(result.current.activePan).toBeUndefined();
    });

    it('loads existing saved scope from storage adapter', () => {
      const storage = new InMemoryScopeStorageAdapter();
      storage.setItem(
        DEFAULT_SCOPE_STORAGE_KEY,
        JSON.stringify({
          type: 'member',
          profileId: 'p1',
          pan: 'ABCDE1234F',
          name: 'Aarav',
        })
      );

      const { result } = renderHook(() => usePortfolioScope({ storageAdapter: storage }));
      expect(result.current.scope.type).toBe('member');
      expect(result.current.isConsolidated).toBe(false);
      expect(result.current.activeProfileId).toBe('p1');
      expect(result.current.activePan).toBe('ABCDE1234F');
    });

    it('sets member scope and persists to storage', () => {
      const storage = new InMemoryScopeStorageAdapter();
      const { result } = renderHook(() => usePortfolioScope({ storageAdapter: storage }));

      act(() => {
        result.current.setMemberScope({
          profileId: 'p2',
          pan: 'ALPAC1001A',
          name: 'Neha',
        });
      });

      expect(result.current.scope).toEqual({
        type: 'member',
        profileId: 'p2',
        pan: 'ALPAC1001A',
        name: 'Neha',
      });
      expect(result.current.isConsolidated).toBe(false);
      expect(result.current.activeProfileId).toBe('p2');
      expect(result.current.activePan).toBe('ALPAC1001A');

      const rawStored = storage.getItem(DEFAULT_SCOPE_STORAGE_KEY);
      expect(rawStored).toBeTruthy();
      if (!rawStored) return;
      expect(deserializeScope(rawStored)).toEqual({
        type: 'member',
        profileId: 'p2',
        pan: 'ALPAC1001A',
        name: 'Neha',
      });
    });

    it('resets scope to consolidated and clears storage', () => {
      const storage = new InMemoryScopeStorageAdapter();
      storage.setItem(
        DEFAULT_SCOPE_STORAGE_KEY,
        JSON.stringify({ type: 'member', profileId: 'p1' })
      );

      const { result } = renderHook(() => usePortfolioScope({ storageAdapter: storage }));
      act(() => {
        result.current.resetScope();
      });

      expect(result.current.isConsolidated).toBe(true);
      expect(storage.getItem(DEFAULT_SCOPE_STORAGE_KEY)).toBeNull();
    });

    it('supports custom storage keys', () => {
      const storage = new InMemoryScopeStorageAdapter();
      const customKey = 'custom_scope_key';
      const { result } = renderHook(() =>
        usePortfolioScope({
          storageAdapter: storage,
          storageKey: customKey,
        })
      );

      act(() => {
        result.current.setMemberScope({ profileId: 'p3' });
      });

      expect(storage.getItem(customKey)).toBeTruthy();
      expect(storage.getItem(DEFAULT_SCOPE_STORAGE_KEY)).toBeNull();
    });

    it('handles async storage adapter getItem gracefully', async () => {
      const asyncStorage = {
        getItem: vi.fn().mockResolvedValue(
          JSON.stringify({
            type: 'member',
            profileId: 'p-async',
            pan: 'ASYNC1234A',
          })
        ),
        setItem: vi.fn().mockResolvedValue(undefined),
        removeItem: vi.fn().mockResolvedValue(undefined),
      };

      let hookResult: { current: ReturnType<typeof usePortfolioScope> } | undefined;
      await act(async () => {
        const { result } = renderHook(() =>
          usePortfolioScope({ storageAdapter: asyncStorage })
        );
        hookResult = result;
      });

      expect(asyncStorage.getItem).toHaveBeenCalled();
      expect(hookResult?.current).toBeDefined();
      expect(hookResult?.current.activeProfileId).toBe('p-async');
    });
  });
});
