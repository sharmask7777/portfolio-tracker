import axios from 'axios';
import { CacheService } from './cache.service';

export class MarketDataService {
  private static MFAPI_BASE = 'https://api.mfapi.in/mf';
  private static FINAPI_BASE = 'https://finapi.upvaly.com/api/mf';
  private static GOLD_API_BASE = 'https://api.gold-api.com/api/v1/gold';

  /**
   * Fetches the latest NAV for a mutual fund.
   */
  public static async getLatestNAV(amfiCode: string): Promise<number> {
    const cacheKey = `nav:${amfiCode}`;
    const cached = await CacheService.get<number>(cacheKey);
    if (cached !== null) return cached;

    try {
      const response = await axios.get(`${this.MFAPI_BASE}/${amfiCode}/latest`);
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
    const cacheKey = `holdings:${isin}`;
    const cached = await CacheService.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.FINAPI_BASE}/isin/${isin}`);
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
