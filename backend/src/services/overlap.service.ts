import { prisma } from './db.service';
import { MarketDataService } from './market-data.service';
import { PortfolioUtils } from '../utils/portfolio.utils';
import { FamilyService } from './family.service';
import { AlternativeAssetService } from './alternative-assets.service';
import { normalizeStockName, TOP_INDIAN_STOCKS_SECTOR_MAP } from './holdings.registry';

export interface StockContribution {
  schemeName: string;
  value: number;
  weight: number; // Stored as percentage within the fund (e.g. 8.5 for 8.5%)
}

export interface StockExposure {
  name: string;
  sector: string;
  absoluteValue: number;
  percentage: number; // Stored as fraction of total portfolio (0 to 1)
  contributions: StockContribution[];
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
   * Calculates aggregated stock exposures for a portfolio, profile, or family group scope.
   */
  public static async getPortfolioExposures(portfolioId: string, userId: string): Promise<StockExposure[]> {
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
      // 1. Check if portfolioId matches an authorized FamilyGroup
      const familyMembership = await prisma.familyMember.findFirst({
        where: { groupId: portfolioId, userId },
      });

      if (familyMembership) {
        portfolios = await FamilyService.getFamilyPortfolios(portfolioId);
      } else {
        // 2. Check if portfolioId matches a single portfolio owned by the user
        const singlePortfolio = await prisma.portfolio.findFirst({
          where: { id: portfolioId, userId },
          include: {
            folios: {
              include: { asset: true, transactions: { orderBy: { date: 'asc' } } },
            },
          },
        });

        if (singlePortfolio) {
          portfolios = [singlePortfolio];
        } else {
          // 3. Check if portfolioId matches a managed profile owned by the user
          portfolios = await prisma.portfolio.findMany({
            where: { managedProfileId: portfolioId, userId },
            include: {
              folios: {
                include: { asset: true, transactions: { orderBy: { date: 'asc' } } },
              },
            },
          });
        }
      }
    }

    // Return empty array gracefully if no portfolios or unauthorized scope
    if (!portfolios || portfolios.length === 0) {
      return [];
    }

    const allFolios = portfolios.flatMap((p) => p.folios || []);
    if (allFolios.length === 0) {
      return [];
    }

    // 1. Calculate active folio values with positive units and NAVs
    const activeFolioData = await Promise.all(
      allFolios.map(async (folio) => {
        const currentUnits = PortfolioUtils.getLatestUnits(folio.transactions);
        if (currentUnits <= 0) return null;

        let folioValue = 0;
        if (folio.asset.type === 'MUTUAL_FUND') {
          const liveNav = folio.asset.amfiCode ? await MarketDataService.getLatestNAV(folio.asset.amfiCode) : 0;
          let currentPrice = liveNav > 0 ? liveNav : PortfolioUtils.getLatestNAV(folio.transactions);
          if (currentPrice <= 0) {
            const lastTx = folio.transactions[folio.transactions.length - 1];
            if (lastTx && lastTx.amount > 0 && lastTx.units > 0) {
              currentPrice = lastTx.amount / lastTx.units;
            } else {
              const totalInvested = PortfolioUtils.getTotalInvested(folio.transactions);
              currentPrice = totalInvested > 0 ? totalInvested / currentUnits : 10;
            }
          }
          folioValue = currentUnits * currentPrice;
        } else if (folio.asset.type === 'STOCK') {
          let currentPrice = PortfolioUtils.getLatestNAV(folio.transactions);
          if (currentPrice <= 0) {
            const lastTx = folio.transactions[folio.transactions.length - 1];
            if (lastTx && lastTx.amount > 0 && lastTx.units > 0) {
              currentPrice = lastTx.amount / lastTx.units;
            } else {
              const totalInvested = PortfolioUtils.getTotalInvested(folio.transactions);
              currentPrice = totalInvested > 0 ? totalInvested / currentUnits : 100;
            }
          }
          folioValue = currentUnits * currentPrice;
        } else {
          // Alternative Assets (EPF, PPF, Gold, Real Estate, etc.)
          const lastTx = folio.transactions[folio.transactions.length - 1];
          const alt = await AlternativeAssetService.calculateValue(folio.asset.type, currentUnits, lastTx?.date);
          folioValue = alt.currentValue;
        }

        return folioValue > 0 ? { folio, folioValue } : null;
      })
    );

    const validFolios = activeFolioData.filter((f): f is NonNullable<typeof f> => f !== null && f.folioValue > 0);
    const totalPortfolioValue = validFolios.reduce((acc, f) => acc + f.folioValue, 0);

    // Guard against non-positive portfolio value
    if (totalPortfolioValue <= 0) {
      return [];
    }

    // 2. Fetch underlying holdings for equity mutual funds and stocks in parallel
    const holdingsResults = await Promise.all(
      validFolios.map(async ({ folio, folioValue }) => {
        if (folio.asset.type === 'STOCK') {
          return { folio, folioValue, data: null };
        }
        if (folio.asset.type !== 'MUTUAL_FUND' || (!folio.asset.isin && !folio.asset.name)) {
          return null;
        }
        const data = await MarketDataService.getHoldings(folio.asset.isin || '', folio.asset.name);
        return { folio, folioValue, data };
      })
    );

    // 3. Aggregate results with deterministic stock name normalization
    const stockMap: Record<string, { exposure: StockExposure; canonicalName: string }> = {};

    for (const result of holdingsResults) {
      if (!result) continue;
      const { folio, folioValue, data } = result;

      if (folio.asset.type === 'STOCK') {
        // Direct individual stock holding
        const rawName = folio.asset.name;
        const normKey = normalizeStockName(rawName);
        const lookup = TOP_INDIAN_STOCKS_SECTOR_MAP[normKey] || TOP_INDIAN_STOCKS_SECTOR_MAP[folio.asset.symbol?.toUpperCase() || ''];
        const canonicalName = lookup?.canonicalName || rawName;
        const sector = lookup?.sector || 'Other';
        const absoluteValue = folioValue;

        if (!stockMap[normKey]) {
          stockMap[normKey] = {
            canonicalName,
            exposure: {
              name: canonicalName,
              sector,
              absoluteValue: 0,
              percentage: 0,
              contributions: [],
            },
          };
        }

        stockMap[normKey].exposure.absoluteValue += absoluteValue;
        if (stockMap[normKey].exposure.sector === 'Other' && sector !== 'Other') {
          stockMap[normKey].exposure.sector = sector;
        }
        stockMap[normKey].exposure.contributions.push({
          schemeName: 'Direct Holding',
          value: absoluteValue,
          weight: 100,
        });
      } else if (data && Array.isArray(data.holdings)) {
        // Mutual Fund underlying constituent holdings
        for (const holding of data.holdings) {
          const rawName = holding.name;
          const normKey = normalizeStockName(rawName);
          const lookup = TOP_INDIAN_STOCKS_SECTOR_MAP[normKey];
          const canonicalName = lookup?.canonicalName || rawName;
          const sector = holding.sector && holding.sector !== 'Other' ? holding.sector : (lookup?.sector || 'Other');
          const rawWeight = (holding as any).weightage ?? (holding as any).weight ?? (holding as any).percentage ?? 0;
          const weightVal = typeof rawWeight === 'number' ? rawWeight : parseFloat(String(rawWeight));
          const weightPercent = isNaN(weightVal) ? 0 : weightVal;
          const weightFraction = weightPercent / 100;
          const absoluteValue = folioValue * weightFraction;

          if (!stockMap[normKey]) {
            stockMap[normKey] = {
              canonicalName,
              exposure: {
                name: canonicalName,
                sector,
                absoluteValue: 0,
                percentage: 0,
                contributions: [],
              },
            };
          }

          stockMap[normKey].exposure.absoluteValue += absoluteValue;
          if (stockMap[normKey].exposure.sector === 'Other' && sector !== 'Other') {
            stockMap[normKey].exposure.sector = sector;
          }
          stockMap[normKey].exposure.contributions.push({
            schemeName: folio.asset.name,
            value: absoluteValue,
            weight: weightPercent,
          });
        }
      }
    }

    // 4. Calculate final portfolio percentages and sort descending by exposure value
    const exposures = Object.values(stockMap).map(({ exposure }) => ({
      ...exposure,
      percentage: totalPortfolioValue > 0 ? exposure.absoluteValue / totalPortfolioValue : 0,
    }));

    return exposures.sort((a, b) => b.absoluteValue - a.absoluteValue);
  }

  /**
   * Calculates intersection between two specific mutual funds.
   */
  public static async getFundOverlap(isinA: string, isinB: string): Promise<FundOverlap> {
    const [dataA, dataB] = await Promise.all([
      MarketDataService.getHoldings(isinA),
      MarketDataService.getHoldings(isinB),
    ]);

    const nameA = dataA?.schemeName || isinA;
    const nameB = dataB?.schemeName || isinB;

    if (
      !dataA ||
      !dataB ||
      !Array.isArray(dataA.holdings) ||
      !Array.isArray(dataB.holdings) ||
      dataA.holdings.length === 0 ||
      dataB.holdings.length === 0
    ) {
      return {
        fundA: nameA,
        fundB: nameB,
        overlapPercentage: 0,
        commonStocks: [],
      };
    }

    const mapA: Record<string, { rawWeight: number; name: string }> = {};
    dataA.holdings.forEach((h: any) => {
      const normKey = normalizeStockName(h.name);
      mapA[normKey] = { rawWeight: parseFloat(h.weightage) || 0, name: h.name };
    });

    const commonStocks: any[] = [];
    let overlapPercentage = 0;

    dataB.holdings.forEach((hB: any) => {
      const normKey = normalizeStockName(hB.name);
      if (mapA[normKey]) {
        const weightA = mapA[normKey].rawWeight;
        const weightB = parseFloat(hB.weightage) || 0;
        const commonWeight = Math.min(weightA, weightB);
        overlapPercentage += commonWeight;
        commonStocks.push({
          name: mapA[normKey].name,
          weightA,
          weightB,
        });
      }
    });

    return {
      fundA: nameA,
      fundB: nameB,
      overlapPercentage,
      commonStocks: commonStocks.sort((a, b) => Math.max(b.weightA, b.weightB) - Math.max(a.weightA, a.weightB)),
    };
  }
}
