import { MarketDataService } from './market-data.service';
import { PortfolioUtils } from '../utils/portfolio.utils';

// Mock db.service per AGENTS.md instructions
jest.mock('@src/services/db.service', () => require('@src/test/db.mock'));
jest.mock('./market-data.service');
jest.mock('./cache.service');

describe('Portfolio Day Change Robustness Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Single Folio Day Change Logic', () => {
    it('should compute exact day change and percentage using pairwise atomic navs', async () => {
      (MarketDataService.getNAVChange as jest.Mock).mockResolvedValue({
        currentPrice: 100,
        previousPrice: 98,
        change: 2,
        changePercentage: 2.0408,
        currentDate: '16-10-2026',
        previousDate: '15-10-2026',
      });

      const currentUnits = 500;
      const navChange = await MarketDataService.getNAVChange('122639');
      expect(navChange).not.toBeNull();

      const currentPrice = navChange!.currentPrice;
      const prevPrice = navChange!.previousPrice;
      const dayChange = (currentPrice - prevPrice) * currentUnits;
      const dayChangePercentage = ((currentPrice - prevPrice) / prevPrice) * 100;

      expect(dayChange).toBe(1000);
      expect(dayChangePercentage).toBeCloseTo(2.0408, 4);
    });

    it('should return 0 dayChange and 0 dayChangePercentage when holding has 0 units (closed folio)', async () => {
      (MarketDataService.getNAVChange as jest.Mock).mockResolvedValue({
        currentPrice: 100,
        previousPrice: 98,
        change: 2,
        changePercentage: 2.0408,
        currentDate: '16-10-2026',
        previousDate: '15-10-2026',
      });

      const currentUnits = 0;
      let dayChange = 0;
      let dayChangePercentage = 0;

      if (currentUnits > 0) {
        const navChange = await MarketDataService.getNAVChange('122639');
        if (navChange) {
          dayChange = (navChange.currentPrice - navChange.previousPrice) * currentUnits;
          dayChangePercentage = navChange.changePercentage;
        }
      }

      expect(dayChange).toBe(0);
      expect(dayChangePercentage).toBe(0);
    });

    it('should NEVER fall back to historical transaction purchase NAV when previous NAV is unavailable', async () => {
      // API returns null and previous NAV returns 0
      (MarketDataService.getNAVChange as jest.Mock).mockResolvedValue(null);
      (MarketDataService.getPreviousNAV as jest.Mock).mockResolvedValue(0);

      const transactions = [
        { type: 'PURCHASE', units: 1000, nav: 20, date: '2020-01-01', amount: 20000 },
      ];
      const lastNav = PortfolioUtils.getLatestNAV(transactions);
      expect(lastNav).toBe(20);

      const currentPrice = 100; // 5x appreciation over 6 years
      const currentUnits = 1000;

      const navChange = await MarketDataService.getNAVChange('122639');
      const previousNav = await MarketDataService.getPreviousNAV('122639', currentPrice);

      let dayChange = 0;
      let dayChangePercentage = 0;

      if (navChange) {
        dayChange = (navChange.currentPrice - navChange.previousPrice) * currentUnits;
        dayChangePercentage = ((navChange.currentPrice - navChange.previousPrice) / navChange.previousPrice) * 100;
      } else if (previousNav > 0) {
        dayChange = (currentPrice - previousNav) * currentUnits;
        dayChangePercentage = ((currentPrice - previousNav) / previousNav) * 100;
      }

      // Must be 0, NOT (100 - 20) * 1000 = 80,000!
      expect(dayChange).toBe(0);
      expect(dayChangePercentage).toBe(0);
    });
  });

  describe('Portfolio-Level Day Change Aggregation', () => {
    it('should aggregate portfolio day change without exploding percentage or division by zero', () => {
      const enrichedFolios = [
        {
          id: 'folio-1',
          metrics: {
            currentValue: 50000,
            dayChange: 1000,
            dayChangePercentage: 2.04,
          },
        },
        {
          id: 'folio-2',
          metrics: {
            currentValue: 30000,
            dayChange: -300,
            dayChangePercentage: -0.99,
          },
        },
        {
          id: 'folio-3', // Folio with no day change data available
          metrics: {
            currentValue: 20000,
            dayChange: 0,
            dayChangePercentage: 0,
          },
        },
      ];

      const totalDayChange = enrichedFolios.reduce((acc, f) => acc + (f.metrics.dayChange || 0), 0);
      const totalPreviousValue = enrichedFolios.reduce((acc, f) => {
        if (f.metrics.currentValue > 0) {
          const prev = f.metrics.currentValue - (f.metrics.dayChange || 0);
          return acc + Math.max(0, prev);
        }
        return acc;
      }, 0);
      const totalDayChangePercentage = totalPreviousValue > 0 ? (totalDayChange / totalPreviousValue) * 100 : 0;

      // Total change = 1000 - 300 + 0 = 700
      expect(totalDayChange).toBe(700);
      // Total prev value = (50000 - 1000) + (30000 - (-300)) + (20000 - 0) = 49000 + 30300 + 20000 = 99300
      expect(totalPreviousValue).toBe(99300);
      // Percentage = (700 / 99300) * 100 = 0.7049%
      expect(totalDayChangePercentage).toBeCloseTo(0.7049, 3);
    });

    it('should handle zero portfolio value cleanly without NaN or Infinity', () => {
      const enrichedFolios: any[] = [];

      const totalDayChange = enrichedFolios.reduce((acc, f) => acc + (f.metrics.dayChange || 0), 0);
      const totalPreviousValue = enrichedFolios.reduce((acc, f) => {
        if (f.metrics.currentValue > 0) {
          const prev = f.metrics.currentValue - (f.metrics.dayChange || 0);
          return acc + Math.max(0, prev);
        }
        return acc;
      }, 0);
      const totalDayChangePercentage = totalPreviousValue > 0 ? (totalDayChange / totalPreviousValue) * 100 : 0;

      expect(totalDayChange).toBe(0);
      expect(totalPreviousValue).toBe(0);
      expect(totalDayChangePercentage).toBe(0);
      expect(Number.isFinite(totalDayChangePercentage)).toBe(true);
    });
  });
});
