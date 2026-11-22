/**
 * @file holdings-controls.tsx
 * @description Header search, asset class pills, and sort controls for the mobile Holdings screen.
 */

import React from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Plus } from 'lucide-react-native';
import type { SchemeSortField } from '@portfolio/core-view';

/** Available asset class filter options */
export const ASSET_TYPES = [
  { id: 'ALL', label: 'All' },
  { id: 'EQUITY', label: 'Equity' },
  { id: 'DEBT', label: 'Debt' },
  { id: 'HYBRID', label: 'Hybrid' },
  { id: 'COMMODITY', label: 'Gold' },
] as const;

/** Available sort options */
export const SORT_OPTIONS: readonly { id: SchemeSortField; label: string }[] = [
  { id: 'value', label: 'Value' },
  { id: 'dayChange', label: 'Day Change' },
  { id: 'performance', label: 'Return' },
  { id: 'name', label: 'Name' },
] as const;

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f4f4f5',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e3a8a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#93c5fd',
  },
  searchBar: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f4f4f5',
    fontSize: 14,
    marginBottom: 12,
  },
  scrollPills: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  pillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortLabel: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  sortChip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  sortChipActive: {
    borderColor: '#3b82f6',
  },
  sortChipText: {
    fontSize: 11,
    color: '#a1a1aa',
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: '#93c5fd',
  },
});

/**
 * Props for {@link HoldingsFilterControls}.
 */
export interface HoldingsFilterControlsProps {
  /** Search query string */
  searchQuery: string;
  /** Callback on search change */
  onSearchChange: (q: string) => void;
  /** Active asset class ID */
  selectedAsset: string;
  /** Callback on asset selection */
  onSelectAsset: (asset: string) => void;
  /** Active sort field */
  selectedSort: SchemeSortField;
  /** Callback on sort field selection */
  onSelectSort: (sort: SchemeSortField) => void;
  /** Optional callback to open add asset modal */
  onOpenAddAsset?: (() => void) | undefined;
}

interface AssetPillsProps {
  selectedAsset: string;
  onSelectAsset: (asset: string) => void;
}

function AssetPills({ selectedAsset, onSelectAsset }: AssetPillsProps): React.ReactElement {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollPills}
    >
      {ASSET_TYPES.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={[styles.pill, selectedAsset === t.id && styles.pillActive]}
          onPress={() => onSelectAsset(t.id)}
          testID={`filter-asset-${t.id.toLowerCase()}`}
        >
          <Text style={[styles.pillText, selectedAsset === t.id && styles.pillTextActive]}>
            {t.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

interface SortChipsProps {
  selectedSort: SchemeSortField;
  onSelectSort: (sort: SchemeSortField) => void;
}

function SortChips({ selectedSort, onSelectSort }: SortChipsProps): React.ReactElement {
  return (
    <View style={styles.sortRow}>
      <Text style={styles.sortLabel}>Sort by:</Text>
      {SORT_OPTIONS.map((s) => (
        <TouchableOpacity
          key={s.id}
          style={[styles.sortChip, selectedSort === s.id && styles.sortChipActive]}
          onPress={() => onSelectSort(s.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID={`sort-by-${s.id}`}
        >
          <Text style={[styles.sortChipText, selectedSort === s.id && styles.sortChipTextActive]}>
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/**
 * Filter and sorting controls for Holdings screen.
 *
 * @param props - Component properties {@link HoldingsFilterControlsProps}.
 * @returns React Native element.
 */
export function HoldingsFilterControls(
  props: HoldingsFilterControlsProps
): React.ReactElement {
  const {
    searchQuery,
    onSearchChange,
    selectedAsset,
    onSelectAsset,
    selectedSort,
    onSelectSort,
    onOpenAddAsset,
  } = props;

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Holdings</Text>
        {onOpenAddAsset ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={onOpenAddAsset}
            testID="open-add-asset-btn"
            accessibilityLabel="Add asset"
          >
            <Plus size={14} color="#93c5fd" />
            <Text style={styles.addBtnText}>Add Asset</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <TextInput
        style={styles.searchBar}
        placeholder="Search schemes or folios..."
        placeholderTextColor="#71717a"
        value={searchQuery}
        onChangeText={onSearchChange}
        testID="holdings-search-input"
      />
      <AssetPills selectedAsset={selectedAsset} onSelectAsset={onSelectAsset} />
      <SortChips selectedSort={selectedSort} onSelectSort={onSelectSort} />
    </View>
  );
}
