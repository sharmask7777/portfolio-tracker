import { describe, it, expect } from 'vitest';
import {
  generateITRReportCSV,
  computeAY,
  getAdvanceTaxQuarter,
  calculate112AExemption,
  AdvanceTaxQuarter,
  verifyItrInvariants,
} from './itrReportGenerator';

describe('itrReportGenerator', () => {
  describe('computeAY', () => {
    it('computes correct Assessment Year from Financial Year', () => {
      expect(computeAY('2024-25')).toBe('2025-26');
      expect(computeAY('2023-24')).toBe('2024-25');
      expect(computeAY('2025-26')).toBe('2026-27');
    });
  });

  describe('getAdvanceTaxQuarter', () => {
    it('accurately maps sell dates to Table F quarters for FY 2024-25', () => {
      expect(getAdvanceTaxQuarter('2024-05-10')).toBe(AdvanceTaxQuarter.Q1);
      expect(getAdvanceTaxQuarter('2024-06-15')).toBe(AdvanceTaxQuarter.Q1);
      expect(getAdvanceTaxQuarter('2024-06-16')).toBe(AdvanceTaxQuarter.Q2A);
      expect(getAdvanceTaxQuarter('2024-07-22')).toBe(AdvanceTaxQuarter.Q2A);
      expect(getAdvanceTaxQuarter('2024-07-23')).toBe(AdvanceTaxQuarter.Q2B);
      expect(getAdvanceTaxQuarter('2024-09-15')).toBe(AdvanceTaxQuarter.Q2B);
      expect(getAdvanceTaxQuarter('2024-09-16')).toBe(AdvanceTaxQuarter.Q3);
      expect(getAdvanceTaxQuarter('2024-12-15')).toBe(AdvanceTaxQuarter.Q3);
      expect(getAdvanceTaxQuarter('2024-12-16')).toBe(AdvanceTaxQuarter.Q4);
      expect(getAdvanceTaxQuarter('2025-03-15')).toBe(AdvanceTaxQuarter.Q4);
      expect(getAdvanceTaxQuarter('2025-03-16')).toBe(AdvanceTaxQuarter.Q5);
      expect(getAdvanceTaxQuarter('2025-03-31')).toBe(AdvanceTaxQuarter.Q5);
    });
  });

  describe('calculate112AExemption', () => {
    it('exhausts 10% tranche first before 12.5% tranche in FY 2024-25 (Rs 1.25L limit)', () => {
      // 80k in 10% tranche, 70k in 12.5% tranche
      // Limit 125,000 -> 80,000 exempt from 10%, remaining 45,000 exempt from 12.5%
      const res = calculate112AExemption(80000, 70000, '2024-25');
      expect(res.exempt10).toBe(80000);
      expect(res.taxable10).toBe(0);
      expect(res.exempt12_5).toBe(45000);
      expect(res.taxable12_5).toBe(25000);
      expect(res.totalExemption).toBe(125000);
    });

    it('fully exhausts limit in 10% tranche when 10% tranche exceeds limit', () => {
      // 150k in 10% tranche, 50k in 12.5% tranche
      const res = calculate112AExemption(150000, 50000, '2024-25');
      expect(res.exempt10).toBe(125000);
      expect(res.taxable10).toBe(25000);
      expect(res.exempt12_5).toBe(0);
      expect(res.taxable12_5).toBe(50000);
    });

    it('applies 1L limit for pre-Budget FY 2023-24', () => {
      const res = calculate112AExemption(150000, 0, '2023-24');
      expect(res.exempt10).toBe(100000);
      expect(res.taxable10).toBe(50000);
    });
  });

  describe('generateITRReportCSV', () => {
    const mockDetails = [
      {
        assetName: 'Parag Parikh Flexi Cap Fund, Direct Growth',
        folioNumber: '12345/67',
        isin: 'INF879O01018',
        assetClass: 'EQUITY',
        section: '111A (15%)',
        buyDate: '2024-01-10',
        sellDate: '2024-05-20',
        holdingPeriodDays: 131,
        holdingType: 'Short-Term',
        units: 100.5,
        buyNav: 50.0,
        sellNav: 60.0,
        grossConsideration: 6030.0,
        costOfAcquisition: 5025.0,
        fmvAsOfJan31_2018: 0,
        totalFmvJan31_2018: 0,
        deemedCostOfAcquisition: 5025.0,
        transferExpenses: 0,
        gain: 1005.0,
        taxType: 'STCG',
        taxRate: 0.15,
        taxBeforeCess: 150.75,
        cess: 6.03,
        estimatedTax: 156.78,
        advanceTaxQuarter: 'Q1 (01/04 - 15/06)',
        isGrandfathered: false,
        isAnchorDependent: false,
      },
      {
        assetName: 'HDFC "Top 100" Fund',
        folioNumber: '98765',
        isin: 'INF179K01BE2',
        assetClass: 'EQUITY',
        section: '111A (20%)',
        buyDate: '2024-02-15',
        sellDate: '2024-08-10',
        holdingPeriodDays: 177,
        holdingType: 'Short-Term',
        units: 200.123,
        buyNav: 100.0,
        sellNav: 120.0,
        grossConsideration: 24014.76,
        costOfAcquisition: 20012.3,
        fmvAsOfJan31_2018: 0,
        totalFmvJan31_2018: 0,
        deemedCostOfAcquisition: 20012.3,
        transferExpenses: 14.76,
        gain: 3987.7,
        taxType: 'STCG',
        taxRate: 0.20,
        taxBeforeCess: 797.54,
        cess: 31.90,
        estimatedTax: 829.44,
        advanceTaxQuarter: 'Q2b (23/07 - 15/09)',
        isGrandfathered: false,
        isAnchorDependent: true,
      },
      {
        assetName: 'ICICI Prudential Bluechip Fund',
        folioNumber: '55555',
        isin: 'INF109K011B1',
        assetClass: 'EQUITY',
        section: '112A (10%)',
        buyDate: '2017-06-01',
        sellDate: '2024-06-25',
        holdingPeriodDays: 2581,
        holdingType: 'Long-Term',
        units: 500,
        buyNav: 30.0,
        sellNav: 100.0,
        grossConsideration: 50000.0,
        costOfAcquisition: 15000.0,
        fmvAsOfJan31_2018: 45.0,
        totalFmvJan31_2018: 22500.0,
        deemedCostOfAcquisition: 22500.0,
        transferExpenses: 50.0,
        gain: 27450.0,
        taxType: 'LTCG',
        taxRate: 0.10,
        taxBeforeCess: 0,
        cess: 0,
        estimatedTax: 0,
        advanceTaxQuarter: 'Q2a (16/06 - 22/07)',
        isGrandfathered: true,
        isAnchorDependent: false,
      },
      {
        assetName: 'Mirae Asset Large Cap Fund',
        folioNumber: '77777',
        isin: 'INF769K01026',
        assetClass: 'EQUITY',
        section: '112A (12.5%)',
        buyDate: '2022-01-15',
        sellDate: '2024-10-10',
        holdingPeriodDays: 1000,
        holdingType: 'Long-Term',
        units: 1000,
        buyNav: 50.0,
        sellNav: 80.0,
        grossConsideration: 80000.0,
        costOfAcquisition: 50000.0,
        fmvAsOfJan31_2018: 0,
        totalFmvJan31_2018: 0,
        deemedCostOfAcquisition: 50000.0,
        transferExpenses: 0,
        gain: 30000.0,
        taxType: 'LTCG',
        taxRate: 0.125,
        taxBeforeCess: 0,
        cess: 0,
        estimatedTax: 0,
        advanceTaxQuarter: 'Q3 (16/09 - 15/12)',
        isGrandfathered: false,
        isAnchorDependent: false,
      },
      {
        assetName: 'Aditya Birla Sun Life Short Term Debt Fund',
        folioNumber: '88888',
        isin: 'INF209K01157',
        assetClass: 'DEBT',
        section: '50AA (Slab)',
        buyDate: '2023-05-10',
        sellDate: '2025-01-15',
        holdingPeriodDays: 616,
        holdingType: 'Short-Term',
        units: 100,
        buyNav: 100.0,
        sellNav: 110.0,
        grossConsideration: 11000.0,
        costOfAcquisition: 10000.0,
        fmvAsOfJan31_2018: 0,
        totalFmvJan31_2018: 0,
        deemedCostOfAcquisition: 10000.0,
        transferExpenses: 0,
        gain: 1000.0,
        taxType: 'SLAB',
        taxRate: 0.30,
        taxBeforeCess: 300.0,
        cess: 12.0,
        estimatedTax: 312.0,
        advanceTaxQuarter: 'Q4 (16/12 - 15/03)',
        isGrandfathered: false,
        isAnchorDependent: false,
      },
      {
        assetName: 'Nippon India Grandfathered Debt Fund',
        folioNumber: '99999',
        isin: 'INF204K01012',
        assetClass: 'DEBT',
        section: '112 Debt (20% Indexed)',
        buyDate: '2022-03-10',
        sellDate: '2025-03-20',
        holdingPeriodDays: 1106,
        holdingType: 'Long-Term',
        units: 100,
        buyNav: 100.0,
        sellNav: 125.0,
        grossConsideration: 12500.0,
        costOfAcquisition: 10000.0,
        fmvAsOfJan31_2018: 0,
        totalFmvJan31_2018: 0,
        deemedCostOfAcquisition: 10000.0,
        transferExpenses: 0,
        gain: 2500.0,
        taxType: 'LTCG',
        taxRate: 0.20,
        taxBeforeCess: 500.0,
        cess: 20.0,
        estimatedTax: 520.0,
        advanceTaxQuarter: 'Q5 (16/03 - 31/03)',
        isGrandfathered: true,
        isAnchorDependent: false,
      },
    ];

    it('generates the statutory metadata header block compliant with Schedule CG', () => {
      const csv = generateITRReportCSV({
        assesseeName: 'Test Investor',
        pan: 'ABCDE1234F',
        fy: '2024-25',
        details: mockDetails,
      });

      expect(csv).toContain('# ====================================================================================================');
      expect(csv).toContain('# CAPITAL GAINS TAX AUDIT REPORT (SCHEDULE CG - ITR-2 / ITR-3 COMPLIANT)');
      expect(csv).toContain('# Assessee Name: Test Investor | PAN: ABCDE1234F | FY: 2024-25 | AY: 2025-26');
      expect(csv).toContain('# Total Consideration: Rs 183544.76 | Total Cost: Rs 110037.30 | Transfer Expenses: Rs 64.76');
      expect(csv).toContain('# Section 111A STCG: Rs 4992.70 (Pre: Rs 1005.00 @ 15% | Post: Rs 3987.70 @ 20%)');
      expect(csv).toContain('# Section 112A LTCG: Rs 57450.00 (Pre: Rs 27450.00 @ 10% | Post: Rs 30000.00 @ 12.5%)');
      expect(csv).toContain('# Section 112A Exemption Claimed: Rs 57450.00 (Exhausted against 10% tranche first)');
      expect(csv).toContain('# Section 50AA Deemed STCG (Slab): Rs 1000.00 | Section 112 Debt LTCG: Rs 2500.00');
      expect(csv).toContain('# Base Tax Payable: Rs 1748.29 | Health & Education Cess (4%): Rs 69.93 | Total Tax: Rs 1818.22');
      expect(csv).toContain('# ADVANCE TAX ACCRUAL MATRIX (SECTION 234C / SCHEDULE CG TABLE F)');
      expect(csv).toContain('# Quarter,Due Date,Sec 111A (15%),Sec 111A (20%),Sec 112A (10%),Sec 112A (12.5%),Sec 50AA (Slab),Sec 112 Debt,Total Gains');
    });

    it('includes Table F Advance Tax Accrual Matrix with all 6 quarters and correct due dates', () => {
      const csv = generateITRReportCSV({
        assesseeName: 'Test Investor',
        pan: 'ABCDE1234F',
        fy: '2024-25',
        details: mockDetails,
      });

      expect(csv).toContain('# Q1 (01/04 - 15/06),15/06/2024,1005.00,0.00,0.00,0.00,0.00,0.00,1005.00');
      expect(csv).toContain('# Q2a (16/06 - 22/07),15/09/2024,0.00,0.00,27450.00,0.00,0.00,0.00,27450.00');
      expect(csv).toContain('# Q2b (23/07 - 15/09),15/09/2024,0.00,3987.70,0.00,0.00,0.00,0.00,3987.70');
      expect(csv).toContain('# Q3 (16/09 - 15/12),15/12/2024,0.00,0.00,0.00,30000.00,0.00,0.00,30000.00');
      expect(csv).toContain('# Q4 (16/12 - 15/03),15/03/2025,0.00,0.00,0.00,0.00,1000.00,0.00,1000.00');
      expect(csv).toContain('# Q5 (16/03 - 31/03),31/03/2025,0.00,0.00,0.00,0.00,0.00,2500.00,2500.00');
    });

    it('includes the standardized 27-column header and properly formatted data rows', () => {
      const csv = generateITRReportCSV({
        assesseeName: 'Test Investor',
        pan: 'ABCDE1234F',
        fy: '2024-25',
        details: mockDetails,
      });

      const expectedHeader = 'Sr. No.,Folio Number,ISIN,Asset / Scheme Name,Asset Class,Tax Section,Buy Date,Sell Date,Holding Period (Days),Holding Type,Units,Buy NAV (Rs),Sell NAV (Rs),Gross Consideration (Rs),Cost of Acquisition (Rs),FMV as on 31-Jan-2018 (Rs),Total FMV 2018 (Rs),Deemed Cost u/s 55(2)(ac) (Rs),Transfer Expenses / Exit Load (Rs),Net Capital Gain / (Loss) (Rs),Tax Rate (%),Tax Before Cess (Rs),Health & Education Cess (4%) (Rs),Total Tax Payable (Rs),Advance Tax Quarter,Grandfathered Flag,Anchor / Estimate Warning';
      expect(csv).toContain(expectedHeader);

      const headerCols = expectedHeader.split(',');
      expect(headerCols.length).toBe(27);

      // Verify row 1 escaping of comma
      expect(csv).toContain('"Parag Parikh Flexi Cap Fund, Direct Growth"');
      // Verify row 2 escaping of quotes
      expect(csv).toContain('"HDFC ""Top 100"" Fund"');
      // Verify row 2 anchor warning
      expect(csv).toContain('Estimated');
      // Verify grandfathered row
      expect(csv).toContain('45.0000,22500.00,22500.00,50.00,27450.00,10.0%,0.00,0.00,0.00,Q2a (16/06 - 22/07),Yes,Actual');

      // Check all non-metadata rows have 27 columns
      const lines = csv.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      expect(lines.length).toBe(mockDetails.length + 1); // 1 header + 6 data rows
    });

    it('formats numbers and zero amounts accurately', () => {
      const singleItem = [
        {
          assetName: 'Zero Tax Stock',
          folioNumber: '',
          isin: '',
          assetClass: 'EQUITY',
          section: '111A (15%)',
          buyDate: '2024-04-01',
          sellDate: '2024-05-01',
          holdingPeriodDays: 30,
          holdingType: 'Short-Term',
          units: 10,
          buyNav: 10,
          sellNav: 10,
          grossConsideration: 100,
          costOfAcquisition: 100,
          fmvAsOfJan31_2018: 0,
          totalFmvJan31_2018: 0,
          deemedCostOfAcquisition: 100,
          transferExpenses: 0,
          gain: 0,
          taxType: 'STCG',
          taxRate: 0.15,
          taxBeforeCess: 0,
          cess: 0,
          estimatedTax: 0,
          advanceTaxQuarter: 'Q1 (01/04 - 15/06)',
          isGrandfathered: false,
          isAnchorDependent: false,
        }
      ];

      const csv = generateITRReportCSV({
        assesseeName: 'Zero Assessee',
        pan: 'ZZZZZ0000Z',
        fy: '2024-25',
        details: singleItem,
      });

      expect(csv).toContain('10.000,10.0000,10.0000,100.00,100.00,0.0000,0.00,100.00,0.00,0.00,15.0%,0.00,0.00,0.00,Q1 (01/04 - 15/06),No,Actual');
    });
  });

  describe('verifyItrInvariants', () => {
    const mockItrData = {
      fy: '2024-25',
      quarterlySummary: { q1: 100, q2a: 100, q2b: 100, q3: 100, q4: 50, q5: 50, total: 500 },
      exemptLtcg: 80000,
      taxableGain: 420000,
      realized: {
        total: 500,
        taxableStcg: 200,
        taxableLtcg: 220,
        taxableSlab: 0,
      },
    };

    it('rejects ITR generation if quarterly accrued gains do not sum to total CG', () => {
      const badData = { ...mockItrData, quarterlySummary: { q1: 100, q2: 0, q3: 0, q4: 0, total: 500 } };
      expect(() => verifyItrInvariants(badData as any)).toThrow(/Invariant violated/);
    });

    it('rejects ITR generation if 112A exemption exceeds statutory limit', () => {
      const badData = { ...mockItrData, exemptLtcg: 130000 };
      expect(() => verifyItrInvariants(badData as any)).toThrow(/Invariant violated/);

      const badPreBudgetData = { ...mockItrData, fy: '2023-24', exemptLtcg: 105000 };
      expect(() => verifyItrInvariants(badPreBudgetData as any)).toThrow(/Invariant violated/);
    });

    it('rejects ITR generation if taxable gain is negative', () => {
      const badData = {
        ...mockItrData,
        realized: { ...mockItrData.realized, taxableStcg: -50 },
      };
      expect(() => verifyItrInvariants(badData as any)).toThrow(/Invariant violated/);
    });

    it('accepts valid ITR report data', () => {
      expect(() => verifyItrInvariants(mockItrData as any)).not.toThrow();
    });
  });
});

