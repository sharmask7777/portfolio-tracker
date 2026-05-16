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
  public static async getPortfolioExposures(portfolioId: string): Promise<StockExposure[]> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        folios: {
          include: { asset: true, transactions: { orderBy: { date: 'asc' } } },
        },
      },
    });

    if (!portfolio) throw new Error('Portfolio not found');

    const stockMap: Record<string, StockExposure> = {};
    let totalPortfolioValue = 0;

    // 1. Calculate folio values and filter out closed positions in parallel
    const activeFolioData = await Promise.all(
      portfolio.folios.map(async (folio) => {
        const currentUnits = PortfolioUtils.getLatestUnits(folio.transactions);
        if (currentUnits <= 0) return null;

        const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
        const currentPrice = liveNav > 0 ? liveNav : (lastTx?.nav || 0);
        const folioValue = currentUnits * currentPrice;

        return { folio, folioValue };
      })
    );

    const validFolios = activeFolioData.filter((f): f is NonNullable<typeof f> => f !== null && f.folioValue > 0);
    totalPortfolioValue = validFolios.reduce((acc, f) => acc + f.folioValue, 0);

    // 2. Fetch all holdings in parallel
    const holdingsResults = await Promise.all(
      validFolios.map(async ({ folio, folioValue }) => {
        if (!folio.asset.isin) return null;
        const data = await MarketDataService.getHoldings(folio.asset.isin);
        return { folio, folioValue, data };
      })
    );

    // 3. Aggregate results
    for (const result of holdingsResults) {
      if (!result || !result.data || !result.data.holdings) continue;
      const { folio, folioValue, data } = result;

      for (const holding of data.holdings) {
        const weight = parseFloat(holding.weightage) / 100;
        const absoluteValue = folioValue * weight;

        if (!stockMap[holding.name]) {
          stockMap[holding.name] = {
            name: holding.name,
            sector: holding.sector,
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

    // Calculate final percentages
    const exposures = Object.values(stockMap).map((exposure) => ({
      ...exposure,
      percentage: totalPortfolioValue > 0 ? (exposure.absoluteValue / totalPortfolioValue) : 0,
    }));

    // Sort by absolute value descending
    return exposures.sort((a, b) => b.absoluteValue - a.absoluteValue);
  }

  /**
   * Calculates overlap between two mutual funds.
   */
  public static async getFundOverlap(isinA: string, isinB: string): Promise<FundOverlap | null> {
    const [holdingsA, holdingsB] = await Promise.all([
      MarketDataService.getHoldings(isinA),
      MarketDataService.getHoldings(isinB),
    ]);

    if (!holdingsA || !holdingsB || !holdingsA.holdings || !holdingsB.holdings) return null;

    const commonStocks = [];
    let overlapPercentage = 0;

    const mapB: Record<string, number> = {};
    for (const h of holdingsB.holdings) {
      mapB[h.name] = parseFloat(h.weightage);
    }

    for (const hA of holdingsA.holdings) {
      const weightA = parseFloat(hA.weightage);
      const weightB = mapB[hA.name];

      if (weightB) {
        const minWeight = Math.min(weightA, weightB);
        overlapPercentage += minWeight;
        commonStocks.push({
          name: hA.name,
          weightA,
          weightB,
        });
      }
    }

    return {
      fundA: holdingsA.schemeName,
      fundB: holdingsB.schemeName,
      overlapPercentage,
      commonStocks: commonStocks.sort((a, b) => Math.max(b.weightA, b.weightB) - Math.max(a.weightA, a.weightB)),
    };
  }
}
