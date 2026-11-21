import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  claimPairingSecret,
  parseAndValidateQrPayload,
  loginWithCredentials,
} from '../../src/services/auth-service';
import { ScannerView } from '../../src/components/ScannerView';
import { ManualPairForm } from '../../src/components/ManualPairForm';
import { CredentialLoginForm } from '../../src/components/Auth/CredentialLoginForm';

export type PairScreenMode = 'camera' | 'credentials' | 'manual';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  content: {
    flexGrow: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    width: '100%',
    maxWidth: 340,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#27272a',
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  tabButtonTextActive: {
    color: '#f4f4f5',
  },
  errorBanner: {
    width: '100%',
    maxWidth: 340,
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
  linkButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#60a5fa',
    fontSize: 14,
  },
});

function useAuthSubmit(router: ReturnType<typeof useRouter>) {
  const [isPairing, setIsPairing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runAuth = useCallback(
    async (action: () => Promise<unknown>, fallbackMsg: string) => {
      setIsPairing(true);
      setErrorMessage(null);
      try {
        await action();
        router.replace('/(tabs)');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : fallbackMsg);
      } finally {
        setIsPairing(false);
      }
    },
    [router],
  );

  return { isPairing, errorMessage, setErrorMessage, runAuth };
}

function usePairingFlow() {
  const router = useRouter();
  const [mode, setMode] = useState<PairScreenMode>('camera');
  const { isPairing, errorMessage, setErrorMessage, runAuth } = useAuthSubmit(router);

  const handleScan = useCallback(
    (scannedData: string) => {
      try {
        const payload = parseAndValidateQrPayload(scannedData);
        void runAuth(
          () => claimPairingSecret(payload.serverUrl, payload.pairingSecret, 'Mobile Device'),
          'Pairing failed',
        );
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Invalid QR code');
      }
    },
    [runAuth, setErrorMessage],
  );

  const handleManualSubmit = useCallback(
    (url: string, secret: string) => {
      if (!url.trim() || !secret.trim()) {
        setErrorMessage('Both Server URL and Pairing Secret are required');
        return;
      }
      void runAuth(() => claimPairingSecret(url, secret, 'Mobile Device'), 'Pairing failed');
    },
    [runAuth, setErrorMessage],
  );

  const handleCredentialSubmit = useCallback(
    async (serverUrl: string, email: string, pass: string) => {
      await runAuth(
        async () => {
          await loginWithCredentials(serverUrl, email, pass);
        },
        'Login failed',
      );
    },
    [runAuth],
  );

  return {
    mode,
    setMode,
    isPairing,
    errorMessage,
    handleScan,
    handleManualSubmit,
    handleCredentialSubmit,
  };
}

interface ModeTabsProps {
  readonly mode: PairScreenMode;
  readonly onSelectMode: (m: PairScreenMode) => void;
  readonly disabled: boolean;
}

function ModeTabs(props: ModeTabsProps): React.ReactElement {
  const { mode, onSelectMode, disabled } = props;
  const tabs: Array<{ id: PairScreenMode; label: string; testID: string }> = [
    { id: 'camera', label: 'Scan QR', testID: 'tab-scan-qr' },
    { id: 'credentials', label: 'Password', testID: 'tab-credentials' },
    { id: 'manual', label: 'Pair Code', testID: 'tab-pair-code' },
  ];

  return (
    <View style={styles.tabContainer} testID="pair-mode-tabs">
      {tabs.map((t) => {
        const active = mode === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabButton, active && styles.tabButtonActive]}
            onPress={() => onSelectMode(t.id)}
            disabled={disabled}
            testID={t.testID}
          >
            <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface PairModeContentProps {
  readonly mode: PairScreenMode;
  readonly isPairing: boolean;
  readonly errorMessage: string | null;
  readonly onScan: (scannedData: string) => void;
  readonly onManualSubmit: (url: string, secret: string) => void;
  readonly onCredentialSubmit: (url: string, email: string, pass: string) => Promise<void>;
  readonly onSetMode: (m: PairScreenMode) => void;
}

function PairModeContent(props: PairModeContentProps): React.ReactElement {
  const { mode, isPairing, errorMessage, onScan, onManualSubmit, onCredentialSubmit, onSetMode } = props;

  if (mode === 'credentials') {
    return (
      <CredentialLoginForm
        onSubmit={onCredentialSubmit}
        isLoading={isPairing}
        onCancel={() => onSetMode('camera')}
        error={errorMessage}
      />
    );
  }

  if (mode === 'manual') {
    return (
      <ManualPairForm
        onSubmit={onManualSubmit}
        isPairing={isPairing}
        onSwitchToCamera={() => onSetMode('camera')}
      />
    );
  }

  return (
    <>
      <ScannerView
        onScan={onScan}
        isPairing={isPairing}
        onSwitchToManual={() => onSetMode('manual')}
      />
      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => onSetMode('credentials')}
        disabled={isPairing}
        testID="switch-to-credentials-btn"
      >
        <Text style={styles.linkButtonText}>Or sign in with Email & Password</Text>
      </TouchableOpacity>
    </>
  );
}

/**
 * Main pairing and authentication screen supporting QR scan, credentials, and manual pairing code.
 */
export default function PairScreen(): React.ReactElement {
  const {
    mode,
    setMode,
    isPairing,
    errorMessage,
    handleScan,
    handleManualSubmit,
    handleCredentialSubmit,
  } = usePairingFlow();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Pair with Server</Text>
        <Text style={styles.subtitle}>
          Scan the QR code, log in with your account, or enter a pairing code.
        </Text>
      </View>
      <ModeTabs mode={mode} onSelectMode={setMode} disabled={isPairing} />
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
      <PairModeContent
        mode={mode}
        isPairing={isPairing}
        errorMessage={errorMessage}
        onScan={handleScan}
        onManualSubmit={handleManualSubmit}
        onCredentialSubmit={handleCredentialSubmit}
        onSetMode={setMode}
      />
    </ScrollView>
  );
}
