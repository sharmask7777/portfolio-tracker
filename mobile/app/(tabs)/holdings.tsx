/**
 * @file holdings.tsx
 * @description Mobile holdings screen. Uses ScopeSelectorHeader and useConsolidatedHoldings from
 * @portfolio/core-view to provide parity with Web: expandable multi-folio scheme groups,
 * member PAN breakdown, search, asset-class filtering, and sorting.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  usePortfolioScope,
  useConsolidatedHoldings,
  type SchemeSortField,
  type PortfolioScope,
} from '@portfolio/core-view';
import {
  getEnrichedHoldings,
  refreshPortfolio,
  type EnrichedHolding,
} from '../../src/services/portfolio-service';
import {
  getStoredFamilyProfiles,
  getStoredFolios,
  type FamilyProfile,
  type FolioEntity,
} from '../../src/services/family-service';
import { secureStoreScopeStorageAdapter } from '../../src/services/scope-storage-adapter';
import { ScopeSelectorHeader } from '../../src/components/Navigation';
import {
  SchemeGroupCard,
  HoldingsFilterControls,
  adaptHoldingsToFolioInputs,
} from '../../src/components/Holdings';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  content: {
    padding: 20,
    paddingTop: 16,
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

function useHoldingsData() {
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [folios, setFolios] = useState<FolioEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [enriched, storedProfiles, storedFolios] = await Promise.all([
        getEnrichedHoldings(),
        getStoredFamilyProfiles(),
        getStoredFolios(),
      ]);
      setHoldings(enriched);
      setProfiles(storedProfiles);
      setFolios(storedFolios);
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

  return { holdings, profiles, folios, isLoading, isRefreshing, handleRefresh };
}

interface FilteredHoldingsOptions {
  holdings: readonly EnrichedHolding[];
  folios: readonly FolioEntity[];
  scope: PortfolioScope;
  searchQuery: string;
  selectedAsset: string;
  selectedSort: SchemeSortField;
}

function useFilteredHoldings(opts: FilteredHoldingsOptions) {
  const { holdings, folios, scope, searchQuery, selectedAsset, selectedSort } = opts;
  const folioInputs = useMemo(() => {
    return adaptHoldingsToFolioInputs(holdings, folios);
  }, [holdings, folios]);

  return useConsolidatedHoldings({
    folios: folioInputs,
    scope,
    searchQuery,
    assetTypeFilter: selectedAsset,
    sortField: selectedSort,
    sortDirection: selectedSort === 'name' ? 'asc' : 'desc',
  });
}

interface HoldingsListProps {
  isLoading: boolean;
  schemes: ReturnType<typeof useConsolidatedHoldings>['sortedSchemes'];
  isExpanded: (id: string) => boolean;
  onToggleExpand: (id: string) => void;
  isConsolidatedScope: boolean;
}

function HoldingsList(props: HoldingsListProps): React.ReactElement {
  const { isLoading, schemes, isExpanded, onToggleExpand, isConsolidatedScope } = props;

  if (isLoading && schemes.length === 0) {
    return (
      <View style={styles.center} testID="holdings-loading">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (schemes.length === 0) {
    return (
      <Text style={styles.emptyText} testID="holdings-empty">
        No holdings match your search criteria.
      </Text>
    );
  }

  return (
    <>
      {schemes.map((group) => (
        <SchemeGroupCard
          key={group.id}
          group={group}
          isExpanded={isExpanded(group.id)}
          onToggleExpand={onToggleExpand}
          showPanBadges={isConsolidatedScope}
        />
      ))}
    </>
  );
}

interface HoldingsScreenContentProps {
  isRefreshing: boolean;
  handleRefresh: () => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedAsset: string;
  setSelectedAsset: (a: string) => void;
  selectedSort: SchemeSortField;
  setSelectedSort: (s: SchemeSortField) => void;
  listProps: HoldingsListProps;
}

function HoldingsScreenContent(props: HoldingsScreenContentProps): React.ReactElement {
  const {
    isRefreshing,
    handleRefresh,
    searchQuery,
    setSearchQuery,
    selectedAsset,
    setSelectedAsset,
    selectedSort,
    setSelectedSort,
    listProps,
  } = props;

  return (
    <ScrollView
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
      <HoldingsFilterControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedAsset={selectedAsset}
        onSelectAsset={setSelectedAsset}
        selectedSort={selectedSort}
        onSelectSort={setSelectedSort}
      />
      <HoldingsList {...listProps} />
    </ScrollView>
  );
}

/**
 * Holdings list screen with ScopeSelector, search, asset-class filtering, and expandable schemes.
 *
 * @returns React Native holdings tab element.
 */
export default function HoldingsScreen(): React.ReactElement {
  const { holdings, profiles, folios, isLoading, isRefreshing, handleRefresh } = useHoldingsData();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('ALL');
  const [selectedSort, setSelectedSort] = useState<SchemeSortField>('value');

  const scopeState = usePortfolioScope({ storageAdapter: secureStoreScopeStorageAdapter });

  const { sortedSchemes, isExpanded, toggleExpanded } = useFilteredHoldings({
    holdings,
    folios,
    scope: scopeState.scope,
    searchQuery,
    selectedAsset,
    selectedSort,
  });

  const listProps: HoldingsListProps = {
    isLoading,
    schemes: sortedSchemes,
    isExpanded,
    onToggleExpand: toggleExpanded,
    isConsolidatedScope: scopeState.scope.type === 'consolidated',
  };

  return (
    <View style={styles.container}>
      <ScopeSelectorHeader
        scope={scopeState.scope}
        profiles={profiles}
        onSelectConsolidated={scopeState.setConsolidated}
        onSelectMember={scopeState.setMemberScope}
        totalFolios={folios.length}
      />
      <HoldingsScreenContent
        isRefreshing={isRefreshing}
        handleRefresh={handleRefresh}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedAsset={selectedAsset}
        setSelectedAsset={setSelectedAsset}
        selectedSort={selectedSort}
        setSelectedSort={setSelectedSort}
        listProps={listProps}
      />
    </View>
  );
}
