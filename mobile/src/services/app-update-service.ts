/**
 * App Update Service
 * Checks for updates against GitHub Releases without App Store
 */
import * as Application from 'expo-constants';
import { Linking } from 'react-native';

export interface AppReleaseInfo {
  version: string;
  releaseNotes: string;
  downloadUrl: string;
  hasUpdate: boolean;
}

interface GitHubAsset {
  name?: string | undefined;
  browser_download_url?: string | undefined;
}

interface GitHubReleaseResponse {
  tag_name?: string | undefined;
  body?: string | undefined;
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
  const hasUpdate = Boolean(latestTag && latestTag !== currentVersion && downloadUrl);

  return {
    version: latestTag,
    releaseNotes,
    downloadUrl,
    hasUpdate,
  };
}

/**
 * Checks for newer APK releases directly on GitHub Releases API
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
 * Triggers direct download and installation of the updated APK
 */
export async function downloadAndInstallUpdate(downloadUrl: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(downloadUrl);
    if (!canOpen) {
      return false;
    }
    await Linking.openURL(downloadUrl);
    return true;
  } catch {
    return false;
  }
}
