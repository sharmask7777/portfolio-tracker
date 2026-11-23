import { describe, it, expect } from 'vitest';
import { adaptHoldingToFolioInput, buildFolioEntityMap } from './holding-adapters';
import type { EnrichedHolding } from '../../services/portfolio-calculations';
import type { FolioEntity } from '../../services/family-service';

describe('holding-adapters', () => {
  const mockHolding: EnrichedHolding = {
    id: 'hold-syn-01',
    folio_number: 'FOLIO-SYN-101',
    amfi_code: '120503',
    scheme_name: 'Synthetic Bluechip Equity Direct Growth',
    isin: 'INF209K01157',
    units: 100,
    invested_cost: 10000,
    current_nav: 125,
    current_value: 12500,
    asset_class: 'EQUITY',
    nav_date: '2026-03-31',
    updated_at: '2026-03-31T10:00:00.000Z',
    day_change: 250.5,
    day_change_pct: 2.04,
    xirr: 0.156,
    absolute_return: 0.25,
    asset_category: 'Equity Large Cap',
    dayChange: 250.5,
    dayChangePct: 2.04,
    gainLoss: 2500,
    gainLossPct: 25,
  };

  const mockFolio: FolioEntity = {
    folio_number: 'FOLIO-SYN-101',
    amc_name: 'Synthetic Mutual Fund AMC',
    pan: 'ABCDE1234F',
    updated_at: '2026-03-31T10:00:00.000Z',
  };

  it('adapts holding to FolioInput passing xirr, absoluteReturn, dayChange, and dayChangePercentage', () => {
    const input = adaptHoldingToFolioInput(mockHolding, mockFolio);

    expect(input.id).toBe('hold-syn-01');
    expect(input.folioNumber).toBe('FOLIO-SYN-101');
    expect(input.pan).toBe('ABCDE1234F');
    expect(input.amcName).toBe('Synthetic Mutual Fund AMC');
    expect(input.metrics?.dayChange).toBe(250.5);
    expect(input.metrics?.dayChangePercentage).toBe(2.04);
    expect(input.metrics?.xirr).toBe(0.156);
    expect(input.metrics?.absoluteReturn).toBe(0.25);
  });

  it('falls back to gainLossPct / 100 when absolute_return is not provided', () => {
    const holdingWithoutAbs: EnrichedHolding = {
      ...mockHolding,
      absolute_return: undefined,
      gainLossPct: 15.5,
    };

    const input = adaptHoldingToFolioInput(holdingWithoutAbs, mockFolio);

    expect(input.metrics?.absoluteReturn).toBe(0.155);
  });

  it('builds folio entity map correctly', () => {
    const map = buildFolioEntityMap([mockFolio]);
    expect(map.get('FOLIO-SYN-101')).toEqual(mockFolio);
    expect(map.get('NON_EXISTENT')).toBeUndefined();
  });
});
