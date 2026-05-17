import * as fc from 'fast-check';
import { TaxService } from './tax.service';
import { AssetType } from '@prisma/client';
import { arbitraryScheme } from '../test/arbitraries';

describe('TaxService Property-Based Tests', () => {
  describe('Task 1: Tax Loss Set-off Invariants', () => {
    it('should satisfy tax loss set-off invariants for any transaction sequence', () => {
      fc.assert(
        fc.property(arbitraryScheme, (scheme) => {
          const result = TaxService.calculatePortfolioTax(
            scheme.scheme,
            AssetType.MUTUAL_FUND, // Assuming Equity-oriented for these tests
            scheme.transactions,
            100, // currentNav
          );

          const { stcg, ltcg, taxableSTCG, taxableLTCG } = result.realized;

          const stcl = stcg < 0 ? Math.abs(stcg) : 0;
          const ltcl = ltcg < 0 ? Math.abs(ltcg) : 0;
          const pureSTCG = stcg > 0 ? stcg : 0;
          const pureLTCG = ltcg > 0 ? ltcg : 0;

          // Property 1: TaxableLTCG = max(0, RealizedLTCG - RealizedLTCL - max(0, RealizedSTCL - RealizedSTCG))
          // In our implementation: 
          // remainingLTCG = max(0, pureLTCG - ltcl)
          // remainingSTCL = max(0, stcl - pureSTCG)
          // finalLTCG = max(0, remainingLTCG - remainingSTCL)
          
          const expectedRemainingLTCG = Math.max(0, pureLTCG - ltcl);
          const expectedRemainingSTCL = Math.max(0, stcl - pureSTCG);
          const expectedTaxableLTCG = Math.max(0, expectedRemainingLTCG - expectedRemainingSTCL);

          // Property 2: TaxableSTCG = max(0, RealizedSTCG - RealizedSTCL)
          const expectedTaxableSTCG = Math.max(0, pureSTCG - stcl);

          // Property 3: totalTaxable should be >= totalRealized
          const totalRealized = stcg + ltcg;
          const totalTaxable = taxableSTCG + taxableLTCG;
          expect(totalTaxable).toBeGreaterThanOrEqual(totalRealized - 1e-6);

          expect(taxableLTCG).toBeCloseTo(expectedTaxableLTCG, 5);
          expect(taxableSTCG).toBeCloseTo(expectedTaxableSTCG, 5);
        }),
        { numRuns: 1000 }
      );
    });

    it('should verify that SLAB gains (Debt/Short-term) are not set off against LTCG', () => {
       // In TaxService, 'SLAB' realized gains are added to total but not involved in set-off logic
       // Let's verify this behavior.
       fc.assert(
         fc.property(arbitraryScheme, (scheme) => {
            // We need to force some transactions to be SLAB.
            // In getTaxType, Debt + < 36 months (pre 2024) or any Debt (post 2023) -> SLAB
            const result = TaxService.calculatePortfolioTax(
                "Debt Fund",
                AssetType.MUTUAL_FUND,
                scheme.transactions,
                100
            );

            // Since it's a "Debt Fund" (name based detection in isEquity),
            // it will likely produce SLAB or LTCG gains.
            
            const { slab, taxableSTCG, taxableLTCG } = result.realized;
            
            // Slab gains should not affect taxableSTCG or taxableLTCG calculations 
            // as they are calculated from stcgRealized and ltcgRealized which filter by 'STCG' and 'LTCG'
            
            // If all gains were SLAB, taxableSTCG and taxableLTCG should be 0.
            if (result.realized.details.every(g => g.taxType === 'SLAB')) {
                expect(taxableSTCG).toBe(0);
                expect(taxableLTCG).toBe(0);
            }
         }),
         { numRuns: 100 }
       );
    });
  });

  describe('Task 2: FIFO Depletion and Grandfathering', () => {
    it('should maintain FIFO lot depletion across multiple sell cycles', () => {
      fc.assert(
        fc.property(arbitraryScheme, (scheme) => {
          const result = TaxService.calculatePortfolioTax(
            scheme.scheme,
            AssetType.MUTUAL_FUND,
            scheme.transactions,
            100
          );

          // Verify FIFO: Buy dates in realized details should be non-decreasing
          // because we always take the oldest lot first.
          const details = result.realized.details;
          for (let i = 1; i < details.length; i++) {
            expect(details[i].buyDate.getTime()).toBeGreaterThanOrEqual(details[i-1].buyDate.getTime());
          }
        }),
        { numRuns: 500 }
      );
    });

    it('should apply Grandfathering rules for Equity assets bought before Jan 31, 2018', () => {
      const grandfatherNav = 150;
      const oldDate = new Date('2017-01-01');
      const sellDate = new Date('2024-01-01');

      // Test Case: Sale Price > FMV > Actual Cost
      // Actual: 100, FMV: 150, Sale: 200 -> Effective Buy: 150
      const gain1 = TaxService.calculateGain(
        "Equity Fund",
        AssetType.MUTUAL_FUND,
        { date: oldDate, units: 10, nav: 100, originalUnits: 10 },
        10,
        200,
        sellDate,
        grandfatherNav
      );
      expect(gain1.buyNav).toBe(100);
      expect(gain1.isGrandfathered).toBe(true);
      expect(gain1.gain).toBe((200 - 150) * 10);

      // Test Case: FMV > Sale Price > Actual Cost
      // Actual: 100, FMV: 150, Sale: 120 -> Effective Buy: 120 (Gain = 0)
      const gain2 = TaxService.calculateGain(
        "Equity Fund",
        AssetType.MUTUAL_FUND,
        { date: oldDate, units: 10, nav: 100, originalUnits: 10 },
        10,
        120,
        sellDate,
        grandfatherNav
      );
      expect(gain2.gain).toBe(0);

      // Test Case: FMV > Actual Cost > Sale Price
      // Actual: 100, FMV: 150, Sale: 80 -> Effective Buy: 100 (Loss = 20)
      const gain3 = TaxService.calculateGain(
        "Equity Fund",
        AssetType.MUTUAL_FUND,
        { date: oldDate, units: 10, nav: 100, originalUnits: 10 },
        10,
        80,
        sellDate,
        grandfatherNav
      );
      expect(gain3.gain).toBe((80 - 100) * 10);
    });

    it('should apply Budget 2024 tax rates for sales after July 23, 2024', () => {
      const preDate = new Date('2024-07-20');
      const postDate = new Date('2024-07-25');
      
      const buyDate = new Date('2023-01-01'); // > 1 year holding

      const gainPre = TaxService.calculateGain(
        "Equity Fund",
        AssetType.MUTUAL_FUND,
        { date: buyDate, units: 1, nav: 100, originalUnits: 1 },
        1,
        200,
        preDate
      );
      expect(gainPre.taxRate).toBe(0.10); // Pre-budget LTCG 10%

      const gainPost = TaxService.calculateGain(
        "Equity Fund",
        AssetType.MUTUAL_FUND,
        { date: buyDate, units: 1, nav: 100, originalUnits: 1 },
        1,
        200,
        postDate
      );
      expect(gainPost.taxRate).toBe(0.125); // Post-budget LTCG 12.5%
    });
  });
});
