/**
 * @file holdings.tsx
 * @description Mobile holdings screen. Uses ScopeSelectorHeader and useConsolidatedHoldings from
 * @portfolio/core-view to provide parity with Web: expandable multi-folio scheme groups,
 * member PAN breakdown, search, asset-class filtering, and sorting.
 */

import React, { useState } from 'react';
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
  type SchemeSortField,
  type ConsolidatedSchemeGroup,
  type PerformanceMode,
} from '@portfolio/core-view';
import { type EnrichedHolding } from '../../src/services/portfolio-service';
import { secureStoreScopeStorageAdapter } from '../../src/services/scope-storage-adapter';
import { ScopeSelectorHeader } from '../../src/components/Navigation';
import {
  SchemeGroupCard,
  HoldingsFilterControls,
  ClosedPositionsSection,
  AddAssetModal,
} from '../../src/components/Holdings';
import {
  useHoldingsData,
  useManualAssetMutations,
  useHoldingsFilters,
} from './use-holdings-screen';

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

interface HoldingsListProps {
  isLoading: boolean;
  schemes: readonly ConsolidatedSchemeGroup[];
  isExpanded: (id: string) => boolean;
  onToggleExpand: (id: string) => void;
  isConsolidatedScope: boolean;
  performanceMode?: PerformanceMode | undefined;
}

function HoldingsList(props: HoldingsListProps): React.ReactElement {
  const { isLoading, schemes, isExpanded, onToggleExpand, isConsolidatedScope, performanceMode } = props;

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
          performanceMode={performanceMode}
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
  performanceMode?: PerformanceMode | undefined;
  onTogglePerformanceMode?: ((mode: PerformanceMode) => void) | undefined;
  closedHoldings: readonly EnrichedHolding[];
  onDeleteClosedFolio: (folioNumber: string) => Promise<void>;
  onOpenAddAsset: () => void;
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
    performanceMode,
    onTogglePerformanceMode,
    closedHoldings,
    onDeleteClosedFolio,
    onOpenAddAsset,
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
        performanceMode={performanceMode}
        onTogglePerformanceMode={onTogglePerformanceMode}
        onOpenAddAsset={onOpenAddAsset}
      />
      <HoldingsList {...listProps} />
      <ClosedPositionsSection
        closedHoldings={closedHoldings}
        onDeleteFolio={onDeleteClosedFolio}
      />
    </ScrollView>
  );
}

/**
 * Holdings list screen with ScopeSelector, search, asset-class filtering, and expandable schemes.
 *
 * @returns React Native holdings tab element.
 */
export default function HoldingsScreen(): React.ReactElement {
  const { holdings, closedHoldings, profiles, folios, isLoading, isRefreshing, handleRefresh, loadData } = useHoldingsData();
  const [addAssetModalOpen, setAddAssetModalOpen] = useState(false);
  const scopeState = usePortfolioScope({ storageAdapter: secureStoreScopeStorageAdapter });
  const { handleDeleteClosedFolio, handleAddManualAsset } = useManualAssetMutations(loadData, scopeState.scope);
  const filters = useHoldingsFilters(holdings, folios, scopeState.scope);

  const listProps: HoldingsListProps = {
    isLoading,
    schemes: filters.sortedSchemes,
    isExpanded: filters.isExpanded,
    onToggleExpand: filters.toggleExpanded,
    isConsolidatedScope: scopeState.scope.type === 'consolidated',
    performanceMode: filters.performanceMode,
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
        searchQuery={filters.searchQuery}
        setSearchQuery={filters.setSearchQuery}
        selectedAsset={filters.selectedAsset}
        setSelectedAsset={filters.setSelectedAsset}
        selectedSort={filters.selectedSort}
        setSelectedSort={filters.setSelectedSort}
        performanceMode={filters.performanceMode}
        onTogglePerformanceMode={filters.setPerformanceMode}
        closedHoldings={closedHoldings}
        onDeleteClosedFolio={handleDeleteClosedFolio}
        onOpenAddAsset={() => setAddAssetModalOpen(true)}
        listProps={listProps}
      />
      <AddAssetModal
        visible={addAssetModalOpen}
        onClose={() => setAddAssetModalOpen(false)}
        onSubmit={handleAddManualAsset}
      />
    </View>
  );
}
