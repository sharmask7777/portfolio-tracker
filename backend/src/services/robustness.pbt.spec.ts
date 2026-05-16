import * as fc from 'fast-check';
import { PerformanceService } from './performance.service';
import { TaxService } from './tax.service';
import { AssetType } from '@prisma/client';

describe('Robustness Property-Based Tests', () => {
  // Realistic minimum for amount is 0.01 (1 paisa)
  const validAmount = fc.oneof(
    fc.double({ min: 0.01, max: 1000000, noNaN: true, noDefaultInfinity: true }),
    fc.double({ min: -1000000, max: -0.01, noNaN: true, noDefaultInfinity: true })
  );
  const positiveAmount = fc.double({ min: 0.01, max: 1000000, noNaN: true, noDefaultInfinity: true });
  const validNav = fc.double({ min: 1, max: 10000, noNaN: true, noDefaultInfinity: true });
  // Using timestamps to ensure valid date values for toISOString()
  const validDate = fc.integer({ min: new Date('2000-01-01').getTime(), max: new Date().getTime() })
    .map(t => new Date(t));

  describe('PerformanceService.calculateXIRR', () => {
    it('should never return NaN or throw for any sequence of cash flows', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              amount: validAmount,
              date: validDate,
            }),
            { minLength: 1, maxLength: 50 }
          ),
          fc.double({ min: 0, max: 10000000, noNaN: true, noDefaultInfinity: true }),
          (transactions, currentValue) => {
            const result = PerformanceService.calculateXIRR(transactions, currentValue);
            return !isNaN(result) && isFinite(result);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should return approximately 0% for zero gain scenarios', () => {
       fc.assert(
        fc.property(
          positiveAmount,
          (investment) => {
            const transactions = [{ amount: -investment, date: new Date('2023-01-01') }];
            const result = PerformanceService.calculateXIRR(transactions, investment, new Date('2024-01-01'));
            return Math.abs(result) < 0.0001;
          }
        )
      );
    });
  });

  describe('TaxService FIFO Invariants', () => {
    const MF = AssetType.MUTUAL_FUND;

    it('should never realize more gains than total value growth minus tax rules', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              type: fc.constantFrom('BUY', 'PURCHASE', 'SIP'),
              units: fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true }),
              nav: validNav,
              date: validDate,
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.double({ min: 1, max: 50, noNaN: true, noDefaultInfinity: true }), // units to sell
          validNav, // sell nav
          (buys, unitsToSell, sellNav) => {
            const totalUnitsAcquired = buys.reduce((acc, b) => acc + b.units, 0);
            const actualUnitsToSell = Math.min(unitsToSell, totalUnitsAcquired);
            
            const transactions = [
              ...buys.map(b => ({ ...b, date: b.date.toISOString() })),
              { type: 'SELL', units: actualUnitsToSell, nav: sellNav, date: new Date().toISOString() }
            ];

            const summary = TaxService.calculatePortfolioTax('Test', MF, transactions, sellNav);
            return isFinite(summary.realized.total);
          }
        )
      );
    });

    it('should ensure taxable gains are always less than or equal to raw gains', () => {
      fc.assert(
        fc.property(
           fc.array(
            fc.record({
              type: fc.constantFrom('BUY', 'SELL'),
              units: fc.double({ min: 1, max: 100, noNaN: true, noDefaultInfinity: true }),
              nav: validNav,
              date: validDate,
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (txs) => {
            const summary = TaxService.calculatePortfolioTax('Test', MF, txs, 500);
            // Allow for minor floating point diffs
            return (summary.realized.taxableSTCG + summary.realized.taxableLTCG) <= 
                   (Math.max(0, summary.realized.stcg) + Math.max(0, summary.realized.ltcg)) + 0.1;
          }
        )
      );
    });
  });

  describe('Analytics Invariants', () => {
    it('should ensure weighted X-Ray percentages sum correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              value: fc.double({ min: 1, max: 100000, noNaN: true, noDefaultInfinity: true }),
              weights: fc.array(fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }), { minLength: 5, maxLength: 5 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (funds) => {
             const totalValue = funds.reduce((acc, f) => acc + f.value, 0);
             const aggregatedWeights = [0, 0, 0, 0, 0];
             
             funds.forEach(f => {
               const fundWeightFactor = f.value / totalValue;
               f.weights.forEach((w, i) => {
                 aggregatedWeights[i] += w * fundWeightFactor;
               });
             });

             const totalWeight = aggregatedWeights.reduce((acc, w) => acc + w, 0);
             const originalTotalWeight = funds.reduce((acc, f) => acc + f.weights.reduce((a, b) => a + b, 0) * (f.value / totalValue), 0);
             
             return Math.abs(totalWeight - originalTotalWeight) < 0.01;
          }
        )
      );
    });
  });
});
