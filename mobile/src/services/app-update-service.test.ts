import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLinking } = vi.hoisted(() => ({
  mockLinking: {
    canOpenURL: vi.fn(),
    openURL: vi.fn(),
  },
}));

vi.mock('react-native', () => ({
  Linking: mockLinking,
  Platform: { OS: 'android' },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.0.0',
    },
  },
}));

import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
} from './app-update-service';

describe('app-update-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkForAppUpdate', () => {
    it('returns null when GitHub API request fails with non-200 status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as unknown as Response);

      const result = await checkForAppUpdate('testowner', 'testrepo');
      expect(result).toBeNull();
    });

    it('returns null when network throws an exception', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network offline')
      );

      const result = await checkForAppUpdate('testowner', 'testrepo');
      expect(result).toBeNull();
    });

    it('correctly detects available update when GitHub release has higher version and APK asset', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tag_name: 'v2.0.0',
          html_url: 'https://github.com/testowner/testrepo/releases/tag/v2.0.0',
          body: 'New features and offline optimizations',
          assets: [
            {
              name: 'portfolio-tracker-release.apk',
              browser_download_url:
                'https://github.com/testowner/testrepo/releases/download/v2.0.0/app.apk',
            },
            {
              name: 'source.tar.gz',
              browser_download_url: 'https://github.com/...',
            },
          ],
        }),
      } as unknown as Response);

      const result = await checkForAppUpdate('testowner', 'testrepo');

      expect(result).not.toBeNull();
      expect(result?.version).toBe('v2.0.0');
      expect(result?.hasUpdate).toBe(true);
      expect(result?.releaseNotes).toBe('New features and offline optimizations');
      expect(result?.downloadUrl).toBe(
        'https://github.com/testowner/testrepo/releases/download/v2.0.0/app.apk'
      );
      expect(result?.releasePageUrl).toBe(
        'https://github.com/testowner/testrepo/releases/tag/v2.0.0'
      );
    });

    it('detects no update when latest tag matches current installed version', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tag_name: '1.0.0',
          body: 'Current release notes',
          assets: [
            {
              name: 'app-release.apk',
              browser_download_url: 'https://github.com/.../app.apk',
            },
          ],
        }),
      } as unknown as Response);

      const result = await checkForAppUpdate('testowner', 'testrepo');

      expect(result).not.toBeNull();
      expect(result?.hasUpdate).toBe(false);
      expect(result?.version).toBe('1.0.0');
    });

    it('detects no update when release contains no APK assets', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tag_name: 'v3.0.0',
          body: 'Source code only',
          assets: [
            {
              name: 'source.zip',
              browser_download_url: 'https://github.com/.../source.zip',
            },
          ],
        }),
      } as unknown as Response);

      const result = await checkForAppUpdate('testowner', 'testrepo');

      expect(result).not.toBeNull();
      expect(result?.hasUpdate).toBe(false);
      expect(result?.downloadUrl).toBe('');
    });
  });

  describe('downloadAndInstallUpdate', () => {
    it('opens URL directly via Linking.openURL', async () => {
      mockLinking.openURL.mockResolvedValueOnce(undefined);

      const success = await downloadAndInstallUpdate('https://example.com/app.apk');

      expect(success).toBe(true);
      expect(mockLinking.openURL).toHaveBeenCalledWith('https://example.com/app.apk');
    });

    it('falls back to secondary URL if primary URL fails to launch', async () => {
      mockLinking.openURL.mockRejectedValueOnce(new Error('APK launch error'));
      mockLinking.openURL.mockResolvedValueOnce(undefined);

      const success = await downloadAndInstallUpdate(
        'https://example.com/app.apk',
        'https://github.com/testowner/testrepo/releases/tag/v2.0.0'
      );

      expect(success).toBe(true);
      expect(mockLinking.openURL).toHaveBeenCalledWith('https://example.com/app.apk');
      expect(mockLinking.openURL).toHaveBeenCalledWith(
        'https://github.com/testowner/testrepo/releases/tag/v2.0.0'
      );
    });

    it('returns false when both downloadUrl and fallbackUrl are empty', async () => {
      const success = await downloadAndInstallUpdate('', '');

      expect(success).toBe(false);
      expect(mockLinking.openURL).not.toHaveBeenCalled();
    });

    it('returns false when all launch attempts reject', async () => {
      mockLinking.openURL.mockRejectedValue(new Error('No browser installed'));

      const success = await downloadAndInstallUpdate(
        'https://example.com/app.apk',
        'https://github.com/testowner/testrepo/releases/tag/v2.0.0'
      );

      expect(success).toBe(false);
    });
  });
});
