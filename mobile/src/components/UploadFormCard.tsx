import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import type { SelectedFile, StatusMessage } from '../services/upload-actions';

export type { SelectedFile, StatusMessage };

export interface UploadFormCardProps {
  selectedFile: SelectedFile | null;
  password: string;
  isUploading: boolean;
  statusMsg: StatusMessage | null;
  onPickDocument: () => void;
  onChangePassword: (text: string) => void;
  onUpload: () => void;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 20,
    marginBottom: 16,
  },
  pickerButton: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderStyle: 'dashed',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerButtonText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '600',
  },
  pickerHint: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 4,
  },
  selectedFileBox: {
    backgroundColor: '#27272a',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  selectedFileName: {
    color: '#f4f4f5',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedFileSize: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e4e4e7',
    marginBottom: 8,
  },
  passwordInput: {
    backgroundColor: '#27272a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3f3f46',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f4f4f5',
    fontSize: 14,
  },
  passwordHelp: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 6,
    lineHeight: 15,
  },
  uploadButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  banner: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  bannerSuccess: {
    backgroundColor: '#064e3b',
  },
  bannerWarning: {
    backgroundColor: '#78350f',
  },
  bannerError: {
    backgroundColor: '#7f1d1d',
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  textSuccess: {
    color: '#34d399',
  },
  textWarning: {
    color: '#fbbf24',
  },
  textError: {
    color: '#f87171',
  },
});

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function renderBanner(msg: StatusMessage | null): React.ReactElement | null {
  if (!msg) return null;
  const bannerStyle =
    msg.type === 'success'
      ? styles.bannerSuccess
      : msg.type === 'warning'
        ? styles.bannerWarning
        : styles.bannerError;
  const textStyle =
    msg.type === 'success'
      ? styles.textSuccess
      : msg.type === 'warning'
        ? styles.textWarning
        : styles.textError;

  return (
    <View style={[styles.banner, bannerStyle]} testID="status-banner">
      <Text style={[styles.bannerText, textStyle]}>{msg.text}</Text>
    </View>
  );
}

function renderFilePicker(
  selectedFile: SelectedFile | null,
  onPick: () => void,
): React.ReactElement {
  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={onPick}
        testID="pick-document-btn"
      >
        <Text style={styles.pickerButtonText}>Choose CAS PDF File</Text>
        <Text style={styles.pickerHint}>Select CAMS or KFintech statement</Text>
      </TouchableOpacity>

      {selectedFile && (
        <View style={styles.selectedFileBox} testID="selected-file-info">
          <Text style={styles.selectedFileName}>{selectedFile.name}</Text>
          {selectedFile.size && (
            <Text style={styles.selectedFileSize}>
              {formatFileSize(selectedFile.size)}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function renderPasswordCard(
  password: string,
  onChange: (t: string) => void,
): React.ReactElement {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>PDF Password (Optional / PAN / DOB)</Text>
      <TextInput
        style={styles.passwordInput}
        value={password}
        onChangeText={onChange}
        placeholder="e.g. ABCDE1234F or 01011990"
        placeholderTextColor="#71717a"
        secureTextEntry
        autoCapitalize="characters"
        testID="password-input"
      />
      <Text style={styles.passwordHelp}>
        CAMS and KFintech CAS PDFs are encrypted with your PAN or Date of Birth.
      </Text>
    </View>
  );
}

export function UploadFormCard({
  selectedFile,
  password,
  isUploading,
  statusMsg,
  onPickDocument,
  onChangePassword,
  onUpload,
}: UploadFormCardProps): React.ReactElement {
  const isButtonDisabled = !selectedFile || isUploading;

  return (
    <View testID="upload-form-card">
      {renderBanner(statusMsg)}
      {renderFilePicker(selectedFile, onPickDocument)}
      {renderPasswordCard(password, onChangePassword)}

      <TouchableOpacity
        style={[
          styles.uploadButton,
          isButtonDisabled && styles.uploadButtonDisabled,
        ]}
        onPress={onUpload}
        disabled={isButtonDisabled}
        testID="upload-statement-btn"
      >
        {isUploading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.uploadButtonText}>Upload Statement</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
