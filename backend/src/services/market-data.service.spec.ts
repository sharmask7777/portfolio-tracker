import axios from 'axios';
import { MarketDataService } from './market-data.service';
import { CacheService } from './cache.service';
import { prisma } from './db.service';

jest.mock('axios');
jest.mock('./cache.service');
jest.mock('./db.service', () => ({
  prisma: {
    historicalNAV: {
      createMany: jest.fn(),
    },
  },
}));

describe('MarketDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHistoricalNAVs', () => {
    it('should fetch historical data and save to DB', async () => {
      const mockData = {
        data: {
          data: [
            { date: '15-05-2026', nav: '150.5' },
            { date: '14-05-2026', nav: '149.2' },
          ],
        },
      };
      (axios.get as jest.Mock).mockResolvedValue(mockData);

      await MarketDataService.getHistoricalNAVs('122639');

      expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('122639'), expect.any(Object));
      expect(prisma.historicalNAV.createMany).toHaveBeenCalledWith({
        data: [
          { amfiCode: '122639', date: new Date(2026, 4, 15), nav: 150.5 },
          { amfiCode: '122639', date: new Date(2026, 4, 14), nav: 149.2 },
        ],
        skipDuplicates: true,
      });
    });

    it('should filter by startDate if provided', async () => {
      const mockData = {
        data: {
          data: [
            { date: '15-05-2026', nav: '150.5' },
            { date: '01-01-2026', nav: '100.0' },
          ],
        },
      };
      (axios.get as jest.Mock).mockResolvedValue(mockData);

      const startDate = new Date(2026, 4, 1); // May 1st
      await MarketDataService.getHistoricalNAVs('122639', startDate);

      expect(prisma.historicalNAV.createMany).toHaveBeenCalledWith({
        data: [
          { amfiCode: '122639', date: new Date(2026, 4, 15), nav: 150.5 },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe('getLatestNAV', () => {
    it('should return cached NAV if available', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(150.5);
      const nav = await MarketDataService.getLatestNAV('122639');
      expect(nav).toBe(150.5);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should fetch from API and cache if not in cache', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({
        data: { data: [{ nav: '160.75' }] }
      });

      const nav = await MarketDataService.getLatestNAV('122639');
      expect(nav).toBe(160.75);
      expect(CacheService.set).toHaveBeenCalledWith('nav:122639', 160.75, 86400);
    });
  });

  describe('getHoldings', () => {
    it('should return cached holdings if available', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue({ isin: 'INF123', holdings: [] });
      const holdings = await MarketDataService.getHoldings('INF123');
      expect(holdings.isin).toBe('INF123');
    });

    it('should fetch from FinAPI and cache if not in cache', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({
        data: { data: { isin: 'INF123', sector_breakdown: {} } }
      });

      const holdings = await MarketDataService.getHoldings('INF123');
      expect(holdings.isin).toBe('INF123');
      expect(CacheService.set).toHaveBeenCalledWith('holdings:INF123', expect.any(Object), 604800);
    });
  });
});
