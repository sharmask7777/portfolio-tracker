import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConsolidatedHoldings } from './useConsolidatedHoldings';
import type { FolioInput } from '../consolidation/types';
import type { PortfolioScope } from '../scope/usePortfolioScope';

describe('useConsolidatedHoldings', () => {
  const sampleFolios: FolioInput[] = [
    {
      id: 'folio-1',
      number: '1001',
      folioNumber: '1001',
      pan: 'ABCDE1234F',
      asset: {
        id: 'asset-1',
        name: 'HDFC Top 100 Fund - Direct Growth',
        type: 'MUTUAL_FUND',
        isin: 'INF179K01BE2',
        amfiCode: '118989',
      },
      metrics: {
        investedAmount: 100000,
        currentValue: 150000,
        dayChange: 500,
        xirr: 0.15,
      },
    },
    {
      id: 'folio-2',
      number: '1002',
      folioNumber: '1002',
      pan: 'ALPAC1001A',
      asset: {
        id: 'asset-2',
        name: 'HDFC Top 100 Fund - Direct Growth',
        type: 'MUTUAL_FUND',
        isin: 'INF179K01BE2',
        amfiCode: '118989',
      },
      metrics: {
        investedAmount: 50000,
        currentValue: 75000,
        dayChange: 250,
        xirr: 0.12,
      },
    },
    {
      id: 'folio-3',
      number: '3001',
      folioNumber: '3001',
      pan: 'ABCDE1234F',
      asset: {
        id: 'asset-3',
        name: 'Nippon India Small Cap Fund',
        type: 'MUTUAL_FUND',
        isin: 'INF204K01UN0',
        amfiCode: '118778',
      },
      metrics: {
        investedAmount: 60000,
        currentValue: 90000,
        dayChange: -200,
        xirr: 0.22,
      },
    },
    {
      id: 'folio-4',
      number: '4001',
      folioNumber: '4001',
      pan: 'BETAB2002B',
      asset: {
        id: 'asset-4',
        name: 'Sovereign Gold Bond 2028',
        type: 'GOLD',
        isin: 'IN0020180010',
      },
      metrics: {
        investedAmount: 40000,
        currentValue: 60000,
        dayChange: 100,
        xirr: 0.08,
      },
    },
  ];

  describe('consolidation and default state', () => {
    it('handles undefined or empty folios gracefully', () => {
      const { result } = renderHook(() => useConsolidatedHoldings({}));
      expect(result.current.allSchemes).toEqual([]);
      expect(result.current.filteredSchemes).toEqual([]);
      expect(result.current.sortedSchemes).toEqual([]);
    });

    it('consolidates folios into schemes under consolidated scope', () => {
      const scope: PortfolioScope = { type: 'consolidated' };
      const { result } = renderHook(() =>
        useConsolidatedHoldings({ folios: sampleFolios, scope })
      );

      expect(result.current.allSchemes).toHaveLength(3);
      const hdfc = result.current.allSchemes.find((s) => s.isin === 'INF179K01BE2');
      expect(hdfc).toBeDefined();
      expect(hdfc?.folioCount).toBe(2);
      expect(hdfc?.pans).toEqual(expect.arrayContaining(['ABCDE1234F', 'ALPAC1001A']));
    });
  });

  describe('scope filtering', () => {
    it('filters folios to matching member PAN', () => {
      const memberScope: PortfolioScope = {
        type: 'member',
        profileId: 'prof-2',
        pan: 'ALPAC1001A',
        name: 'Neha',
      };
      const { result } = renderHook(() =>
        useConsolidatedHoldings({ folios: sampleFolios, scope: memberScope })
      );

      expect(result.current.allSchemes).toHaveLength(1);
      const hdfc = result.current.allSchemes[0];
      expect(hdfc?.schemeName).toBe('HDFC Top 100 Fund - Direct Growth');
      expect(hdfc?.folioCount).toBe(1);
      expect(hdfc?.pans).toEqual(['ALPAC1001A']);
      expect(hdfc?.metrics.currentValue).toBe(75000);
    });

    it('returns empty when member PAN has no matching folios', () => {
      const memberScope: PortfolioScope = {
        type: 'member',
        profileId: 'prof-unknown',
        pan: 'NONEXISTENT',
      };
      const { result } = renderHook(() =>
        useConsolidatedHoldings({ folios: sampleFolios, scope: memberScope })
      );
      expect(result.current.allSchemes).toHaveLength(0);
    });
  });

  describe('search query filtering', () => {
    it('filters by scheme name substring', () => {
      const { result } = renderHook(() =>
        useConsolidatedHoldings({
          folios: sampleFolios,
          searchQuery: 'small cap',
        })
      );
      expect(result.current.filteredSchemes).toHaveLength(1);
      expect(result.current.filteredSchemes[0]?.schemeName).toBe('Nippon India Small Cap Fund');
    });

    it('filters by ISIN code', () => {
      const { result } = renderHook(() =>
        useConsolidatedHoldings({
          folios: sampleFolios,
          searchQuery: 'INF179K01BE2',
        })
      );
      expect(result.current.filteredSchemes).toHaveLength(1);
      expect(result.current.filteredSchemes[0]?.schemeName).toBe('HDFC Top 100 Fund - Direct Growth');
    });

    it('filters by folio number', () => {
      const { result } = renderHook(() =>
        useConsolidatedHoldings({
          folios: sampleFolios,
          searchQuery: '4001',
        })
      );
      expect(result.current.filteredSchemes).toHaveLength(1);
      expect(result.current.filteredSchemes[0]?.schemeName).toBe('Sovereign Gold Bond 2028');
    });

    it('filters by member PAN', () => {
      const { result } = renderHook(() =>
        useConsolidatedHoldings({
          folios: sampleFolios,
          searchQuery: 'BETAB2002B',
        })
      );
      expect(result.current.filteredSchemes).toHaveLength(1);
      expect(result.current.filteredSchemes[0]?.schemeName).toBe('Sovereign Gold Bond 2028');
    });
  });

  describe('asset type filtering', () => {
    it('filters by GOLD asset type', () => {
      const { result } = renderHook(() =>
        useConsolidatedHoldings({
          folios: sampleFolios,
          assetTypeFilter: 'GOLD',
        })
      );
      expect(result.current.filteredSchemes).toHaveLength(1);
      expect(result.current.filteredSchemes[0]?.type).toBe('GOLD');
    });

    it('includes all when assetTypeFilter is ALL or undefined', () => {
      const { result } = renderHook(() =>
        useConsolidatedHoldings({
          folios: sampleFolios,
          assetTypeFilter: 'ALL',
        })
      );
      expect(result.current.filteredSchemes).toHaveLength(3);
    });

    it('excludes folios without a PAN when member scope has a PAN', () => {
      const foliosWithPanless = [
        ...sampleFolios,
        {
          id: 'panless-1',
          folioNumber: 'PANLESS-1',
          schemeName: 'Unassigned Fund',
          type: 'EQUITY',
          currentValue: 5000,
          costValue: 4000,
          units: 100,
        },
      ];
      const { result } = renderHook(() =>
        useConsolidatedHoldings({
          folios: foliosWithPanless,
          scope: { type: 'member', profileId: 'p1', pan: 'ABCDE1234F', name: 'Aarav' },
        })
      );
      expect(result.current.allSchemes.every((s) => s.schemeName !== 'Unassigned Fund')).toBe(true);
    });
  });

  describe('sorting', () => {
    it('sorts schemes by value descending', () => {
      const { result } = renderHook(() =>
        useConsolidatedHoldings({
          folios: sampleFolios,
          sortField: 'value',
          sortDirection: 'desc',
        })
      );
      expect(result.current.sortedSchemes[0]?.schemeName).toBe('HDFC Top 100 Fund - Direct Growth');
      expect(result.current.sortedSchemes[1]?.schemeName).toBe('Nippon India Small Cap Fund');
      expect(result.current.sortedSchemes[2]?.schemeName).toBe('Sovereign Gold Bond 2028');
    });
  });

  describe('expansion state management', () => {
    it('initializes with initialExpandedIds', () => {
      const { result } = renderHook(() =>
        useConsolidatedHoldings({
          folios: sampleFolios,
          initialExpandedIds: ['group_isin_INF179K01BE2'],
        })
      );
      expect(result.current.isExpanded('group_isin_INF179K01BE2')).toBe(true);
      expect(result.current.isExpanded('other_id')).toBe(false);
    });

    it('toggles expansion state', () => {
      const { result } = renderHook(() => useConsolidatedHoldings({ folios: sampleFolios }));
      const schemeId = result.current.allSchemes[0]?.id;
      expect(schemeId).toBeDefined();
      if (!schemeId) return;

      expect(result.current.isExpanded(schemeId)).toBe(false);
      act(() => {
        result.current.toggleExpanded(schemeId);
      });
      expect(result.current.isExpanded(schemeId)).toBe(true);

      act(() => {
        result.current.toggleExpanded(schemeId);
      });
      expect(result.current.isExpanded(schemeId)).toBe(false);
    });

    it('expands all and collapses all schemes', () => {
      const { result } = renderHook(() => useConsolidatedHoldings({ folios: sampleFolios }));
      expect(result.current.expandedSchemeIds.size).toBe(0);

      act(() => {
        result.current.expandAll();
      });
      expect(result.current.expandedSchemeIds.size).toBe(result.current.allSchemes.length);

      act(() => {
        result.current.collapseAll();
      });
      expect(result.current.expandedSchemeIds.size).toBe(0);
    });
  });
});
