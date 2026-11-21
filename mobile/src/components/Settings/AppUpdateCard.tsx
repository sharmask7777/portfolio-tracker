import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { DownloadCloud, CheckCircle2, AlertCircle } from 'lucide-react-native';
import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  type AppReleaseInfo,
} from '../../services/app-update-service';

const styles = StyleSheet.create({
  card: {
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
  label: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f4f4f5',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#27272a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  downloadButton: {
    backgroundColor: '#2563eb',
  },
  buttonText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
  },
  downloadButtonText: {
    color: '#ffffff',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  statusText: {
    fontSize: 13,
    color: '#a1a1aa',
    flex: 1,
  },
  notes: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 8,
    lineHeight: 16,
  },
});

/**
 * Props for AppUpdateCard component.
 */
export interface AppUpdateCardProps {
  readonly currentVersion?: string;
  readonly repoOwner?: string;
  readonly repoName?: string;
}

interface ActionButtonsProps {
  readonly isChecking: boolean;
  readonly releaseInfo: AppReleaseInfo | null;
  readonly onCheck: () => void;
  readonly onInstall: () => void;
}

function renderActionButtons({
  isChecking,
  releaseInfo,
  onCheck,
  onInstall,
}: ActionButtonsProps): React.ReactElement {
  if (releaseInfo?.hasUpdate) {
    return (
      <TouchableOpacity
        style={[styles.button, styles.downloadButton]}
        onPress={onInstall}
        testID="download-update-button"
      >
        <DownloadCloud size={16} color="#ffffff" />
        <Text style={[styles.buttonText, styles.downloadButtonText]}>
          Download & Install {releaseInfo.version}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onCheck}
      disabled={isChecking}
      testID="check-updates-button"
    >
      {isChecking ? (
        <ActivityIndicator size="small" color="#60a5fa" />
      ) : (
        <>
          <DownloadCloud size={16} color="#60a5fa" />
          <Text style={styles.buttonText}>Check for Updates</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function useAppUpdate(repoOwner: string, repoName: string) {
  const [isChecking, setIsChecking] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<AppReleaseInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCheck = useCallback(async () => {
    setIsChecking(true);
    setErrorMsg(null);
    try {
      const info = await checkForAppUpdate(repoOwner, repoName);
      setReleaseInfo(info);
      if (!info) setErrorMsg('Unable to check for updates. Check internet connectivity.');
    } catch {
      setErrorMsg('Error checking GitHub releases.');
    } finally {
      setIsChecking(false);
    }
  }, [repoOwner, repoName]);

  const handleInstall = useCallback(async () => {
    if (!releaseInfo?.downloadUrl) {
      Alert.alert('Download Unavailable', 'No direct APK download asset found in release.');
      return;
    }
    const success = await downloadAndInstallUpdate(releaseInfo.downloadUrl);
    if (!success) {
      Alert.alert('Install Error', 'Unable to launch browser/installer for APK download.');
    }
  }, [releaseInfo]);

  return { isChecking, releaseInfo, errorMsg, handleCheck, handleInstall };
}

/**
 * Settings card providing manual and on-demand checking for new APK releases from GitHub.
 *
 * @param props - AppUpdateCardProps configuration
 * @returns React Native component element
 */
export function AppUpdateCard({
  currentVersion = '1.0.0',
  repoOwner = 'sharmask7777',
  repoName = 'portfolio-tracker',
}: AppUpdateCardProps): React.ReactElement {
  const { isChecking, releaseInfo, errorMsg, handleCheck, handleInstall } = useAppUpdate(
    repoOwner,
    repoName,
  );

  return (
    <View style={styles.card} testID="settings-update-card">
      <Text style={styles.sectionTitle}>App Version & Updates</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Installed Version</Text>
        <Text style={styles.value} testID="installed-app-version">{currentVersion}</Text>
      </View>
      {renderStatusSection({ isChecking, releaseInfo, errorMsg })}
      {renderActionButtons({
        isChecking,
        releaseInfo,
        onCheck: () => void handleCheck(),
        onInstall: () => void handleInstall(),
      })}
    </View>
  );
}

interface StatusSectionProps {
  readonly isChecking: boolean;
  readonly releaseInfo: AppReleaseInfo | null;
  readonly errorMsg: string | null;
}

function renderStatusSection({
  isChecking,
  releaseInfo,
  errorMsg,
}: StatusSectionProps): React.ReactElement | null {
  if (isChecking) {
    return (
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>Checking GitHub releases...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.statusRow}>
        <AlertCircle size={16} color="#f87171" />
        <Text style={[styles.statusText, { color: '#f87171' }]}>{errorMsg}</Text>
      </View>
    );
  }

  if (releaseInfo) {
    if (releaseInfo.hasUpdate) {
      return (
        <View style={{ marginTop: 8 }}>
          <View style={styles.statusRow}>
            <DownloadCloud size={16} color="#60a5fa" />
            <Text style={[styles.statusText, { color: '#60a5fa', fontWeight: '600' }]}>
              New version {releaseInfo.version} is available!
            </Text>
          </View>
          <Text style={styles.notes} numberOfLines={2}>
            {releaseInfo.releaseNotes}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.statusRow}>
        <CheckCircle2 size={16} color="#4ade80" />
        <Text style={[styles.statusText, { color: '#4ade80' }]}>
          App is up to date ({releaseInfo.version || 'Latest'}).
        </Text>
      </View>
    );
  }

  return null;
}
