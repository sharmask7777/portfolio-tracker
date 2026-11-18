import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  authenticateWithBiometrics,
  getStoredCredentials,
  clearCredentials,
} from '../../src/services/auth-service';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  iconPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  userBadge: {
    fontSize: 13,
    color: '#60a5fa',
    backgroundColor: '#1e3a8a33',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
  },
  errorBanner: {
    width: '100%',
    backgroundColor: '#7f1d1d33',
    borderColor: '#b91c1c',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#71717a',
    fontSize: 14,
  },
});

function useBiometricLock() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUnlock = useCallback(async () => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const result = await authenticateWithBiometrics('Unlock Portfolio Tracker');
      if (result.success) {
        router.replace('/(tabs)');
      } else {
        setErrorMessage(result.error ?? 'Biometric authentication failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Biometric error occurred';
      setErrorMessage(msg);
    } finally {
      setIsAuthenticating(false);
    }
  }, [router]);

  const handleDisconnect = useCallback(async () => {
    try {
      await clearCredentials();
      router.replace('/(auth)/pair');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear credentials';
      setErrorMessage(msg);
    }
  }, [router]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const creds = await getStoredCredentials();
      if (mounted && creds.user?.email) {
        setUserEmail(creds.user.email);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { userEmail, isAuthenticating, errorMessage, handleUnlock, handleDisconnect };
}

/**
 * Biometric lock screen displayed when returning to the app with existing credentials.
 */
export default function LockScreen(): React.ReactElement {
  const { userEmail, isAuthenticating, errorMessage, handleUnlock, handleDisconnect } =
    useBiometricLock();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconPlaceholder}>
          <Text style={styles.iconText}>🔒</Text>
        </View>

        <Text style={styles.title}>Portfolio Tracker</Text>
        <Text style={styles.subtitle}>
          Your financial data is protected by biometric security.
        </Text>

        {userEmail ? (
          <Text style={styles.userBadge}>Connected as {userEmail}</Text>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleUnlock}
          disabled={isAuthenticating}
          activeOpacity={0.8}
          testID="unlock-portfolio-btn"
          accessibilityLabel="Unlock Portfolio"
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Unlock Portfolio</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleDisconnect}
          disabled={isAuthenticating}
        >
          <Text style={styles.secondaryButtonText}>Unpair / Switch Device</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
