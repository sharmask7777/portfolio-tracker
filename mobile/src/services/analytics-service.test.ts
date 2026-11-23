import { describe, it, expect } from 'vitest';
import { deriveAnalyticsFromHoldings } from './analytics-service';
import type { EnrichedHolding } from './portfolio-calculations';

describe('analytics-service', () => {
  const mockHoldings: EnrichedHolding[] = [
    {
      id: 'hold-1',
      folio_number: 'FOLIO-101',
      amfi_code: '120503',
      scheme_name: 'Synthetic Flexi Cap Fund Direct Growth',
      isin: 'INF879O01018',
      units: 1000,
      invested_cost: 400000,
      current_nav: 600,
      current_value: 600000,
      asset_class: 'EQUITY',
      nav_date: '2026-03-31',
      updated_at: '2026-03-31T10:00:00.000Z',
      day_change: 2000,
      day_change_pct: 0.33,
      xirr: 0.15,
      absolute_return: 0.5,
      asset_category: 'EQUITY',
      dayChange: 2000,
      dayChangePct: 0.33,
      gainLoss: 200000,
      gainLossPct: 50,
    },
    {
      id: 'hold-2',
      folio_number: 'FOLIO-102',
      amfi_code: '119551',
      scheme_name: 'Synthetic Equity Arbitrage Fund Direct Growth',
      isin: 'INF174K01LS2',
      units: 5000,
      invested_cost: 150000,
      current_nav: 40,
      current_value: 200000,
      asset_class: 'HYBRID',
      nav_date: '2026-03-31',
      updated_at: '2026-03-31T10:00:00.000Z',
      day_change: 100,
      day_change_pct: 0.05,
      xirr: 0.08,
      absolute_return: 0.33,
      asset_category: 'ARBITRAGE',
      dayChange: 100,
      dayChangePct: 0.05,
      gainLoss: 50000,
      gainLossPct: 33.33,
    },
    {
      id: 'hold-3',
      folio_number: 'FOLIO-103',
      amfi_code: '100123',
      scheme_name: 'Synthetic Liquid Fund Direct Growth',
      isin: 'INF200K01VA8',
      units: 100,
      invested_cost: 100000,
      current_nav: 1000,
      current_value: 100000,
      asset_class: 'DEBT',
      nav_date: '2026-03-31',
      updated_at: '2026-03-31T10:00:00.000Z',
      day_change: 50,
      day_change_pct: 0.05,
      xirr: 0.06,
      absolute_return: 0.05,
      asset_category: 'CASH',
      dayChange: 50,
      dayChangePct: 0.05,
      gainLoss: 0,
      gainLossPct: 0,
    },
  ];

  it('produces non-empty marketCap with large, mid, small allocations', () => {
    const { xrayData } = deriveAnalyticsFromHoldings(mockHoldings);

    expect(xrayData.marketCap).toBeDefined();
    expect(xrayData.marketCap.large).toBeDefined();
    expect(xrayData.marketCap.large.percentage).toBeGreaterThan(0);
    expect(xrayData.marketCap.large.value).toBeGreaterThan(0);
    expect(xrayData.marketCap.mid).toBeDefined();
    expect(xrayData.marketCap.mid.percentage).toBeGreaterThan(0);
    expect(xrayData.marketCap.small).toBeDefined();
    expect(xrayData.marketCap.small.percentage).toBeGreaterThan(0);
  });

  it('produces assetAllocation with arbitrage category breakdown', () => {
    const { xrayData } = deriveAnalyticsFromHoldings(mockHoldings);

    expect(xrayData.assetAllocation).toBeDefined();
    expect(xrayData.assetAllocation.arbitrage).toBeDefined();
    expect(xrayData.assetAllocation.arbitrage?.value).toBe(200000);
    expect(xrayData.assetAllocation.arbitrage?.percentage).toBeCloseTo(22.22, 1);
  });
});
