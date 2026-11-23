import { useCallback } from 'react';
import {
  usePortfolioScope,
  useConsolidatedHoldings,
  LocalStorageScopeStorageAdapter,
} from '@portfolio/core-view';

import { useSettings } from './contexts/SettingsContext';
import api, { API_ENDPOINTS } from './api';
import type { StockExposure } from './utils/hierarchy-types';
import type { ManagedProfile } from './components/Family/FamilySelector';
import { useDashboardData } from './useDashboardData';
import { useDashboardMutations } from './useDashboardMutations';
import { useDashboardUpload } from './useDashboardUpload';
import { useDashboardSelection } from './useDashboardSelection';

const localStorageAdapter = new LocalStorageScopeStorageAdapter();

export function useDashboardController() {
  const settings = useSettings();
  const sel = useDashboardSelection();

  const {
    scope,
    activeProfileId: selectedProfileId,
    setConsolidated,
    setMemberScope,
    resetScope,
  } = usePortfolioScope({
    storageAdapter: localStorageAdapter,
    storageKey: 'portfolio_selected_profile_id',
  });

  const handleResetScopeIfMissing = useCallback((profilesList: ManagedProfile[]) => {
    if (selectedProfileId && profilesList.length > 0 && !profilesList.some((p) => p.id === selectedProfileId)) {
      setConsolidated();
    }
  }, [selectedProfileId, setConsolidated]);

  const data = useDashboardData({
    selectedFamilyId: sel.selectedFamilyId,
    selectedProfileId,
    cpiInflationRate: settings.cpiInflationRate,
    marginalTaxBracket: settings.marginalTaxBracket,
    excludeArbitrage: sel.excludeArbitrage,
    onResetScopeIfMissing: handleResetScopeIfMissing,
  });

  const upload = useDashboardUpload({
    fetchSummary: data.fetchSummary,
  });

  const handlePurgeSuccess = useCallback(() => {
    data.setPortfolio(null);
    data.setProfiles([]);
    data.setXRayData(null);
    data.setExposures([]);
    data.setTaxSummary(null);
    data.setHarvesting(null);
    sel.setSelectedFamilyId(null);
  }, [data, sel]);

  const mutations = useDashboardMutations({
    fetchSummary: data.fetchSummary,
    selectedProfileId,
    setConsolidated,
    resetScope,
    onPurgeSuccess: handlePurgeSuccess,
  });

  const {
    allSchemes: schemeGroups,
    sortedSchemes: sortedSchemeGroups,
    expandedSchemeIds,
    toggleExpanded,
  } = useConsolidatedHoldings({
    folios: data.portfolio?.folios,
    scope,
    performanceMode: settings.performanceMode,
    sortField: sel.sortField,
    sortDirection: sel.sortDirection,
  });

  const handleProfileSelect = (id: string | null) => {
    sel.setSelectedFamilyId(null);
    if (id) {
      const matched = data.profiles.find((p) => p.id === id);
      setMemberScope({ profileId: id, pan: matched?.pan, name: matched?.name });
    } else {
      setConsolidated();
    }
  };

  const handleToggleExcludeArbitrage = async (val: boolean) => {
    sel.setExcludeArbitrage(val);
    if (data.portfolio?.id) {
      try {
        const res = await api.get<StockExposure[]>(
          `${API_ENDPOINTS.PORTFOLIO}/${data.portfolio.id}/exposures?excludeArbitrage=${val}`
        );
        data.setExposures(res.data || []);
      } catch (err) {
        console.error('Failed to fetch exposures:', err);
      }
    }
  };

  return {
    ...settings,
    ...data,
    ...upload,
    ...mutations,
    ...sel,
    selectedProfileId,
    schemeGroups,
    sortedSchemeGroups,
    expandedSchemeIds,
    toggleExpanded,
    handleProfileSelect,
    handleToggleExcludeArbitrage,
  };
}
