/**
 * @file use-holdings-screen.ts
 * @description Custom hooks extracted from holdings.tsx to satisfy max-lines Fowler sensors.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  useConsolidatedHoldings,
  type SchemeSortField,
  type PortfolioScope,
} from '@portfolio/core-view';
import {
  getEnrichedHoldings,
  getEnrichedClosedHoldings,
  deleteFolio,
  refreshPortfolio,
  type EnrichedHolding,
} from '../../src/services/portfolio-service';
import { addManualAsset, type AddManualAssetPayload } from '../../src/services/manual-asset-service';
import {
  getStoredFamilyProfiles,
  getStoredFolios,
  type FamilyProfile,
  type FolioEntity,
} from '../../src/services/family-service';
import { usePerformanceMode } from '../../src/services/settings-service';
import {
  adaptHoldingsToFolioInputs,
  type ManualAssetInput,
} from '../../src/components/Holdings';

/**
 * Hook for loading holdings, closed holdings, profiles and folios.
 *
 * @returns State and functions for holdings data.
 */
export function useHoldingsData() {
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [closedHoldings, setClosedHoldings] = useState<EnrichedHolding[]>([]);
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [folios, setFolios] = useState<FolioEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [enriched, enrichedClosed, storedProfiles, storedFolios] = await Promise.all([
        getEnrichedHoldings(),
        getEnrichedClosedHoldings(),
        getStoredFamilyProfiles(),
        getStoredFolios(),
      ]);
      setHoldings(enriched);
      setClosedHoldings(enrichedClosed);
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

  return { holdings, closedHoldings, profiles, folios, isLoading, isRefreshing, handleRefresh, loadData };
}

/**
 * Hook for handling manual asset onboarding and closed folio deletion.
 *
 * @param loadData - Function to reload holdings.
 * @param scope - Current portfolio scope.
 * @returns Mutators for deletion and manual asset addition.
 */
export function useManualAssetMutations(loadData: () => Promise<void>, scope: PortfolioScope) {
  const handleDeleteClosedFolio = useCallback(async (folioNumber: string) => {
    await deleteFolio(folioNumber);
    await loadData();
  }, [loadData]);

  const handleAddManualAsset = useCallback(async (input: ManualAssetInput) => {
    const payload: AddManualAssetPayload = {
      type: input.type,
      name: input.name,
      units: input.units,
      balanceDate: input.balanceDate,
      pan: scope.type === 'member' ? scope.pan : undefined,
    };
    await addManualAsset(payload);
    await loadData();
  }, [loadData, scope]);

  return { handleDeleteClosedFolio, handleAddManualAsset };
}

/**
 * Options for useFilteredHoldings hook.
 */
export interface FilteredHoldingsOptions {
  holdings: readonly EnrichedHolding[];
  folios: readonly FolioEntity[];
  scope: PortfolioScope;
  searchQuery: string;
  selectedAsset: string;
  selectedSort: SchemeSortField;
}

/**
 * Hook for searching, filtering, and sorting holdings via core-view.
 *
 * @param holdings - Enriched holdings list.
 * @param folios - Stored folios.
 * @param scope - Current portfolio scope.
 * @returns Filtered and sorted schemes with expansion state.
 */
export function useHoldingsFilters(
  holdings: readonly EnrichedHolding[],
  folios: readonly FolioEntity[],
  scope: PortfolioScope,
) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('ALL');
  const [selectedSort, setSelectedSort] = useState<SchemeSortField>('value');
  const [performanceMode, setPerformanceMode] = usePerformanceMode();

  const folioInputs = useMemo(() => {
    return adaptHoldingsToFolioInputs(holdings, folios);
  }, [holdings, folios]);

  const { sortedSchemes, isExpanded, toggleExpanded } = useConsolidatedHoldings({
    folios: folioInputs,
    scope,
    searchQuery,
    assetTypeFilter: selectedAsset,
    sortField: selectedSort,
    sortDirection: selectedSort === 'name' ? 'asc' : 'desc',
    performanceMode,
  });

  return {
    searchQuery,
    setSearchQuery,
    selectedAsset,
    setSelectedAsset,
    selectedSort,
    setSelectedSort,
    performanceMode,
    setPerformanceMode,
    sortedSchemes,
    isExpanded,
    toggleExpanded,
  };
}
