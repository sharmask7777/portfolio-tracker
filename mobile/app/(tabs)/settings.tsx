import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getStoredCredentials,
  clearCredentials,
  authenticateWithBiometrics,
} from '../../src/services/auth-service';
import { checkServerReachable } from '../../src/services/portfolio-service';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  content: {
    padding: 20,
    paddingTop: 56,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f4f4f5',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#a1a1aa',
  },
  sectionCard: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#93c5fd',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  lastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
  },
  label: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f4f4f5',
    maxWidth: 200,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeGreen: {
    backgroundColor: '#14532d',
  },
  badgeAmber: {
    backgroundColor: '#78350f',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  button: {
    backgroundColor: '#27272a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
  },
  disconnectButton: {
    backgroundColor: '#7f1d1d33',
    borderColor: '#b91c1c',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  disconnectText: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '700',
  },
});

interface SettingsState {
  serverUrl: string | null;
  userEmail: string | null;
  isPaired: boolean;
  isOnline: boolean;
  isChecking: boolean;
}

function useSettingsState() {
  const router = useRouter();
  const [state, setState] = useState<SettingsState>({
    serverUrl: null,
    userEmail: null,
    isPaired: false,
    isOnline: false,
    isChecking: true,
  });

  const loadSettings = useCallback(async () => {
    try {
      const creds = await getStoredCredentials();
      const serverUrl = creds.serverUrl;
      const userEmail = creds.user?.email || null;
      const isPaired = Boolean(creds.token);
      let isOnline = false;
      if (serverUrl) {
        isOnline = await checkServerReachable(serverUrl);
      }
      setState({ serverUrl, userEmail, isPaired, isOnline, isChecking: false });
    } catch {
      setState((prev) => ({ ...prev, isChecking: false }));
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      await clearCredentials();
      router.replace('/(auth)/pair');
    } catch {
      Alert.alert('Error', 'Failed to disconnect');
    }
  }, [router]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return { state, handleDisconnect, reload: loadSettings };
}

function renderConnectionCard(state: SettingsState): React.ReactElement {
  const modeBadge = state.isOnline ? styles.badgeGreen : styles.badgeAmber;
  const modeText = state.isOnline ? 'Online' : 'Offline / Standalone';

  return (
    <View style={styles.sectionCard} testID="settings-connection-card">
      <Text style={styles.sectionTitle}>Server Connection</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Server URL</Text>
        <Text style={styles.value} numberOfLines={1}>
          {state.serverUrl || 'Not configured'}
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Paired Status</Text>
        <View style={[styles.badge, state.isPaired ? styles.badgeGreen : styles.badgeAmber]}>
          <Text style={styles.badgeText}>{state.isPaired ? 'Paired' : 'Unpaired'}</Text>
        </View>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Connected User</Text>
        <Text style={styles.value}>{state.userEmail || 'Local User'}</Text>
      </View>
      <View style={styles.lastRow}>
        <Text style={styles.label}>Network Mode</Text>
        <View style={[styles.badge, modeBadge]}>
          <Text style={styles.badgeText}>{modeText}</Text>
        </View>
      </View>
    </View>
  );
}

function renderSecurityCard(): React.ReactElement {
  const onTestAuth = async () => {
    const res = await authenticateWithBiometrics('Test Biometric Verification');
    const msg = res.success ? 'Biometric verification passed!' : res.error || 'Failed';
    Alert.alert('Biometric Test', msg);
  };

  return (
    <View style={styles.sectionCard} testID="settings-security-card">
      <Text style={styles.sectionTitle}>Security & Offline Storage</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Biometric Lock</Text>
        <View style={[styles.badge, styles.badgeGreen]}>
          <Text style={styles.badgeText}>Enabled</Text>
        </View>
      </View>
      <View style={styles.lastRow}>
        <Text style={styles.label}>Local Database</Text>
        <Text style={styles.value}>SQLite (Encrypted KeyStore)</Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={() => void onTestAuth()}
        testID="test-biometric-button"
      >
        <Text style={styles.buttonText}>Test Biometric Prompt</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function SettingsScreen(): React.ReactElement {
  const { state, handleDisconnect } = useSettingsState();

  if (state.isChecking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="settings-scroll"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>App & Server Configuration</Text>
      </View>

      {renderConnectionCard(state)}
      {renderSecurityCard()}

      <TouchableOpacity
        style={styles.disconnectButton}
        onPress={() => void handleDisconnect()}
        testID="disconnect-button"
      >
        <Text style={styles.disconnectText}>Disconnect / Unpair Device</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
