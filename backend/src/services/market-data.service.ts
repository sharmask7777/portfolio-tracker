import axios from 'axios';
import { CacheService } from './cache.service';
import { prisma } from './db.service';

export class MarketDataService {
  private static MFAPI_BASE = 'https://api.mfapi.in/mf';
  private static FINAPI_BASE = 'https://finapi.upvaly.com/api/mf';
  private static GOLD_API_BASE = 'https://api.gold-api.com/api/v1/gold';

  /**
   * Fetches historical NAVs for a mutual fund and caches them in the database.
   */
  public static async getHistoricalNAVs(amfiCode: string, startDate?: Date): Promise<void> {
    if (!amfiCode) return;

    try {
      const response = await axios.get(`${this.MFAPI_BASE}/${amfiCode}`, { timeout: 15000 });
      const data = response.data.data;

      if (!data || !Array.isArray(data)) return;

      const records = data.map((item: any) => {
        const [day, month, year] = item.date.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return {
          amfiCode,
          date,
          nav: parseFloat(item.nav),
        };
      }).filter((r: any) => !isNaN(r.nav));

      // Filter by startDate if provided
      const filteredRecords = startDate 
        ? records.filter(r => r.date >= startDate)
        : records;

      // Upsert in bulk (Prisma doesn't support bulk upsert well, so we do it in a loop or use createMany with skipDuplicates)
      // Since we want to update if NAV changed (unlikely but possible) or just ensure it exists.
      // createMany with skipDuplicates is efficient for initial seeding.
      await prisma.historicalNAV.createMany({
        data: filteredRecords,
        skipDuplicates: true,
      });

    } catch (e) {
      console.error(`Failed to fetch historical NAVs for ${amfiCode}:`, e);
    }
  }

  /**
   * Fetches the latest NAV for a mutual fund.
   */
  public static async getLatestNAV(amfiCode: string): Promise<number> {
    if (!amfiCode) return 0;
    const cacheKey = `nav:${amfiCode}`;
    const cached = await CacheService.get<number>(cacheKey);
    if (cached !== null) return cached;

    try {
      const response = await axios.get(`${this.MFAPI_BASE}/${amfiCode}/latest`, { timeout: 5000 });
      const nav = parseFloat(response.data.data[0].nav);
      
      if (!isNaN(nav)) {
        await CacheService.set(cacheKey, nav, 86400); // 24h cache
        return nav;
      }
    } catch (e) {
      console.error(`Failed to fetch NAV for ${amfiCode}:`, e);
    }
    return 0;
  }

  /**
   * Fetches underlying portfolio holdings and sector breakdown.
   */
  public static async getHoldings(isin: string): Promise<any> {
    if (!isin) return null;
    const cacheKey = `holdings:${isin}`;
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.FINAPI_BASE}/isin/${isin}`, { timeout: 10000 });
      const holdings = response.data.data;

      if (holdings) {
        await CacheService.set(cacheKey, holdings, 86400 * 7); // Cache holdings for 7 days
        return holdings;
      }
    } catch (e) {
      console.error(`Failed to fetch holdings for ${isin}:`, e);
    }
    return null;
  }

  /**
   * Fetches the latest gold price per gram in INR.
   */
  public static async getGoldPrice(): Promise<number> {
    const cacheKey = 'gold_price_inr';
    const cached = await CacheService.get<number>(cacheKey);
    if (cached !== null) return cached;

    try {
      // For MVP, we'll use a realistic rate if the public one is flaky
      // Gold-API often requires specific headers or has region limits
      const response = await axios.get(`${this.GOLD_API_BASE}`);
      const goldPricePerGram = response.data.price / 31.1035; // Convert Ounce to Gram
      
      // Convert to INR (Assume 1 USD = 84 INR for now if needed, or better, fetch from API)
      const inrPrice = goldPricePerGram * 84; 

      await CacheService.set(cacheKey, inrPrice, 3600); // 1h cache
      return inrPrice;
    } catch (e) {
      console.error('Failed to fetch gold price:', e);
      return 7500; // Realistic fallback for 24k gold per gram in INR
    }
  }
}
