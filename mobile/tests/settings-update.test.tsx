import React from 'react';

// Set up React hook dispatcher for testing functional components in Node
let hookState: unknown[] = [];
let hookIdx = 0;

export function resetTestHooks(): void {
  hookState = [];
  hookIdx = 0;
}

// @ts-expect-error React internals for test runner
React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H = {
  useState: (init: unknown) => {
    const curIdx = hookIdx++;
    if (hookState[curIdx] === undefined) {
      hookState[curIdx] = typeof init === 'function' ? (init as () => unknown)() : init;
    }
    const setter = (val: unknown) => {
      hookState[curIdx] = typeof val === 'function' ? (val as (prev: unknown) => unknown)(hookState[curIdx]) : val;
    };
    return [hookState[curIdx], setter];
  },
  useEffect: (fn: () => void) => fn(),
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useRef: (init: unknown) => ({ current: init }),
  useContext: () => ({}),
};

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAlert } = vi.hoisted(() => ({
  mockAlert: { alert: vi.fn() },
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  ActivityIndicator: (props: Record<string, unknown>) => ({ type: 'ActivityIndicator', props }),
  Alert: mockAlert,
}));

vi.mock('lucide-react-native', () => ({
  DownloadCloud: (props: Record<string, unknown>) => ({ type: 'DownloadCloud', props }),
  CheckCircle2: (props: Record<string, unknown>) => ({ type: 'CheckCircle2', props }),
  AlertCircle: (props: Record<string, unknown>) => ({ type: 'AlertCircle', props }),
}));

import { AppUpdateCard } from '../src/components/Settings/AppUpdateCard';
import * as appUpdateService from '../src/services/app-update-service';

function getProps(element: unknown): Record<string, unknown> {
  if (element && typeof element === 'object' && 'props' in element) {
    return (element as { props: Record<string, unknown> }).props ?? {};
  }
  return {};
}

describe('AppUpdateCard Component', () => {
  beforeEach(() => {
    resetTestHooks();
    vi.clearAllMocks();
  });

  it('renders initial state with installed version and check button', () => {
    const card = AppUpdateCard({ currentVersion: '1.0.0' });
    expect(card).toBeDefined();
    expect(getProps(card)['testID']).toBe('settings-update-card');
  });

  it('handles manual check trigger when button is pressed and update is found', async () => {
    vi.spyOn(appUpdateService, 'checkForAppUpdate').mockResolvedValueOnce({
      version: 'mobile-v4',
      releaseNotes: 'Parity update with tax, treemap and family features.',
      downloadUrl: 'https://github.com/sharmask7777/portfolio-tracker/releases/download/mobile-v4/app.apk',
      hasUpdate: true,
    });

    const card = AppUpdateCard({ currentVersion: '1.0.0' });
    expect(card).toBeDefined();

    const children = getProps(card)['children'] as Array<unknown>;
    const checkBtn = children?.find(
      (child) => getProps(child)['testID'] === 'check-updates-button',
    );
    expect(checkBtn).toBeDefined();
    const onPress = getProps(checkBtn)['onPress'] as () => Promise<void>;
    await onPress();

    // Re-render with updated hook state
    hookIdx = 0;
    const updatedCard = AppUpdateCard({ currentVersion: '1.0.0' });
    expect(updatedCard).toBeDefined();

    const updatedChildren = getProps(updatedCard)['children'] as Array<unknown>;
    const downloadBtn = updatedChildren?.find(
      (child) => getProps(child)['testID'] === 'download-update-button',
    );
    expect(downloadBtn).toBeDefined();

    const onInstall = getProps(downloadBtn)['onPress'] as () => Promise<void>;
    const downloadSpy = vi.spyOn(appUpdateService, 'downloadAndInstallUpdate').mockResolvedValueOnce(true);
    await onInstall();
    expect(downloadSpy).toHaveBeenCalledWith(
      'https://github.com/sharmask7777/portfolio-tracker/releases/download/mobile-v4/app.apk',
    );
  });

  it('handles alert when download and install fails', async () => {
    vi.spyOn(appUpdateService, 'checkForAppUpdate').mockResolvedValueOnce({
      version: 'mobile-v4',
      releaseNotes: 'Parity update',
      downloadUrl: 'https://github.com/test.apk',
      hasUpdate: true,
    });

    const card = AppUpdateCard({ currentVersion: '1.0.0' });
    const children = getProps(card)['children'] as Array<unknown>;
    const checkBtn = children?.find(
      (child) => getProps(child)['testID'] === 'check-updates-button',
    );
    const onPress = getProps(checkBtn)['onPress'] as () => Promise<void>;
    await onPress();

    hookIdx = 0;
    const updatedCard = AppUpdateCard({ currentVersion: '1.0.0' });
    const updatedChildren = getProps(updatedCard)['children'] as Array<unknown>;
    const downloadBtn = updatedChildren?.find(
      (child) => getProps(child)['testID'] === 'download-update-button',
    );

    vi.spyOn(appUpdateService, 'downloadAndInstallUpdate').mockResolvedValueOnce(false);
    const onInstall = getProps(downloadBtn)['onPress'] as () => Promise<void>;
    await onInstall();
    expect(mockAlert.alert).toHaveBeenCalledWith(
      'Install Error',
      'Unable to launch browser/installer for APK download.',
    );
  });

  it('handles alert when release has no downloadUrl', async () => {
    vi.spyOn(appUpdateService, 'checkForAppUpdate').mockResolvedValueOnce({
      version: 'mobile-v4',
      releaseNotes: 'No apk',
      downloadUrl: '',
      hasUpdate: true,
    });

    const card = AppUpdateCard({ currentVersion: '1.0.0' });
    const children = getProps(card)['children'] as Array<unknown>;
    const checkBtn = children?.find(
      (child) => getProps(child)['testID'] === 'check-updates-button',
    );
    const onPress = getProps(checkBtn)['onPress'] as () => Promise<void>;
    await onPress();

    hookIdx = 0;
    const updatedCard = AppUpdateCard({ currentVersion: '1.0.0' });
    const updatedChildren = getProps(updatedCard)['children'] as Array<unknown>;
    const downloadBtn = updatedChildren?.find(
      (child) => getProps(child)['testID'] === 'download-update-button',
    );

    const onInstall = getProps(downloadBtn)['onPress'] as () => Promise<void>;
    await onInstall();
    expect(mockAlert.alert).toHaveBeenCalledWith(
      'Download Unavailable',
      'No direct APK download asset found in release.',
    );
  });

  it('handles error scenario when checking updates fails', async () => {
    vi.spyOn(appUpdateService, 'checkForAppUpdate').mockRejectedValueOnce(
      new Error('Network error'),
    );

    const card = AppUpdateCard({ currentVersion: '1.0.0' });
    const children = getProps(card)['children'] as Array<unknown>;
    const checkBtn = children?.find(
      (child) => getProps(child)['testID'] === 'check-updates-button',
    );
    const onPress = getProps(checkBtn)['onPress'] as () => Promise<void>;
    await onPress();

    hookIdx = 0;
    const updatedCard = AppUpdateCard({ currentVersion: '1.0.0' });
    expect(updatedCard).toBeDefined();
  });

  it('handles up-to-date response from GitHub releases', async () => {
    vi.spyOn(appUpdateService, 'checkForAppUpdate').mockResolvedValueOnce({
      version: 'mobile-v4',
      releaseNotes: 'Already latest',
      downloadUrl: 'https://github.com/test.apk',
      hasUpdate: false,
    });

    const card = AppUpdateCard({ currentVersion: '1.0.0' });
    const children = getProps(card)['children'] as Array<unknown>;
    const checkBtn = children?.find(
      (child) => getProps(child)['testID'] === 'check-updates-button',
    );
    const onPress = getProps(checkBtn)['onPress'] as () => Promise<void>;
    await onPress();

    hookIdx = 0;
    const updatedCard = AppUpdateCard({ currentVersion: '1.0.0' });
    expect(updatedCard).toBeDefined();
  });

  it('handles null response when info cannot be fetched', async () => {
    vi.spyOn(appUpdateService, 'checkForAppUpdate').mockResolvedValueOnce(null);

    const card = AppUpdateCard({ currentVersion: '1.0.0' });
    const children = getProps(card)['children'] as Array<unknown>;
    const checkBtn = children?.find(
      (child) => getProps(child)['testID'] === 'check-updates-button',
    );
    const onPress = getProps(checkBtn)['onPress'] as () => Promise<void>;
    await onPress();

    hookIdx = 0;
    const updatedCard = AppUpdateCard({ currentVersion: '1.0.0' });
    expect(updatedCard).toBeDefined();
  });
});
