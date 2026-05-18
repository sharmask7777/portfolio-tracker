import { HistoryService } from './history.service';
import { prisma } from './db.service';
import { MarketDataService } from './market-data.service';

jest.mock('./db.service', () => ({
  prisma: {
    portfolio: {
      findUnique: jest.fn(),
    },
    historicalNAV: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    portfolioHistory: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  },
}));

jest.mock('./market-data.service');

describe('HistoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateHistory', () => {
    it('should calculate daily history correctly', async () => {
      const portfolioId = 'p1';
      const mockPortfolio = {
        id: portfolioId,
        folios: [
          {
            asset: { amfiCode: '122639' },
            transactions: [
              { date: new Date('2026-05-13'), units: 10, amount: 1000, type: 'BUY' },
              { date: new Date('2026-05-15'), units: -5, amount: 600, type: 'SELL' },
            ],
          },
        ],
      };

      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue(mockPortfolio);
      (prisma.historicalNAV.findFirst as jest.Mock).mockResolvedValue({ date: new Date() });
      (prisma.historicalNAV.findMany as jest.Mock).mockResolvedValue([
        { amfiCode: '122639', date: new Date('2026-05-13T00:00:00.000Z'), nav: 100 },
        { amfiCode: '122639', date: new Date('2026-05-14T00:00:00.000Z'), nav: 105 },
        { amfiCode: '122639', date: new Date('2026-05-15T00:00:00.000Z'), nav: 110 },
      ]);

      // Mock today to be 2026-05-15 for stable test
      jest.useFakeTimers().setSystemTime(new Date('2026-05-15T12:00:00.000Z'));

      await HistoryService.calculateHistory(portfolioId);

      expect(prisma.portfolioHistory.createMany).toHaveBeenCalledWith({
        data: [
          {
            portfolioId: 'p1',
            date: new Date('2026-05-13T00:00:00.000Z'),
            value: 1000, // 10 units * 100 NAV
            investedAmount: 1000,
          },
          {
            portfolioId: 'p1',
            date: new Date('2026-05-14T00:00:00.000Z'),
            value: 1050, // 10 units * 105 NAV
            investedAmount: 1000,
          },
          {
            portfolioId: 'p1',
            date: new Date('2026-05-15T00:00:00.000Z'),
            value: 550, // 5 units * 110 NAV
            investedAmount: 400, // 1000 - 600
          },
        ],
        skipDuplicates: true,
      });

      jest.useRealTimers();
    });
  });
});
