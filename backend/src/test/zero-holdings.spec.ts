import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import portfolioRoutes from '@src/routes/portfolio.routes';
import { PortfolioUtils } from '@src/utils/portfolio.utils';
import { PerformanceService } from '@src/services/performance.service';
import { prismaMock } from '@src/test/db.mock';

jest.mock('@src/services/db.service', () => require('@src/test/db.mock'));

jest.mock('@src/middleware/authMiddleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123' };
    next();
  },
}));

describe('Zero Holdings and Sold Funds Isolation', () => {
  describe('PortfolioUtils.getLatestUnits', () => {
    it('returns 0 when the latest unit-bearing transaction has 0 balance', () => {
      const txs = [
        { date: '2023-01-01', type: 'PURCHASE', units: 100, balance: 100 },
        { date: '2023-06-01', type: 'REDEMPTION', units: -100, balance: 0 },
      ];
      expect(PortfolioUtils.getLatestUnits(txs)).toBe(0);
    });

    it('ignores trailing tax/duty/charge transactions that carry 0 balance and returns the real unit balance', () => {
      const txs = [
        { date: '2023-01-01', type: 'PURCHASE', units: 50, balance: 50 },
        { date: '2023-01-01', type: 'STAMP_DUTY_TAX', units: 0, balance: 0 },
      ];
      expect(PortfolioUtils.getLatestUnits(txs)).toBe(50);
    });

    it('treats floating-point residue below 0.001 as 0', () => {
      const txs = [
        { date: '2023-01-01', type: 'PURCHASE', units: 100, balance: 100 },
        { date: '2023-06-01', type: 'REDEMPTION', units: -100, balance: 0.0000001 },
      ];
      expect(PortfolioUtils.getLatestUnits(txs)).toBe(0);
    });

    it('orders same-day buys before sells so that redemptions drop balance to 0', () => {
      const txs = [
        { id: 'tx-sell', date: '2024-05-10', type: 'REDEMPTION', units: -50, balance: 0 },
        { id: 'tx-buy', date: '2024-05-10', type: 'PURCHASE', units: 50, balance: 50 },
      ];
      expect(PortfolioUtils.getLatestUnits(txs)).toBe(0);
    });
  });

  describe('PerformanceService.getMetrics with zero units', () => {
    it('strictly sets active investedAmount to 0 and currentValue to 0 when all units are redeemed', () => {
      const txs = [
        { date: '2023-01-01', type: 'PURCHASE', amount: 10000, units: 100, nav: 100, balance: 100 },
        { date: '2023-06-01', type: 'REDEMPTION', amount: 15000, units: -100, nav: 150, balance: 0 },
      ];
      const metrics = PerformanceService.getMetrics(txs, 160, { currentUnitsOverride: 0 });
      expect(metrics.investedAmount).toBe(0);
      expect(metrics.currentValue).toBe(0);
      expect(metrics.totalGain).toBe(0);
    });

    it('computes positive FIFO cost basis for remaining units when partially redeemed', () => {
      const txs = [
        { date: '2023-01-01', type: 'PURCHASE', amount: 10000, units: 100, nav: 100, balance: 100 },
        { date: '2023-06-01', type: 'REDEMPTION', amount: 7500, units: -50, nav: 150, balance: 50 },
      ];
      // 50 remaining units with buy NAV 100 = 5000 cost basis
      const metrics = PerformanceService.getMetrics(txs, 150, { currentUnitsOverride: 50 });
      expect(metrics.investedAmount).toBe(5000);
      expect(metrics.currentValue).toBe(7500);
      expect(metrics.totalGain).toBe(2500);
    });
  });

  describe('GET /api/portfolio/summary active vs closed folios', () => {
    let app: Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use((req: any, _res: any, next: any) => {
        req.user = { id: 'user-123' };
        next();
      });
      app.use('/api/portfolio', portfolioRoutes);
      jest.clearAllMocks();
    });

    it('filters out closed folios (0 units) from active folios and includes them in closedFolios', async () => {
      const activeFolio = {
        id: 'folio-active',
        number: '10396016',
        portfolioId: 'port-1',
        asset: { id: 'asset-1', name: 'Parag Parikh Flexi Cap Fund', type: 'MUTUAL_FUND', isin: 'INF879O01027', amfiCode: '122639' },
        transactions: [
          { date: new Date('2023-01-01'), type: 'PURCHASE', amount: 50000, units: 500, nav: 100, balance: 500 },
        ],
      };

      const closedFolio = {
        id: 'folio-sold',
        number: '457159707423 / 0',
        portfolioId: 'port-1',
        asset: { id: 'asset-2', name: 'NIPPON INDIA ELSS TAX SAVER FUND', type: 'MUTUAL_FUND', isin: 'INF204K01GK4', amfiCode: '103196' },
        transactions: [
          { date: new Date('2023-01-01'), type: 'PURCHASE', amount: 20000, units: 200, nav: 100, balance: 200 },
          { date: new Date('2023-06-01'), type: 'REDEMPTION', amount: 30000, units: -200, nav: 150, balance: 0 },
        ],
      };

      (prismaMock.portfolio.findMany as any).mockResolvedValue([
        {
          id: 'port-1',
          name: 'My Portfolio',
          userId: 'user-123',
          folios: [activeFolio, closedFolio],
        },
      ]);

      const res = await request(app).get('/api/portfolio/summary');
      if (res.status !== 200) {
        console.error('SERVER ERROR IN TEST:', res.body);
      }
      expect(res.status).toBe(200);

      // Active folios must ONLY contain the fund with positive units/value
      expect(res.body.folios).toHaveLength(1);
      expect(res.body.folios[0].id).toBe('folio-active');

      // Closed folios must contain the sold fund
      expect(res.body.closedFolios).toBeDefined();
      expect(res.body.closedFolios).toHaveLength(1);
      expect(res.body.closedFolios[0].id).toBe('folio-sold');

      // Total invested and total value must NOT include the sold fund
      expect(res.body.metrics.totalInvested).toBe(50000);
      expect(res.body.metrics.totalValue).toBeGreaterThan(0);
    });
  });
});
