import { describe, it, expect } from 'vitest';
import {
  computeGroupKey,
  groupFoliosByKey,
  consolidateFoliosIntoSchemes,
  sortSchemeGroups,
} from './scheme-consolidator';
import type { FolioInput } from './types';

describe('scheme-consolidator', () => {
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
        dayChangePercentage: 0.33,
        xirr: 0.15,
        postTaxXirr: 0.13,
        absoluteReturn: 0.5,
        postTaxAbsoluteReturn: 0.45,
        estimatedTax: 5000,
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
        dayChangePercentage: 0.33,
        xirr: 0.12,
        postTaxXirr: 0.10,
        absoluteReturn: 0.5,
        postTaxAbsoluteReturn: 0.45,
        estimatedTax: 2500,
      },
    },
    {
      id: 'folio-3',
      number: '2001',
      folioNumber: '2001',
      pan: 'ABCDE1234F',
      asset: {
        id: 'asset-3',
        name: 'Parag Parikh Flexi Cap Fund',
        type: 'MUTUAL_FUND',
        isin: 'INF879O01018',
        amfiCode: '122639',
      },
      metrics: {
        investedAmount: 80000,
        currentValue: 120000,
        dayChange: -300,
        dayChangePercentage: -0.25,
        xirr: 0.18,
        postTaxXirr: 0.15,
        absoluteReturn: 0.5,
        postTaxAbsoluteReturn: 0.45,
        estimatedTax: 4000,
      },
    },
  ];

  describe('computeGroupKey', () => {
    it('uses isin when available and valid', () => {
      const key = computeGroupKey(sampleFolios[0]!);
      expect(key).toBe('isin_INF179K01BE2');
    });

    it('falls back to amfiCode if ISIN starts with MISSING-', () => {
      const folio: FolioInput = {
        id: 'f1',
        asset: { isin: 'MISSING-123', amfiCode: '118989', name: 'Scheme A' },
      };
      expect(computeGroupKey(folio)).toBe('amfi_118989');
    });

    it('falls back to normalized name if no isin or amfiCode', () => {
      const folio: FolioInput = {
        id: 'f1',
        asset: { name: 'Custom Equity Fund' },
      };
      expect(computeGroupKey(folio)).toBe('name_custom_equity_fund');
    });

    it('handles missing asset gracefully', () => {
      const folio: FolioInput = { id: 'f1' };
      expect(computeGroupKey(folio)).toBe('name_unknown_asset');
    });
  });

  describe('groupFoliosByKey', () => {
    it('groups multiple folios sharing the same key', () => {
      const map = groupFoliosByKey(sampleFolios);
      expect(map.size).toBe(2);
      expect(map.get('isin_INF179K01BE2')).toHaveLength(2);
      expect(map.get('isin_INF879O01018')).toHaveLength(1);
    });
  });

  describe('consolidateFoliosIntoSchemes', () => {
    it('handles empty or null inputs', () => {
      expect(consolidateFoliosIntoSchemes([])).toEqual([]);
      expect(consolidateFoliosIntoSchemes(null)).toEqual([]);
      expect(consolidateFoliosIntoSchemes(undefined)).toEqual([]);
    });

    it('consolidates multi-folio schemes with correct aggregation and deduplicated PANs', () => {
      const groups = consolidateFoliosIntoSchemes(sampleFolios);
      expect(groups).toHaveLength(2);

      const hdfc = groups.find((g) => g.isin === 'INF179K01BE2');
      expect(hdfc).toBeDefined();
      if (!hdfc) return;

      expect(hdfc.schemeName).toBe('HDFC Top 100 Fund - Direct Growth');
      expect(hdfc.folioCount).toBe(2);
      expect(hdfc.pans).toEqual(expect.arrayContaining(['ABCDE1234F', 'ALPAC1001A']));
      expect(hdfc.metrics.investedAmount).toBe(150000);
      expect(hdfc.metrics.currentValue).toBe(225000);
      expect(hdfc.metrics.dayChange).toBe(750);
      expect(hdfc.metrics.estimatedTax).toBe(7500);
      expect(hdfc.metrics.netRealizableValue).toBe(217500);

      // Weighted XIRR: (150k*0.15 + 75k*0.12) / 225k = (22500 + 9000) / 225k = 31500 / 225000 = 0.14
      expect(hdfc.metrics.xirr).toBeCloseTo(0.14, 4);

      // Constituents sorted by descending currentValue
      expect(hdfc.folios[0]?.id).toBe('folio-1');
      expect(hdfc.folios[1]?.id).toBe('folio-2');
    });

    it('preserves single-folio schemes with original id', () => {
      const groups = consolidateFoliosIntoSchemes(sampleFolios);
      const ppfas = groups.find((g) => g.isin === 'INF879O01018');
      expect(ppfas).toBeDefined();
      if (!ppfas) return;

      expect(ppfas.id).toBe('folio-3');
      expect(ppfas.folioCount).toBe(1);
      expect(ppfas.pans).toEqual(['ABCDE1234F']);
      expect(ppfas.metrics.investedAmount).toBe(80000);
      expect(ppfas.metrics.currentValue).toBe(120000);
      expect(ppfas.metrics.dayChange).toBe(-300);
    });
  });

  describe('sortSchemeGroups', () => {
    const groups = consolidateFoliosIntoSchemes(sampleFolios);

    it('returns empty array on empty or null inputs', () => {
      expect(sortSchemeGroups([], 'value', 'desc')).toEqual([]);
      expect(sortSchemeGroups(null, 'value', 'desc')).toEqual([]);
    });

    it('returns original array when sortField or sortDirection is null', () => {
      expect(sortSchemeGroups(groups, null, null)).toEqual(groups);
      expect(sortSchemeGroups(groups, 'value', null)).toEqual(groups);
    });

    it('sorts by current value desc/asc', () => {
      const desc = sortSchemeGroups(groups, 'value', 'desc');
      expect(desc[0]?.schemeName).toBe('HDFC Top 100 Fund - Direct Growth');

      const asc = sortSchemeGroups(groups, 'value', 'asc');
      expect(asc[0]?.schemeName).toBe('Parag Parikh Flexi Cap Fund');
    });

    it('sorts by scheme name', () => {
      const asc = sortSchemeGroups(groups, 'name', 'asc');
      expect(asc[0]?.schemeName).toBe('HDFC Top 100 Fund - Direct Growth');

      const desc = sortSchemeGroups(groups, 'name', 'desc');
      expect(desc[0]?.schemeName).toBe('Parag Parikh Flexi Cap Fund');
    });

    it('sorts by invested amount', () => {
      const asc = sortSchemeGroups(groups, 'invested', 'asc');
      expect(asc[0]?.schemeName).toBe('Parag Parikh Flexi Cap Fund');
    });

    it('sorts by day change', () => {
      const desc = sortSchemeGroups(groups, 'dayChange', 'desc');
      expect(desc[0]?.schemeName).toBe('HDFC Top 100 Fund - Direct Growth');
    });

    it('sorts by performance under XIRR and ABS', () => {
      const descXirr = sortSchemeGroups(groups, 'performance', 'desc', 'XIRR');
      // PPFAS has 0.18 xirr, HDFC has 0.14 xirr
      expect(descXirr[0]?.schemeName).toBe('Parag Parikh Flexi Cap Fund');

      const descPostTax = sortSchemeGroups(groups, 'postTaxPerformance', 'desc', 'XIRR');
      expect(descPostTax[0]?.schemeName).toBe('Parag Parikh Flexi Cap Fund');
    });
  });
});
