import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Zap, SlidersHorizontal, BarChart2 } from 'lucide-react-native';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 8,
    marginBottom: 16,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#09090b',
    borderRadius: 8,
    padding: 3,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#27272a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
    marginLeft: 6,
  },
  toggleTextActiveNominal: {
    color: '#3b82f6',
    fontWeight: '700',
  },
  toggleTextActiveReality: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  assumptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  assumptionsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f59e0b',
    marginLeft: 5,
  },
});

/**
 * Properties for {@link RealityCheckModeToggle}.
 */
export interface RealityCheckModeToggleProps {
  realityCheckMode: boolean;
  onToggle: (mode: boolean) => void;
  onOpenAssumptions?: (() => void) | undefined;
}

/**
 * Renders the Nominal button pill.
 *
 * @param props Button props
 * @returns React Native element
 */
function NominalButton({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <TouchableOpacity
      style={[styles.toggleButton, active && styles.toggleButtonActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Switch to Nominal View"
      testID="reality-check-toggle-nominal"
    >
      <BarChart2 size={14} color={active ? '#3b82f6' : '#71717a'} />
      <Text style={[styles.toggleText, active && styles.toggleTextActiveNominal]}>
        Nominal
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Renders the Reality Check button pill.
 *
 * @param props Button props
 * @returns React Native element
 */
function RealityButton({
  active,
  onPress,
}: {
  active: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <TouchableOpacity
      style={[styles.toggleButton, active && styles.toggleButtonActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Switch to Reality Check Mode"
      testID="reality-check-toggle-reality"
    >
      <Zap size={14} color={active ? '#f59e0b' : '#71717a'} />
      <Text style={[styles.toggleText, active && styles.toggleTextActiveReality]}>
        Reality Check
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Segmented control for toggling between standard Nominal View and Reality Check mode.
 *
 * @param props Toggle state and callbacks
 * @returns React Native toggle component
 */
export function RealityCheckModeToggle({
  realityCheckMode,
  onToggle,
  onOpenAssumptions,
}: RealityCheckModeToggleProps): React.ReactElement {
  return (
    <View style={styles.container} testID="reality-check-mode-toggle-card">
      <View style={styles.toggleGroup}>
        <NominalButton active={!realityCheckMode} onPress={() => onToggle(false)} />
        <RealityButton active={realityCheckMode} onPress={() => onToggle(true)} />
      </View>

      {realityCheckMode && onOpenAssumptions && (
        <TouchableOpacity
          style={styles.assumptionsButton}
          onPress={onOpenAssumptions}
          accessibilityRole="button"
          accessibilityLabel="Edit Reality Check Assumptions"
          testID="reality-check-assumptions-button"
        >
          <SlidersHorizontal size={13} color="#f59e0b" />
          <Text style={styles.assumptionsText}>Assumptions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
