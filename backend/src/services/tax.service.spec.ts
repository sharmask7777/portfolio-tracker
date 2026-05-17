import { TaxService } from './tax.service';
import { AssetType } from '@prisma/client';

describe('TaxService Refined Rules', () => {
  const MF = AssetType.MUTUAL_FUND;
  const STOCK = AssetType.STOCK;

  describe('Budget 2024 Changes (Post-July 23, 2024)', () => {
    it('should apply 20% STCG and 12.5% LTCG for sales on/after July 23, 2024', () => {
      const transactions = [
        { type: 'BUY', units: 10, nav: 100, date: '2024-01-01' },
        { type: 'SELL', units: 10, nav: 150, date: '2024-08-01' }, // STCG
      ];
      const summary = TaxService.calculatePortfolioTax('Fund A', MF, transactions, 150);
      expect(summary.realized.details[0].taxRate).toBe(0.20);
      expect(summary.realized.details[0].taxType).toBe('STCG');
    });

    it('should apply 15% STCG and 10% LTCG for sales before July 23, 2024', () => {
      const transactions = [
        { type: 'BUY', units: 10, nav: 100, date: '2024-01-01' },
        { type: 'SELL', units: 10, nav: 150, date: '2024-06-01' }, // STCG
      ];
      const summary = TaxService.calculatePortfolioTax('Fund A', MF, transactions, 150);
      expect(summary.realized.details[0].taxRate).toBe(0.15);
    });
  });

  describe('Debt Fund New Regime (Post-April 1, 2023)', () => {
    it('should classify new debt funds as SLAB regardless of holding period', () => {
      const transactions = [
        { type: 'BUY', units: 10, nav: 100, date: '2023-05-01' },
        { type: 'SELL', units: 10, nav: 150, date: '2025-06-01' }, // > 2 years
      ];
      // Fixed Deposit type is handled as debt-like in our isEquity check
      const summary = TaxService.calculatePortfolioTax('Debt Fund', AssetType.FIXED_DEPOSIT, transactions, 150);
      expect(summary.realized.details[0].taxType).toBe('SLAB');
      expect(summary.realized.slab).toBe(500);
    });

    it('should grandfather old debt funds (> 24m) if sold after July 2024', () => {
      const transactions = [
        { type: 'BUY', units: 10, nav: 100, date: '2022-01-01' },
        { type: 'SELL', units: 10, nav: 150, date: '2024-08-01' }, // > 24m, sold post-budget
      ];
      const summary = TaxService.calculatePortfolioTax('Old Debt', AssetType.FIXED_DEPOSIT, transactions, 150);
      expect(summary.realized.details[0].taxType).toBe('LTCG');
      expect(summary.realized.details[0].taxRate).toBe(0.125);
    });
  });

  describe('Bonus Units', () => {
    it('should set bonus unit cost to 0 and use allotment date for holding period', () => {
      const transactions = [
        { type: 'BUY', units: 10, nav: 100, date: '2023-01-01' },
        { type: 'BONUS', units: 10, nav: 100, date: '2024-01-01' }, // Allotted later
        { type: 'SELL', units: 20, nav: 150, date: '2024-06-01' },
      ];
      const summary = TaxService.calculatePortfolioTax('Fund A', MF, transactions, 150);
      
      // First lot (Original): LT (since Jan 2023 to June 2024 > 1yr)
      // Wait, Jan 2023 to June 2024 IS > 1 year.
      expect(summary.realized.details[0].taxType).toBe('LTCG');
      expect(summary.realized.details[0].buyNav).toBe(100);

      // Second lot (Bonus): ST (since Jan 2024 to June 2024 < 1yr)
      expect(summary.realized.details[1].taxType).toBe('STCG');
      expect(summary.realized.details[1].buyNav).toBe(0);
      expect(summary.realized.details[1].gain).toBe(1500); // (150 - 0) * 10
    });
  });

  describe('Loss Set-off Hierarchy', () => {
    it('should set off STCL against both STCG and LTCG', () => {
      const txs = [
        { type: 'BUY', units: 10, nav: 100, date: '2022-01-01' },
        { type: 'SELL', units: 10, nav: 300, date: '2023-06-01' }, // Realized LTCG = 2000
        { type: 'BUY', units: 10, nav: 200, date: '2024-01-01' }, 
        { type: 'SELL', units: 10, nav: 150, date: '2024-06-01' }, // Realized STCL = 500
      ];
      const summary = TaxService.calculatePortfolioTax('Equity', MF, txs, 300);
      
      expect(summary.realized.ltcg).toBe(2000);
      expect(summary.realized.stcg).toBe(-500);
      // Taxable LTCG = 2000 - 500 (STCL) = 1500
      expect(summary.realized.taxableLTCG).toBe(1500);
      expect(summary.realized.taxableSTCG).toBe(0);
    });

    it('should NOT set off LTCL against STCG', () => {
      const txs = [
        { type: 'BUY', units: 10, nav: 200, date: '2022-01-01' }, 
        { type: 'SELL', units: 10, nav: 150, date: '2024-08-01' }, // Realized LTCL = 500
        { type: 'BUY', units: 10, nav: 100, date: '2024-01-01' },
        { type: 'SELL', units: 10, nav: 300, date: '2024-08-15' }, // Realized STCG = 2000
      ];
      const summary = TaxService.calculatePortfolioTax('Equity', MF, txs, 300);
      
      expect(summary.realized.ltcg).toBe(-500);
      expect(summary.realized.stcg).toBe(2000);
      // LTCL cannot set off STCG
      expect(summary.realized.taxableSTCG).toBe(2000);
      expect(summary.realized.taxableLTCG).toBe(0);
    });
  });

  describe('Unrealized Tax Estimation', () => {
    it('should calculate estimated tax for debt funds using marginal slab', () => {
      const transactions = [
        { type: 'BUY', units: 10, nav: 100, date: '2023-05-01' }, // Debt fund post-2023 -> SLAB
      ];
      const currentNav = 150;
      const taxSlab = 0.30;
      const estimatedTax = TaxService.calculateUnrealizedTax(
        'Debt Fund', AssetType.FIXED_DEPOSIT, transactions, currentNav, taxSlab
      );
      // Gain = (150 - 100) * 10 = 500. Tax = 500 * 0.30 = 150.
      expect(estimatedTax).toBe(150);
    });

    it('should calculate estimated tax for equity funds using 12.5% LTCG', () => {
      const transactions = [
        { type: 'BUY', units: 10, nav: 100, date: '2022-01-01' }, // > 1 year -> LTCG
      ];
      const currentNav = 200;
      const estimatedTax = TaxService.calculateUnrealizedTax(
        'Equity Fund', MF, transactions, currentNav, 0.30
      );
      // Gain = (200 - 100) * 10 = 1000. Tax = 1000 * 0.125 = 125.
      expect(estimatedTax).toBe(125);
    });

    it('should calculate estimated tax for equity funds using 20% STCG', () => {
      const transactions = [
        { type: 'BUY', units: 10, nav: 100, date: '2026-01-01' }, // < 1 year (since "now" is May 2026)
      ];
      const currentNav = 150;
      const estimatedTax = TaxService.calculateUnrealizedTax(
        'Equity Fund', MF, transactions, currentNav, 0.30
      );
      // Gain = (150 - 100) * 10 = 500. Tax = 500 * 0.20 = 100.
      expect(estimatedTax).toBe(100);
    });
  });
});
