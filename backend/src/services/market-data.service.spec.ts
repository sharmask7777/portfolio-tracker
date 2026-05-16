import axios from 'axios';
import { MarketDataService } from './market-data.service';
import { CacheService } from './cache.service';

jest.mock('axios');
jest.mock('./cache.service');

describe('MarketDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
