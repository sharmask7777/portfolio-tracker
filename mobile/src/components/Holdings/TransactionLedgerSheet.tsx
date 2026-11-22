/**
 * @file TransactionLedgerSheet.tsx
 * @description Bottom sheet modal displaying chronological transactions for a folio.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import { formatIndianRupee } from '@portfolio/core-view';
import {
  getTransactionsForFolio,
  type TransactionEntity,
} from '../../services/portfolio-service';

/**
 * Props for {@link TransactionLedgerSheet}.
 */
export interface TransactionLedgerSheetProps {
  /** Whether modal sheet is visible */
  readonly visible: boolean;
  /** Folio number or identifier */
  readonly folioNumber: string;
  /** Scheme or asset name */
  readonly schemeName?: string | undefined;
  /** Member PAN if available */
  readonly pan?: string | undefined;
  /** Close callback */
  readonly onClose: () => void;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
    maxHeight: '80%',
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  titleCol: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#a1a1aa',
  },
  closeBtn: {
    padding: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  txLeft: {
    flex: 1,
  },
  txType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 2,
  },
  txDate: {
    fontSize: 11,
    color: '#71717a',
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f4f4f5',
    marginBottom: 2,
  },
  txSub: {
    fontSize: 11,
    color: '#a1a1aa',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#71717a',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
});

function formatDateDisplay(d: string): string {
  try {
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString();
  } catch {
    return d;
  }
}

interface TxItemProps {
  tx: TransactionEntity;
}

function TxItem({ tx }: TxItemProps): React.ReactElement {
  const isRedemption = tx.type.toUpperCase().includes('REDEMPTION') || tx.type.toUpperCase().includes('SELL');
  const amountPrefix = isRedemption ? '-' : '+';
  const amountColor = isRedemption ? '#ef4444' : '#22c55e';

  return (
    <View style={styles.txRow} testID={`tx-item-${tx.id}`}>
      <View style={styles.txLeft}>
        <Text style={styles.txType}>{tx.type}</Text>
        <Text style={styles.txDate}>{formatDateDisplay(tx.date)}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: amountColor }]}>
          {amountPrefix}{formatIndianRupee(Math.abs(tx.amount))}
        </Text>
        <Text style={styles.txSub}>
          {Math.abs(tx.units).toFixed(3)} units @ {formatIndianRupee(tx.nav)}
        </Text>
      </View>
    </View>
  );
}

function LedgerHeader({
  schemeName,
  folioNumber,
  pan,
  onClose,
}: {
  schemeName?: string | undefined;
  folioNumber: string;
  pan?: string | undefined;
  onClose: () => void;
}): React.ReactElement {
  return (
    <View style={styles.header}>
      <View style={styles.titleCol}>
        <Text style={styles.title} numberOfLines={2}>
          {schemeName || 'Folio Ledger'}
        </Text>
        <Text style={styles.subtitle}>
          Folio: {folioNumber}{pan ? ` • PAN: ${pan}` : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="ledger-close-btn" accessibilityLabel="Close ledger">
        <X size={20} color="#a1a1aa" />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Modal sheet displaying transactions for a given folio.
 *
 * @param props - Component properties {@link TransactionLedgerSheetProps}
 * @returns React Native element
 */
export function TransactionLedgerSheet(props: TransactionLedgerSheetProps): React.ReactElement | null {
  const { visible, folioNumber, schemeName, pan, onClose } = props;
  const [transactions, setTransactions] = useState<TransactionEntity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !folioNumber) return;
    let isMounted = true;
    setLoading(true);
    void getTransactionsForFolio(folioNumber)
      .then((txs) => {
        if (isMounted) setTransactions(txs);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [visible, folioNumber]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer} testID="transaction-ledger-sheet">
          <LedgerHeader schemeName={schemeName} folioNumber={folioNumber} pan={pan} onClose={onClose} />
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          ) : (
            <FlatList
              data={transactions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <TxItem tx={item} />}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No recorded transactions for this folio.</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
