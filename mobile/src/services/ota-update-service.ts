/**
 * Over-The-Air (OTA) Update Service
 * Checks for and applies JS bundle updates via expo-updates
 */
import * as Updates from 'expo-updates';

export interface OtaUpdateStatus {
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  lastChecked?: Date | undefined;
  error?: string | undefined;
}

/**
 * Checks for OTA updates in the background on app load or user action
 */
export async function checkForOtaUpdate(): Promise<boolean> {
  if (__DEV__) {
    return false;
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Applies the downloaded OTA update by reloading the app bundle
 */
export async function applyOtaUpdate(): Promise<void> {
  if (__DEV__) {
    return;
  }

  try {
    await Updates.reloadAsync();
  } catch {
    // If reloading fails, the update will be applied automatically on next cold launch
  }
}
