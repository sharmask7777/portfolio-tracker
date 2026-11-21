import React, { useState } from 'react';
import {
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SlidersHorizontal, Info } from 'lucide-react-native';
import type { RealityCheckAssumptions } from '../../services/reality-check-service';
import {
  INFLATION_PRESETS,
  TAX_PRESETS,
  HORIZON_PRESETS,
  modalStyles,
} from './assumptions-presets';

export { INFLATION_PRESETS, TAX_PRESETS, HORIZON_PRESETS };

/**
 * Properties for {@link AssumptionsModal}.
 */
export interface AssumptionsModalProps {
  visible: boolean;
  onClose: () => void;
  assumptions: RealityCheckAssumptions;
  onSaveAssumptions: (newAssumptions: RealityCheckAssumptions) => void;
}

/**
 * Renders a row of selectable preset chips.
 *
 * @param props Grid props with preset list, current active value, and onSelect callback
 * @returns React Native preset grid element
 */
export function PresetGrid({
  presets,
  currentValue,
  onSelect,
}: {
  presets: Array<{ label: string; value: number }>;
  currentValue: number;
  onSelect: (val: number) => void;
}): React.ReactElement {
  return (
    <View style={modalStyles.grid}>
      {presets.map((p) => {
        const isActive = Math.abs(currentValue - p.value) < 0.001;
        return (
          <TouchableOpacity
            key={p.label}
            style={[modalStyles.chip, isActive && modalStyles.chipActive]}
            onPress={() => onSelect(p.value)}
            accessibilityRole="button"
          >
            <Text style={[modalStyles.chipText, isActive && modalStyles.chipTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Renders the modal header with title and close button.
 *
 * @param props Header close callback
 * @returns React Native element
 */
export function ModalHeader({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <View style={modalStyles.header}>
      <View style={modalStyles.headerTitleRow}>
        <SlidersHorizontal size={18} color="#f59e0b" />
        <Text style={modalStyles.title}>Reality Check Assumptions</Text>
      </View>
      <TouchableOpacity
        onPress={onClose}
        style={modalStyles.closeBtn}
        accessibilityRole="button"
        accessibilityLabel="Close"
        testID="assumptions-close-button"
      >
        <Text style={modalStyles.closeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

interface MacroOptionProps {
  label: string;
  valueText: string;
  presets: Array<{ label: string; value: number }>;
  currentValue: number;
  onSelect: (val: number) => void;
}

/**
 * Renders a single macro option section with title, current value, and presets grid.
 *
 * @param props Section label, formatted value, presets, active value, and select callback
 * @returns React Native element
 */
function MacroOption({
  label,
  valueText,
  presets,
  currentValue,
  onSelect,
}: MacroOptionProps): React.ReactElement {
  return (
    <View style={modalStyles.section}>
      <View style={modalStyles.sectionTitleRow}>
        <Text style={modalStyles.sectionLabel}>{label}</Text>
        <Text style={modalStyles.sectionValue}>{valueText}</Text>
      </View>
      <PresetGrid presets={presets} currentValue={currentValue} onSelect={onSelect} />
    </View>
  );
}

/**
 * Renders the explanatory info callout in the modal.
 *
 * @returns React Native element
 */
function DescriptionBox(): React.ReactElement {
  return (
    <View style={modalStyles.descriptionBox}>
      <Info size={14} color="#a1a1aa" />
      <Text style={modalStyles.descriptionText}>
        Statutory capital gains tax and CPI inflation erode long-term purchasing
        power. Customize below to test your portfolio under different macro scenarios.
      </Text>
    </View>
  );
}

interface ModalSectionsProps {
  inflationRate: number;
  setInflationRate: (val: number) => void;
  taxRate: number;
  setTaxRate: (val: number) => void;
  horizonYears: number;
  setHorizonYears: (val: number) => void;
  handleApply: () => void;
}

/**
 * Renders the body sections containing macro preset controls and the apply button.
 *
 * @param props Controls state and handlers
 * @returns React Native element
 */
function ModalSections({
  inflationRate,
  setInflationRate,
  taxRate,
  setTaxRate,
  horizonYears,
  setHorizonYears,
  handleApply,
}: ModalSectionsProps): React.ReactElement {
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <DescriptionBox />
      <MacroOption
        label="Annual CPI Inflation Rate"
        valueText={`${(inflationRate * 100).toFixed(1)}%`}
        presets={INFLATION_PRESETS}
        currentValue={inflationRate}
        onSelect={setInflationRate}
      />
      <MacroOption
        label="Estimated Tax Drag Rate"
        valueText={`${(taxRate * 100).toFixed(1)}%`}
        presets={TAX_PRESETS}
        currentValue={taxRate}
        onSelect={setTaxRate}
      />
      <MacroOption
        label="Compounding Horizon"
        valueText={`${horizonYears} Years`}
        presets={HORIZON_PRESETS}
        currentValue={horizonYears}
        onSelect={setHorizonYears}
      />
      <TouchableOpacity
        style={modalStyles.applyButton}
        onPress={handleApply}
        accessibilityRole="button"
        accessibilityLabel="Apply Reality Check Assumptions"
        testID="assumptions-apply-button"
      >
        <Text style={modalStyles.applyButtonText}>Apply Assumptions</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

/**
 * Modal dialog for customizing Reality Check inflation, tax rate, and compounding horizon.
 *
 * @param props Modal visibility and handlers
 * @returns React Native assumptions modal
 */
export function AssumptionsModal({
  visible,
  onClose,
  assumptions,
  onSaveAssumptions,
}: AssumptionsModalProps): React.ReactElement {
  const [inflationRate, setInflationRate] = useState(assumptions.inflationRate);
  const [taxRate, setTaxRate] = useState(assumptions.taxRate);
  const [horizonYears, setHorizonYears] = useState(assumptions.horizonYears);

  const handleApply = () => {
    onSaveAssumptions({ inflationRate, taxRate, horizonYears });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="assumptions-modal"
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.content}>
          <ModalHeader onClose={onClose} />
          <ModalSections
            inflationRate={inflationRate}
            setInflationRate={setInflationRate}
            taxRate={taxRate}
            setTaxRate={setTaxRate}
            horizonYears={horizonYears}
            setHorizonYears={setHorizonYears}
            handleApply={handleApply}
          />
        </View>
      </View>
    </Modal>
  );
}
