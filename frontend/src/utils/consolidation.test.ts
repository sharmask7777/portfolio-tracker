import { describe, it, expect } from 'vitest';
import { consolidateFoliosIntoSchemes } from './consolidation';

describe('consolidateFoliosIntoSchemes', () => {
  it('returns empty array when input is empty or null', () => {
    expect(consolidateFoliosIntoSchemes([])).toEqual([]);
    expect(consolidateFoliosIntoSchemes(null as any)).toEqual([]);
  });

  it('preserves single-folio schemes with folioCount = 1', () => {
    const folios = [
      {
        id: 'folio-1',
        number: '12345678',
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
        },
        transactions: [],
      },
    ];

    const result = consolidateFoliosIntoSchemes(folios);
    expect(result).toHaveLength(1);
    expect(result[0].schemeName).toBe('HDFC Top 100 Fund - Direct Growth');
    expect(result[0].folioCount).toBe(1);
    expect(result[0].pans).toEqual(['ABCDE1234F']);
    expect(result[0].metrics.investedAmount).toBe(100000);
    expect(result[0].metrics.currentValue).toBe(150000);
    expect(result[0].metrics.dayChange).toBe(500);
    expect(result[0].metrics.xirr).toBe(0.15);
  });

  it('consolidates multiple folios of Parag Parikh Flexi Cap Fund into a single master scheme group with unique PANs', () => {
    const folios = [
      {
        id: 'folio-pp-1',
        number: '10396016',
        pan: 'ABCDE1234F',
        asset: {
          id: 'asset-ppfc',
          name: 'Parag Parikh Flexi Cap Fund - Direct Plan Growth',
          type: 'MUTUAL_FUND',
          isin: 'INF879O01027',
          amfiCode: '122639',
        },
        metrics: {
          investedAmount: 500000,
          currentValue: 700000,
          dayChange: 2000,
          dayChangePercentage: 0.28,
          xirr: 0.20,
          postTaxXirr: 0.18,
          absoluteReturn: 0.40,
          postTaxAbsoluteReturn: 0.35,
          estimatedTax: 10000,
        },
        transactions: [],
      },
      {
        id: 'folio-pp-2',
        number: '18377890',
        pan: 'WXYZP9876Q',
        asset: {
          id: 'asset-ppfc',
          name: 'Parag Parikh Flexi Cap Fund - Direct Plan Growth',
          type: 'MUTUAL_FUND',
          isin: 'INF879O01027',
          amfiCode: '122639',
        },
        metrics: {
          investedAmount: 300000,
          currentValue: 300000,
          dayChange: 1000,
          dayChangePercentage: 0.33,
          xirr: 0.10,
          postTaxXirr: 0.09,
          absoluteReturn: 0.0,
          postTaxAbsoluteReturn: 0.0,
          estimatedTax: 0,
        },
        transactions: [],
      },
    ];

    const result = consolidateFoliosIntoSchemes(folios);
    expect(result).toHaveLength(1);
    const ppfc = result[0];
    expect(ppfc.schemeName).toBe('Parag Parikh Flexi Cap Fund - Direct Plan Growth');
    expect(ppfc.folioCount).toBe(2);
    expect(ppfc.folios).toHaveLength(2);
    expect(ppfc.pans).toEqual(['ABCDE1234F', 'WXYZP9876Q']);

    // Sum of invested and value
    expect(ppfc.metrics.investedAmount).toBe(800000);
    expect(ppfc.metrics.currentValue).toBe(1000000);
    expect(ppfc.metrics.dayChange).toBe(3000);

    // Consolidated day change %
    // prevValue = 1000000 - 3000 = 997000
    // % = (3000 / 997000) * 100 = 0.3009%
    expect(ppfc.metrics.dayChangePercentage).toBeCloseTo((3000 / 997000) * 100, 2);

    // Weighted XIRR: (0.20 * 700000 + 0.10 * 300000) / 1000000 = (140000 + 30000) / 1000000 = 0.17
    expect(ppfc.metrics.xirr).toBeCloseTo(0.17, 3);

    // Child folios sorted descending by current value
    expect(ppfc.folios[0].id).toBe('folio-pp-1');
    expect(ppfc.folios[1].id).toBe('folio-pp-2');
  });

  it('keeps Direct and Regular plans as distinct scheme groups due to distinct ISINs', () => {
    const folios = [
      {
        id: 'folio-pp-direct',
        number: '10396016',
        asset: {
          name: 'Parag Parikh Flexi Cap Fund - Direct Plan Growth',
          type: 'MUTUAL_FUND',
          isin: 'INF879O01027',
        },
        metrics: { investedAmount: 50000, currentValue: 60000, dayChange: 100, xirr: 0.15 },
      },
      {
        id: 'folio-pp-regular',
        number: '10396016',
        asset: {
          name: 'Parag Parikh Flexi Cap Fund - Regular Plan Growth',
          type: 'MUTUAL_FUND',
          isin: 'INF879O01019',
        },
        metrics: { investedAmount: 20000, currentValue: 22000, dayChange: 30, xirr: 0.11 },
      },
    ];

    const result = consolidateFoliosIntoSchemes(folios);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.isin)).toContain('INF879O01027');
    expect(result.map(r => r.isin)).toContain('INF879O01019');
  });
});
