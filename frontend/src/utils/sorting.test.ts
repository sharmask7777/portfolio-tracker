import type { ConsolidatedSchemeGroup } from './consolidation';
import { describe, it, expect } from 'vitest';
import { sortFolios } from './sorting';

describe('sortFolios', () => {
  const mockFolios = [
    {
      id: '1',
      asset: { name: 'Axis Bluechip', type: 'MUTUAL_FUND' },
      metrics: { investedAmount: 10000, currentValue: 12000, dayChange: 100, dayChangePercentage: 1.0, xirr: 0.15, postTaxXirr: 0.12, absoluteReturn: 0.2, postTaxAbsoluteReturn: 0.16 }
    },
    {
      id: '2',
      asset: { name: 'HDFC Equity', type: 'ETF' },
      metrics: { investedAmount: 5000, currentValue: 8000, dayChange: -50, dayChangePercentage: -0.5, xirr: 0.25, postTaxXirr: 0.20, absoluteReturn: 0.6, postTaxAbsoluteReturn: 0.48 }
    }
  ];

  it('returns original array when sortField or sortDirection is null', () => {
    const result = sortFolios(mockFolios, null, null, 'XIRR');
    expect(result).toEqual(mockFolios);
  });

  it('sorts by scheme name', () => {
    const sortedDesc = sortFolios(mockFolios, 'name', 'desc', 'XIRR');
    expect(sortedDesc[0].asset.name).toBe('HDFC Equity');

    const sortedAsc = sortFolios(mockFolios, 'name', 'asc', 'XIRR');
    expect(sortedAsc[0].asset.name).toBe('Axis Bluechip');
  });

  it('sorts by invested amount', () => {
    const sortedDesc = sortFolios(mockFolios, 'invested', 'desc', 'XIRR');
    expect(sortedDesc[0].metrics.investedAmount).toBe(10000);

    const sortedAsc = sortFolios(mockFolios, 'invested', 'asc', 'XIRR');
    expect(sortedAsc[0].metrics.investedAmount).toBe(5000);
  });

  it('sorts by current value', () => {
    const sortedDesc = sortFolios(mockFolios, 'value', 'desc', 'XIRR');
    expect(sortedDesc[0].metrics.currentValue).toBe(12000);
  });

  it('sorts by performance (XIRR mode)', () => {
    const sortedDesc = sortFolios(mockFolios, 'performance', 'desc', 'XIRR');
    expect(sortedDesc[0].metrics.xirr).toBe(0.25);
  });

  it('sorts by performance (ABS mode)', () => {
    const sortedDesc = sortFolios(mockFolios, 'performance', 'desc', 'ABS');
    expect(sortedDesc[0].metrics.absoluteReturn).toBe(0.6);
  });
});

import { sortSchemeGroups } from './sorting';

describe('sortSchemeGroups & extra sorting coverage', () => {
  const mockGroups: ConsolidatedSchemeGroup[] = [
    {
      id: 'grp-1',
      schemeName: 'Axis Bluechip',
      type: 'MUTUAL_FUND',
      pans: ['ABCDE1234F'],
      folioCount: 1,
      folios: [],
      metrics: { investedAmount: 10000, currentValue: 12000, dayChange: 100, dayChangePercentage: 1.0, xirr: 0.15, postTaxXirr: 0.12, absoluteReturn: 0.2, postTaxAbsoluteReturn: 0.16 }
    },
    {
      id: 'grp-2',
      schemeName: 'HDFC Equity',
      type: 'ETF',
      pans: ['ABCDE1234F'],
      folioCount: 1,
      folios: [],
      metrics: { investedAmount: 5000, currentValue: 8000, dayChange: -50, dayChangePercentage: -0.5, xirr: 0.25, postTaxXirr: 0.20, absoluteReturn: 0.6, postTaxAbsoluteReturn: 0.48 }
    }
  ];

  it('handles null/undefined groups or null fields', () => {
    // @ts-expect-error test null
    expect(sortSchemeGroups(null, 'name', 'asc', 'XIRR')).toEqual([]);
    expect(sortSchemeGroups(mockGroups, null, null, 'XIRR')).toEqual(mockGroups);
  });

  it('sorts scheme groups by various fields and directions', () => {
    expect(sortSchemeGroups(mockGroups, 'name', 'asc', 'XIRR')[0].schemeName).toBe('Axis Bluechip');
    expect(sortSchemeGroups(mockGroups, 'name', 'desc', 'XIRR')[0].schemeName).toBe('HDFC Equity');
    expect(sortSchemeGroups(mockGroups, 'type', 'asc', 'XIRR')[0].type).toBe('ETF');
    expect(sortSchemeGroups(mockGroups, 'invested', 'asc', 'XIRR')[0].schemeName).toBe('HDFC Equity');
    expect(sortSchemeGroups(mockGroups, 'value', 'desc', 'XIRR')[0].schemeName).toBe('Axis Bluechip');
    expect(sortSchemeGroups(mockGroups, 'dayChange', 'desc', 'XIRR')[0].schemeName).toBe('Axis Bluechip');
    expect(sortSchemeGroups(mockGroups, 'performance', 'desc', 'XIRR')[0].schemeName).toBe('HDFC Equity');
    expect(sortSchemeGroups(mockGroups, 'performance', 'desc', 'ABS')[0].schemeName).toBe('HDFC Equity');
    expect(sortSchemeGroups(mockGroups, 'postTaxPerformance', 'desc', 'XIRR')[0].schemeName).toBe('HDFC Equity');
    expect(sortSchemeGroups(mockGroups, 'postTaxPerformance', 'desc', 'ABS')[0].schemeName).toBe('HDFC Equity');
  });

  it('covers sortFolios with type, dayChange, postTaxPerformance and equal values', () => {
    // @ts-expect-error test null folios
    expect(sortFolios(null, 'name', 'asc', 'XIRR')).toEqual([]);
    const equalFolios = [
      { id: '1', asset: { name: 'A', type: 'MUTUAL_FUND' }, metrics: { dayChange: 10, postTaxXirr: 0.1, postTaxAbsoluteReturn: 0.1 } },
      { id: '2', asset: { name: 'A', type: 'MUTUAL_FUND' }, metrics: { dayChange: 10, postTaxXirr: 0.1, postTaxAbsoluteReturn: 0.1 } },
    ];
    expect(sortFolios(equalFolios, 'name', 'asc', 'XIRR')).toHaveLength(2);
    expect(sortFolios(equalFolios, 'type', 'desc', 'XIRR')).toHaveLength(2);
    expect(sortFolios(equalFolios, 'dayChange', 'asc', 'XIRR')[0].metrics.dayChange).toBe(10);
    expect(sortFolios(equalFolios, 'postTaxPerformance', 'asc', 'XIRR')[0].metrics.postTaxXirr).toBe(0.1);
    expect(sortFolios(equalFolios, 'postTaxPerformance', 'asc', 'ABS')[0].metrics.postTaxAbsoluteReturn).toBe(0.1);
  });
});
