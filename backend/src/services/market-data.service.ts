import axios from 'axios';
import { CacheService } from './cache.service';
import { prisma } from './db.service';
import { resolveCuratedOrTemplateHoldings, normalizeStockName } from './holdings.registry';

export interface NAVChangeResult {
  currentPrice: number;
  previousPrice: number;
  change: number;
  changePercentage: number;
  currentDate: string;
  previousDate: string;
}

export class MarketDataService {
  private static MFAPI_BASE = 'https://api.mfapi.in/mf';
  private static FINAPI_BASE = 'https://finapi.upvaly.com/api/mf';
  private static GOLD_API_URL = 'https://api.gold-api.com/price/XAU/INR';
  private static TROY_OUNCE_TO_GRAMS = 31.1034768;

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

  private static navChangeInFlight = new Map<string, Promise<NAVChangeResult | null>>();

  /**
   * Fetches latest and previous trading day NAVs atomically for a mutual fund from MFAPI.
   */
  public static async getNAVChange(amfiCode: string): Promise<NAVChangeResult | null> {
    if (!amfiCode) return null;
    const cacheKey = `nav_change:${amfiCode}`;
    const cached = await CacheService.get<NAVChangeResult | 'NULL'>(cacheKey);
    if (cached === 'NULL') return null;
    if (cached) return cached as NAVChangeResult;

    if (this.navChangeInFlight.has(amfiCode)) {
      return this.navChangeInFlight.get(amfiCode)!;
    }

    const fetchPromise = (async () => {
      try {
        const response = await axios.get(`${this.MFAPI_BASE}/${amfiCode}`, { timeout: 8000 });
        const data = response.data?.data;
        if (!data || !Array.isArray(data) || data.length < 2) {
          await CacheService.set(cacheKey, 'NULL', 60);
          return null;
        }

        const currentPrice = parseFloat(data[0].nav);
        const previousPrice = parseFloat(data[1].nav);

        if (isNaN(currentPrice) || isNaN(previousPrice) || previousPrice <= 0 || currentPrice <= 0) {
          await CacheService.set(cacheKey, 'NULL', 60);
          return null;
        }

        const change = currentPrice - previousPrice;
        const changePercentage = ((currentPrice - previousPrice) / previousPrice) * 100;

        const result: NAVChangeResult = {
          currentPrice,
          previousPrice,
          change,
          changePercentage,
          currentDate: data[0].date,
          previousDate: data[1].date,
        };

        await CacheService.set(cacheKey, result, 3600); // 1h cache
        await CacheService.set(`nav:${amfiCode}`, currentPrice, 3600);
        return result;
      } catch (e) {
        console.error(`Failed to fetch NAV change for ${amfiCode}:`, e);
        await CacheService.set(cacheKey, 'NULL', 60); // 60s negative cache to prevent cascading timeouts
        return null;
      } finally {
        this.navChangeInFlight.delete(amfiCode);
      }
    })();

    this.navChangeInFlight.set(amfiCode, fetchPromise);
    return fetchPromise;
  }

  /**
   * Fetches the latest NAV for a mutual fund.
   */
  public static async getLatestNAV(amfiCode: string): Promise<number> {
    if (!amfiCode) return 0;
    const cacheKey = `nav:${amfiCode}`;
    const cached = await CacheService.get<number>(cacheKey);
    if (cached !== null) return cached;

    const navChange = await this.getNAVChange(amfiCode);
    if (navChange && navChange.currentPrice > 0) {
      return navChange.currentPrice;
    }

    try {
      const response = await axios.get(`${this.MFAPI_BASE}/${amfiCode}/latest`, { timeout: 5000 });
      const nav = parseFloat(response.data?.data?.[0]?.nav);
      
      if (!isNaN(nav) && nav > 0) {
        await CacheService.set(cacheKey, nav, 86400);
        return nav;
      }
    } catch (e) {
      console.error(`Failed to fetch NAV for ${amfiCode}:`, e);
    }
    return 0;
  }

  public static async getPreviousNAV(amfiCode: string, currentNav?: number | Date): Promise<number> {
    if (!amfiCode) return 0;

    const navChange = await this.getNAVChange(amfiCode);
    if (navChange && navChange.previousPrice > 0) {
      return navChange.previousPrice;
    }

    try {
      const navs = await prisma.historicalNAV.findMany({
        where: { amfiCode },
        orderBy: { date: 'desc' },
        take: 2
      });

      if (navs.length < 2) return 0;

      // Ensure historical records are within a reasonable recency window (within 7 days of now, and records within 7 days of each other)
      const now = Date.now();
      const ageDays = Math.abs(now - navs[0].date.getTime()) / (1000 * 60 * 60 * 24);
      const diffDays = Math.abs(navs[0].date.getTime() - navs[1].date.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 7 || diffDays > 7) return 0;

      if (typeof currentNav === 'number') {
        // If currentNav matches the latest DB NAV (navs[0]), then navs[0] is current and navs[1] is previous
        if (Math.abs(navs[0].nav - currentNav) < 0.0001) {
          return navs[1].nav;
        }
        // If currentNav differs from navs[0] and navs[0] is recent, then navs[0] is the previous trading day's NAV
        return navs[0].nav;
      }

      return navs[1].nav;
    } catch (e) {
      console.error(`Failed to fetch previous NAV for ${amfiCode}:`, e);
      return 0;
    }
  }

  /**
   * Fetches underlying portfolio holdings and sector breakdown.
   */
  public static async getHoldings(isin?: string, schemeName?: string, category?: string): Promise<any> {
    if (!isin && !schemeName) return null;
    const isSynthetic = !isin || isin.startsWith('MISSING-');
    const cacheKey = isSynthetic
      ? (schemeName ? `holdings:name:${normalizeStockName(schemeName)}` : `holdings:${isin}`)
      : `holdings:${isin}`;

    const cached = await CacheService.get<any>(cacheKey);
    // Stale/invalid cache guard: only return cached data if it actually contains a valid holdings array.
    if (cached && Array.isArray(cached.holdings)) {
      return cached;
    }

    let externalData: any = null;
    if (!isSynthetic && isin) {
      try {
        const response = await axios.get(`${this.FINAPI_BASE}/isin/${isin}`, { timeout: 3000 });
        externalData = response.data?.data;
      } catch (e) {
        // Gracefully fall through to curated and category templates
      }
    }

    // If external API provided valid holdings array, enrich missing expenseRatio and cache
    if (externalData && Array.isArray(externalData.holdings) && externalData.holdings.length > 0) {
      if (!externalData.expenseRatio || externalData.expenseRatio === 0) {
        const cat = (externalData.category || externalData.schemeCategoryLabel || '').toLowerCase();
        if (cat.includes('equity')) externalData.expenseRatio = 0.8;
        else if (cat.includes('debt')) externalData.expenseRatio = 0.4;
        else if (cat.includes('hybrid')) externalData.expenseRatio = 0.6;
        else if (cat.includes('index')) externalData.expenseRatio = 0.2;
        else externalData.expenseRatio = 0.7;
      }
      await CacheService.set(cacheKey, externalData, 86400 * 7);
      return externalData;
    }

    // Tier 1 / Tier 2 / Tier 3 Enrichment via holdings.registry
    const effectiveSchemeName = externalData?.schemeName || cached?.schemeName || schemeName || '';
    const effectiveCategory = externalData?.schemeCategoryLabel || externalData?.category || cached?.schemeCategoryLabel || cached?.category || category || '';
    const enriched = resolveCuratedOrTemplateHoldings(isin || '', effectiveSchemeName, effectiveCategory);

    // Merge external metadata if available (preserving isin, schemeCode, etc.)
    const finalResult = {
      ...(externalData || {}),
      ...(cached || {}),
      ...enriched,
      isin: externalData?.isin || cached?.isin || isin || '',
    };

    await CacheService.set(cacheKey, finalResult, 86400 * 7);
    return finalResult;
  }

  /**
   * Fetches the latest gold price per gram in INR.
   */
  public static async getGoldPrice(): Promise<number> {
    const cacheKey = 'gold_price_inr';
    const cached = await CacheService.get<number>(cacheKey);
    if (cached !== null) return cached;

    try {
      const response = await axios.get(this.GOLD_API_URL, { timeout: 10000 });
      const pricePerOunceINR = parseFloat(response.data?.price);
      
      if (!isNaN(pricePerOunceINR) && pricePerOunceINR > 0) {
        const inrPricePerGram = pricePerOunceINR / this.TROY_OUNCE_TO_GRAMS;
        await CacheService.set(cacheKey, inrPricePerGram, 3600); // 1h cache
        return inrPricePerGram;
      }
      throw new Error(`Invalid gold price payload from API: ${JSON.stringify(response.data)}`);
    } catch (e) {
      console.error('Failed to fetch gold price:', e);
      return 0;
    }
  }
}
