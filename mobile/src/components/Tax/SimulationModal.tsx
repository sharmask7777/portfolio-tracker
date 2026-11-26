import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import {
  type SimulationLot,
  type SimulationSellResult,
} from '../../services/tax-harvesting';
import { simulateWithdrawal } from '../../services/tax-simulation-service';
import { SimulationResultView } from './SimulationResultView';
import { SimulationForm } from './SimulationForm';

/**
 * Props for {@link SimulationModal}.
 */
export interface SimulationModalProps {
  /** Whether the modal is currently visible */
  visible: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Name of the mutual fund scheme to simulate */
  schemeName?: string | undefined;
  /** Folio identifier */
  folioId?: string | undefined;
  /** Flag indicating whether the fund is an ELSS tax-saving scheme */
  isElss?: boolean | undefined;
  /** Current NAV or market price per unit */
  currentNav?: number | undefined;
  /** Pre-filled units to sell */
  initialUnits?: number | undefined;
  /** Available purchase lots for FIFO allocation */
  lots?: SimulationLot[] | undefined;
  /** Applicable tax slab rate (e.g. 0.30) */
  taxSlab?: number | undefined;
  /** Fund asset class */
  assetClass?: ('EQUITY' | 'DEBT' | 'HYBRID' | 'OTHER') | undefined;
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
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
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
  },
  schemeSubtitle: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorBannerText: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '600',
  },
});

function computeUnits(mode: 'units' | 'amount', val: string, price: number): number {
  const num = parseFloat(val);
  if (isNaN(num) || num <= 0) return 0;
  return mode === 'units' ? num : (price > 0 ? num / price : 0);
}

interface SimulationHeaderProps {
  schemeName: string;
  onClose: () => void;
}

function SimulationHeader({ schemeName, onClose }: SimulationHeaderProps): React.ReactElement {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Simulate Redemption</Text>
        <Text style={styles.schemeSubtitle} numberOfLines={1}>{schemeName}</Text>
      </View>
      <TouchableOpacity
        style={styles.closeBtn}
        testID="close-simulation-modal-btn"
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close simulation modal"
      >
        <X size={20} color="#a1a1aa" />
      </TouchableOpacity>
    </View>
  );
}

function useSellSimulation(props: SimulationModalProps) {
  const {
    schemeName = 'Mutual Fund Scheme',
    folioId = 'FOLIO-1',
    isElss = false,
    currentNav = 100,
    initialUnits,
    lots,
    taxSlab = 0.30,
    assetClass = 'EQUITY',
  } = props;

  const [mode, setMode] = useState<'units' | 'amount'>('units');
  const [inputVal, setInputVal] = useState(initialUnits ? initialUnits.toString() : '');
  const [result, setResult] = useState<SimulationSellResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setInputVal(initialUnits ? initialUnits.toString() : '');
    setMode('units');
    setResult(null);
    setError(null);
  }, [props.visible, schemeName, folioId, initialUnits]);

  const unitsToSell = computeUnits(mode, inputVal, currentNav);

  const handleSimulate = async () => {
    const activeLots = lots ?? [];
    setLoading(true);
    setError(null);
    try {
      const res = await simulateWithdrawal({
        folioId,
        schemeName,
        isElss,
        assetClass,
        lots: activeLots,
        unitsToSell,
        currentNav,
        taxSlab,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  return { mode, setMode, inputVal, setInputVal, result, setResult, error, setError, unitsToSell, handleSimulate, loading };
}

/**
 * Interactive Sell & Redemption Simulation modal.
 *
 * @param props - Component properties {@link SimulationModalProps}
 * @returns React Native modal
 */
export function SimulationModal(props: SimulationModalProps): React.ReactElement {
  const { mode, setMode, inputVal, setInputVal, result, setResult, error, setError, unitsToSell, handleSimulate, loading } =
    useSellSimulation(props);

  return (
    <Modal visible={props.visible} animationType="slide" transparent testID="simulation-modal">
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalContent}
        >
          <SimulationHeader schemeName={props.schemeName ?? 'Mutual Fund Scheme'} onClose={props.onClose} />
          <ScrollView>
            {error ? (
              <View style={styles.errorBanner} testID="simulation-error-banner">
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            ) : null}
            {!result ? (
              <SimulationForm
                mode={mode}
                onModeChange={setMode}
                inputVal={inputVal}
                onInputChange={setInputVal}
                unitsToSell={unitsToSell}
                currentNav={props.currentNav ?? 100}
                onSubmit={handleSimulate}
                loading={loading}
              />
            ) : (
              <SimulationResultView
                result={result}
                onReset={() => {
                  setResult(null);
                  setError(null);
                }}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
