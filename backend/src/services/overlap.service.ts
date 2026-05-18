import { prisma } from './db.service';
import { MarketDataService } from './market-data.service';
import { PerformanceService } from './performance.service';
import { PortfolioUtils } from '../utils/portfolio.utils';

export interface StockExposure {
  name: string;
  sector: string;
  absoluteValue: number;
  percentage: number;
  contributions: {
    schemeName: string;
    value: number;
    weight: number;
  }[];
}

export interface FundOverlap {
  fundA: string;
  fundB: string;
  overlapPercentage: number;
  commonStocks: {
    name: string;
    weightA: number;
    weightB: number;
  }[];
}

export class OverlapService {
  /**
   * Calculates aggregated stock exposures for a portfolio.
   */
  public static async getPortfolioExposures(portfolioId: string, userId: string = 'mock-user-123'): Promise<StockExposure[]> {
    let portfolios: any[] = [];

    if (portfolioId === 'consolidated') {
      portfolios = await prisma.portfolio.findMany({
        where: { userId },
        include: {
          folios: {
            include: { asset: true, transactions: { orderBy: { date: 'asc' } } },
          },
        },
      });
    } else {
      const p = await prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: {
          folios: {
            include: { asset: true, transactions: { orderBy: { date: 'asc' } } },
          },
        },
      });

      if (p) {
        portfolios = [p];
      } else {
        portfolios = await prisma.portfolio.findMany({
          where: { managedProfileId: portfolioId },
          include: {
            folios: {
              include: { asset: true, transactions: { orderBy: { date: 'asc' } } },
            },
          },
        });
      }
    }

    if (portfolios.length === 0) throw new Error('Portfolio/Profile not found');

    const allFolios = portfolios.flatMap(p => p.folios);
    const stockMap: Record<string, StockExposure> = {};
    let totalPortfolioValue = 0;

    // 1. Calculate folio values and filter out closed positions in parallel
    const activeFolioData = await Promise.all(
      allFolios.map(async (folio) => {
        const currentUnits = PortfolioUtils.getLatestUnits(folio.transactions);
        if (currentUnits <= 0) return null;

        const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
        const currentPrice = liveNav > 0 ? liveNav : PortfolioUtils.getLatestNAV(folio.transactions);
        const folioValue = currentUnits * currentPrice;

        return { folio, folioValue };
      })
    );

    const validFolios = activeFolioData.filter((f): f is NonNullable<typeof f> => f !== null && f.folioValue > 0);
    totalPortfolioValue = validFolios.reduce((acc, f) => acc + f.folioValue, 0);

    // 2. Fetch all holdings in parallel
    const holdingsResults = await Promise.all(
      validFolios.map(async ({ folio, folioValue }) => {
        if (folio.asset.type === 'STOCK') {
           return { folio, folioValue, data: null };
        }
        if (!folio.asset.isin) return null;
        const data = await MarketDataService.getHoldings(folio.asset.isin);
        return { folio, folioValue, data };
      })
    );

    // 3. Aggregate results
    for (const result of holdingsResults) {
      const { folio, folioValue, data } = result || {};
      if (!folio) continue;

      if (folio.asset.type === 'STOCK') {
        // Individual Stock
        const name = folio.asset.name;
        const sector = 'Other'; 
        const absoluteValue = folioValue || 0;

        if (!stockMap[name]) {
          stockMap[name] = {
            name,
            sector,
            absoluteValue: 0,
            percentage: 0,
            contributions: [],
          };
        }

        stockMap[name].absoluteValue += absoluteValue;
        stockMap[name].contributions.push({
          schemeName: 'Direct Holding',
          value: absoluteValue,
          weight: 100,
        });
      } else if (data && data.holdings) {
        // Mutual Fund Holdings
        for (const holding of data.holdings) {
          const weight = parseFloat(holding.weightage) / 100;
          const absoluteValue = (folioValue || 0) * weight;

          if (!stockMap[holding.name]) {
            stockMap[holding.name] = {
              name: holding.name,
              sector: holding.sector || 'Other',
              absoluteValue: 0,
              percentage: 0,
              contributions: [],
            };
          }

          stockMap[holding.name].absoluteValue += absoluteValue;
          stockMap[holding.name].contributions.push({
            schemeName: folio.asset.name,
            value: absoluteValue,
            weight: weight * 100,
          });
        }
      }
    }

    // Calculate final percentages
    const exposures = Object.values(stockMap).map((exposure) => ({
      ...exposure,
      percentage: exposure.absoluteValue / (totalPortfolioValue || 1),
    }));

    return exposures.sort((a, b) => b.absoluteValue - a.absoluteValue);
  }

  /**
   * Calculates intersection between two specific funds.
   */
  public static async getFundOverlap(isinA: string, isinB: string): Promise<FundOverlap> {
    const [dataA, dataB] = await Promise.all([
      MarketDataService.getHoldings(isinA),
      MarketDataService.getHoldings(isinB),
    ]);

    if (!dataA || !dataB || !dataA.holdings || !dataB.holdings) {
      throw new Error('Holdings data not available for one or both funds');
    }

    const mapA: Record<string, number> = {};
    dataA.holdings.forEach((h: any) => (mapA[h.name] = parseFloat(h.weightage)));

    const commonStocks: any[] = [];
    let overlapPercentage = 0;

    dataB.holdings.forEach((hB: any) => {
      if (mapA[hB.name]) {
        const weightA = mapA[hB.name];
        const weightB = parseFloat(hB.weightage);
        const commonWeight = Math.min(weightA, weightB);
        overlapPercentage += commonWeight;
        commonStocks.push({
          name: hB.name,
          weightA,
          weightB,
        });
      }
    });

    return {
      fundA: dataA.schemeName,
      fundB: dataB.schemeName,
      overlapPercentage,
      commonStocks: commonStocks.sort((a, b) => Math.max(b.weightA, b.weightB) - Math.max(a.weightA, a.weightB)),
    };
  }
}
