import { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import api, { API_ENDPOINTS } from './api';
import type { HarvestTicketResponse } from './types/generated/HarvestTicketResponse';
import type { StockExposure } from './utils/hierarchy-types';
import type { XRayData } from './components/Analytics/types';
import type { ITRSummary } from './utils/itr-report-generator';
import type { PortfolioSummaryResponse } from './types/portfolio';
import type { ManagedProfile } from './components/Family/FamilySelector';

export interface UseDashboardDataParams {
  selectedFamilyId: string | null;
  selectedProfileId: string | null;
  cpiInflationRate: number;
  marginalTaxBracket: number;
  excludeArbitrage: boolean;
  onResetScopeIfMissing: (profiles: ManagedProfile[]) => void;
}

export function useDashboardData({
  selectedFamilyId,
  selectedProfileId,
  cpiInflationRate,
  marginalTaxBracket,
  excludeArbitrage,
  onResetScopeIfMissing,
}: UseDashboardDataParams) {
  const [profiles, setProfiles] = useState<ManagedProfile[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummaryResponse | null>(null);
  const [xrayData, setXRayData] = useState<XRayData | null>(null);
  const [exposures, setExposures] = useState<StockExposure[]>([]);
  const [taxSummary, setTaxSummary] = useState<ITRSummary | null>(null);
  const [selectedTaxFY, setSelectedTaxFY] = useState<string | null>(null);
  const selectedTaxFYRef = useRef<string | null>(selectedTaxFY);
  useEffect(() => {
    selectedTaxFYRef.current = selectedTaxFY;
  }, [selectedTaxFY]);
  const [harvesting, setHarvesting] = useState<HarvestTicketResponse | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  const fetchSupplementaryData = useCallback(async (scopeId: string, signal: AbortSignal) => {
    const taxParams: Record<string, string | number> = { taxSlab: marginalTaxBracket };
    if (selectedTaxFYRef.current) {
      taxParams.fy = selectedTaxFYRef.current;
    }
    const [xrayRes, exposuresRes, taxRes, harvestingRes] = await Promise.allSettled([
      api.get<XRayData>(`${API_ENDPOINTS.PORTFOLIO}/${scopeId}/xray`, { signal }),
      api.get<StockExposure[]>(`${API_ENDPOINTS.PORTFOLIO}/${scopeId}/exposures?excludeArbitrage=${excludeArbitrage}`, { signal }),
      api.get<ITRSummary>(`${API_ENDPOINTS.PORTFOLIO}/${scopeId}/tax-summary`, { params: taxParams, signal }),
      api.get<HarvestTicketResponse>(`${API_ENDPOINTS.TAX}/harvesting-opportunities`, { params: { scopeId }, signal }),
    ]);
    if (signal.aborted) return;
    if (xrayRes.status === 'fulfilled') setXRayData(xrayRes.value.data);
    if (exposuresRes.status === 'fulfilled') setExposures(exposuresRes.value.data || []);
    if (taxRes.status === 'fulfilled') setTaxSummary(taxRes.value.data);
    if (harvestingRes.status === 'fulfilled') setHarvesting(harvestingRes.value.data);
  }, [excludeArbitrage, marginalTaxBracket]);

  useEffect(() => {
    const scopeId = portfolio?.id;
    if (!scopeId || !selectedTaxFY) return;
    let cancelled = false;
    api
      .get<ITRSummary>(`${API_ENDPOINTS.PORTFOLIO}/${scopeId}/tax-summary`, {
        params: { fy: selectedTaxFY, taxSlab: marginalTaxBracket },
      })
      .then((res) => {
        if (!cancelled && res.data) {
          setTaxSummary(res.data);
        }
      })
      .catch((err: unknown) => {
        if (!axios.isCancel(err) && !(err instanceof Error && err.name === 'CanceledError')) {
          console.error('Failed to fetch tax summary for FY:', err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [portfolio?.id, selectedTaxFY, marginalTaxBracket]);

  const fetchSummary = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (!hasLoadedOnceRef.current) setLoading(true);
      else setIsRefetching(true);

      const [summaryRes, profilesRes] = await Promise.all([
        api.get<PortfolioSummaryResponse>(`${API_ENDPOINTS.PORTFOLIO}/summary`, {
          params: { familyGroupId: selectedFamilyId, profileId: selectedProfileId, cpiInflationRate, marginalTaxBracket },
          signal: controller.signal,
        }),
        api.get<ManagedProfile[]>(`${API_ENDPOINTS.FAMILY}/profiles`, { signal: controller.signal }),
      ]);

      hasLoadedOnceRef.current = true;
      setPortfolio(summaryRes.data);
      setProfiles(profilesRes.data);
      onResetScopeIfMissing(profilesRes.data);

      if (summaryRes.data?.id) {
        await fetchSupplementaryData(summaryRes.data.id, controller.signal);
      }
    } catch (err: unknown) {
      if (!axios.isCancel(err) && !(err instanceof Error && err.name === 'CanceledError')) {
        console.error('Failed to fetch data:', err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setIsRefetching(false);
      }
    }
  }, [selectedFamilyId, selectedProfileId, cpiInflationRate, marginalTaxBracket, onResetScopeIfMissing, fetchSupplementaryData]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    profiles,
    setProfiles,
    portfolio,
    setPortfolio,
    xrayData,
    setXRayData,
    exposures,
    setExposures,
    taxSummary,
    setTaxSummary,
    selectedTaxFY,
    setSelectedTaxFY,
    harvesting,
    setHarvesting,
    loading,
    setLoading,
    isRefetching,
    fetchSummary,
  };
}
