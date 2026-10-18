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
      findMany: jest.fn(),
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

    it('should enrich with Tier 1 Curated Top Holdings when fund matches curated registry', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({
        data: { data: { schemeName: 'Parag Parikh Flexi Cap Fund - Direct Plan' } }
      });

      const holdings = await MarketDataService.getHoldings('INF879O01018');
      expect(holdings.holdings.length).toBeGreaterThan(0);
      expect(holdings.holdings.some((h: any) => h.name.includes('HDFC Bank'))).toBe(true);
      expect(holdings.holdings.some((h: any) => h.name.includes('ITC'))).toBe(true);
      expect(holdings.portfolio.assetAllocation.equity).toBe('85.00');
    });

    it('should fall back to Tier 2 Category Constituent Templates when scheme category is matched', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({
        data: { data: { schemeName: 'Unknown AMC Small Cap Fund', schemeCategoryLabel: 'Equity Scheme - Small Cap Fund' } }
      });

      const holdings = await MarketDataService.getHoldings('INF_RANDOM_SMALLCAP');
      expect(holdings.holdings.length).toBeGreaterThan(0);
      expect(holdings.schemeCategoryLabel).toBe('Equity Scheme - Small Cap Fund');
      expect(holdings.portfolio.marketCapWeightage.smallCap).toBe('67.00');
    });

    it('should return empty holdings for Debt / Liquid funds (Tier 3)', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({
        data: { data: { schemeName: 'HDFC Liquid Fund - Direct Plan', schemeCategoryLabel: 'Debt Scheme - Liquid Fund' } }
      });

      const holdings = await MarketDataService.getHoldings('INF179K01999');
      expect(holdings.holdings).toEqual([]);
      expect(holdings.sectors).toEqual([]);
      expect(holdings.portfolio.assetAllocation.debt).toBe('100.00');
    });

    it('should seamlessly fallback to curated/category template when FinAPI network call fails', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockRejectedValue(new Error('FinAPI service timeout'));

      const holdings = await MarketDataService.getHoldings('INF879O01018', 'Parag Parikh Flexi Cap Fund');
      expect(holdings.holdings.length).toBeGreaterThan(0);
      expect(holdings.schemeName).toBe('Parag Parikh Flexi Cap Fund');
    });

    it('should reject stale cached object without holdings array and re-enrich with template holdings', async () => {
      // Simulate poisoned Redis cache containing only scheme metadata without holdings
      (CacheService.get as jest.Mock).mockResolvedValue({
        schemeName: 'Edelweiss NIFTY Large Midcap 250 Index Fund',
        schemeCategoryLabel: 'Other Scheme - Index Funds',
        expenseRatio: 0.7,
      });

      const holdings = await MarketDataService.getHoldings('INF754K01NR9');
      expect(holdings).toBeDefined();
      expect(Array.isArray(holdings.holdings)).toBe(true);
      expect(holdings.holdings.length).toBeGreaterThan(0);
      expect(CacheService.set).toHaveBeenCalledWith('holdings:INF754K01NR9', expect.any(Object), 604800);
    });

    it('should skip external FinAPI network call for synthetic ISINs and resolve via scheme name', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);

      const holdings = await MarketDataService.getHoldings('MISSING-122639', 'Parag Parikh Flexi Cap Fund');
      expect(axios.get).not.toHaveBeenCalledWith(expect.stringContaining('MISSING-122639'), expect.any(Object));
      expect(holdings.holdings.length).toBeGreaterThan(0);
      expect(holdings.holdings.some((h: any) => h.name.includes('HDFC Bank'))).toBe(true);
    });

    it('should resolve holdings when isin is undefined but schemeName is provided', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);

      const holdings = await MarketDataService.getHoldings(undefined, 'Axis Small Cap Fund');
      expect(holdings).toBeDefined();
      expect(holdings.holdings.length).toBeGreaterThan(0);
      expect(holdings.schemeCategoryLabel).toContain('Small Cap');
    });

    it('should return null when both isin and schemeName are missing', async () => {
      const holdings = await MarketDataService.getHoldings(undefined, undefined);
      expect(holdings).toBeNull();
    });
  });

  describe('getGoldPrice', () => {
    it('should return cached price if available', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(7850);
      const price = await MarketDataService.getGoldPrice();
      expect(price).toBe(7850);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should fetch price in INR from API and convert per gram', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({
        data: { price: 311034.768, currency: 'INR' },
      });

      const price = await MarketDataService.getGoldPrice();
      expect(axios.get).toHaveBeenCalledWith('https://api.gold-api.com/price/XAU/INR', { timeout: 10000 });
      expect(price).toBeCloseTo(10000, 1);
      expect(CacheService.set).toHaveBeenCalledWith('gold_price_inr', expect.any(Number), 3600);
    });

    it('should handle API errors gracefully and return 0', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      const price = await MarketDataService.getGoldPrice();
      expect(price).toBe(0);
    });
  });

  describe('getNAVChange', () => {
    it('should return cached NAV change if available', async () => {
      const mockResult = {
        currentPrice: 100,
        previousPrice: 98,
        change: 2,
        changePercentage: 2.0408,
        currentDate: '16-10-2026',
        previousDate: '15-10-2026',
      };
      (CacheService.get as jest.Mock).mockResolvedValue(mockResult);

      const result = await MarketDataService.getNAVChange('122639');
      expect(result).toEqual(mockResult);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('should fetch from MFAPI and compute day change from consecutive trading days', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({
        data: {
          data: [
            { date: '16-10-2026', nav: '100.00' },
            { date: '15-10-2026', nav: '98.00' },
            { date: '14-10-2026', nav: '97.00' },
          ],
        },
      });

      const result = await MarketDataService.getNAVChange('122639');
      expect(result).not.toBeNull();
      expect(result?.currentPrice).toBe(100.0);
      expect(result?.previousPrice).toBe(98.0);
      expect(result?.change).toBeCloseTo(2.0, 4);
      expect(result?.changePercentage).toBeCloseTo(2.0408, 3);
      expect(result?.currentDate).toBe('16-10-2026');
      expect(result?.previousDate).toBe('15-10-2026');

      expect(CacheService.set).toHaveBeenCalledWith(
        'nav_change:122639',
        expect.objectContaining({ currentPrice: 100, previousPrice: 98 }),
        3600
      );
      expect(CacheService.set).toHaveBeenCalledWith('nav:122639', 100, 3600);
    });

    it('should return null when API returns less than 2 data points or invalid navs', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({
        data: { data: [{ date: '16-10-2026', nav: '100.00' }] },
      });

      const result = await MarketDataService.getNAVChange('122639');
      expect(result).toBeNull();
    });

    it('should return null when API call fails', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await MarketDataService.getNAVChange('122639');
      expect(result).toBeNull();
    });
  });

  describe('getPreviousNAV', () => {
    it('should use getNAVChange previousPrice when available', async () => {
      (CacheService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'nav_change:122639') {
          return Promise.resolve({
            currentPrice: 100,
            previousPrice: 98,
            change: 2,
            changePercentage: 2.04,
            currentDate: '16-10-2026',
            previousDate: '15-10-2026',
          });
        }
        return Promise.resolve(null);
      });

      const prevNav = await MarketDataService.getPreviousNAV('122639');
      expect(prevNav).toBe(98);
    });

    it('should return 0 when historical records in DB have a gap greater than 7 days', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({ data: { data: [] } });

      (prisma.historicalNAV.findMany as jest.Mock).mockResolvedValue([
        { amfiCode: '122639', nav: 100, date: new Date('2026-10-16') },
        { amfiCode: '122639', nav: 50, date: new Date('2026-05-15') }, // 5 months gap!
      ]);

      const prevNav = await MarketDataService.getPreviousNAV('122639');
      expect(prevNav).toBe(0);
    });

    it('should return 0 when DB records are closely spaced but both are older than 7 days from now', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({ data: { data: [] } });

      const staleDate1 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const staleDate2 = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago (1 day apart)

      (prisma.historicalNAV.findMany as jest.Mock).mockResolvedValue([
        { amfiCode: '122639', nav: 100, date: staleDate1 },
        { amfiCode: '122639', nav: 99, date: staleDate2 },
      ]);

      const prevNav = await MarketDataService.getPreviousNAV('122639', 105);
      expect(prevNav).toBe(0);
    });

    it('should return navs[0].nav as previous NAV when currentNav is newer and differs from navs[0]', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({ data: { data: [] } });

      const recentYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentDayBefore = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      (prisma.historicalNAV.findMany as jest.Mock).mockResolvedValue([
        { amfiCode: '122639', nav: 100, date: recentYesterday },
        { amfiCode: '122639', nav: 98, date: recentDayBefore },
      ]);

      // Today's live NAV is 102 (not yet in DB)
      const prevNav = await MarketDataService.getPreviousNAV('122639', 102);
      expect(prevNav).toBe(100);
    });

    it('should return navs[1].nav when currentNav matches navs[0] (already in DB)', async () => {
      (CacheService.get as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockResolvedValue({ data: { data: [] } });

      const recentToday = new Date();
      const recentYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      (prisma.historicalNAV.findMany as jest.Mock).mockResolvedValue([
        { amfiCode: '122639', nav: 102, date: recentToday },
        { amfiCode: '122639', nav: 100, date: recentYesterday },
      ]);

      // Today's live NAV is 102 (matches navs[0])
      const prevNav = await MarketDataService.getPreviousNAV('122639', 102);
      expect(prevNav).toBe(100);
    });
  });
});

