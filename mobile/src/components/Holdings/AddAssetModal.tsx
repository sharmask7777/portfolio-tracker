/**
 * @file AddAssetModal.tsx
 * @description Modal allowing manual onboarding of alternative assets (Gold/SGB, Real Estate, EPF/PPF) into portfolio.
 */

import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { X } from 'lucide-react-native';

/**
 * Alternative asset input payload.
 */
export interface ManualAssetInput {
  /** Asset category type */
  type: 'EPF' | 'PPF' | 'SGB' | 'PHYSICAL_GOLD' | 'REAL_ESTATE' | 'FIXED_DEPOSIT';
  /** Descriptive asset name */
  name: string;
  /** Units or monetary balance */
  units: number;
  /** As-of date (YYYY-MM-DD) */
  balanceDate: string;
}

/**
 * Props for {@link AddAssetModal}.
 */
export interface AddAssetModalProps {
  /** Whether the modal is visible */
  readonly visible: boolean;
  /** Close callback */
  readonly onClose: () => void;
  /** Callback invoked on successful asset creation */
  readonly onSubmit: (asset: ManualAssetInput) => Promise<void>;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  typeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  typeChipActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  typeChipTextActive: {
    color: '#93c5fd',
  },
  input: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 8,
    padding: 10,
    color: '#f4f4f5',
    fontSize: 14,
    marginBottom: 14,
  },
  submitBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});

const ASSET_TYPES: Array<{ key: ManualAssetInput['type']; label: string }> = [
  { key: 'SGB', label: 'SGB (Gold Bonds)' },
  { key: 'PHYSICAL_GOLD', label: 'Physical Gold' },
  { key: 'REAL_ESTATE', label: 'Real Estate' },
  { key: 'FIXED_DEPOSIT', label: 'Fixed Deposit' },
  { key: 'EPF', label: 'EPF (8.25%)' },
  { key: 'PPF', label: 'PPF (7.1%)' },
];

interface FormFieldsProps {
  name: string;
  units: string;
  onNameChange: (text: string) => void;
  onUnitsChange: (text: string) => void;
}

function FormFields(props: FormFieldsProps): React.ReactElement {
  const { name, units, onNameChange, onUnitsChange } = props;

  return (
    <>
      <Text style={styles.label}>Asset / Holding Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 10g Gold Bar or Bangalore Apartment"
        placeholderTextColor="#52525b"
        value={name}
        onChangeText={onNameChange}
        testID="manual-asset-name-input"
      />
      <Text style={styles.label}>Current Value / Balance (INR)</Text>
      <TextInput
        style={styles.input}
        placeholder="0.00"
        placeholderTextColor="#52525b"
        keyboardType="numeric"
        value={units}
        onChangeText={onUnitsChange}
        testID="manual-asset-units-input"
      />
    </>
  );
}

interface TypeChipsProps {
  currentType: ManualAssetInput['type'];
  onSelect: (t: ManualAssetInput['type']) => void;
}

function TypeChips({ currentType, onSelect }: TypeChipsProps): React.ReactElement {
  return (
    <View style={styles.typeRow}>
      {ASSET_TYPES.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[styles.typeChip, currentType === t.key && styles.typeChipActive]}
          onPress={() => onSelect(t.key)}
          testID={`asset-type-${t.key}`}
        >
          <Text style={[styles.typeChipText, currentType === t.key && styles.typeChipTextActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * Modal dialog for manually onboarding physical gold, SGB, real estate, or retirement assets.
 *
 * @param props - Component properties {@link AddAssetModalProps}
 * @returns React Native element
 */
export function AddAssetModal(props: AddAssetModalProps): React.ReactElement {
  const { visible, onClose, onSubmit } = props;
  const [type, setType] = useState<ManualAssetInput['type']>('SGB');
  const [name, setName] = useState('');
  const [units, setUnits] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const parsedUnits = parseFloat(units);
    if (!name.trim() || isNaN(parsedUnits) || parsedUnits <= 0) return;
    setLoading(true);
    try {
      await onSubmit({ type, name: name.trim(), units: parsedUnits, balanceDate: new Date().toISOString().split('T')[0] ?? '' });
      setName('');
      setUnits('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal} testID="add-asset-modal">
          <View style={styles.header}>
            <Text style={styles.title}>Add Alternative Asset</Text>
            <TouchableOpacity onPress={onClose} testID="close-add-asset-modal" accessibilityLabel="Close"><X size={20} color="#a1a1aa" /></TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={styles.label}>Select Asset Type</Text>
            <TypeChips currentType={type} onSelect={setType} />
            <FormFields name={name} units={units} onNameChange={setName} onUnitsChange={setUnits} />
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading} testID="submit-manual-asset">
              <Text style={styles.submitBtnText}>{loading ? 'Saving...' : 'Add to Portfolio'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
