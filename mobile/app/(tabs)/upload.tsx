import React from 'react';
import { StyleSheet, Text, View, ScrollView, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  UploadFormCard,
  UploadQueueCard,
  useCasUpload,
} from '../../src/components';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 64,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f4f4f5',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#a1a1aa',
  },
});

function UploadHeader(): React.ReactElement {
  return (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityLabel="Upload CAS Statement">
        Upload CAS Statement
      </Text>
      <Text style={styles.subtitle}>
        Import Consolidated Account Statements
      </Text>
    </View>
  );
}

/**
 * CAS PDF document upload tab screen. Features native document picking,
 * encrypted password capture, immediate online submission, and offline outbox queuing.
 *
 * @returns React Native upload tab element
 */
export default function UploadTabScreen(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(
    insets?.top ?? 0,
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
    16
  ) + 16;

  const {
    selectedFile,
    password,
    setPassword,
    isUploading,
    isSyncing,
    statusMsg,
    queueStatus,
    handlePickDocument,
    handleUpload,
    handleSyncOutbox,
  } = useCasUpload();

  return (
    <View style={styles.container} testID="upload-screen">
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding }]}>
        <UploadHeader />
        <UploadFormCard
          selectedFile={selectedFile}
          password={password}
          isUploading={isUploading}
          statusMsg={statusMsg}
          onPickDocument={handlePickDocument}
          onChangePassword={setPassword}
          onUpload={handleUpload}
        />
        <UploadQueueCard
          status={queueStatus}
          onSync={handleSyncOutbox}
          isSyncing={isSyncing}
        />
      </ScrollView>
    </View>
  );
}
