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
} from '../../src/services/auth-service';
import { ScannerView, ManualPairForm } from '../../src/components';

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
    marginBottom: 24,
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

function usePairingFlow() {
  const router = useRouter();
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [isPairing, setIsPairing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const executeClaim = useCallback(
    async (serverUrl: string, secret: string) => {
      setIsPairing(true);
      setErrorMessage(null);
      try {
        await claimPairingSecret(serverUrl, secret, 'Mobile Device');
        router.replace('/(tabs)');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Pairing failed');
      } finally {
        setIsPairing(false);
      }
    },
    [router],
  );

  const handleScan = useCallback(
    (scannedData: string) => {
      try {
        const payload = parseAndValidateQrPayload(scannedData);
        void executeClaim(payload.serverUrl, payload.pairingSecret);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Invalid QR code');
      }
    },
    [executeClaim],
  );

  const handleManualSubmit = useCallback(
    (url: string, secret: string) => {
      if (!url.trim() || !secret.trim()) {
        setErrorMessage('Both Server URL and Pairing Secret are required');
        return;
      }
      void executeClaim(url, secret);
    },
    [executeClaim],
  );

  return { mode, setMode, isPairing, errorMessage, handleScan, handleManualSubmit };
}

/**
 * QR Scanner and Manual Pairing Screen for connecting the mobile app to portfolio-api.
 */
export default function PairScreen(): React.ReactElement {
  const { mode, setMode, isPairing, errorMessage, handleScan, handleManualSubmit } =
    usePairingFlow();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Pair with Server</Text>
        <Text style={styles.subtitle}>
          Scan the QR code displayed on your web dashboard to pair this device.
        </Text>
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {mode === 'camera' ? (
        <>
          <ScannerView
            onScan={handleScan}
            isPairing={isPairing}
            onSwitchToManual={() => setMode('manual')}
          />
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => setMode('manual')}
            disabled={isPairing}
          >
            <Text style={styles.linkButtonText}>Trouble scanning? Enter code manually</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ManualPairForm
          onSubmit={handleManualSubmit}
          isPairing={isPairing}
          onSwitchToCamera={() => setMode('camera')}
        />
      )}
    </ScrollView>
  );
}
