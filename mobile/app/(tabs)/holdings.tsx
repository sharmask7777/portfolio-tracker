import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  getEnrichedHoldings,
  filterHoldings,
  groupHoldingsByAssetClass,
  refreshPortfolio,
  formatInr,
  type EnrichedHolding,
  type GroupedHoldings,
} from '../../src/services/portfolio-service';
import { HoldingCard } from '../../src/components';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  content: {
    padding: 20,
    paddingTop: 56,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#f4f4f5',
    marginBottom: 12,
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
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  toggleButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#93c5fd',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d4d4d8',
  },
  emptyText: {
    fontSize: 14,
    color: '#71717a',
    textAlign: 'center',
    marginTop: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090b',
  },
});

function useHoldingsList() {
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupByAsset, setGroupByAsset] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const data = await getEnrichedHoldings();
      setHoldings(data);
    } catch {
      // Retain existing state
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshPortfolio();
      await loadData();
    } catch {
      // Retain state on error
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return {
    holdings,
    isLoading,
    isRefreshing,
    searchQuery,
    setSearchQuery,
    groupByAsset,
    setGroupByAsset,
    handleRefresh,
  };
}

function renderGroup(group: GroupedHoldings): React.ReactElement {
  return (
    <View key={group.assetClass}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {group.assetClass} ({group.holdings.length})
        </Text>
        <Text style={styles.sectionTotal}>{formatInr(group.totalValue)}</Text>
      </View>
      {group.holdings.map((h) => (
        <HoldingCard key={h.id} holding={h} />
      ))}
    </View>
  );
}

interface HeaderControlsProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  groupByAsset: boolean;
  setGroupByAsset: (val: boolean) => void;
  count: number;
}

function HoldingsHeaderControls(props: HeaderControlsProps): React.ReactElement {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Holdings</Text>
      <TextInput
        style={styles.searchBar}
        placeholder="Search schemes or folios..."
        placeholderTextColor="#71717a"
        value={props.searchQuery}
        onChangeText={props.setSearchQuery}
        testID="holdings-search-input"
      />
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, props.groupByAsset && styles.toggleButtonActive]}
          onPress={() => props.setGroupByAsset(true)}
          testID="toggle-group-asset"
        >
          <Text style={[styles.toggleText, props.groupByAsset && styles.toggleTextActive]}>
            By Asset Class
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, !props.groupByAsset && styles.toggleButtonActive]}
          onPress={() => props.setGroupByAsset(false)}
          testID="toggle-group-all"
        >
          <Text style={[styles.toggleText, !props.groupByAsset && styles.toggleTextActive]}>
            All Schemes ({props.count})
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface ListBodyProps {
  filtered: EnrichedHolding[];
  groups: GroupedHoldings[];
  groupByAsset: boolean;
}

function HoldingsListBody(props: ListBodyProps): React.ReactElement {
  if (props.filtered.length === 0) {
    return (
      <Text style={styles.emptyText} testID="holdings-empty">
        No holdings match your search criteria.
      </Text>
    );
  }
  if (props.groupByAsset) {
    return <>{props.groups.map((g) => renderGroup(g))}</>;
  }
  return (
    <>
      {props.filtered.map((h) => (
        <HoldingCard key={h.id} holding={h} />
      ))}
    </>
  );
}

function HoldingsLoadingView(): React.ReactElement {
  return (
    <View style={styles.center} testID="holdings-loading">
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );
}

export default function HoldingsScreen(): React.ReactElement {
  const {
    holdings,
    isLoading,
    isRefreshing,
    searchQuery,
    setSearchQuery,
    groupByAsset,
    setGroupByAsset,
    handleRefresh,
  } = useHoldingsList();

  const filtered = useMemo(() => {
    return filterHoldings(holdings, searchQuery);
  }, [holdings, searchQuery]);

  const groups = useMemo(() => {
    return groupByAsset ? groupHoldingsByAssetClass(filtered) : [];
  }, [groupByAsset, filtered]);

  if (isLoading && holdings.length === 0) {
    return <HoldingsLoadingView />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      testID="holdings-scroll"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#3b82f6"
          colors={['#3b82f6']}
        />
      }
    >
      <HoldingsHeaderControls
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        groupByAsset={groupByAsset}
        setGroupByAsset={setGroupByAsset}
        count={filtered.length}
      />
      <HoldingsListBody
        filtered={filtered}
        groups={groups}
        groupByAsset={groupByAsset}
      />
    </ScrollView>
  );
}
