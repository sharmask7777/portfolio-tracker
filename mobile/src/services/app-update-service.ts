/**
 * App Update Service
 * Checks for updates against GitHub Releases without App Store
 */
import * as Application from 'expo-constants';
import { Linking, Platform } from 'react-native';

export interface AppReleaseInfo {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  releasePageUrl: string;
  hasUpdate: boolean;
}

interface GitHubAsset {
  name?: string | undefined;
  browser_download_url?: string | undefined;
}

interface GitHubReleaseResponse {
  tag_name?: string | undefined;
  body?: string | undefined;
  html_url?: string | undefined;
  assets?: GitHubAsset[] | undefined;
}

function findApkDownloadUrl(assets?: GitHubAsset[] | undefined): string {
  if (!assets) {
    return '';
  }
  const apkAsset = assets.find((asset) => asset.name?.endsWith('.apk'));
  return apkAsset?.browser_download_url ?? '';
}

function parseReleaseInfo(
  currentVersion: string,
  data: GitHubReleaseResponse
): AppReleaseInfo {
  const latestTag = data.tag_name ?? '';
  const releaseNotes = data.body ?? 'Performance and bug fixes.';
  const downloadUrl = findApkDownloadUrl(data.assets);
  const releasePageUrl = data.html_url ?? '';
  const isIos = Platform?.OS === 'ios';
  const hasUpdate = Boolean(
    latestTag &&
      latestTag !== currentVersion &&
      (isIos ? releasePageUrl || downloadUrl : downloadUrl || releasePageUrl)
  );

  return {
    version: latestTag,
    releaseNotes,
    downloadUrl,
    releasePageUrl,
    hasUpdate,
  };
}

/**
 * Checks for newer APK releases directly on GitHub Releases API
 *
 * @param repoOwner - Repository owner on GitHub
 * @param repoName - Repository name on GitHub
 * @returns AppReleaseInfo object if check succeeds, null otherwise
 */
export async function checkForAppUpdate(
  repoOwner: string,
  repoName: string
): Promise<AppReleaseInfo | null> {
  try {
    const currentVersion = Application.default?.expoConfig?.version ?? '1.0.0';
    const endpoint = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GitHubReleaseResponse;
    return parseReleaseInfo(currentVersion, data);
  } catch {
    return null;
  }
}

/**
 * Triggers direct download and installation of the updated APK with resilient fallback.
 * Attempts direct openURL without gating on canOpenURL to prevent false negatives
 * on Android 11+ caused by Package Visibility Filtering. Falls back to release page.
 *
 * @param downloadUrl - Primary direct APK download URL
 * @param fallbackUrl - Optional fallback URL (e.g. GitHub release HTML page)
 * @returns Promise resolving to true if URL was successfully dispatched to system
 */
export async function downloadAndInstallUpdate(
  downloadUrl: string,
  fallbackUrl?: string
): Promise<boolean> {
  const primaryUrl = downloadUrl.trim();
  const secondaryUrl = fallbackUrl?.trim();

  if (!primaryUrl && !secondaryUrl) {
    return false;
  }

  if (primaryUrl) {
    try {
      await Linking.openURL(primaryUrl);
      return true;
    } catch {
      // Primary launch failed; attempt fallback
    }
  }

  if (secondaryUrl && secondaryUrl !== primaryUrl) {
    try {
      await Linking.openURL(secondaryUrl);
      return true;
    } catch {
      // Fallback launch failed
    }
  }

  return false;
}
