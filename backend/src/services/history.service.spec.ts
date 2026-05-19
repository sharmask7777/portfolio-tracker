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
      findMany: jest.fn(),
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

  describe('getPortfolioStats', () => {
    it('should return correct stats from history data', async () => {
      const mockHistory = [
        { date: new Date('2025-01-01'), value: 1000, investedAmount: 800 },
        { date: new Date('2025-06-01'), value: 1500, investedAmount: 900 },
        { date: new Date('2026-01-01'), value: 1200, investedAmount: 1000 },
        { date: new Date('2026-05-15'), value: 2000, investedAmount: 1100 },
      ];

      (prisma.portfolioHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const stats = await HistoryService.getPortfolioStats(['p1']);

      expect(stats.ath.value).toBe(2000);
      expect(stats.maxInvested.value).toBe(1100);
      expect(stats.yearly).toHaveLength(2);
      
      // Check 2026
      expect(stats.yearly[0].year).toBe(2026);
      expect(stats.yearly[0].ath.value).toBe(2000);
      expect(stats.yearly[0].maxInvested.value).toBe(1100);

      // Check 2025
      expect(stats.yearly[1].year).toBe(2025);
      expect(stats.yearly[1].ath.value).toBe(1500);
      expect(stats.yearly[1].maxInvested.value).toBe(900);
    });

    it('should return zero stats when no history data exists', async () => {
      (prisma.portfolioHistory.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await HistoryService.getPortfolioStats(['p1']);

      expect(stats).toEqual({
        ath: { value: 0, date: null },
        maxInvested: { value: 0, date: null },
        yearly: [],
      });
    });

    it('should correctly identify peak values per year across multi-year history', async () => {
      const mockHistory = [
        { date: new Date('2024-12-31'), value: 5000, investedAmount: 4000 },
        { date: new Date('2025-01-10'), value: 6000, investedAmount: 4500 },
        { date: new Date('2025-02-15'), value: 5500, investedAmount: 4600 },
        { date: new Date('2026-03-20'), value: 8000, investedAmount: 5000 },
        { date: new Date('2026-04-10'), value: 7500, investedAmount: 5200 },
      ];

      (prisma.portfolioHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const stats = await HistoryService.getPortfolioStats(['p1']);

      expect(stats.ath.value).toBe(8000);
      expect(stats.yearly).toHaveLength(3); // 2026, 2025, 2024
      
      const stats2026 = stats.yearly.find(y => y.year === 2026);
      expect(stats2026?.ath.value).toBe(8000);
      expect(stats2026?.maxInvested.value).toBe(5200);

      const stats2025 = stats.yearly.find(y => y.year === 2025);
      expect(stats2025?.ath.value).toBe(6000);
      expect(stats2025?.maxInvested.value).toBe(4600);
    });

    it('should handle history entries with NaN values by treating them as 0', async () => {
      const mockHistory = [
        { date: new Date('2026-01-01'), value: 1000, investedAmount: 800 },
        { date: new Date('2026-01-02'), value: NaN, investedAmount: 800 },
        { date: new Date('2026-01-03'), value: 1200, investedAmount: NaN },
      ];

      (prisma.portfolioHistory.findMany as jest.Mock).mockResolvedValue(mockHistory);

      const stats = await HistoryService.getPortfolioStats(['p1']);

      // NaN values in comparisons (point.value > ath.value) will be false, 
      // so ATH remains the last valid peak (1000) or becomes 1200 if valid.
      // Wait, let's see logic: 
      // If point.value is NaN, (NaN > 1000) is false.
      // If point.value is 1200, (1200 > 1000) is true.
      expect(stats.ath.value).toBe(1200);
      expect(stats.maxInvested.value).toBe(800);
    });
  });
});
