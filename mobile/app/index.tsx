import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#a1a1aa',
    textAlign: 'center',
    maxWidth: 280,
  },
});

export default function SplashScreen(): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Portfolio Tracker</Text>
      <Text style={styles.subtitle}>
        Offline-first mobile portfolio companion
      </Text>
    </View>
  );
}
