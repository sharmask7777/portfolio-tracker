import { describe, it, expect } from 'vitest';
import {
  consolidateFoliosIntoSchemes,
  computeGroupKey,
  sanitizeReturnRate,
  type FolioInput,
} from './consolidation';

describe('Scheme Consolidation Service', () => {
  it('bounds wild XIRR return rates using sanitizeReturnRate', () => {
    expect(sanitizeReturnRate(15.0, 0.1)).toBe(10.0); // Capped at 1000%
    expect(sanitizeReturnRate(-2.5, 0.1)).toBe(-1.0); // Clamped at -100%
    expect(sanitizeReturnRate(NaN, 0.12)).toBe(0.12);
    expect(sanitizeReturnRate(null, 0.15)).toBe(0.15);
  });

  it('computes group key by ISIN first, then AMFI code, then normalized name', () => {
    const folioWithIsin: FolioInput = {
      id: 'f1',
      asset: { isin: 'INF209K01165', name: 'Parag Parikh Flexi Cap Fund' },
    };
    expect(computeGroupKey(folioWithIsin)).toBe('isin_INF209K01165');

    const folioWithAmfi: FolioInput = {
      id: 'f2',
      asset: { amfiCode: '122639', name: 'Parag Parikh Flexi Cap Fund' },
    };
    expect(computeGroupKey(folioWithAmfi)).toBe('amfi_122639');

    const folioWithNameOnly: FolioInput = {
      id: 'f3',
      asset: { name: 'Parag Parikh Flexi Cap Fund' },
    };
    expect(computeGroupKey(folioWithNameOnly)).toBe('name_parag_parikh_flexi_cap_fund');
  });

  it('consolidates multiple folios for the same scheme and aggregates metrics', () => {
    const folios: FolioInput[] = [
      {
        id: 'f1',
        pan: 'ABCDE1234F',
        asset: { isin: 'INF209K01165', name: 'Parag Parikh Flexi Cap Fund' },
        metrics: {
          investedAmount: 50000,
          currentValue: 70000,
          dayChange: 500,
          xirr: 0.18,
          postTaxXirr: 0.16,
          estimatedTax: 2500,
        },
      },
      {
        id: 'f2',
        pan: 'XYZAB5678C',
        asset: { isin: 'INF209K01165', name: 'Parag Parikh Flexi Cap Fund' },
        metrics: {
          investedAmount: 30000,
          currentValue: 40000,
          dayChange: 300,
          xirr: 0.14,
          postTaxXirr: 0.12,
          estimatedTax: 1200,
        },
      },
    ];

    const consolidated = consolidateFoliosIntoSchemes(folios);
    expect(consolidated).toHaveLength(1);

    const group = consolidated[0]!;
    expect(group.folioCount).toBe(2);
    expect(group.pans).toEqual(['ABCDE1234F', 'XYZAB5678C']);
    expect(group.metrics.investedAmount).toBe(80000);
    expect(group.metrics.currentValue).toBe(110000);
    expect(group.metrics.dayChange).toBe(800);
    expect(group.metrics.estimatedTax).toBe(3700);
    expect(group.metrics.netRealizableValue).toBe(110000 - 3700);
    // Weighted XIRR: (70k*0.18 + 40k*0.14) / 110k = (12.6k + 5.6k)/110k = 18.2/110 = ~0.16545
    expect(group.metrics.xirr).toBeCloseTo(0.1655, 3);
  });
});
