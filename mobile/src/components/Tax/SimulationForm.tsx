import React from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';
import { formatInr } from '../../services/portfolio-service';

/**
 * Props for {@link SimulationForm}.
 */
export interface SimulationFormProps {
  /** Input mode: units or target amount */
  mode: 'units' | 'amount';
  /** Mode switch handler */
  onModeChange: (m: 'units' | 'amount') => void;
  /** Raw text input string */
  inputVal: string;
  /** Input change handler */
  onInputChange: (v: string) => void;
  /** Derived units to sell */
  unitsToSell: number;
  /** Current NAV per unit */
  currentNav: number;
  /** Submit handler */
  onSubmit: () => void;
}

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#27272a',
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#2563eb',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: '#a1a1aa',
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: '#27272a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3f3f46',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#f4f4f5',
  },
  helperText: {
    fontSize: 11,
    color: '#71717a',
    marginTop: 4,
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});

interface ModeToggleProps {
  mode: 'units' | 'amount';
  onModeChange: (m: 'units' | 'amount') => void;
}

function ModeToggle({ mode, onModeChange }: ModeToggleProps): React.ReactElement {
  return (
    <View style={styles.toggleRow}>
      <TouchableOpacity
        style={[styles.toggleBtn, mode === 'units' && styles.toggleBtnActive]}
        onPress={() => onModeChange('units')}
      >
        <Text style={[styles.toggleText, mode === 'units' && styles.toggleTextActive]}>By Units</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleBtn, mode === 'amount' && styles.toggleBtnActive]}
        onPress={() => onModeChange('amount')}
      >
        <Text style={[styles.toggleText, mode === 'amount' && styles.toggleTextActive]}>By Amount (₹)</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Sell simulation input form allowing redemption parameter input by units or target amount.
 *
 * @param props - Component properties {@link SimulationFormProps}
 * @returns React Native component
 */
export function SimulationForm({
  mode,
  onModeChange,
  inputVal,
  onInputChange,
  unitsToSell,
  currentNav,
  onSubmit,
}: SimulationFormProps): React.ReactElement {
  return (
    <View>
      <ModeToggle mode={mode} onModeChange={onModeChange} />

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{mode === 'units' ? 'Units to Sell' : 'Target Amount (₹)'}</Text>
        <TextInput
          style={styles.inputField}
          testID={mode === 'units' ? 'sim-units-input' : 'sim-amount-input'}
          keyboardType="numeric"
          placeholder={mode === 'units' ? 'e.g. 50' : 'e.g. 25000'}
          placeholderTextColor="#71717a"
          value={inputVal}
          onChangeText={onInputChange}
        />
        {unitsToSell > 0 && (
          <Text style={styles.helperText}>
            ≈ {unitsToSell.toFixed(3)} units @ {formatInr(currentNav)} = {formatInr(unitsToSell * currentNav)}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, unitsToSell <= 0 && { opacity: 0.5 }]}
        testID="simulate-submit-btn"
        disabled={unitsToSell <= 0}
        onPress={onSubmit}
      >
        <Text style={styles.submitBtnText}>Calculate Post-Tax Proceeds</Text>
      </TouchableOpacity>
    </View>
  );
}
