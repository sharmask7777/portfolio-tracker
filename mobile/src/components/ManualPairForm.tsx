import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';

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

export interface ManualPairFormProps {
  onSubmit: (serverUrl: string, secret: string) => void;
  isPairing: boolean;
  onSwitchToCamera: () => void;
}

export function ManualPairForm({
  onSubmit,
  isPairing,
  onSwitchToCamera,
}: ManualPairFormProps): React.ReactElement {
  const [serverUrl, setServerUrl] = useState('');
  const [secret, setSecret] = useState('');

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
