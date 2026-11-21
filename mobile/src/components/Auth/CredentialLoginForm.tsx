import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { DEFAULT_SERVER_URL } from '../../services/auth-service';

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 6,
  },
  subText: {
    fontSize: 12,
    color: '#a1a1aa',
    marginBottom: 16,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 14,
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
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 16,
  },
  linkButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#60a5fa',
    fontSize: 13,
  },
});

/**
 * Props for the direct email and password authentication form.
 */
export interface CredentialLoginFormProps {
  readonly onSubmit: (serverUrl: string, email: string, pass: string) => Promise<void>;
  readonly isLoading: boolean;
  readonly onCancel?: () => void;
  readonly error?: string | null;
}

interface InputFieldProps {
  readonly label: string;
  readonly placeholder: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly testID: string;
  readonly secureTextEntry?: boolean;
}

function InputField(props: InputFieldProps): React.ReactElement {
  const { label, placeholder, value, onChangeText, testID, secureTextEntry } = props;
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
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

interface FormInputsProps {
  readonly serverUrl: string;
  readonly setServerUrl: (val: string) => void;
  readonly email: string;
  readonly setEmail: (val: string) => void;
  readonly password: string;
  readonly setPassword: (val: string) => void;
}

function FormInputs(props: FormInputsProps): React.ReactElement {
  return (
    <>
      <InputField
        label="Server URL"
        placeholder="http://10.0.2.2:8080"
        value={props.serverUrl}
        onChangeText={props.setServerUrl}
        testID="login-server-url-input"
      />
      <InputField
        label="Email or Username"
        placeholder="admin@example.com"
        value={props.email}
        onChangeText={props.setEmail}
        testID="login-email-input"
      />
      <InputField
        label="Password"
        placeholder="••••••••"
        value={props.password}
        onChangeText={props.setPassword}
        testID="login-password-input"
        secureTextEntry
      />
    </>
  );
}

/**
 * Direct email and password login form component for local emulation and testing.
 */
export function CredentialLoginForm(props: CredentialLoginFormProps): React.ReactElement {
  const { onSubmit, isLoading, onCancel, error } = props;
  const [serverUrl, setServerUrl] = useState<string>(DEFAULT_SERVER_URL);
  const [email, setEmail] = useState<string>('admin@example.com');
  const [password, setPassword] = useState<string>('');

  const handleSubmit = useCallback(() => {
    void onSubmit(serverUrl, email, password);
  }, [onSubmit, serverUrl, email, password]);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

  return (
    <View style={styles.card} testID="credential-login-form">
      <Text style={styles.headerText}>Email & Password Login</Text>
      <Text style={styles.subText}>Direct authentication for Android Studio emulator and local testing</Text>
      {error ? <Text style={styles.errorText} testID="login-error-text">{error}</Text> : null}
      <FormInputs
        serverUrl={serverUrl}
        setServerUrl={setServerUrl}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
      />
      <TouchableOpacity
        style={[styles.primaryButton, { opacity: canSubmit ? 1 : 0.6 }]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        testID="login-submit-button"
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>Sign In</Text>
        )}
      </TouchableOpacity>
      {onCancel ? (
        <TouchableOpacity style={styles.linkButton} onPress={onCancel} testID="login-cancel-button">
          <Text style={styles.linkButtonText}>Back to QR Scan</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
