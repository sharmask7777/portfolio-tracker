import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, UserPlus } from 'lucide-react-native';
import {
  validateSyntheticPan,
  type FamilyRelationship,
} from '../../services/family-service';

/**
 * Data payload when adding a new family member.
 */
export interface AddMemberInput {
  /** Full name of the member */
  name: string;
  /** Validated synthetic PAN */
  pan: string;
  /** Relationship to the primary investor */
  relationship: FamilyRelationship | string;
  /** Optional notes or tags */
  notes?: string | undefined;
}

/**
 * Props for {@link AddMemberModal}.
 */
export interface AddMemberModalProps {
  /** Visibility state of the modal */
  visible: boolean;
  /** Callback to close the modal without saving */
  onClose: () => void;
  /** Callback when valid member details are submitted */
  onAddMember: (input: AddMemberInput) => void;
}

interface FormFieldsProps {
  name: string;
  setName: (t: string) => void;
  pan: string;
  setPan: (t: string) => void;
  panError: string | null;
  setPanError: (t: string | null) => void;
  relationship: FamilyRelationship;
  setRelationship: (r: FamilyRelationship) => void;
  notes: string;
  setNotes: (t: string) => void;
}

const RELATION_OPTIONS: FamilyRelationship[] = [
  'Spouse',
  'Child',
  'Parent',
  'Sibling',
  'Self',
];

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#27272a',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#27272a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f4f4f5',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  chipActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#3b82f6',
  },
  chipText: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#93c5fd',
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#a1a1aa',
    fontWeight: '600',
    fontSize: 14,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});

function FormFields(props: FormFieldsProps): React.ReactElement {
  const { name, setName, pan, setPan, panError, setPanError, relationship, setRelationship, notes, setNotes } = props;

  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput testID="add-member-name-input" style={styles.input} placeholder="e.g. Neha Sharma" placeholderTextColor="#71717a" value={name} onChangeText={setName} />
      </View>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Permanent Account Number (PAN)</Text>
        <TextInput testID="add-member-pan-input" style={[styles.input, panError ? styles.inputError : null]} placeholder="e.g. ALPAC1001A" placeholderTextColor="#71717a" value={pan} onChangeText={(t) => { setPan(t.toUpperCase()); setPanError(null); }} autoCapitalize="characters" maxLength={10} />
        {panError ? <Text style={styles.errorText}>{panError}</Text> : null}
      </View>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Relationship</Text>
        <View style={styles.chipsRow}>
          {RELATION_OPTIONS.map((rel) => (
            <TouchableOpacity key={rel} style={[styles.chip, relationship === rel && styles.chipActive]} onPress={() => setRelationship(rel)}>
              <Text style={[styles.chipText, relationship === rel && styles.chipTextActive]}>{rel}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Notes (Optional)</Text>
        <TextInput style={styles.input} placeholder="e.g. Long-term mutual funds" placeholderTextColor="#71717a" value={notes} onChangeText={setNotes} />
      </View>
    </ScrollView>
  );
}

/**
 * Modal dialog for inputting and validating new family member details.
 *
 * @param props - Component props
 * @returns React Native element
 */
export function AddMemberModal(props: AddMemberModalProps): React.ReactElement {
  const { visible, onClose, onAddMember } = props;
  const [name, setName] = useState('');
  const [pan, setPan] = useState('');
  const [relationship, setRelationship] = useState<FamilyRelationship>('Spouse');
  const [notes, setNotes] = useState('');
  const [panError, setPanError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a member name.');
      return;
    }
    const validation = validateSyntheticPan(pan);
    if (!validation.isValid) {
      setPanError(validation.error ?? 'Invalid PAN format');
      return;
    }
    onAddMember({ name: name.trim(), pan: pan.trim().toUpperCase(), relationship, notes: notes.trim() || undefined });
    setName('');
    setPan('');
    setNotes('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent testID="add-member-modal">
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}><UserPlus size={20} color="#60a5fa" /><Text style={styles.title}>Add Family Member</Text></View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={18} color="#a1a1aa" /></TouchableOpacity>
          </View>
          <FormFields name={name} setName={setName} pan={pan} setPan={setPan} panError={panError} setPanError={setPanError} relationship={relationship} setRelationship={setRelationship} notes={notes} setNotes={setNotes} />
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} testID="submit-add-member-btn"><Text style={styles.submitBtnText}>Add Member</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
