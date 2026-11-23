import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import type {
  FinancialGoal,
  CreateGoalInput,
  GoalCategory,
  GoalPriority,
} from '../../services/goals-service';

/** Properties for the AddGoalModal component. */
export interface AddGoalModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (input: CreateGoalInput, editId?: string) => Promise<void> | void;
  initialGoal?: FinancialGoal | null | undefined;
}

/** Validation result for goal form inputs. */
export interface GoalValidationResult {
  isValid: boolean;
  error?: string | undefined;
}

const CATEGORIES: GoalCategory[] = [
  'Retirement',
  'Emergency Fund',
  'House Down Payment',
  'Education',
  'Vacation',
  'Custom',
];

const PRIORITIES: GoalPriority[] = ['High', 'Medium', 'Low'];

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#18181b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f4f4f5' },
  closeBtn: { padding: 4 },
  label: { fontSize: 12, fontWeight: '600', color: '#a1a1aa', marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: '#27272a', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#f4f4f5', fontSize: 14, marginBottom: 14 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#27272a' },
  activeChip: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 12, color: '#a1a1aa', fontWeight: '600' },
  activeChipText: { color: '#ffffff' },
  errorText: { color: '#ef4444', fontSize: 12, marginBottom: 12 },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8, marginBottom: 20 },
  saveBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});

/**
 * Validates financial goal input attributes.
 *
 * @param name - Goal name string
 * @param targetAmount - Target monetary amount string
 * @returns Object indicating validity and optional error message
 */
export function validateGoalInput(name: string, targetAmount: string): GoalValidationResult {
  if (!name.trim()) return { isValid: false, error: 'Goal name is required' };
  const parsed = parseFloat(targetAmount);
  if (isNaN(parsed) || parsed <= 0) return { isValid: false, error: 'Target amount must be a positive number' };
  return { isValid: true };
}

function getInitialFormValues(initialGoal?: FinancialGoal | null) {
  if (!initialGoal) {
    return { name: '', category: 'Retirement' as GoalCategory, priority: 'High' as GoalPriority, targetAmount: '', targetDate: '2030-12-31', allocatedPct: '25' };
  }
  return {
    name: initialGoal.name,
    category: initialGoal.category,
    priority: initialGoal.priority,
    targetAmount: initialGoal.targetAmount.toString(),
    targetDate: initialGoal.targetDate.slice(0, 10),
    allocatedPct: (initialGoal.allocatedPercentage ?? 25).toString(),
  };
}

function useGoalFormState(initialGoal?: FinancialGoal | null) {
  const initial = getInitialFormValues(initialGoal);
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState<GoalCategory>(initial.category);
  const [priority, setPriority] = useState<GoalPriority>(initial.priority);
  const [targetAmount, setTargetAmount] = useState(initial.targetAmount);
  const [targetDate, setTargetDate] = useState(initial.targetDate);
  const [allocatedPct, setAllocatedPct] = useState(initial.allocatedPct);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const vals = getInitialFormValues(initialGoal);
    setName(vals.name);
    setCategory(vals.category);
    setPriority(vals.priority);
    setTargetAmount(vals.targetAmount);
    setTargetDate(vals.targetDate);
    setAllocatedPct(vals.allocatedPct);
    setError(null);
  }, [initialGoal]);

  return { name, setName, category, setCategory, priority, setPriority, targetAmount, setTargetAmount, targetDate, setTargetDate, allocatedPct, setAllocatedPct, error, setError };
}

interface ChipSelectorsProps {
  category: GoalCategory;
  priority: GoalPriority;
  onSelectCategory: (c: GoalCategory) => void;
  onSelectPriority: (p: GoalPriority) => void;
}

function ChipSelectors({ category, priority, onSelectCategory, onSelectPriority }: ChipSelectorsProps) {
  return (
    <View>
      <Text style={styles.label}>Category</Text>
      <View style={styles.chipContainer}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c} style={[styles.chip, category === c && styles.activeChip]} onPress={() => onSelectCategory(c)}>
            <Text style={[styles.chipText, category === c && styles.activeChipText]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>Priority</Text>
      <View style={styles.chipContainer}>
        {PRIORITIES.map((p) => (
          <TouchableOpacity key={p} style={[styles.chip, priority === p && styles.activeChip]} onPress={() => onSelectPriority(p)}>
            <Text style={[styles.chipText, priority === p && styles.activeChipText]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ModalHeader({ isEdit, onClose }: { isEdit: boolean; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{isEdit ? 'Edit Financial Goal' : 'Create New Goal'}</Text>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close Modal">
        <X size={20} color="#a1a1aa" />
      </TouchableOpacity>
    </View>
  );
}

async function saveGoalFromForm(
  form: ReturnType<typeof useGoalFormState>,
  onSave: (input: CreateGoalInput, editId?: string) => Promise<void> | void,
  initialGoal?: FinancialGoal | null,
): Promise<boolean> {
  const val = validateGoalInput(form.name, form.targetAmount);
  if (!val.isValid) {
    form.setError(val.error ?? 'Validation failed');
    return false;
  }
  form.setError(null);
  await onSave(
    {
      name: form.name.trim(),
      category: form.category,
      priority: form.priority,
      targetAmount: parseFloat(form.targetAmount),
      targetDate: form.targetDate.trim(),
      allocatedPercentage: form.allocatedPct ? parseFloat(form.allocatedPct) : undefined,
    },
    initialGoal?.id,
  );
  return true;
}

/**
 * Modal dialog for creating and updating personal financial goals.
 *
 * @param props - Component properties
 * @returns React Native element
 */
export function AddGoalModal({
  visible,
  onClose,
  onSave,
  initialGoal,
}: AddGoalModalProps): React.ReactElement {
  const form = useGoalFormState(initialGoal);

  const handleSubmit = async () => {
    const success = await saveGoalFromForm(form, onSave, initialGoal);
    if (success) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheet}
        >
          <ModalHeader isEdit={Boolean(initialGoal)} onClose={onClose} />
          <ScrollView>
            <Text style={styles.label}>Goal Name</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={form.setName} placeholder="e.g. Retirement 2045" placeholderTextColor="#71717a" />
            <ChipSelectors category={form.category} priority={form.priority} onSelectCategory={form.setCategory} onSelectPriority={form.setPriority} />
            <Text style={styles.label}>Target Amount (₹)</Text>
            <TextInput style={styles.input} value={form.targetAmount} onChangeText={form.setTargetAmount} keyboardType="numeric" placeholder="e.g. 2500000" placeholderTextColor="#71717a" />
            <Text style={styles.label}>Target Date / Year (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={form.targetDate} onChangeText={form.setTargetDate} placeholder="2030-12-31" placeholderTextColor="#71717a" />
            <Text style={styles.label}>Allocated Portfolio %</Text>
            <TextInput style={styles.input} value={form.allocatedPct} onChangeText={form.setAllocatedPct} keyboardType="numeric" placeholder="e.g. 25" placeholderTextColor="#71717a" />
            {form.error && <Text style={styles.errorText}>{form.error}</Text>}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
              <Text style={styles.saveBtnText}>{initialGoal ? 'Update Goal' : 'Save Goal'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
