import { PerformanceService } from './performance.service';

describe('PerformanceService', () => {
  describe('calculateXIRR', () => {
    it('should calculate 10% XIRR for a simple one-year investment', () => {
      const transactions = [
        { amount: -100, date: new Date('2023-01-01') }
      ];
      const currentValue = 110;
      const asOfDate = new Date('2024-01-01');

      const result = PerformanceService.calculateXIRR(transactions, currentValue, asOfDate);
      // 10% return in exactly one year should be 0.1
      expect(result).toBeCloseTo(0.1, 2);
    });

    it('should calculate XIRR for multiple transactions', () => {
      const transactions = [
        { amount: -100, date: new Date('2023-01-01') },
        { amount: -100, date: new Date('2023-07-01') }
      ];
      const currentValue = 220;
      const asOfDate = new Date('2024-01-01');

      const result = PerformanceService.calculateXIRR(transactions, currentValue, asOfDate);
      // Roughly 13.5% (calculated externally)
      expect(result).toBeGreaterThan(0.1);
      expect(result).toBeLessThan(0.2);
    });
  });

  describe('calculateCAGR', () => {
    it('should calculate 10% CAGR for a two-year investment', () => {
      const invested = 100;
      const current = 121; // 100 * 1.1 * 1.1
      const start = new Date('2022-01-01');
      const end = new Date('2024-01-01');

      const result = PerformanceService.calculateCAGR(invested, current, start, end);
      expect(result).toBeCloseTo(0.1, 2);
    });
  });

  describe('calculateAbsoluteReturn', () => {
    it('should calculate absolute return correctly', () => {
      expect(PerformanceService.calculateAbsoluteReturn(100, 150)).toBe(0.5);
      expect(PerformanceService.calculateAbsoluteReturn(100, 80)).toBe(-0.2);
    });
  });

  describe('getMetrics', () => {
    it('should aggregate all metrics correctly', () => {
      const transactions = [
        { type: 'BUY', amount: 100, date: '2023-01-01' },
      ];
      const metrics = PerformanceService.getMetrics(transactions, 110, { currentUnitsOverride: 1 });
      
      expect(metrics.investedAmount).toBe(100);
      expect(metrics.currentValue).toBe(110);
      expect(metrics.totalGain).toBe(10);
      expect(metrics.absoluteReturn).toBe(0.1);
    });

    it('should calculate post-tax metrics when taxSlab is provided', () => {
      const transactions = [
        { type: 'BUY', amount: 1000, units: 10, nav: 100, date: '2026-01-01' }, // Equity < 1yr
      ];
      // Today is 2026-05-17. Holding is < 1 year -> STCG 20%
      const currentPrice = 150;
      const metrics = PerformanceService.getMetrics(transactions, currentPrice, {
        currentUnitsOverride: 10,
        taxSlab: 0.3,
        assetType: 'MUTUAL_FUND' as any,
        assetName: 'Equity Fund'
      });

      // Gain = (150 - 100) * 10 = 500
      // Estimated Tax = 500 * 0.20 = 100
      // Post-Tax Value = 1500 - 100 = 1400
      // Post-Tax Absolute Return = (1400 - 1000) / 1000 = 0.4
      expect(metrics.estimatedTax).toBe(100);
      expect(metrics.postTaxAbsoluteReturn).toBe(0.4);
      expect(metrics.postTaxXirr).toBeDefined();
    });
  });
});
