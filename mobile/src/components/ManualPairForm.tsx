import React, { useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { classifyTransportSecurity, TransportSecurityInfo } from '../services/transport-security';

const styles = StyleSheet.create({
  manualCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#d4d4d8',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f4f4f5',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  linkButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#60a5fa',
    fontSize: 14,
  },
  warningBanner: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
  },
  warningLocal: {
    backgroundColor: '#2e2008',
    borderColor: '#d97706',
  },
  warningPublic: {
    backgroundColor: '#3b0d0c',
    borderColor: '#dc2626',
  },
  warningText: {
    fontSize: 12,
    lineHeight: 16,
  },
  warningTextLocal: {
    color: '#fbbf24',
  },
  warningTextPublic: {
    color: '#f87171',
  },
  badgeSecure: {
    fontSize: 11,
    color: '#34d399',
    marginTop: 4,
    fontWeight: '500',
  },
});

interface FormFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  testID?: string;
}

function FormField({
  label,
  placeholder,
  value,
  onChangeText,
  testID,
}: FormFieldProps): React.ReactElement {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#71717a"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        testID={testID}
        accessibilityLabel={label}
      />
    </View>
  );
}

function SecurityBanner({ info }: { info: TransportSecurityInfo | null }): React.ReactElement | null {
  if (!info) return null;
  if (info.level === 'SECURE') {
    return (
      <Text style={styles.badgeSecure} testID="transport-secure-badge">
        🔒 Secure TLS Connection
      </Text>
    );
  }
  const isLocal = info.level === 'LOCAL_INSECURE';
  return (
    <View
      style={[styles.warningBanner, isLocal ? styles.warningLocal : styles.warningPublic]}
      testID={isLocal ? 'transport-warning-local' : 'transport-warning-public'}
    >
      <Text style={[styles.warningText, isLocal ? styles.warningTextLocal : styles.warningTextPublic]}>
        {isLocal ? '⚠️ ' : '🛑 '}
        {info.warningMessage}
      </Text>
    </View>
  );
}

/**
 * Props for {@link ManualPairForm}.
 */
export interface ManualPairFormProps {
  /** Callback fired with serverUrl and pairingSecret upon form submission */
  onSubmit: (serverUrl: string, secret: string) => void;
  /** Whether pairing HTTP request is actively in progress */
  isPairing: boolean;
  /** Callback to switch back to QR camera scanner view */
  onSwitchToCamera: () => void;
}

/**
 * Fallback form allowing manual entry of server URL and pairing secret
 * when camera is unavailable or QR scanning is not preferred.
 */
export function ManualPairForm({
  onSubmit,
  isPairing,
  onSwitchToCamera,
}: ManualPairFormProps): React.ReactElement {
  const [serverUrl, setServerUrl] = useState('');
  const [secret, setSecret] = useState('');

  const securityInfo = useMemo(() => {
    return serverUrl.trim() ? classifyTransportSecurity(serverUrl) : null;
  }, [serverUrl]);

  const handleSubmit = useCallback(() => {
    onSubmit(serverUrl, secret);
  }, [onSubmit, serverUrl, secret]);

  return (
    <View style={styles.manualCard}>
      <FormField
        label="Server URL"
        placeholder="https://portfolio.example.com"
        value={serverUrl}
        onChangeText={setServerUrl}
        testID="server-url-input"
      />
      <SecurityBanner info={securityInfo} />
      <FormField
        label="Pairing Secret"
        placeholder="pair_abc123..."
        value={secret}
        onChangeText={setSecret}
        testID="pairing-secret-input"
      />
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSubmit}
        disabled={isPairing}
        activeOpacity={0.8}
        testID="connect-pair-btn"
        accessibilityLabel="Connect & Pair"
      >
        {isPairing ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>Connect & Pair</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkButton} onPress={onSwitchToCamera} disabled={isPairing}>
        <Text style={styles.linkButtonText}>Switch to QR Scanner</Text>
      </TouchableOpacity>
    </View>
  );
}
