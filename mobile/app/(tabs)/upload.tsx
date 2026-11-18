import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { UploadCloud } from 'lucide-react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    padding: 24,
    paddingTop: 64,
  },
  header: {
    marginBottom: 24,
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
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});

export default function UploadTabScreen(): React.ReactElement {
  return (
    <View style={styles.container} testID="upload-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Upload CAS</Text>
        <Text style={styles.subtitle}>
          Import Consolidated Account Statements
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.iconBox}>
          <UploadCloud size={32} color="#3b82f6" />
        </View>
        <Text style={styles.cardTitle}>Document Ingestion</Text>
        <Text style={styles.cardDescription}>
          Select CAMS or KFintech CAS PDF statements to parse transactions and
          update your offline holdings.
        </Text>
      </View>
    </View>
  );
}
