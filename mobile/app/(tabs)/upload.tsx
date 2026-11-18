import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
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
      <Text style={styles.title}>Upload CAS</Text>
      <Text style={styles.subtitle}>
        Import Consolidated Account Statements
      </Text>
    </View>
  );
}

export default function UploadTabScreen(): React.ReactElement {
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
