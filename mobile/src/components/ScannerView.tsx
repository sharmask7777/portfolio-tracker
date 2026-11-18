import React, { useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';

const styles = StyleSheet.create({
  scannerContainer: {
    width: '100%',
    maxWidth: 320,
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#27272a',
    backgroundColor: '#18181b',
    marginBottom: 20,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderBox: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionText: {
    color: '#a1a1aa',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
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

export interface ScannerViewProps {
  onScan: (scannedData: string) => void;
  isPairing: boolean;
  onSwitchToManual: () => void;
}

export function ScannerView({
  onScan,
  isPairing,
  onSwitchToManual,
}: ScannerViewProps): React.ReactElement {
  const [permission, requestPermission] = useCameraPermissions();

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (!isPairing && result.data) {
        onScan(result.data);
      }
    },
    [isPairing, onScan],
  );

  if (!permission?.granted) {
    return (
      <View style={styles.scannerContainer}>
        <View style={styles.permissionBox}>
          <Text style={styles.permissionText}>Camera access is required to scan the pairing QR code.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>Enable Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={onSwitchToManual}>
            <Text style={styles.linkButtonText}>Enter Code Manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.scannerContainer}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={isPairing ? undefined : handleBarcodeScanned}
      >
        <View style={styles.cameraOverlay}>
          <View style={styles.viewfinderBox} />
        </View>
      </CameraView>
    </View>
  );
}
