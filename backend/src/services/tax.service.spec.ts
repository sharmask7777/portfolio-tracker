import { TaxService } from './tax.service';
import { AssetType } from '@prisma/client';

describe('TaxService', () => {
  const MF = AssetType.MUTUAL_FUND;

  it('should calculate STCG correctly for a short-term holding', () => {
    const transactions = [
      { type: 'BUY', units: 10, nav: 100, date: '2023-01-01' },
      { type: 'SELL', units: 10, nav: 150, date: '2023-06-01' },
    ];
    const summary = TaxService.calculatePortfolioTax('Fund A', MF, transactions, 150);
    
    expect(summary.realized.stcg).toBe(500); // (150-100) * 10
    expect(summary.realized.ltcg).toBe(0);
    expect(summary.realized.details[0].taxType).toBe('STCG');
  });

  it('should calculate LTCG correctly for holding > 1 year', () => {
    const transactions = [
      { type: 'BUY', units: 10, nav: 100, date: '2022-01-01' },
      { type: 'SELL', units: 10, nav: 150, date: '2023-06-01' },
    ];
    const summary = TaxService.calculatePortfolioTax('Fund A', MF, transactions, 150);
    
    expect(summary.realized.ltcg).toBe(500);
    expect(summary.realized.stcg).toBe(0);
    expect(summary.realized.details[0].taxType).toBe('LTCG');
  });

  it('should handle FIFO matching correctly', () => {
    const transactions = [
      { type: 'BUY', units: 10, nav: 100, date: '2022-01-01' }, // LT
      { type: 'BUY', units: 10, nav: 200, date: '2023-01-01' }, // ST (relative to sell date)
      { type: 'SELL', units: 15, nav: 250, date: '2023-03-01' }, 
    ];
    // Sold 10 units from 1st buy (LTCG) and 5 units from 2nd buy (STCG)
    const summary = TaxService.calculatePortfolioTax('Fund A', MF, transactions, 250);
    
    // LTCG: (250-100) * 10 = 1500
    // STCG: (250-200) * 5 = 250
    expect(summary.realized.ltcg).toBe(1500);
    expect(summary.realized.stcg).toBe(250);
  });

  it('should apply grandfathering logic for purchases before Feb 2018', () => {
    const transactions = [
      { type: 'BUY', units: 10, nav: 100, date: '2017-01-01' },
      { type: 'SELL', units: 10, nav: 250, date: '2023-01-01' },
    ];
    const grandfatherNav = 200; // FMV on Jan 31, 2018
    const summary = TaxService.calculatePortfolioTax('Fund A', MF, transactions, 250, grandfatherNav);
    
    // Cost = max(100, min(200, 250)) = 200
    // Gain = (250 - 200) * 10 = 500
    expect(summary.realized.ltcg).toBe(500);
    expect(summary.realized.details[0].isGrandfathered).toBe(true);
  });
});
