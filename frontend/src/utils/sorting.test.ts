import { describe, it, expect } from 'vitest';
import { sortFolios } from './sorting';

describe('sortFolios', () => {
  const mockFolios = [
    {
      id: '1',
      asset: { name: 'Axis Bluechip', type: 'MUTUAL_FUND' },
      metrics: { investedAmount: 10000, currentValue: 12000, dayChange: 100, xirr: 0.15, postTaxXirr: 0.12, absoluteReturn: 0.2, postTaxAbsoluteReturn: 0.16 }
    },
    {
      id: '2',
      asset: { name: 'HDFC Equity', type: 'ETF' },
      metrics: { investedAmount: 5000, currentValue: 8000, dayChange: -50, xirr: 0.25, postTaxXirr: 0.20, absoluteReturn: 0.6, postTaxAbsoluteReturn: 0.48 }
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
