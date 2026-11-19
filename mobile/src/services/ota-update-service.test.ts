import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Updates from 'expo-updates';
import { checkForOtaUpdate, applyOtaUpdate } from './ota-update-service';

vi.mock('expo-updates', () => ({
  checkForUpdateAsync: vi.fn(),
  fetchUpdateAsync: vi.fn(),
  reloadAsync: vi.fn(),
}));

describe('ota-update-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('__DEV__', false);
  });

  describe('checkForOtaUpdate', () => {
    it('returns false immediately in development mode (__DEV__ = true)', async () => {
      vi.stubGlobal('__DEV__', true);

      const result = await checkForOtaUpdate();

      expect(result).toBe(false);
      expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled();
    });

    it('returns false when no update is available on server', async () => {
      vi.mocked(Updates.checkForUpdateAsync).mockResolvedValueOnce({
        isAvailable: false,
      } as unknown as Updates.UpdateCheckResult);

      const result = await checkForOtaUpdate();

      expect(result).toBe(false);
      expect(Updates.checkForUpdateAsync).toHaveBeenCalledOnce();
      expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled();
    });

    it('downloads update and returns true when an update is available', async () => {
      vi.mocked(Updates.checkForUpdateAsync).mockResolvedValueOnce({
        isAvailable: true,
      } as unknown as Updates.UpdateCheckResult);
      vi.mocked(Updates.fetchUpdateAsync).mockResolvedValueOnce({
        isNew: true,
      } as unknown as Updates.UpdateFetchResult);

      const result = await checkForOtaUpdate();

      expect(result).toBe(true);
      expect(Updates.checkForUpdateAsync).toHaveBeenCalledOnce();
      expect(Updates.fetchUpdateAsync).toHaveBeenCalledOnce();
    });

    it('safely catches error and returns false when check or fetch fails', async () => {
      vi.mocked(Updates.checkForUpdateAsync).mockRejectedValueOnce(
        new Error('Network error or server down')
      );

      const result = await checkForOtaUpdate();

      expect(result).toBe(false);
    });
  });

  describe('applyOtaUpdate', () => {
    it('does nothing in development mode (__DEV__ = true)', async () => {
      vi.stubGlobal('__DEV__', true);

      await applyOtaUpdate();

      expect(Updates.reloadAsync).not.toHaveBeenCalled();
    });

    it('calls Updates.reloadAsync in production mode', async () => {
      vi.mocked(Updates.reloadAsync).mockResolvedValueOnce();

      await applyOtaUpdate();

      expect(Updates.reloadAsync).toHaveBeenCalledOnce();
    });

    it('swallows errors gracefully when reload fails', async () => {
      vi.mocked(Updates.reloadAsync).mockRejectedValueOnce(
        new Error('Reload timeout')
      );

      await expect(applyOtaUpdate()).resolves.toBeUndefined();
    });
  });
});
