import { vi } from 'vitest';

export const Platform = {
  OS: 'android',
  select: <T>(obj: Record<string, T>): T | undefined => obj['android'] ?? obj['default'],
};

export const StyleSheet = {
  create: <T>(styles: T): T => styles,
};

export const View = (props: Record<string, unknown>): Record<string, unknown> => ({ type: 'View', props });
export const Text = (props: Record<string, unknown>): Record<string, unknown> => ({ type: 'Text', props });
export const TextInput = (props: Record<string, unknown>): Record<string, unknown> => ({ type: 'TextInput', props });
export const TouchableOpacity = (props: Record<string, unknown>): Record<string, unknown> => ({ type: 'TouchableOpacity', props });
export const ScrollView = (props: Record<string, unknown>): Record<string, unknown> => ({ type: 'ScrollView', props });
export const ActivityIndicator = (props: Record<string, unknown>): Record<string, unknown> => ({ type: 'ActivityIndicator', props });
export const Alert = { alert: vi.fn() };
export const StatusBar = { currentHeight: 24 };
