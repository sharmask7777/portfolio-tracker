import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { getStoredCredentials } from '../src/services/auth-service';

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
    marginBottom: 24,
  },
  spinner: {
    marginTop: 12,
  },
});

export default function SplashScreen(): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const creds = await getStoredCredentials();
        if (!mounted) return;
        if (creds.token) {
          router.replace('/(auth)/lock');
        } else {
          router.replace('/(auth)/pair');
        }
      } catch {
        if (mounted) router.replace('/(auth)/pair');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Portfolio Tracker</Text>
      <Text style={styles.subtitle}>
        Offline-first mobile portfolio companion
      </Text>
      <ActivityIndicator size="small" color="#3b82f6" style={styles.spinner} />
    </View>
  );
}
