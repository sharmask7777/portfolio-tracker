/**
 * @file usePortfolioScope.ts
 * @description Framework-agnostic controller and React hook for portfolio active scope management.
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * Scope storage adapter interface allowing pluggable storage mechanisms:
 * localStorage on Web, expo-secure-store or AsyncStorage on React Native.
 */
export interface ScopeStorageAdapter {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem?: (key: string) => void | Promise<void>;
}

/**
 * Web browser localStorage scope storage adapter.
 */
export class LocalStorageScopeStorageAdapter implements ScopeStorageAdapter {
  getItem(key: string): string | null {
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : globalThis.localStorage;
      if (storage) {
        return storage.getItem(key);
      }
    } catch {
      // Fallback for security errors or sandbox restrictions
    }
    return null;
  }

  setItem(key: string, value: string): void {
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : globalThis.localStorage;
      if (storage) {
        storage.setItem(key, value);
      }
    } catch {
      // Fallback for quota exceeded or sandbox restrictions
    }
  }

  removeItem(key: string): void {
    try {
      const storage = typeof window !== 'undefined' ? window.localStorage : globalThis.localStorage;
      if (storage) {
        storage.removeItem(key);
      }
    } catch {
      // Fallback
    }
  }
}

/**
 * Default in-memory storage adapter for environments without persistent storage.
 */
export class InMemoryScopeStorageAdapter implements ScopeStorageAdapter {
  private readonly storage = new Map<string, string>();

  getItem(key: string): string | null {
    return this.storage.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }
}

/**
 * Active scope union representing either Consolidated (all family/PANs) or an individual Member.
 */
export type PortfolioScope =
  | { readonly type: 'consolidated' }
  | {
      readonly type: 'member';
      readonly profileId: string;
      readonly pan?: string | undefined;
      readonly name?: string | undefined;
    };

export const DEFAULT_SCOPE_STORAGE_KEY = 'portfolio_active_scope';

export interface UsePortfolioScopeOptions {
  /** Optional custom storage adapter (defaults to InMemoryScopeStorageAdapter) */
  readonly storageAdapter?: ScopeStorageAdapter;
  /** Custom storage key */
  readonly storageKey?: string;
  /** Initial scope (defaults to consolidated) */
  readonly initialScope?: PortfolioScope;
}

export interface UsePortfolioScopeResult {
  /** The currently active portfolio scope */
  readonly scope: PortfolioScope;
  /** Whether the current scope is consolidated across all members */
  readonly isConsolidated: boolean;
  /** The active profile ID, or null if consolidated */
  readonly activeProfileId: string | null;
  /** The active PAN, or undefined if consolidated */
  readonly activePan: string | undefined;
  /** Set scope to consolidated */
  readonly setConsolidated: () => void;
  /** Set scope to a specific member */
  readonly setMemberScope: (profile: {
    readonly profileId: string;
    readonly pan?: string | undefined;
    readonly name?: string | undefined;
  }) => void;
  /** Reset scope to consolidated and clear persistent storage */
  readonly resetScope: () => void;
}

/**
 * Serializes a PortfolioScope to JSON.
 */
export function serializeScope(scope: PortfolioScope): string {
  return JSON.stringify(scope);
}

/**
 * Deserializes JSON into a valid PortfolioScope with fallback to consolidated.
 * Supports parsing JSON objects or legacy plain profile ID strings.
 */
export function deserializeScope(raw: string | null): PortfolioScope {
  if (!raw) return { type: 'consolidated' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === 'member' && typeof parsed.profileId === 'string') {
      return {
        type: 'member',
        profileId: parsed.profileId,
        ...(parsed.pan ? { pan: parsed.pan } : {}),
        ...(parsed.name ? { name: parsed.name } : {}),
      };
    }
  } catch {
    // If not JSON, but a valid legacy raw ID string (e.g. 'prof-alpha'), support it
    if (typeof raw === 'string' && raw.trim().length > 0 && !raw.startsWith('{')) {
      return {
        type: 'member',
        profileId: raw.trim(),
      };
    }
  }
  return { type: 'consolidated' };
}

/**
 * React hook for managing portfolio active scope with pluggable storage adapter.
 *
 * @param options - Configuration options for storage and initial state.
 * @returns Scope state and mutation controllers.
 */
export function usePortfolioScope(options?: UsePortfolioScopeOptions): UsePortfolioScopeResult {
  const storageKey = options?.storageKey ?? DEFAULT_SCOPE_STORAGE_KEY;
  const storageAdapter = options?.storageAdapter;

  const [scope, setScope] = useState<PortfolioScope>(() => {
    if (options?.initialScope) return options.initialScope;
    if (storageAdapter) {
      const stored = storageAdapter.getItem(storageKey);
      if (typeof stored === 'string') {
        return deserializeScope(stored);
      }
    }
    return { type: 'consolidated' };
  });

  // Handle async storage initialization if adapter returns Promise
  useEffect(() => {
    if (!storageAdapter) return;
    const result = storageAdapter.getItem(storageKey);
    if (result instanceof Promise) {
      result.then((stored) => {
        if (typeof stored === 'string') {
          setScope(deserializeScope(stored));
        }
      }).catch(() => {
        // Ignore initialization errors
      });
    }
  }, [storageAdapter, storageKey]);

  const persistScope = useCallback(
    (newScope: PortfolioScope) => {
      setScope(newScope);
      if (storageAdapter) {
        if (newScope.type === 'consolidated') {
          if (storageAdapter.removeItem) {
            storageAdapter.removeItem(storageKey);
          } else {
            storageAdapter.setItem(storageKey, serializeScope(newScope));
          }
        } else {
          storageAdapter.setItem(storageKey, serializeScope(newScope));
        }
      }
    },
    [storageAdapter, storageKey]
  );

  const setConsolidated = useCallback(() => {
    persistScope({ type: 'consolidated' });
  }, [persistScope]);

  const setMemberScope = useCallback(
    (profile: {
      readonly profileId: string;
      readonly pan?: string | undefined;
      readonly name?: string | undefined;
    }) => {
      persistScope({
        type: 'member',
        profileId: profile.profileId,
        ...(profile.pan ? { pan: profile.pan } : {}),
        ...(profile.name ? { name: profile.name } : {}),
      });
    },
    [persistScope]
  );

  const resetScope = useCallback(() => {
    persistScope({ type: 'consolidated' });
  }, [persistScope]);

  const isConsolidated = scope.type === 'consolidated';
  const activeProfileId = scope.type === 'member' ? scope.profileId : null;
  const activePan = scope.type === 'member' ? scope.pan : undefined;

  return {
    scope,
    isConsolidated,
    activeProfileId,
    activePan,
    setConsolidated,
    setMemberScope,
    resetScope,
  };
}
