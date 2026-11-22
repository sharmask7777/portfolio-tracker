import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SECURE_STORE_KEYS,
  getStoredCredentials,
  saveStoredCredentials,
  clearCredentials,
  parseAndValidateQrPayload,
  claimPairingSecret,
  loginWithCredentials,
  authenticateWithBiometrics,
  DEFAULT_SERVER_URL,
  LOCAL_DEV_SERVER_URL,
  normalizeServerUrl,
} from './auth-service';
import type { UserResponse } from '../types/generated';

const { mockStorage, mockLocalAuth } = vi.hoisted(() => ({
  mockStorage: new Map<string, string>(),
  mockLocalAuth: {
    hasHardwareAsync: vi.fn(),
    isEnrolledAsync: vi.fn(),
    authenticateAsync: vi.fn(),
  },
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

vi.mock('expo-local-authentication', () => mockLocalAuth);

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('auth-service', () => {
  const sampleUser: UserResponse = {
    id: 'usr_abc123',
    email: 'test@example.com',
  };

  beforeEach(() => {
    mockStorage.clear();
    vi.clearAllMocks();
  });

  describe('Secure Credential Storage', () => {
    it('returns null fields when storage is empty', async () => {
      const credentials = await getStoredCredentials();
      expect(credentials).toEqual({
        serverUrl: null,
        token: null,
        user: null,
      });
    });

    it('persists and retrieves credentials correctly', async () => {
      await saveStoredCredentials('https://api.portfolio.example.com', 'jwt-token-123', sampleUser);

      const credentials = await getStoredCredentials();
      expect(credentials.serverUrl).toBe('https://api.portfolio.example.com');
      expect(credentials.token).toBe('jwt-token-123');
      expect(credentials.user).toEqual(sampleUser);
    });

    it('handles malformed or invalid user JSON in storage gracefully', async () => {
      mockStorage.set(SECURE_STORE_KEYS.SERVER_URL, 'https://api.example.com');
      mockStorage.set(SECURE_STORE_KEYS.DEVICE_TOKEN, 'tok-1');
      mockStorage.set(SECURE_STORE_KEYS.USER_INFO, 'not-valid-json');

      const credentials = await getStoredCredentials();
      expect(credentials.serverUrl).toBe('https://api.example.com');
      expect(credentials.token).toBe('tok-1');
      expect(credentials.user).toBeNull();
    });

    it('handles user JSON missing id or email gracefully', async () => {
      mockStorage.set(SECURE_STORE_KEYS.SERVER_URL, 'https://api.example.com');
      mockStorage.set(SECURE_STORE_KEYS.DEVICE_TOKEN, 'tok-1');
      mockStorage.set(SECURE_STORE_KEYS.USER_INFO, JSON.stringify({ name: 'Aarav' }));

      const credentials = await getStoredCredentials();
      expect(credentials.user).toBeNull();
    });

    it('clears all credentials upon disconnect', async () => {
      await saveStoredCredentials('https://api.example.com', 'jwt-123', sampleUser);
      expect(mockStorage.size).toBe(3);

      await clearCredentials();
      expect(mockStorage.size).toBe(0);

      const credentials = await getStoredCredentials();
      expect(credentials).toEqual({
        serverUrl: null,
        token: null,
        user: null,
      });
    });
  });

  describe('parseAndValidateQrPayload', () => {
    it('successfully parses valid QR payload with future expiration', () => {
      const futureDate = new Date(Date.now() + 1000 * 60 * 10).toISOString();
      const payloadString = JSON.stringify({
        serverUrl: 'https://portfolio.local:3000',
        pairingSecret: 'pair_secret_999',
        expiresAt: futureDate,
      });

      const parsed = parseAndValidateQrPayload(payloadString);
      expect(parsed).toEqual({
        serverUrl: 'https://portfolio.local:3000',
        pairingSecret: 'pair_secret_999',
        expiresAt: futureDate,
      });
    });

    it('throws on empty payload', () => {
      expect(() => parseAndValidateQrPayload('')).toThrow('Empty QR code payload');
      expect(() => parseAndValidateQrPayload('   ')).toThrow('Empty QR code payload');
    });

    it('throws on malformed JSON payload', () => {
      expect(() => parseAndValidateQrPayload('not-json')).toThrow(
        'Malformed QR code: invalid JSON',
      );
    });

    it('throws if payload is not an object', () => {
      expect(() => parseAndValidateQrPayload('"just a string"')).toThrow(
        'Invalid QR payload format',
      );
    });

    it('throws if required fields are missing', () => {
      const missingSecret = JSON.stringify({
        serverUrl: 'https://portfolio.local',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });
      expect(() => parseAndValidateQrPayload(missingSecret)).toThrow(
        'QR payload is missing required pairing fields',
      );

      const missingUrl = JSON.stringify({
        pairingSecret: 'sec_1',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });
      expect(() => parseAndValidateQrPayload(missingUrl)).toThrow(
        'QR payload is missing required pairing fields',
      );
    });

    it('throws if server URL is not http/https', () => {
      const invalidUrl = JSON.stringify({
        serverUrl: 'ftp://files.example.com',
        pairingSecret: 'sec_1',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });
      expect(() => parseAndValidateQrPayload(invalidUrl)).toThrow(
        'Invalid server URL in QR payload',
      );
    });

    it('throws if QR payload is expired', () => {
      const pastDate = new Date(Date.now() - 1000 * 60).toISOString();
      const expiredPayload = JSON.stringify({
        serverUrl: 'http://192.168.1.5:3000',
        pairingSecret: 'sec_1',
        expiresAt: pastDate,
      });
      expect(() => parseAndValidateQrPayload(expiredPayload)).toThrow(
        'Pairing QR code has expired',
      );
    });

    it('throws if expiresAt is invalid date format', () => {
      const invalidDatePayload = JSON.stringify({
        serverUrl: 'http://192.168.1.5:3000',
        pairingSecret: 'sec_1',
        expiresAt: 'not-a-date',
      });
      expect(() => parseAndValidateQrPayload(invalidDatePayload)).toThrow(
        'Pairing QR code has expired',
      );
    });
  });

  describe('claimPairingSecret', () => {
    it('successfully claims pairing secret and persists credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: 'device-jwt-777',
          user: sampleUser,
        }),
      });

      const result = await claimPairingSecret(
        'https://portfolio.example.com/',
        'pair_sec_456',
        'iPhone 16 Pro',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://portfolio.example.com/api/v1/auth/pair/claim',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pairingSecret: 'pair_sec_456',
            deviceName: 'iPhone 16 Pro',
          }),
        },
      );

      expect(result).toEqual({
        token: 'device-jwt-777',
        user: sampleUser,
      });

      const creds = await getStoredCredentials();
      expect(creds.serverUrl).toBe('https://portfolio.example.com');
      expect(creds.token).toBe('device-jwt-777');
      expect(creds.user).toEqual(sampleUser);
    });

    it('throws formatted error message when server returns error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          message: 'Pairing secret has expired',
        }),
      });

      await expect(
        claimPairingSecret('https://api.example.com', 'expired_sec', 'Pixel 9'),
      ).rejects.toThrow('Failed to pair device: Pairing secret has expired');

      const creds = await getStoredCredentials();
      expect(creds.token).toBeNull();
    });

    it('throws fallback HTTP status when server response is not JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new Error('Bad gateway');
        },
      });

      await expect(
        claimPairingSecret('https://api.example.com', 'sec', 'Device'),
      ).rejects.toThrow('Failed to pair device: HTTP 502');
    });

    it('throws error when server response is missing token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: sampleUser,
        }),
      });

      await expect(
        claimPairingSecret('https://api.example.com', 'sec', 'Device'),
      ).rejects.toThrow('Invalid pair claim response: missing token');
    });

    it('throws error when network request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network connection failed'));

      await expect(
        claimPairingSecret('https://api.example.com', 'sec', 'Device'),
      ).rejects.toThrow('Network connection failed');
    });
  });

  describe('loginWithCredentials', () => {
    it('successfully logs in with email and password and stores credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: 'jwt-cred-login-token-123',
          user: sampleUser,
        }),
      });

      const result = await loginWithCredentials(
        'http://10.0.2.2:8080',
        'admin@example.com',
        'password123',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'http://10.0.2.2:8080/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@example.com',
            password: 'password123',
          }),
        },
      );

      expect(result).toEqual({
        token: 'jwt-cred-login-token-123',
        user: sampleUser,
      });

      const creds = await getStoredCredentials();
      expect(creds.serverUrl).toBe('http://10.0.2.2:8080');
      expect(creds.token).toBe('jwt-cred-login-token-123');
      expect(creds.user).toEqual(sampleUser);
    });

    it('throws formatted error when server rejects credentials with 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          message: 'Invalid email or password',
        }),
      });

      await expect(
        loginWithCredentials('http://10.0.2.2:8080', 'wrong@example.com', 'badpass'),
      ).rejects.toThrow('Login failed: Invalid email or password');

      const creds = await getStoredCredentials();
      expect(creds.token).toBeNull();
    });

    it('defaults server URL when empty string is passed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: 'token-default-url',
          user: sampleUser,
        }),
      });

      await loginWithCredentials('', 'user@example.com', 'pass');

      expect(mockFetch).toHaveBeenCalledWith(
        `${DEFAULT_SERVER_URL}/api/auth/login`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('rewrites localhost to 10.0.2.2 on Android platforms to prevent ConnectException', () => {
      expect(DEFAULT_SERVER_URL).toBe('http://10.0.2.2:8082');
      expect(LOCAL_DEV_SERVER_URL).toBe('http://10.0.2.2:8080');

      const normalized = normalizeServerUrl('http://localhost:8082');
      expect(normalized).toBe('http://10.0.2.2:8082');

      const normalizedIp = normalizeServerUrl('http://127.0.0.1:8082');
      expect(normalizedIp).toBe('http://10.0.2.2:8082');
    });
  });

  describe('authenticateWithBiometrics', () => {
    it('returns unavailable when device lacks biometric hardware', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValueOnce(false);

      const result = await authenticateWithBiometrics();
      expect(result).toEqual({
        success: false,
        isAvailable: false,
        error: 'Biometric hardware unavailable',
      });
      expect(mockLocalAuth.authenticateAsync).not.toHaveBeenCalled();
    });

    it('returns unavailable when device has no biometrics enrolled', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValueOnce(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValueOnce(false);

      const result = await authenticateWithBiometrics();
      expect(result).toEqual({
        success: false,
        isAvailable: false,
        error: 'No biometrics enrolled',
      });
      expect(mockLocalAuth.authenticateAsync).not.toHaveBeenCalled();
    });

    it('returns success when biometric authentication passes', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValueOnce(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValueOnce(true);
      mockLocalAuth.authenticateAsync.mockResolvedValueOnce({
        success: true,
      });

      const result = await authenticateWithBiometrics('Custom Prompt Message');
      expect(result).toEqual({
        success: true,
        isAvailable: true,
      });
      expect(mockLocalAuth.authenticateAsync).toHaveBeenCalledWith({
        promptMessage: 'Custom Prompt Message',
        fallbackLabel: 'Use Device Passcode',
        disableDeviceFallback: false,
      });
    });

    it('returns error when user cancels authentication', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValueOnce(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValueOnce(true);
      mockLocalAuth.authenticateAsync.mockResolvedValueOnce({
        success: false,
        error: 'user_cancel',
      });

      const result = await authenticateWithBiometrics();
      expect(result).toEqual({
        success: false,
        isAvailable: true,
        error: 'user_cancel',
      });
    });

    it('handles unexpected exceptions safely', async () => {
      mockLocalAuth.hasHardwareAsync.mockRejectedValueOnce(new Error('Native auth error'));

      const result = await authenticateWithBiometrics();
      expect(result).toEqual({
        success: false,
        isAvailable: false,
        error: 'Native auth error',
      });
    });
  });
});
