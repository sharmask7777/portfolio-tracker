/**
 * @file PerformanceModeToggle.tsx
 * @description Accessible segmented control for toggling between XIRR and Absolute Return (ABS) calculation modes.
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import type { PerformanceMode } from '@portfolio/core-view';

/**
 * Props for {@link PerformanceModeToggle}.
 */
export interface PerformanceModeToggleProps {
  /** Active calculation mode ('XIRR' or 'ABS') */
  mode: PerformanceMode;
  /** Callback triggered when a different mode is selected */
  onToggle: (mode: PerformanceMode) => void;
  /** Optional container style overrides */
  style?: StyleProp<ViewStyle> | undefined;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 2,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  segment: {
    minHeight: 44,
    minWidth: 48,
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#2563eb',
  },
  segmentInactive: {
    backgroundColor: 'transparent',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textActive: {
    color: '#ffffff',
  },
  textInactive: {
    color: '#a1a1aa',
  },
});

/**
 * Segmented control rendering [ XIRR | ABS ] with WCAG accessible touch targets (>= 44x44pt).
 *
 * @param props - Component properties {@link PerformanceModeToggleProps}
 * @returns React Native element
 */
export function PerformanceModeToggle({
  mode,
  onToggle,
  style,
}: PerformanceModeToggleProps): React.ReactElement {
  return (
    <View style={[styles.container, style]} testID="performance-mode-toggle">
      <TouchableOpacity
        style={[styles.segment, mode === 'XIRR' ? styles.segmentActive : styles.segmentInactive]}
        onPress={() => {
          if (mode !== 'XIRR') onToggle('XIRR');
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'XIRR' }}
        accessibilityLabel="Select XIRR performance mode"
        testID="toggle-mode-xirr"
        activeOpacity={0.7}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Text style={[styles.segmentText, mode === 'XIRR' ? styles.textActive : styles.textInactive]}>
          XIRR
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segment, mode === 'ABS' ? styles.segmentActive : styles.segmentInactive]}
        onPress={() => {
          if (mode !== 'ABS') onToggle('ABS');
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: mode === 'ABS' }}
        accessibilityLabel="Select ABS performance mode"
        testID="toggle-mode-abs"
        activeOpacity={0.7}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Text style={[styles.segmentText, mode === 'ABS' ? styles.textActive : styles.textInactive]}>
          ABS
        </Text>
      </TouchableOpacity>
    </View>
  );
}
