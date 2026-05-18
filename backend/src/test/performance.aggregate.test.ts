import { PerformanceService } from '../services/performance.service';

describe('Performance Aggregation Logic', () => {
  it('should calculate consolidated XIRR across multiple portfolios correctly', () => {
    // Portfolio A: Buy 100 on Jan 1, worth 150 on Dec 31
    const cashflowsA = [
      { amount: -100, date: new Date('2024-01-01') }
    ];
    const valueA = 150;

    // Portfolio B: Buy 200 on July 1, worth 220 on Dec 31
    const cashflowsB = [
      { amount: -200, date: new Date('2024-07-01') }
    ];
    const valueB = 220;

    // Consolidated: Buy 100 Jan 1, 200 July 1, worth 370 Dec 31
    const combinedCashflows = [...cashflowsA, ...cashflowsB];
    const combinedValue = valueA + valueB;
    const asOfDate = new Date('2024-12-31');

    const consolidatedXirr = PerformanceService.calculateXIRR(combinedCashflows, combinedValue, asOfDate);

    // Simple manual sanity check: 
    // Roughly (150-100)/100 = 50% for A (1 year)
    // Roughly (220-200)/200 = 10% for B (0.5 year) -> ~21% annualized
    // Combined should be somewhere in between weighted by time/amount.
    
    expect(consolidatedXirr).toBeGreaterThan(0.20);
    expect(consolidatedXirr).toBeLessThan(0.60);
    
    // Individual checks for reference
    const xirrA = PerformanceService.calculateXIRR(cashflowsA, valueA, asOfDate);
    const xirrB = PerformanceService.calculateXIRR(cashflowsB, valueB, asOfDate);
    
    // Verification that the logic doesn't crash and returns a valid number
    expect(isFinite(consolidatedXirr)).toBe(true);
  });

  it('should handle zero value consolidated portfolios', () => {
    const cashflows = [
      { amount: -100, date: new Date('2024-01-01') },
      { amount: 100, date: new Date('2024-02-01') } // Full exit
    ];
    const xirr = PerformanceService.calculateXIRR(cashflows, 0);
    expect(xirr).toBeDefined();
  });
});
