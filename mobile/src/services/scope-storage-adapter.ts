/**
 * @file scope-storage-adapter.ts
 * @description Pluggable ScopeStorageAdapter implementation backed by expo-secure-store for mobile persistence.
 */

import * as SecureStore from 'expo-secure-store';
import type { ScopeStorageAdapter } from '@portfolio/core-view';

/**
 * Storage adapter implementation that persists active portfolio scope into hardware-backed SecureStore.
 */
export class SecureStoreScopeStorageAdapter implements ScopeStorageAdapter {
  /**
   * Reads a stored string value by key from SecureStore.
   *
   * @param key - Storage key
   * @returns Stored string or null if not found/error
   */
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  }

  /**
   * Persists a key-value string pair into SecureStore.
   *
   * @param key - Storage key
   * @param value - Value to persist
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Fallback on secure store failure
    }
  }

  /**
   * Deletes a key from SecureStore.
   *
   * @param key - Storage key
   */
  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Fallback
    }
  }
}

/**
 * Singleton instance of SecureStoreScopeStorageAdapter.
 */
export const secureStoreScopeStorageAdapter = new SecureStoreScopeStorageAdapter();
