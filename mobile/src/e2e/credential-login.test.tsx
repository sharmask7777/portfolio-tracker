import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setupReactHookDispatcher,
  resetHookState,
  render,
  screen,
  fireEvent,
} from './test-harness';

const { mockStorage, mockRouter } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
  mockRouter: {
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
  },
}));

vi.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  Tabs: Object.assign(
    (props: Record<string, unknown>) => ({ type: 'Tabs', props }),
    { Screen: (props: Record<string, unknown>) => ({ type: 'Tabs.Screen', props }) },
  ),
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

vi.mock('expo-camera', () => ({
  CameraView: (props: Record<string, unknown>) => ({ type: 'CameraView', props }),
  useCameraPermissions: () => [{ granted: false }, vi.fn()],
}));

vi.mock('expo-local-authentication', () => ({
  hasHardwareAsync: vi.fn().mockResolvedValue(true),
  isEnrolledAsync: vi.fn().mockResolvedValue(true),
  authenticateAsync: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  View: (props: Record<string, unknown>) => ({ type: 'View', props }),
  Text: (props: Record<string, unknown>) => ({ type: 'Text', props }),
  ScrollView: (props: Record<string, unknown>) => ({ type: 'ScrollView', props }),
  TextInput: (props: Record<string, unknown>) => ({ type: 'TextInput', props }),
  TouchableOpacity: (props: Record<string, unknown>) => ({ type: 'TouchableOpacity', props }),
  ActivityIndicator: (props: Record<string, unknown>) => ({ type: 'ActivityIndicator', props }),
  RefreshControl: (props: Record<string, unknown>) => ({ type: 'RefreshControl', props }),
  Alert: { alert: vi.fn() },
  Platform: { OS: 'ios', select: (s: Record<string, unknown>) => s['ios'] },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { CredentialLoginForm } from '../components/Auth/CredentialLoginForm';
import PairScreen from '../../app/(auth)/pair';

describe('CredentialLoginForm Component', () => {
  beforeEach(() => {
    setupReactHookDispatcher();
    resetHookState();
    vi.clearAllMocks();
  });

  it('renders input fields with default server URL and email', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <CredentialLoginForm
        onSubmit={onSubmit}
        isLoading={false}
      />
    ));

    expect(screen.getByTestId('credential-login-form')).toBeDefined();
    expect(screen.getByTestId('login-server-url-input')).toBeDefined();
    expect(screen.getByTestId('login-email-input')).toBeDefined();
    expect(screen.getByTestId('login-password-input')).toBeDefined();
    expect(screen.getByTestId('login-submit-button')).toBeDefined();
  });

  it('displays error text when error prop is provided', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <CredentialLoginForm
        onSubmit={onSubmit}
        isLoading={false}
        error="Invalid credentials"
      />
    ));

    const errorEl = screen.getByTestId('login-error-text');
    expect(errorEl).toBeDefined();
  });

  it('calls onSubmit with entered credentials when form is submitted', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(() => (
      <CredentialLoginForm
        onSubmit={onSubmit}
        isLoading={false}
      />
    ));

    fireEvent.changeText(screen.getByTestId('login-server-url-input'), 'http://10.0.2.2:8080');
    fireEvent.changeText(screen.getByTestId('login-email-input'), 'user@portfolio.test');
    fireEvent.changeText(screen.getByTestId('login-password-input'), 'SecretPass123');

    fireEvent.press(screen.getByTestId('login-submit-button'));
    expect(onSubmit).toHaveBeenCalledWith(
      'http://10.0.2.2:8080',
      'user@portfolio.test',
      'SecretPass123',
    );
  });
});

describe('PairScreen Mode Switcher', () => {
  beforeEach(() => {
    setupReactHookDispatcher();
    resetHookState();
    vi.clearAllMocks();
  });

  it('renders mode tabs and switches between QR, Password, and Code', () => {
    render(() => <PairScreen />);

    expect(screen.getByTestId('pair-mode-tabs')).toBeDefined();
    expect(screen.getByTestId('tab-scan-qr')).toBeDefined();
    expect(screen.getByTestId('tab-credentials')).toBeDefined();
    expect(screen.getByTestId('tab-pair-code')).toBeDefined();

    // Switch to Password login
    fireEvent.press(screen.getByTestId('tab-credentials'));
    expect(screen.getByTestId('credential-login-form')).toBeDefined();

    // Switch to Manual Pairing Code
    fireEvent.press(screen.getByTestId('tab-pair-code'));
    expect(screen.getByTestId('manual-pair-form')).toBeDefined();
  });
});
