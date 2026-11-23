import { describe, it, expect } from 'vitest';
import {
  mapRawFolioToHolding,
  summarizeHoldings,
  type ServerFolioData,
  type EnrichedHolding,
} from './portfolio-calculations';

describe('portfolio-calculations', () => {
  describe('mapRawFolioToHolding', () => {
    it('extracts dayChange, dayChangePercentage, xirr, absoluteReturn, and assetCategory from ServerFolioData', () => {
      const serverFolio: ServerFolioData = {
        id: 'folio-synthetic-01',
        number: 'FOLIO-SYN-101',
        pan: 'ABCDE1234F',
        units: 100,
        assetCategory: 'Equity Large Cap',
        asset: {
          amfiCode: '120503',
          name: 'Synthetic Bluechip Equity Direct Growth',
          isin: 'INF209K01157',
          assetType: 'EQUITY',
        },
        metrics: {
          investedAmount: 10000,
          currentValue: 12500,
          currentPrice: 125,
          dayChange: 250.5,
          dayChangePercentage: 2.04,
          xirr: 0.156,
          absoluteReturn: 0.25,
        },
      };

      const now = '2026-03-31T10:00:00.000Z';
      const holding = mapRawFolioToHolding(serverFolio, now);

      expect(holding).not.toBeNull();
      expect(holding?.day_change).toBe(250.5);
      expect(holding?.day_change_pct).toBe(2.04);
      expect(holding?.xirr).toBe(0.156);
      expect(holding?.absolute_return).toBe(0.25);
      expect(holding?.asset_category).toBe('Equity Large Cap');
    });

    it('falls back to defaults when metrics or assetCategory are missing', () => {
      const serverFolio: ServerFolioData = {
        id: 'folio-synthetic-02',
        number: 'FOLIO-SYN-102',
        units: 50,
        asset: {
          name: 'Synthetic Liquid Fund Direct Growth',
          assetType: 'DEBT',
        },
      };

      const now = '2026-03-31T10:00:00.000Z';
      const holding = mapRawFolioToHolding(serverFolio, now);

      expect(holding).not.toBeNull();
      expect(holding?.day_change).toBe(0);
      expect(holding?.day_change_pct).toBe(0);
      expect(holding?.xirr).toBe(0);
      expect(holding?.absolute_return).toBe(0);
      expect(holding?.asset_category).toBe('DEBT');
    });
  });

  describe('summarizeHoldings', () => {
    it('sums non-zero dayChange correctly and computes dayGainPct', () => {
      const holdings: EnrichedHolding[] = [
        {
          id: 'hold-1',
          folio_number: 'FOLIO-1',
          amfi_code: '120503',
          scheme_name: 'Synthetic Equity Fund',
          isin: 'INF209K01157',
          units: 100,
          invested_cost: 10000,
          current_nav: 110,
          current_value: 11000,
          asset_class: 'EQUITY',
          nav_date: '2026-03-31',
          updated_at: '2026-03-31T10:00:00.000Z',
          day_change: 200,
          day_change_pct: 1.85,
          xirr: 0.12,
          absolute_return: 0.1,
          asset_category: 'Equity Large Cap',
          dayChange: 200,
          dayChangePct: 1.85,
          gainLoss: 1000,
          gainLossPct: 10,
        },
        {
          id: 'hold-2',
          folio_number: 'FOLIO-2',
          amfi_code: '118989',
          scheme_name: 'Synthetic Debt Fund',
          isin: 'INF209K01199',
          units: 50,
          invested_cost: 5000,
          current_nav: 104,
          current_value: 5200,
          asset_class: 'DEBT',
          nav_date: '2026-03-31',
          updated_at: '2026-03-31T10:00:00.000Z',
          day_change: -50,
          day_change_pct: -0.95,
          xirr: 0.07,
          absolute_return: 0.04,
          asset_category: 'Debt Short Duration',
          dayChange: -50,
          dayChangePct: -0.95,
          gainLoss: 200,
          gainLossPct: 4,
        },
      ];

      const summary = summarizeHoldings(holdings);

      expect(summary.totalCurrentValue).toBe(16200);
      expect(summary.totalInvestedCost).toBe(15000);
      expect(summary.dayGain).toBe(150);
      expect(summary.dayGainPct).toBe(0.93);
    });
  });
});
