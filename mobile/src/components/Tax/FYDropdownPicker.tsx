import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';

/**
 * Properties for {@link FYDropdownPicker}.
 */
export interface FYDropdownPickerProps {
  /** Currently selected Financial Year (e.g. '2024-25') */
  selectedFY: string;
  /** List of selectable Financial Years */
  availableFYs: string[];
  /** Callback triggered when user selects a different Financial Year */
  onFYChange?: ((fy: string) => void) | undefined;
}

const styles = StyleSheet.create({
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  triggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e4e4e7',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3f3f46',
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  optionsList: {
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#27272a',
  },
  optionItemActive: {
    backgroundColor: '#1e3a8a',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d4d4d8',
  },
  optionTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

interface OptionItemProps {
  fy: string;
  isActive: boolean;
  onSelect: (fy: string) => void;
}

function DropdownOptionItem({ fy, isActive, onSelect }: OptionItemProps): React.ReactElement {
  return (
    <TouchableOpacity
      testID={`fy-option-${fy}`}
      style={[styles.optionItem, isActive && styles.optionItemActive]}
      onPress={() => onSelect(fy)}
      accessibilityRole="button"
      accessibilityLabel={`Select FY ${fy}`}
      accessibilityState={{ selected: isActive }}
    >
      <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
        FY {fy}
      </Text>
      {isActive ? <Check size={16} color="#60a5fa" /> : null}
    </TouchableOpacity>
  );
}

/**
 * Properties for {@link FYDropdownModal}.
 */
export interface DropdownModalProps {
  /** Whether the modal is currently visible */
  isOpen: boolean;
  /** Currently selected Financial Year */
  selectedFY: string;
  /** Available Financial Years */
  availableFYs: string[];
  /** Handler to dismiss the modal */
  onClose: () => void;
  /** Handler invoked when a financial year is chosen */
  onSelect: (fy: string) => void;
}

/**
 * Accessible modal dialog displaying the full list of selectable Financial Years.
 *
 * @param props - Modal properties {@link DropdownModalProps}
 * @returns Modal element
 */
export function FYDropdownModal({
  isOpen,
  selectedFY,
  availableFYs,
  onClose,
  onSelect,
}: DropdownModalProps): React.ReactElement {
  return (
    <Modal
      testID="fy-dropdown-modal"
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        testID="fy-dropdown-backdrop"
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          style={styles.modalCard}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.modalTitle}>Financial Year</Text>
          <View style={styles.optionsList}>
            {availableFYs.map((fy) => (
              <DropdownOptionItem
                key={fy}
                fy={fy}
                isActive={selectedFY === fy}
                onSelect={onSelect}
              />
            ))}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/**
 * Dropdown selector for choosing Indian Financial Years in Tax & Capital Gains view.
 *
 * Replaces horizontal scroll banners with an accessible, high-contrast modal picker.
 */
export function FYDropdownPicker({
  selectedFY,
  availableFYs,
  onFYChange,
}: FYDropdownPickerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (fy: string): void => {
    onFYChange?.(fy);
    setIsOpen(false);
  };

  return (
    <View>
      <TouchableOpacity
        testID="fy-dropdown-button"
        style={styles.triggerButton}
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Select Financial Year, current: FY ${selectedFY}`}
      >
        <Text style={styles.triggerText}>FY {selectedFY}</Text>
        <ChevronDown size={14} color="#a1a1aa" />
      </TouchableOpacity>

      <FYDropdownModal
        isOpen={isOpen}
        selectedFY={selectedFY}
        availableFYs={availableFYs}
        onClose={() => setIsOpen(false)}
        onSelect={handleSelect}
      />
    </View>
  );
}
