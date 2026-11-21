import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import type { PairClaimRequest, PairClaimResponse, UserResponse } from '../types/generated';

export const SECURE_STORE_KEYS = {
  SERVER_URL: 'PORTFOLIO_SERVER_URL',
  DEVICE_TOKEN: 'PORTFOLIO_DEVICE_TOKEN',
  USER_INFO: 'PORTFOLIO_USER_INFO',
} as const;

export interface StoredCredentials {
  serverUrl: string | null;
  token: string | null;
  user: UserResponse | null;
}

export interface QrPairingPayload {
  serverUrl: string;
  pairingSecret: string;
  expiresAt: string;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  isAvailable: boolean;
}

function isValidUser(val: unknown): val is UserResponse {
  if (typeof val !== 'object' || val === null) {
    return false;
  }
  const record = val as Record<string, unknown>;
  return typeof record['id'] === 'string' && typeof record['email'] === 'string';
}

function parseStoredUser(userInfoRaw: string | null): UserResponse | null {
  if (!userInfoRaw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(userInfoRaw);
    return isValidUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Retrieves stored authentication credentials from secure hardware storage.
 */
export async function getStoredCredentials(): Promise<StoredCredentials> {
  const [serverUrl, token, userInfoRaw] = await Promise.all([
    SecureStore.getItemAsync(SECURE_STORE_KEYS.SERVER_URL),
    SecureStore.getItemAsync(SECURE_STORE_KEYS.DEVICE_TOKEN),
    SecureStore.getItemAsync(SECURE_STORE_KEYS.USER_INFO),
  ]);

  return {
    serverUrl,
    token,
    user: parseStoredUser(userInfoRaw),
  };
}

/**
 * Securely persists server connection URL, device token, and user profile.
 */
export async function saveStoredCredentials(
  serverUrl: string,
  token: string,
  user: UserResponse,
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(SECURE_STORE_KEYS.SERVER_URL, serverUrl),
    SecureStore.setItemAsync(SECURE_STORE_KEYS.DEVICE_TOKEN, token),
    SecureStore.setItemAsync(SECURE_STORE_KEYS.USER_INFO, JSON.stringify(user)),
  ]);
}

/**
 * Clears all stored credentials from secure hardware storage.
 */
export async function clearCredentials(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.SERVER_URL),
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.DEVICE_TOKEN),
    SecureStore.deleteItemAsync(SECURE_STORE_KEYS.USER_INFO),
  ]);
}

function parseQrJson(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Empty QR code payload');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Malformed QR code: invalid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid QR payload format');
  }
  return parsed as Record<string, unknown>;
}

function validateServerUrl(serverUrl: string): void {
  if (!serverUrl) {
    throw new Error('QR payload is missing required pairing fields');
  }
  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
    throw new Error('Invalid server URL in QR payload');
  }
}

function validateExpiry(expiresAt: string): void {
  if (!expiresAt) {
    throw new Error('QR payload is missing required pairing fields');
  }
  const expirationTime = new Date(expiresAt).getTime();
  if (isNaN(expirationTime) || expirationTime <= Date.now()) {
    throw new Error('Pairing QR code has expired');
  }
}

function validateQrFields(record: Record<string, unknown>): QrPairingPayload {
  const serverUrl = typeof record['serverUrl'] === 'string' ? record['serverUrl'].trim() : '';
  const pairingSecret = typeof record['pairingSecret'] === 'string' ? record['pairingSecret'].trim() : '';
  const expiresAt = typeof record['expiresAt'] === 'string' ? record['expiresAt'].trim() : '';

  validateServerUrl(serverUrl);
  if (!pairingSecret) {
    throw new Error('QR payload is missing required pairing fields');
  }
  validateExpiry(expiresAt);

  return { serverUrl, pairingSecret, expiresAt };
}

/**
 * Parses and validates scanned QR payload.
 */
export function parseAndValidateQrPayload(raw: string): QrPairingPayload {
  const record = parseQrJson(raw);
  return validateQrFields(record);
}

function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function validatePairClaimResponse(data: unknown): PairClaimResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid pair claim response: expected object');
  }
  const record = data as Record<string, unknown>;
  const token = record['token'];
  const user = record['user'];
  if (typeof token !== 'string' || !token) {
    throw new Error('Invalid pair claim response: missing token');
  }
  if (!isValidUser(user)) {
    throw new Error('Invalid pair claim response: invalid user profile');
  }
  return { token, user };
}

async function extractErrorDetail(response: Response): Promise<string> {
  let errorDetail = `HTTP ${response.status}`;
  try {
    const errJson = (await response.json()) as Record<string, unknown>;
    if (typeof errJson['message'] === 'string') {
      errorDetail = errJson['message'];
    }
  } catch {
    // Retain default HTTP status code message
  }
  return errorDetail;
}

/**
 * Claims a pairing secret from the remote server, exchanges it for a token,
 * and saves credentials to secure storage.
 */
export async function claimPairingSecret(
  serverUrl: string,
  pairingSecret: string,
  deviceName: string,
): Promise<PairClaimResponse> {
  const normalizedUrl = normalizeServerUrl(serverUrl);
  const endpoint = `${normalizedUrl}/api/v1/auth/pair/claim`;
  const body: PairClaimRequest = {
    pairingSecret: pairingSecret.trim(),
    deviceName: deviceName.trim(),
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await extractErrorDetail(response);
    throw new Error(`Failed to pair device: ${detail}`);
  }

  const rawJson: unknown = await response.json();
  const claimResponse = validatePairClaimResponse(rawJson);
  await saveStoredCredentials(normalizedUrl, claimResponse.token, claimResponse.user);
  return claimResponse;
}

export const DEFAULT_SERVER_URL = 'http://10.0.2.2:8080';

export interface LoginResponse {
  token: string;
  user: UserResponse;
}

function parseLoginResponse(data: unknown): LoginResponse {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid login response: expected object');
  }
  const record = data as Record<string, unknown>;
  const token = record['token'];
  if (typeof token !== 'string' || !token) {
    throw new Error('Invalid login response: missing token');
  }

  const rawUser = record['user'];
  let user: UserResponse | null = null;
  if (isValidUser(rawUser)) {
    user = rawUser;
  } else if (typeof record['id'] === 'string' && typeof record['email'] === 'string') {
    user = { id: record['id'], email: record['email'] };
  }

  if (!user) {
    throw new Error('Invalid login response: invalid user profile');
  }

  return { token, user };
}

/**
 * Logs in with email and password directly against the server,
 * saves credentials in secure storage, and returns user identity.
 *
 * @param serverUrl - Backend API root URL (defaults to http://10.0.2.2:8080)
 * @param email - User email address
 * @param password - Account password
 * @returns Login authentication response
 */
export async function loginWithCredentials(
  serverUrl: string,
  email: string,
  password: string,
): Promise<LoginResponse> {
  const trimmedUrl = serverUrl.trim();
  const normalizedUrl = normalizeServerUrl(trimmedUrl || DEFAULT_SERVER_URL);
  const endpoint = `${normalizedUrl}/api/auth/login`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });

  if (!response.ok) {
    const detail = await extractErrorDetail(response);
    throw new Error(`Login failed: ${detail}`);
  }

  const rawJson: unknown = await response.json();
  const loginRes = parseLoginResponse(rawJson);
  await saveStoredCredentials(normalizedUrl, loginRes.token, loginRes.user);
  return loginRes;
}

/**
 * Prompts user for biometric authentication (Face ID, Touch ID, Fingerprint, or PIN fallback).
 */
export async function authenticateWithBiometrics(
  promptMessage: string = 'Unlock Portfolio Tracker',
): Promise<BiometricAuthResult> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { success: false, isAvailable: false, error: 'Biometric hardware unavailable' };
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return { success: false, isAvailable: false, error: 'No biometrics enrolled' };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use Device Passcode',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true, isAvailable: true };
    }

    return {
      success: false,
      isAvailable: true,
      error: result.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown authentication error';
    return { success: false, isAvailable: false, error: message };
  }
}
