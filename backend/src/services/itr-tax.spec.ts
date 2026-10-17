import { TaxService, TaxSection, AdvanceTaxQuarter } from './tax.service';
import { TaxAnalyzerService } from './tax-analyzer.service';
import { AssetType } from '@prisma/client';
import { prismaMock } from '@src/test/db.mock';
import { MarketDataService } from './market-data.service';
import request from 'supertest';
import express from 'express';
import portfolioRoutes from '../routes/portfolio.routes';
import { AuthService } from './authService';

jest.mock('./db.service', () => {
  const { prismaMock } = require('@src/test/db.mock');
  return {
    __esModule: true,
    prisma: prismaMock,
    cleanupDatabase: jest.fn(),
  };
});
jest.mock('@src/services/db.service', () => {
  const { prismaMock } = require('@src/test/db.mock');
  return {
    __esModule: true,
    prisma: prismaMock,
    cleanupDatabase: jest.fn(),
  };
});
jest.mock('./market-data.service');

describe('ITR Tax Engine Regulations & Schedule CG Compliance (TDD)', () => {
  const MF = AssetType.MUTUAL_FUND;
  const STOCK = AssetType.STOCK;

  describe('1. TaxSection Classification & Rates', () => {
    it('should classify equity STCG sold <= 22-Jul-2024 as 111A (15%)', () => {
      const txs = [
        { type: 'BUY', units: 10, nav: 100, date: new Date('2024-01-01') },
        { type: 'SELL', units: 10, nav: 150, date: new Date('2024-07-22') },
      ];
      const summary = TaxService.calculatePortfolioTax('Equity Fund', MF, txs, 150);
      const detail = summary.realized.details[0];

      expect(detail.section).toBe(TaxSection.SEC_111A_15);
      expect(detail.taxRate).toBe(0.15);
      expect(detail.taxType).toBe('STCG');
    });

    it('should classify equity STCG sold >= 23-Jul-2024 as 111A (20%)', () => {
      const txs = [
        { type: 'BUY', units: 10, nav: 100, date: new Date('2024-01-01') },
        { type: 'SELL', units: 10, nav: 150, date: new Date('2024-07-23') },
      ];
      const summary = TaxService.calculatePortfolioTax('Equity Fund', MF, txs, 150);
      const detail = summary.realized.details[0];

      expect(detail.section).toBe(TaxSection.SEC_111A_20);
      expect(detail.taxRate).toBe(0.20);
      expect(detail.taxType).toBe('STCG');
    });

    it('should classify equity LTCG sold <= 22-Jul-2024 as 112A (10%)', () => {
      const txs = [
        { type: 'BUY', units: 10, nav: 100, date: new Date('2023-01-01') },
        { type: 'SELL', units: 10, nav: 150, date: new Date('2024-07-22') },
      ];
      const summary = TaxService.calculatePortfolioTax('Equity Fund', MF, txs, 150);
      const detail = summary.realized.details[0];

      expect(detail.section).toBe(TaxSection.SEC_112A_10);
      expect(detail.taxRate).toBe(0.10);
      expect(detail.taxType).toBe('LTCG');
    });

    it('should classify equity LTCG sold >= 23-Jul-2024 as 112A (12.5%)', () => {
      const txs = [
        { type: 'BUY', units: 10, nav: 100, date: new Date('2023-01-01') },
        { type: 'SELL', units: 10, nav: 150, date: new Date('2024-07-23') },
      ];
      const summary = TaxService.calculatePortfolioTax('Equity Fund', MF, txs, 150);
      const detail = summary.realized.details[0];

      expect(detail.section).toBe(TaxSection.SEC_112A_12_5);
      expect(detail.taxRate).toBe(0.125);
      expect(detail.taxType).toBe('LTCG');
    });

    it('should classify Specified Mutual Fund (bought >= 01-Apr-2023) as 50AA (Slab)', () => {
      const txs = [
        { type: 'BUY', units: 10, nav: 100, date: new Date('2023-04-01') },
        { type: 'SELL', units: 10, nav: 150, date: new Date('2025-05-01') },
      ];
      const summary = TaxService.calculatePortfolioTax('HDFC Debt Fund', MF, txs, 150, 0.30);
      const detail = summary.realized.details[0];

      expect(detail.section).toBe(TaxSection.SEC_50AA);
      expect(detail.taxType).toBe('SLAB');
      expect(detail.taxRate).toBe(0.30);
    });

    it('should classify Grandfathered Debt LTCG sold >= 23-Jul-2024 (held >= 24m) as 112 Debt (12.5%)', () => {
      const txs = [
        { type: 'BUY', units: 10, nav: 100, date: new Date('2022-01-01') },
        { type: 'SELL', units: 10, nav: 150, date: new Date('2024-08-01') }, // > 24m, post 23-Jul-2024
      ];
      const summary = TaxService.calculatePortfolioTax('HDFC Debt Fund', MF, txs, 150);
      const detail = summary.realized.details[0];

      expect(detail.section).toBe(TaxSection.SEC_112_DEBT_12_5);
      expect(detail.taxType).toBe('LTCG');
      expect(detail.taxRate).toBe(0.125);
    });

    it('should classify Grandfathered Debt LTCG sold <= 22-Jul-2024 (held >= 36m) as 112 Debt (20% Indexed)', () => {
      const txs = [
        { type: 'BUY', units: 10, nav: 100, date: new Date('2021-01-01') },
        { type: 'SELL', units: 10, nav: 150, date: new Date('2024-07-20') }, // > 36m, pre 23-Jul-2024
      ];
      const summary = TaxService.calculatePortfolioTax('HDFC Debt Fund', MF, txs, 150);
      const detail = summary.realized.details[0];

      expect(detail.section).toBe(TaxSection.SEC_112_DEBT_20);
      expect(detail.taxType).toBe('LTCG');
      expect(detail.taxRate).toBe(0.20);
    });

    it('should classify short-term debt (bought pre-2023 but held < threshold) as SLAB', () => {
      const txs = [
        { type: 'BUY', units: 10, nav: 100, date: new Date('2023-01-01') },
        { type: 'SELL', units: 10, nav: 150, date: new Date('2024-05-01') }, // < 36m
      ];
      const summary = TaxService.calculatePortfolioTax('HDFC Debt Fund', MF, txs, 150, 0.30);
      const detail = summary.realized.details[0];

      expect(detail.section).toBe(TaxSection.SLAB);
      expect(detail.taxType).toBe('SLAB');
      expect(detail.taxRate).toBe(0.30);
    });
  });

  describe('2. AdvanceTaxQuarter Assignment', () => {
    it.each([
      ['2024-05-15', AdvanceTaxQuarter.Q1],
      ['2024-06-15', AdvanceTaxQuarter.Q1],
      ['2024-06-16', AdvanceTaxQuarter.Q2A],
      ['2024-07-22', AdvanceTaxQuarter.Q2A],
      ['2024-07-23', AdvanceTaxQuarter.Q2B],
      ['2024-09-15', AdvanceTaxQuarter.Q2B],
      ['2024-09-16', AdvanceTaxQuarter.Q3],
      ['2024-12-15', AdvanceTaxQuarter.Q3],
      ['2024-12-16', AdvanceTaxQuarter.Q4],
      ['2025-01-15', AdvanceTaxQuarter.Q4],
      ['2025-03-15', AdvanceTaxQuarter.Q4],
      ['2025-03-16', AdvanceTaxQuarter.Q5],
      ['2025-03-31', AdvanceTaxQuarter.Q5],
    ])('should assign date %s to quarter %s', (dateStr, expectedQuarter) => {
      const q = TaxService.getAdvanceTaxQuarter(new Date(dateStr));
      expect(q).toBe(expectedQuarter);
    });
  });

  describe('3. Holding Period Boundaries', () => {
    it('should treat equity held 364 days as Short-Term and 365 days as Long-Term', () => {
      const buyDate = new Date('2023-01-01');
      const sellDate364 = new Date('2023-12-31'); // 364 days
      const sellDate365 = new Date('2024-01-01'); // 365 days

      const lot = { date: buyDate, units: 10, nav: 100, originalUnits: 10 };
      const gain364 = TaxService.calculateGain('Equity Fund', MF, lot, 10, 150, sellDate364);
      expect(gain364.holdingType).toBe('Short-Term');
      expect(gain364.taxType).toBe('STCG');

      const gain365 = TaxService.calculateGain('Equity Fund', MF, lot, 10, 150, sellDate365);
      expect(gain365.holdingType).toBe('Long-Term');
      expect(gain365.taxType).toBe('LTCG');
    });

    it('should apply 24 months (730 days) holding period for grandfathered debt sold >= 23-Jul-2024', () => {
      const buyDate = new Date('2022-07-01');
      const sellDate729 = new Date('2024-06-30'); // < 730 days
      const sellDate730 = new Date('2024-07-25'); // >= 730 days and post 23-Jul-2024

      const lot = { date: buyDate, units: 10, nav: 100, originalUnits: 10 };
      const gainST = TaxService.calculateGain('Debt Fund', MF, lot, 10, 150, sellDate729);
      expect(gainST.holdingType).toBe('Short-Term');
      expect(gainST.taxType).toBe('SLAB');

      const gainLT = TaxService.calculateGain('Debt Fund', MF, lot, 10, 150, sellDate730);
      expect(gainLT.holdingType).toBe('Long-Term');
      expect(gainLT.taxType).toBe('LTCG');
      expect(gainLT.section).toBe(TaxSection.SEC_112_DEBT_12_5);
    });
  });

  describe('4. Section 55(2)(ac) Boundary Fix', () => {
    it('should grandfather equity units bought exactly on January 31, 2018', () => {
      const exactBoundaryDate = new Date('2018-01-31');
      const lot = { date: exactBoundaryDate, units: 10, nav: 100, originalUnits: 10 };
      const grandfatherNav = 180;
      const sellNav = 200;
      const sellDate = new Date('2024-08-01');

      const gain = TaxService.calculateGain('Equity Fund', MF, lot, 10, sellNav, sellDate, 0, grandfatherNav);
      expect(gain.isGrandfathered).toBe(true);
      expect(gain.fmvAsOfJan31_2018).toBe(180);
      expect(gain.totalFmvJan31_2018).toBe(1800);
      // Deemed cost = max(100, min(180, 200)) = 180 per unit -> 1800
      expect(gain.deemedCostOfAcquisition).toBe(1800);
      expect(gain.gain).toBe(2000 - 1800);
    });

    it('should NOT grandfather equity units bought on February 1, 2018', () => {
      const postBoundaryDate = new Date('2018-02-01');
      const lot = { date: postBoundaryDate, units: 10, nav: 100, originalUnits: 10 };
      const grandfatherNav = 180;
      const sellNav = 200;
      const sellDate = new Date('2024-08-01');

      const gain = TaxService.calculateGain('Equity Fund', MF, lot, 10, sellNav, sellDate, 0, grandfatherNav);
      expect(gain.isGrandfathered).toBe(false);
      expect(gain.deemedCostOfAcquisition).toBe(1000);
      expect(gain.gain).toBe(2000 - 1000);
    });
  });

  describe('5. Transfer Expenses (Exit load) Deduction u/s 48', () => {
    it('should deduct transfer expenses from gross gain to arrive at net capital gain', () => {
      const lot = { date: new Date('2024-01-01'), units: 10, nav: 100, originalUnits: 10 };
      const sellNav = 150;
      const sellDate = new Date('2024-08-01');
      const transferExpenses = 25; // ₹25 exit load

      const gain = TaxService.calculateGain(
        'Equity Fund', MF, lot, 10, sellNav, sellDate, 0, undefined, transferExpenses
      );

      expect(gain.grossConsideration).toBe(1500);
      expect(gain.costOfAcquisition).toBe(1000);
      expect(gain.transferExpenses).toBe(25);
      // Net gain = 1500 - 1000 - 25 = 475
      expect(gain.gain).toBe(475);
    });
  });

  describe('6. Mandatory 4% Health & Education Cess', () => {
    it('should compute taxBeforeCess, 4% cess, and total estimatedTax with cess', () => {
      const lot = { date: new Date('2024-01-01'), units: 10, nav: 100, originalUnits: 10 };
      const sellNav = 200; // gain = 1000, post-budget STCG = 20%
      const sellDate = new Date('2024-08-01');

      const gain = TaxService.calculateGain('Equity Fund', MF, lot, 10, sellNav, sellDate);
      expect(gain.gain).toBe(1000);
      expect(gain.taxRate).toBe(0.20);
      expect(gain.taxBeforeCess).toBe(200);
      expect(gain.cess).toBe(8); // 200 * 0.04
      expect(gain.estimatedTax).toBe(208); // 200 + 8
    });

    it('should zero out cess and estimatedTax when there is a capital loss', () => {
      const lot = { date: new Date('2024-01-01'), units: 10, nav: 200, originalUnits: 10 };
      const sellNav = 150; // loss = -500
      const sellDate = new Date('2024-08-01');

      const gain = TaxService.calculateGain('Equity Fund', MF, lot, 10, sellNav, sellDate);
      expect(gain.gain).toBe(-500);
      expect(gain.taxBeforeCess).toBe(0);
      expect(gain.cess).toBe(0);
      expect(gain.estimatedTax).toBe(0);
    });
  });

  describe('7. Section 112A Exemption Sequential Exhaustion', () => {
    it('should exhaust ₹1,25,000 exemption sequentially: 10% tranche first, then 12.5% tranche in FY 2024-25', () => {
      // Case 1: LTCG 10% = 50,000, LTCG 12.5% = 1,00,000
      // Exemption applied to 10%: 50,000 -> taxable 10% = 0
      // Remaining exemption: 1,25,000 - 50,000 = 75,000
      // Exemption applied to 12.5%: 75,000 -> taxable 12.5% = 25,000
      // Tax on 12.5%: 25,000 * 12.5% = 3125, cess = 125, total = 3250
      const result = TaxService.calculate112AExemption(50000, 100000, '2024-25');
      expect(result.exempt10).toBe(50000);
      expect(result.exempt12_5).toBe(75000);
      expect(result.totalExemption).toBe(125000);
      expect(result.taxable10).toBe(0);
      expect(result.taxable12_5).toBe(25000);
      expect(result.tax10).toBe(0);
      expect(result.tax12_5).toBe(3250); // 3125 + 4% cess
      expect(result.totalTax).toBe(3250);
    });

    it('should use ₹1,00,000 limit for FY 2023-24', () => {
      const result = TaxService.calculate112AExemption(120000, 0, '2023-24');
      expect(result.exempt10).toBe(100000);
      expect(result.taxable10).toBe(20000);
      // 20000 * 0.10 = 2000 + 4% cess = 2080
      expect(result.totalTax).toBe(2080);
    });
  });

  describe('8. Enriched RealizedGain Interface', () => {
    it('should populate all 29 fields in RealizedGain accurately', () => {
      const buyDate = new Date('2017-06-01');
      const sellDate = new Date('2024-08-15');
      const lot = { date: buyDate, units: 100, nav: 50, originalUnits: 100 };
      const grandfatherNav = 80;
      const sellNav = 120;
      const transferExpenses = 100;
      const metadata = {
        folioNumber: '12345/67',
        isin: 'INF123456789',
        pan: 'ABCDE1234F',
      };

      const gain = TaxService.calculateGain(
        'HDFC Top 100 Fund',
        MF,
        lot,
        100,
        sellNav,
        sellDate,
        0.30,
        grandfatherNav,
        transferExpenses,
        metadata
      );

      expect(gain.assetName).toBe('HDFC Top 100 Fund');
      expect(gain.folioNumber).toBe('12345/67');
      expect(gain.isin).toBe('INF123456789');
      expect(gain.pan).toBe('ABCDE1234F');
      expect(gain.assetClass).toBe('Equity');
      expect(gain.section).toBe(TaxSection.SEC_112A_12_5);
      expect(gain.buyDate).toEqual(buyDate);
      expect(gain.sellDate).toEqual(sellDate);
      expect(gain.holdingPeriodDays).toBeGreaterThan(365);
      expect(gain.holdingType).toBe('Long-Term');
      expect(gain.units).toBe(100);
      expect(gain.buyNav).toBe(50);
      expect(gain.sellNav).toBe(120);
      expect(gain.grossConsideration).toBe(12000);
      expect(gain.costOfAcquisition).toBe(5000);
      expect(gain.fmvAsOfJan31_2018).toBe(80);
      expect(gain.totalFmvJan31_2018).toBe(8000);
      expect(gain.deemedCostOfAcquisition).toBe(8000); // max(50, min(80, 120)) * 100
      expect(gain.transferExpenses).toBe(100);
      expect(gain.gain).toBe(12000 - 8000 - 100); // 3900
      expect(gain.taxType).toBe('LTCG');
      expect(gain.taxRate).toBe(0.125);
      expect(gain.taxBeforeCess).toBe(3900 * 0.125); // 487.5
      expect(gain.cess).toBe(487.5 * 0.04); // 19.5
      expect(gain.estimatedTax).toBe(507); // 487.5 + 19.5
      expect(gain.advanceTaxQuarter).toBe(AdvanceTaxQuarter.Q2B);
      expect(gain.isGrandfathered).toBe(true);
      expect(gain.grandfatheredStatus).toBeDefined();
      expect(gain.isAnchorDependent).toBe(false);
    });
  });

  describe('9. Table F & Section Totals Generation', () => {
    it('should generate Table F accrual matrix and Section Totals', () => {
      const txs = [
        { type: 'BUY', units: 10, nav: 100, date: new Date('2024-01-01') },
        { type: 'SELL', units: 10, nav: 150, date: new Date('2024-05-10') }, // Q1, STCG 15%
        { type: 'BUY', units: 10, nav: 100, date: new Date('2024-01-01') },
        { type: 'SELL', units: 10, nav: 150, date: new Date('2024-08-10') }, // Q2b, STCG 20%
      ];
      const summary = TaxService.calculatePortfolioTax('Equity Fund', MF, txs, 150);

      const tableF = TaxService.buildAdvanceTaxMatrix(summary.realized.details);
      expect(tableF).toBeDefined();
      expect(tableF.quarters[AdvanceTaxQuarter.Q1].stcg15).toBe(500);
      expect(tableF.quarters[AdvanceTaxQuarter.Q2B].stcg20).toBe(500);

      const sectionTotals = TaxService.buildSectionTotals(summary.realized.details);
      expect(sectionTotals[TaxSection.SEC_111A_15]).toBeDefined();
      expect(sectionTotals[TaxSection.SEC_111A_15].totalGain).toBe(500);
      expect(sectionTotals[TaxSection.SEC_111A_20]).toBeDefined();
      expect(sectionTotals[TaxSection.SEC_111A_20].totalGain).toBe(500);
    });
  });

  describe('10. TaxAnalyzerService Upgrade', () => {
    it('should use net gain after exit load and include cess in simulation breakdown', async () => {
      (prismaMock.folio.findUnique as jest.Mock).mockResolvedValue({
        id: 'f_test',
        number: 'FOLIO123',
        pan: 'ABCDE1234F',
        asset: {
          name: 'Nippon India Large Cap Fund',
          type: 'MUTUAL_FUND',
          isin: 'INF204K01018',
          amfiCode: '100033',
          exitLoadMetadata: '1% if redeemed within 365 days',
        },
        transactions: [
          { type: 'BUY', units: 10, nav: 100, date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), amount: 1000, balance: 10 },
        ],
      });

      (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(150);

      const sim = await TaxAnalyzerService.simulateSell('f_test', 10, 0.30);
      expect(sim.unitsToSell).toBe(10);
      expect(sim.estimatedValue).toBe(1500);
      expect(sim.exitLoad).toBe(15); // 1% of 1500
      // Net gain = 1500 - 1000 - 15 = 485
      expect(sim.totalGain).toBe(485);
      expect(sim.matchedLots[0].transferExpenses).toBe(15);
      expect(sim.matchedLots[0].gain).toBe(485);
      // Tax: STCG 20% + 4% cess on 485:
      // Tax before cess = 485 * 0.20 = 97, cess = 3.88, total = 100.88
      expect(sim.matchedLots[0].taxBeforeCess).toBeCloseTo(97, 2);
      expect(sim.matchedLots[0].cess).toBeCloseTo(3.88, 2);
      expect(sim.matchedLots[0].estimatedTax).toBeCloseTo(100.88, 2);
      expect(sim.taxBreakdown.totalTax).toBeCloseTo(100.88, 2);
    });
  });

  describe('11. Portfolio Routes /tax-impact and /:id/tax-impact endpoints', () => {
    let app: express.Express;
    const token = AuthService.generateToken({ id: 'u1', email: 'u1@example.com' });

    beforeAll(() => {
      app = express();
      app.use(express.json());
      app.use('/api/portfolio', portfolioRoutes);
    });

    it('should return 200 with Table F and Section Totals from GET /api/portfolio/:id/tax-impact', async () => {
      (prismaMock.portfolio.findFirst as jest.Mock).mockResolvedValue({
        id: 'p1',
        name: 'My Portfolio',
        userId: 'u1',
        folios: [
          {
            id: 'fol_1',
            number: '12345/67',
            pan: 'ABCDE1234F',
            portfolioId: 'p1',
            assetId: 'a1',
            asset: {
              id: 'a1',
              name: 'HDFC Equity Fund',
              type: 'MUTUAL_FUND',
              isin: 'INF123456789',
              amfiCode: '100050',
              exitLoadMetadata: null,
            },
            transactions: [
              { id: 't1', type: 'BUY', units: 10, nav: 100, date: new Date('2024-01-01'), amount: 1000, balance: 10 },
              { id: 't2', type: 'SELL', units: 10, nav: 150, date: new Date('2024-08-01'), amount: 1500, balance: 0 },
            ],
          },
        ],
      });

      (prismaMock.historicalNAV.findFirst as jest.Mock).mockResolvedValue({
        nav: 120,
      });

      (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(150);
      (MarketDataService.getPreviousNAV as jest.Mock).mockResolvedValue(148);

      const res = await request(app)
        .get('/api/portfolio/p1/tax-impact')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tableF');
      expect(res.body).toHaveProperty('sectionTotals');
      expect(res.body).toHaveProperty('details');
      expect(res.body.details.length).toBe(1);
      expect(res.body.details[0].folioNumber).toBe('12345/67');
      expect(res.body.details[0].isin).toBe('INF123456789');
      expect(res.body.details[0].pan).toBe('ABCDE1234F');
      expect(res.body.tableF.quarters[AdvanceTaxQuarter.Q2B].stcg20).toBe(500);
      expect(res.body.sectionTotals[TaxSection.SEC_111A_20].totalGain).toBe(500);
    });

    it('should return 200 from GET /api/portfolio/tax-impact (consolidated query)', async () => {
      (prismaMock.portfolio.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'p1',
          name: 'My Portfolio',
          userId: 'u1',
          folios: [
            {
              id: 'fol_1',
              number: '12345/67',
              pan: 'ABCDE1234F',
              portfolioId: 'p1',
              assetId: 'a1',
              asset: {
                id: 'a1',
                name: 'HDFC Equity Fund',
                type: 'MUTUAL_FUND',
                isin: 'INF123456789',
                amfiCode: '100050',
                exitLoadMetadata: null,
              },
              transactions: [
                { id: 't1', type: 'BUY', units: 10, nav: 100, date: new Date('2024-01-01'), amount: 1000, balance: 10 },
                { id: 't2', type: 'SELL', units: 10, nav: 150, date: new Date('2024-05-15'), amount: 1500, balance: 0 },
              ],
            },
          ],
        },
      ]);

      (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(150);
      (MarketDataService.getPreviousNAV as jest.Mock).mockResolvedValue(150);

      const res = await request(app)
        .get('/api/portfolio/tax-impact?id=consolidated')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.tableF.quarters[AdvanceTaxQuarter.Q1].stcg15).toBe(500);
    });

    it('should return 200 with Table F and Section Totals from GET /api/portfolio/:id/tax-summary', async () => {
      (prismaMock.portfolio.findFirst as jest.Mock).mockResolvedValue({
        id: 'p1',
        name: 'My Portfolio',
        userId: 'u1',
        folios: [
          {
            id: 'fol_1',
            number: '12345/67',
            pan: 'ABCDE1234F',
            portfolioId: 'p1',
            assetId: 'a1',
            asset: {
              id: 'a1',
              name: 'HDFC Equity Fund',
              type: 'MUTUAL_FUND',
              isin: 'INF123456789',
              amfiCode: '100050',
              exitLoadMetadata: null,
            },
            transactions: [
              { id: 't1', type: 'BUY', units: 10, nav: 100, date: new Date('2024-01-01'), amount: 1000, balance: 10 },
            ],
          },
        ],
      });

      (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(150);
      (MarketDataService.getPreviousNAV as jest.Mock).mockResolvedValue(150);

      const res = await request(app)
        .get('/api/portfolio/p1/tax-summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('tableF');
      expect(res.body).toHaveProperty('sectionTotals');
    });
  });
});
