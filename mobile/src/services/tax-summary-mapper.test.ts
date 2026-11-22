import { describe, it, expect } from 'vitest';
import {
  mapServerTableFToMatrix,
  mapServerSummaryToResult,
} from './tax-summary-mapper';
import { AdvanceTaxQuarter } from './tax-types';

describe('tax-summary-mapper', () => {
  it('maps server Table F quarter structure into strongly-typed matrix', () => {
    const rawTableF = {
      quarters: {
        'Q1 (01/04 - 15/06)': {
          ltcg10: '10000',
          estimatedTax: '1040.00',
          cess: '40.00',
          taxBeforeCess: '1000.00',
          totalGain: '10000',
        },
        'Q2b (23/07 - 15/09)': {
          ltcg125: '53000',
          estimatedTax: '6890.00',
          cess: '265.00',
          taxBeforeCess: '6625.00',
          totalGain: '53000',
        },
      },
      quarterTotals: {
        'Q1 (01/04 - 15/06)': '1040.00',
        'Q2b (23/07 - 15/09)': '6890.00',
      },
    };

    const matrix = mapServerTableFToMatrix(rawTableF);
    expect(matrix.quarters[AdvanceTaxQuarter.Q1].ltcg10).toBe(10000);
    expect(matrix.quarters[AdvanceTaxQuarter.Q1].estimatedTax).toBe(1040);
    expect(matrix.quarters[AdvanceTaxQuarter.Q2B].ltcg12_5).toBe(53000);
    expect(matrix.quarters[AdvanceTaxQuarter.Q2B].estimatedTax).toBe(6890);
    expect(matrix.quarterTotals[AdvanceTaxQuarter.Q1]).toBe(1040);
    expect(matrix.quarterTotals[AdvanceTaxQuarter.Q2B]).toBe(6890);
  });

  it('handles empty or undefined tableF gracefully', () => {
    const matrix = mapServerTableFToMatrix(undefined);
    expect(matrix.quarters[AdvanceTaxQuarter.Q1].estimatedTax).toBe(0);
    expect(matrix.quarterTotals[AdvanceTaxQuarter.Q1]).toBe(0);
  });

  it('maps server section totals into TaxCalculationsResult', () => {
    const rawSummary = {
      sectionTotals: {
        '112A (10%)': {
          totalGain: '65000',
          totalTax: '6760.00',
          taxBeforeCess: '6500.00',
        },
        '112A (12.5%)': {
          totalGain: '53000',
          totalTax: '6890.00',
          taxBeforeCess: '6625.00',
        },
        '50AA (Slab)': {
          totalGain: '20000',
          totalTax: '6240.00',
          taxBeforeCess: '6000.00',
        },
      },
    };

    const result = mapServerSummaryToResult(rawSummary, '2024-25');
    expect(result.ltcg10Gain).toBe(65000);
    expect(result.ltcg12_5Gain).toBe(53000);
    expect(result.slabGain).toBe(20000);
    expect(result.totalEquityLTCG).toBe(118000);
    expect(result.ltcgLimit).toBe(125000);
    expect(result.ltcgExemptClaimed).toBe(118000);
    expect(result.grandTotalTax).toBe(6760 + 6890 + 6240);
  });
});
