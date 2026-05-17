import * as fc from 'fast-check';
import { PerformanceService } from './performance.service';

describe('PerformanceService PBT', () => {
  // Stability: Any sequence of cash flows must produce a finite number.
  it('should always return a finite number for XIRR', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            amount: fc.float({ min: -1000000, max: 1000000 }),
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.float({ min: 0, max: 2000000 }),
        (transactions, currentValue) => {
          const result = PerformanceService.calculateXIRR(transactions, currentValue);
          return Number.isFinite(result);
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Identity: 0% net gain should return approx 0% XIRR
  it('should return approx 0% XIRR when final value equals total net investment (at same time)', () => {
      // For simplicity, one investment and one redemption at the same time or zero gain over time.
      // If we invest 1000 on Jan 1 and value is 1000 on Jan 2, XIRR is 0.
      const transactions = [{ amount: -1000, date: new Date('2022-01-01') }];
      const currentValue = 1000;
      const asOfDate = new Date('2023-01-01');
      const result = PerformanceService.calculateXIRR(transactions, currentValue, asOfDate);
      expect(result).toBeCloseTo(0, 5);
  });

  // Monotonicity: If v1 > v2, then XIRR(flows, v1) >= XIRR(flows, v2)
  it('should be monotonic with respect to current value', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            amount: fc.float({ min: -1000000, max: 0 }), // Pure investments for simplicity
            date: fc.date({ min: new Date('2020-01-01'), max: new Date('2021-01-01') }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.float({ min: 1, max: 1000000 }),
        fc.float({ min: 1, max: 1000000 }),
        (transactions, v1, v2) => {
          const valHigh = Math.max(v1, v2);
          const valLow = Math.min(v1, v2);
          const asOfDate = new Date('2022-01-01');
          
          const xirrHigh = PerformanceService.calculateXIRR(transactions, valHigh, asOfDate);
          const xirrLow = PerformanceService.calculateXIRR(transactions, valLow, asOfDate);
          
          return xirrHigh >= xirrLow;
        }
      ),
      { numRuns: 500 }
    );
  });

  // Sign Sensitivity
  it('should return 0 if all flows have the same sign', () => {
    fc.assert(
        fc.property(
          fc.array(
            fc.record({
              amount: fc.float({ min: 1, max: 1000000 }),
              date: fc.date(),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (transactions) => {
            const result = PerformanceService.calculateXIRR(transactions, 0); // No current value to keep all positive
            return result === 0;
          }
        )
      );
  });

  // Heuristics: < 30 days
  it('should return absolute return for periods < 30 days', () => {
    const transactions = [{ amount: -1000, date: new Date('2022-01-01') }];
    const currentValue = 1100;
    const asOfDate = new Date('2022-01-15'); // 14 days
    const result = PerformanceService.calculateXIRR(transactions, currentValue, asOfDate);
    // Absolute return is (1100 - 1000) / 1000 = 0.1
    expect(result).toBeCloseTo(0.1, 5);
  });

  // Capping: 1000%
  it('should cap XIRR at 1000% (10.0)', () => {
      // Something that would normally yield massive XIRR
      const transactions = [{ amount: -1000, date: new Date('2022-01-01') }];
      const currentValue = 1000000;
      const asOfDate = new Date('2023-01-01');
      const result = PerformanceService.calculateXIRR(transactions, currentValue, asOfDate);
      expect(result).toBe(10.0);
  });

  it('should cap XIRR at -100% (-1.0)', () => {
    const transactions = [{ amount: -1000, date: new Date('2022-01-01') }];
    const currentValue = 1;
    const asOfDate = new Date('2023-01-01');
    const result = PerformanceService.calculateXIRR(transactions, currentValue, asOfDate);
    expect(result).toBeGreaterThanOrEqual(-1.0);
  });
});
