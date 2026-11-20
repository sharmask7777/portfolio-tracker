import { describe, it, expect } from 'vitest';
import {
  calculateSection55DeemedCost,
  checkElssLockIn,
  simulateSellRedemption,
  getAdvanceTaxQuarter,
  classifyTaxSection,
  calculate112AExemption,
  buildTaxHarvestPlan,
  formatHarvestInstructions,
  hasOpeningBalanceHistory,
  computeTaxBreakdowns,
  buildAdvanceTaxMatrix,
  TaxSectionName,
  AdvanceTaxQuarter,
  type SimulationLot,
  type SimulationSellRequest,
} from './tax-harvesting';

describe('Tax Harvesting & Statutory Compliance Engine', () => {
  describe('Section 55(2)(ac) Grandfathering Deemed Cost', () => {
    it('returns actual cost when asset was acquired after 31 Jan 2018', () => {
      const deemed = calculateSection55DeemedCost({ cost: 100, fmv2018: 150, sellPrice: 200, isPre2018: false });
      expect(deemed).toBe(100);
    });

    it('Scenario 1: FMV > Cost and Sell > FMV -> Deemed Cost = FMV', () => {
      const deemed = calculateSection55DeemedCost({ cost: 100, fmv2018: 150, sellPrice: 200, isPre2018: true });
      expect(deemed).toBe(150);
    });

    it('Scenario 2: FMV > Cost and Sell < FMV and Sell > Cost -> Deemed Cost = Sell (Zero Gain)', () => {
      const deemed = calculateSection55DeemedCost({ cost: 100, fmv2018: 150, sellPrice: 130, isPre2018: true });
      expect(deemed).toBe(130);
    });

    it('Scenario 3: FMV > Cost and Sell < Cost -> Deemed Cost = Cost (Capital Loss Preserved)', () => {
      const deemed = calculateSection55DeemedCost({ cost: 100, fmv2018: 150, sellPrice: 80, isPre2018: true });
      expect(deemed).toBe(100);
    });

    it('Scenario 4: FMV < Cost -> Deemed Cost = Cost', () => {
      const deemed = calculateSection55DeemedCost({ cost: 100, fmv2018: 80, sellPrice: 120, isPre2018: true });
      expect(deemed).toBe(100);
    });
  });

  describe('ELSS 3-Year Statutory Lock-In Invariant', () => {
    it('identifies ELSS units bought within 3 years as locked', () => {
      const isLocked = checkElssLockIn('2023-01-01', '2025-06-01');
      expect(isLocked).toBe(true);
    });

    it('identifies ELSS units bought 3 or more years ago as unlocked', () => {
      const isLocked = checkElssLockIn('2021-01-01', '2024-01-02');
      expect(isLocked).toBe(false);
    });

    it('blocks simulated redemption of locked ELSS units', () => {
      const lots: SimulationLot[] = [
        { lotId: 'lot-1', buyDate: '2021-01-01', units: 50, buyPrice: 100, isElss: true },
        { lotId: 'lot-2', buyDate: '2024-01-01', units: 50, buyPrice: 150, isElss: true },
      ];

      const request: SimulationSellRequest = {
        folioId: 'f1',
        schemeName: 'Mirae Asset ELSS Tax Saver Fund',
        isElss: true,
        assetClass: 'EQUITY',
        lots,
        unitsToSell: 80,
        sellPrice: 200,
        sellDate: '2024-09-01',
        taxSlab: 0.3,
      };

      const result = simulateSellRedemption(request);
      expect(result.isLocked).toBe(true);
      expect(result.lockedUnits).toBe(50);
      expect(result.unitsSold).toBe(50);
      expect(result.warnings).toContain(
        '50.000 units are locked under statutory 3-year ELSS restriction and cannot be redeemed.'
      );
    });
  });

  describe('FIFO Sell Simulation & Statutory Rates (Budget 2024 Parity)', () => {
    it('applies 12.5% LTCG + 4% Cess on Post-Budget 2024 Equity Sale (>365 days)', () => {
      const lots: SimulationLot[] = [
        { lotId: 'lot-1', buyDate: '2023-01-01', units: 100, buyPrice: 100 },
      ];

      const request: SimulationSellRequest = {
        folioId: 'f2',
        schemeName: 'Parag Parikh Flexi Cap Fund',
        assetClass: 'EQUITY',
        lots,
        unitsToSell: 100,
        sellPrice: 150,
        sellDate: '2024-08-15',
        taxSlab: 0.3,
      };

      const result = simulateSellRedemption(request);
      expect(result.unitsSold).toBe(100);
      expect(result.totalGain).toBe(5000);
      expect(result.ltcgGain).toBe(5000);
      expect(result.stcgGain).toBe(0);
      expect(result.baseTax).toBe(625);
      expect(result.cess).toBe(25);
      expect(result.totalTax).toBe(650);
      expect(result.netProceeds).toBe(15000 - 650);
    });

    it('applies 20% STCG + 4% Cess on Post-Budget 2024 Equity Sale (<365 days)', () => {
      const lots: SimulationLot[] = [
        { lotId: 'lot-1', buyDate: '2024-03-01', units: 100, buyPrice: 100 },
      ];

      const request: SimulationSellRequest = {
        folioId: 'f3',
        schemeName: 'HDFC Mid-Cap Opportunities Fund',
        assetClass: 'EQUITY',
        lots,
        unitsToSell: 100,
        sellPrice: 130,
        sellDate: '2024-08-15',
        taxSlab: 0.3,
      };

      const result = simulateSellRedemption(request);
      expect(result.stcgGain).toBe(3000);
      expect(result.baseTax).toBe(600);
      expect(result.cess).toBe(24);
      expect(result.totalTax).toBe(624);
    });

    it('taxes Section 50AA Debt funds at slab rate regardless of holding period', () => {
      const lots: SimulationLot[] = [
        { lotId: 'lot-1', buyDate: '2023-05-01', units: 100, buyPrice: 100 },
      ];

      const request: SimulationSellRequest = {
        folioId: 'f4',
        schemeName: 'ICICI Prudential Corporate Bond Fund',
        assetClass: 'DEBT',
        lots,
        unitsToSell: 100,
        sellPrice: 110,
        sellDate: '2024-09-01',
        taxSlab: 0.3,
      };

      const result = simulateSellRedemption(request);
      expect(result.slabGain).toBe(1000);
      expect(result.baseTax).toBe(300);
      expect(result.cess).toBe(12);
      expect(result.totalTax).toBe(312);
    });

    it('computes exit load when selling within exit load period', () => {
      const lots: SimulationLot[] = [
        { lotId: 'lot-1', buyDate: '2024-06-01', units: 100, buyPrice: 100 },
      ];

      const request: SimulationSellRequest = {
        folioId: 'f5',
        schemeName: 'UTI Nifty 50 Index Fund',
        assetClass: 'EQUITY',
        lots,
        unitsToSell: 100,
        sellPrice: 120,
        sellDate: '2024-08-01',
        taxSlab: 0.3,
        exitLoadRate: 0.01,
        exitLoadDays: 365,
      };

      const result = simulateSellRedemption(request);
      expect(result.grossValue).toBe(12000);
      expect(result.exitLoad).toBe(120);
      expect(result.netProceeds).toBe(12000 - 120 - result.totalTax);
    });
  });

  describe('Section 112A Exemption Sequential Allocation', () => {
    it('applies ₹1,25,000 exemption limit for FY 2024-25', () => {
      const res = calculate112AExemption(0, 150000, '2024-25');
      expect(res.totalExemption).toBe(125000);
      expect(res.taxable12_5).toBe(25000);
      expect(res.tax12_5).toBe(3250);
      expect(res.totalTax).toBe(3250);
    });

    it('exhausts 10% bracket first before allocating 12.5% in transition year', () => {
      const res = calculate112AExemption(80000, 80000, '2024-25');
      expect(res.exempt10).toBe(80000);
      expect(res.exempt12_5).toBe(45000);
      expect(res.totalExemption).toBe(125000);
      expect(res.taxable10).toBe(0);
      expect(res.taxable12_5).toBe(35000);
      expect(res.totalTax).toBe(4550);
    });

    it('applies ₹1,00,000 limit for prior FY 2023-24', () => {
      const res = calculate112AExemption(120000, 0, '2023-24');
      expect(res.totalExemption).toBe(100000);
      expect(res.taxable10).toBe(20000);
      expect(res.totalTax).toBe(2080);
    });
  });

  describe('Advance Tax Quarters & Table F Classification', () => {
    it('classifies dates into correct statutory quarters', () => {
      expect(getAdvanceTaxQuarter('2024-05-10')).toBe(AdvanceTaxQuarter.Q1);
      expect(getAdvanceTaxQuarter('2024-06-20')).toBe(AdvanceTaxQuarter.Q2A);
      expect(getAdvanceTaxQuarter('2024-08-01')).toBe(AdvanceTaxQuarter.Q2B);
      expect(getAdvanceTaxQuarter('2024-10-15')).toBe(AdvanceTaxQuarter.Q3);
      expect(getAdvanceTaxQuarter('2025-01-20')).toBe(AdvanceTaxQuarter.Q4);
      expect(getAdvanceTaxQuarter('2025-03-25')).toBe(AdvanceTaxQuarter.Q5);
    });

    it('classifies statutory tax section by date and rate', () => {
      expect(
        classifyTaxSection({ taxType: 'STCG', sellDate: '2024-06-01' })
      ).toBe(TaxSectionName.SEC_111A_15);
      expect(
        classifyTaxSection({ taxType: 'STCG', sellDate: '2024-08-01' })
      ).toBe(TaxSectionName.SEC_111A_20);
      expect(
        classifyTaxSection({ taxType: 'LTCG', sellDate: '2024-08-01' })
      ).toBe(TaxSectionName.SEC_112A_12_5);
      expect(
        classifyTaxSection({ taxType: 'LTCG', assetClass: 'DEBT', taxRate: 0.20, isGrandfathered: true })
      ).toBe(TaxSectionName.SEC_112_DEBT_20);
      expect(
        classifyTaxSection({ taxType: 'LTCG', assetClass: 'DEBT', taxRate: 0.125 })
      ).toBe(TaxSectionName.SEC_112_DEBT_12_5);
      expect(
        classifyTaxSection({ taxType: 'SLAB' })
      ).toBe(TaxSectionName.SEC_50AA);
    });

    it('builds Table F advance tax accrual matrix with sum reconciliation', () => {
      const details = [
        {
          gain: 10000,
          sellDate: '2024-05-10',
          taxType: 'STCG',
          taxRate: 0.15,
          taxBeforeCess: 1500,
          cess: 60,
          estimatedTax: 1560,
        },
        {
          gain: 20000,
          sellDate: '2024-08-10',
          taxType: 'LTCG',
          taxRate: 0.125,
          taxBeforeCess: 2500,
          cess: 100,
          estimatedTax: 2600,
        },
      ];

      const matrix = buildAdvanceTaxMatrix(details);
      expect(matrix.quarters[AdvanceTaxQuarter.Q1].totalGain).toBe(10000);
      expect(matrix.quarters[AdvanceTaxQuarter.Q1].estimatedTax).toBe(1560);
      expect(matrix.quarters[AdvanceTaxQuarter.Q2B].totalGain).toBe(20000);
      expect(matrix.quarters[AdvanceTaxQuarter.Q2B].estimatedTax).toBe(2600);

      const totalQuarterTax = Object.values(matrix.quarterTotals).reduce((a, b) => a + b, 0);
      expect(totalQuarterTax).toBe(4160);
    });
  });

  describe('Tax Gain Harvesting Plan & Instructions', () => {
    it('creates optimal harvest plan utilizing remaining exemption', () => {
      const holdings = [
        {
          folioId: 'f1',
          schemeName: 'Nippon India Large Cap Fund',
          currentUnits: 100,
          currentNav: 150,
          lots: [{ lotId: 'l1', buyDate: '2023-01-01', units: 100, buyPrice: 100 }],
        },
        {
          folioId: 'f2',
          schemeName: 'SBI Long Term Equity Fund',
          isElss: true,
          currentUnits: 100,
          currentNav: 150,
          lots: [{ lotId: 'l2', buyDate: '2024-01-01', units: 100, buyPrice: 100, isElss: true }],
        },
      ];

      const plan = buildTaxHarvestPlan(holdings, 25000, '2024-09-01');
      expect(plan.remainingExemption).toBe(100000);
      expect(plan.opportunities).toHaveLength(1);
      expect(plan.opportunities[0]?.schemeName).toBe('Nippon India Large Cap Fund');
      expect(plan.opportunities[0]?.unrealizedGain).toBe(5000);
      expect(plan.totalPotentialHarvest).toBe(5000);
      expect(plan.estimatedTaxSavings).toBe(650);

      const instructions = formatHarvestInstructions(plan);
      expect(instructions).toContain('SECTION 112A TAX-FREE HARVESTING REDEMPTION INSTRUCTIONS');
      expect(instructions).toContain('Nippon India Large Cap Fund');
      expect(instructions).toContain('DO NOT repurchase into ELSS');
    });
  });

  describe('Opening Balance History Detection', () => {
    it('returns true when positive OPENING_BALANCE units remain after FIFO sells', () => {
      const folio = {
        transactions: [
          { type: 'OPENING_BALANCE', units: 50, date: '2023-01-01' },
          { type: 'BUY', units: 50, date: '2023-02-01' },
        ],
      };
      expect(hasOpeningBalanceHistory(folio)).toBe(true);
    });

    it('returns false when OPENING_BALANCE units are fully redeemed', () => {
      const folio = {
        transactions: [
          { type: 'OPENING_BALANCE', units: 50, date: '2023-01-01' },
          { type: 'SELL', units: -50, date: '2023-03-01' },
          { type: 'BUY', units: 50, date: '2023-04-01' },
        ],
      };
      expect(hasOpeningBalanceHistory(folio)).toBe(false);
    });
  });

  describe('Tax Breakdown Computation', () => {
    it('computes total base tax, cess, and exemption percentages', () => {
      const gains = [
        { gain: 100000, section: TaxSectionName.SEC_112A_12_5 },
        { gain: 50000, section: TaxSectionName.SEC_111A_20, taxBeforeCess: 10000 },
        { gain: 20000, section: TaxSectionName.SEC_112_DEBT_20, taxBeforeCess: 4000 },
        { gain: 10000, section: TaxSectionName.SEC_112_DEBT_12_5, taxBeforeCess: 1250 },
      ];
      const res = computeTaxBreakdowns(gains, '2024-25');
      expect(res.ltcgLimit).toBe(125000);
      expect(res.ltcgExemptClaimed).toBe(100000);
      expect(res.ltcgTotalTax).toBe(0);
      expect(res.stcgTotalTax).toBe(10400);
      expect(res.debtTotalTax).toBe(5460); // (4000 + 1250) * 1.04
      expect(res.grandTotalTax).toBe(15860);
    });
  });
});
