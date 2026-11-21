import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Search, Layers } from 'lucide-react-native';
import type { StockExposure } from '../../services/hierarchy-builder';
import { formatIndianRupee } from '../../services/hierarchy-formatters';

/**
 * Valid fields for sorting stock overlap exposures.
 */
export type SortField = 'name' | 'percentage' | 'value' | 'funds';

/**
 * Sort order direction.
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Properties for configuring the StockOverlapTable component.
 */
export interface StockOverlapTableProps {
  exposures: StockExposure[];
  totalPortfolioValue: number;
  excludeArbitrage?: boolean | undefined;
  onToggleExcludeArbitrage?: ((val: boolean) => void) | undefined;
  onSelectStock?: ((stock: StockExposure) => void) | undefined;
  testID?: string | undefined;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#f4f4f5' },
  badge: { backgroundColor: '#27272a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#a1a1aa' },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 12, color: '#a1a1aa' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: '#f4f4f5', fontSize: 13, marginLeft: 8, paddingVertical: 0 },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  stockLeft: { flex: 1, marginRight: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  rank: { fontSize: 12, fontWeight: '700', color: '#71717a', minWidth: 20 },
  stockName: { fontSize: 14, fontWeight: '600', color: '#f4f4f5' },
  overlapBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overlapBadgeText: { fontSize: 10, fontWeight: '600', color: '#38bdf8' },
  sectorText: { fontSize: 12, color: '#a1a1aa', marginLeft: 20 },
  stockRight: { alignItems: 'flex-end' },
  valueText: { fontSize: 14, fontWeight: '700', color: '#f4f4f5', marginBottom: 2 },
  pctText: { fontSize: 12, fontWeight: '600', color: '#38bdf8' },
  emptyContainer: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 120,
  },
  emptyText: { fontSize: 13, color: '#a1a1aa', fontWeight: '500' },
});

/**
 * Filters stock exposures by search text against company name and sector.
 *
 * @param exposures Array of stock exposures
 * @param query Search query text
 * @returns Filtered stock exposure list
 */
export function filterExposures(exposures: StockExposure[], query?: string): StockExposure[] {
  if (!query || query.trim().length === 0) return exposures;
  const q = query.trim().toLowerCase();
  return exposures.filter((item) => item.name.toLowerCase().includes(q) || item.sector.toLowerCase().includes(q));
}

function compareByField(a: StockExposure, b: StockExposure, field: SortField): number {
  if (field === 'name') return a.name.localeCompare(b.name);
  if (field === 'funds') return (a.contributions?.length || 0) - (b.contributions?.length || 0);
  if (field === 'value') return a.absoluteValue - b.absoluteValue;
  return a.percentage - b.percentage;
}

/**
 * Sorts stock exposures by field and direction.
 *
 * @param exposures Array of stock exposures
 * @param field Field to sort by
 * @param order Ascending or descending order
 * @returns Sorted stock exposure list
 */
export function sortExposures(exposures: StockExposure[], field: SortField, order: SortOrder = 'desc'): StockExposure[] {
  return [...exposures].sort((a, b) => {
    const diff = compareByField(a, b, field);
    return order === 'asc' ? diff : -diff;
  });
}

/**
 * Properties for individual stock row.
 */
export interface StockRowProps {
  item: StockExposure;
  index: number;
  onPress?: ((stock: StockExposure) => void) | undefined;
}

/**
 * Row rendering an individual stock company with metrics and overlap badge.
 *
 * @param props Row properties
 * @returns Row element
 */
export function StockRow({ item, index, onPress }: StockRowProps): React.ReactElement {
  const isMultiFund = (item.contributions?.length || 0) > 1;
  const pct = (item.percentage * (item.percentage <= 1 ? 100 : 1)).toFixed(2);

  return (
    <TouchableOpacity
      key={item.name}
      style={styles.stockRow}
      onPress={() => onPress?.(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${pct} percent exposure`}
    >
      <View style={styles.stockLeft}>
        <View style={styles.nameRow}>
          <Text style={styles.rank}>#{index + 1}</Text>
          <Text style={styles.stockName}>{item.name}</Text>
          {isMultiFund && (
            <View style={styles.overlapBadge}>
              <Layers size={10} color="#38bdf8" />
              <Text style={styles.overlapBadgeText}>{`${item.contributions.length} Funds Overlap`}</Text>
            </View>
          )}
        </View>
        <Text style={styles.sectorText}>{item.sector}</Text>
      </View>
      <View style={styles.stockRight}>
        <Text style={styles.valueText}>{formatIndianRupee(item.absoluteValue)}</Text>
        <Text style={styles.pctText}>{pct}%</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Properties for stock overlap header bar.
 */
export interface HeaderProps {
  count: number;
  excludeArbitrage?: boolean | undefined;
  onToggleExcludeArbitrage?: ((val: boolean) => void) | undefined;
}

/**
 * Header section with title, count badge, and exclude arbitrage switch.
 *
 * @param props Header properties
 * @returns Header element
 */
export function StockOverlapHeader({ count, excludeArbitrage = false, onToggleExcludeArbitrage }: HeaderProps): React.ReactElement {
  return (
    <View style={styles.header}>
      <View style={styles.titleGroup}>
        <Text style={styles.title}>Stock Overlap</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{count} Companies</Text></View>
      </View>
      {onToggleExcludeArbitrage && (
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>Ex. Arbitrage</Text>
          <Switch
            value={excludeArbitrage}
            onValueChange={onToggleExcludeArbitrage}
            trackColor={{ false: '#27272a', true: '#38bdf8' }}
            thumbColor={excludeArbitrage ? '#ffffff' : '#71717a'}
          />
        </View>
      )}
    </View>
  );
}

/**
 * Properties for search input bar.
 */
export interface SearchBarProps {
  query: string;
  onChangeQuery: (q: string) => void;
}

/**
 * Search input allowing filtering by company or sector.
 *
 * @param props Search bar properties
 * @returns Search bar element
 */
export function SearchBar({ query, onChangeQuery }: SearchBarProps): React.ReactElement {
  return (
    <View style={styles.searchBar}>
      <Search size={14} color="#71717a" />
      <TextInput
        style={styles.searchInput}
        placeholder="Search company or sector..."
        placeholderTextColor="#71717a"
        value={query}
        onChangeText={onChangeQuery}
        accessibilityLabel="Search company or sector"
      />
    </View>
  );
}

/**
 * Table rendering stock intersection and multi-fund overlap exposures.
 *
 * @param props StockOverlapTable properties
 * @returns Rendered component element
 */
export function StockOverlapTable({
  exposures,
  excludeArbitrage = false,
  onToggleExcludeArbitrage,
  onSelectStock,
  testID = 'stock-overlap-table',
}: StockOverlapTableProps): React.ReactElement {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const list = filterExposures(exposures, query);
    return sortExposures(list, 'percentage', 'desc');
  }, [exposures, query]);

  if (exposures.length === 0) {
    return (
      <View style={styles.emptyContainer} testID={`${testID}-empty`}>
        <Text style={styles.emptyText}>No stock exposures available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID={testID}>
      <StockOverlapHeader
        count={exposures.length}
        excludeArbitrage={excludeArbitrage}
        onToggleExcludeArbitrage={onToggleExcludeArbitrage}
      />
      <SearchBar query={query} onChangeQuery={setQuery} />
      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No stocks matching &quot;{query}&quot;</Text>
        </View>
      ) : (
        filtered.map((item, idx) => (
          <StockRow key={item.name} item={item} index={idx} onPress={onSelectStock} />
        ))
      )}
    </View>
  );
}
