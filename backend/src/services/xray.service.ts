import { AssetType } from '@prisma/client';
import { prisma } from './db.service';
import { MarketDataService } from './market-data.service';
import { AlternativeAssetService } from './alternative-assets.service';
import { PortfolioUtils } from '../utils/portfolio.utils';

export interface XRayData {
  sectors: { name: string; percentage: number; value: number }[];
  marketCap: {
    large: { percentage: number; value: number };
    mid: { percentage: number; value: number };
    small: { percentage: number; value: number };
  };
  assetAllocation: {
    equity: { percentage: number; value: number };
    debt: { percentage: number; value: number };
    cash: { percentage: number; value: number };
    gold: { percentage: number; value: number };
    other: { percentage: number; value: number };
  };
  totalValue: number;
  exArbitrage?: {
    sectors: { name: string; percentage: number; value: number }[];
    marketCap: {
      large: { percentage: number; value: number };
      mid: { percentage: number; value: number };
      small: { percentage: number; value: number };
    };
    assetAllocation: {
      equity: { percentage: number; value: number };
      debt: { percentage: number; value: number };
      cash: { percentage: number; value: number };
      gold: { percentage: number; value: number };
      arbitrage: { percentage: number; value: number };
      other: { percentage: number; value: number };
    };
  };
}

export class XRayService {
  public static async getXRayData(portfolioId: string, userId: string): Promise<XRayData> {
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
      // Try fetching as portfolio ID first
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
        // Fallback: Check if it's a profile ID
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

    let totalPortfolioValue = 0;
    
    // 1. Calculate values for all folios in parallel
    const folioCalculations = await Promise.all(
      allFolios.map(async (folio) => {
        const currentUnits = PortfolioUtils.getLatestUnits(folio.transactions);
        if (currentUnits <= 0) return null;

        let value = 0;
        if (folio.asset.type === 'MUTUAL_FUND' || folio.asset.type === 'STOCK') {
          const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
          const currentPrice = liveNav > 0 ? liveNav : PortfolioUtils.getLatestNAV(folio.transactions);
          value = currentUnits * currentPrice;
        } else {
          const lastTx = folio.transactions[folio.transactions.length - 1];
          const alt = await AlternativeAssetService.calculateValue(folio.asset.type, currentUnits, lastTx?.date);
          value = alt.currentValue;
        }

        return value > 0 ? {
          isin: folio.asset.isin || '',
          amfi: folio.asset.amfiCode || '',
          value,
          type: folio.asset.type,
          name: folio.asset.name
        } : null;
      })
    );

    const folioValues = folioCalculations.filter((v): v is NonNullable<typeof v> => v !== null);
    totalPortfolioValue = folioValues.reduce((acc, fv) => acc + fv.value, 0);

    const sectorMap: Record<string, number> = {};
    const marketCap = { large: 0, mid: 0, small: 0 };
    const assetAllocation = { equity: 0, debt: 0, cash: 0, gold: 0, other: 0 };

    const exArbSectorMap: Record<string, number> = {};
    const exArbMarketCap = { large: 0, mid: 0, small: 0 };
    const exArbAssetAllocation = { equity: 0, debt: 0, cash: 0, gold: 0, arbitrage: 0, other: 0 };

    // 2. Fetch all holdings in parallel
    const holdingsResults = await Promise.all(
      folioValues.map(async (fv) => {
        if (fv.type === 'MUTUAL_FUND' || fv.type === 'STOCK') {
          const data = await MarketDataService.getHoldings(fv.isin);
          
          // FINANCIAL INTELLIGENCE: Persist fund-specific exit load rules (REQ-12.1)
          if (data?.exitLoadMessage && fv.isin) {
            prisma.asset.update({
              where: { isin: fv.isin },
              data: { exitLoadMetadata: data.exitLoadMessage }
            }).catch(err => console.error(`Failed to update exit load metadata for ${fv.isin}:`, err));
          }

          return { fv, data };
        }
        return { fv, data: null };
      })
    );

    // 3. Aggregate from holdings data
    for (const { fv, data } of holdingsResults) {
      const weightFactor = fv.value / (totalPortfolioValue || 1);
      const isArbitrage = fv.type === 'MUTUAL_FUND' && (fv.name?.toLowerCase().includes('arbitrage') || false);

      if (fv.type === 'MUTUAL_FUND' || fv.type === 'STOCK') {
        if (!data) {
          if (isArbitrage) {
            assetAllocation.debt += 100 * weightFactor;
            exArbAssetAllocation.arbitrage += 100 * weightFactor;
          } else {
            assetAllocation.equity += 100 * weightFactor;
            exArbAssetAllocation.equity += 100 * weightFactor;
          }
          continue;
        }

        if (data.sectors) {
          for (const s of data.sectors) {
            let sName = s.sector || s.name || s.sectorName;
            sName = this.normalizeSector(sName);
            const sWeight = parseFloat(s.weightage || s.percent || '0');
            sectorMap[sName] = (sectorMap[sName] || 0) + sWeight * weightFactor;
            if (!isArbitrage) {
              exArbSectorMap[sName] = (exArbSectorMap[sName] || 0) + sWeight * weightFactor;
            }
          }
        }

        if (data.portfolio?.marketCapWeightage) {
          const mc = data.portfolio.marketCapWeightage;
          marketCap.large += parseFloat(mc.largeCap || mc.giant || '0') * weightFactor;
          marketCap.mid += parseFloat(mc.midCap || '0') * weightFactor;
          marketCap.small += parseFloat(mc.smallCap || mc.tiny || '0') * weightFactor;
          if (!isArbitrage) {
            exArbMarketCap.large += parseFloat(mc.largeCap || mc.giant || '0') * weightFactor;
            exArbMarketCap.mid += parseFloat(mc.midCap || '0') * weightFactor;
            exArbMarketCap.small += parseFloat(mc.smallCap || mc.tiny || '0') * weightFactor;
          }
        } else if (fv.type === 'STOCK') {
          // Default individual stocks to Large Cap if no data
          marketCap.large += 100 * weightFactor;
          exArbMarketCap.large += 100 * weightFactor;
        }

        if (isArbitrage) {
          // Arbitrage funds are equity funds but behave like debt.
          // From the exposure POV, they are considered equivalents to debt.
          // So they count as debt allocation in standard asset allocation (decreasing equity exposure).
          assetAllocation.debt += 100 * weightFactor;
          exArbAssetAllocation.arbitrage += 100 * weightFactor;
        } else if (data.portfolio?.assetAllocation) {
          const aa = data.portfolio.assetAllocation;
          assetAllocation.equity += Math.max(0, parseFloat(aa.equity || aa.equityAllocation || '0')) * weightFactor;
          assetAllocation.debt += Math.max(0, parseFloat(aa.debt || aa.debtAllocation || '0')) * weightFactor;
          assetAllocation.cash += Math.max(0, parseFloat(aa.cash || aa.cashAllocation || '0')) * weightFactor;
          assetAllocation.other += Math.max(0, parseFloat(aa.other || aa.otherAllocation || '0')) * weightFactor;

          exArbAssetAllocation.equity += Math.max(0, parseFloat(aa.equity || aa.equityAllocation || '0')) * weightFactor;
          exArbAssetAllocation.debt += Math.max(0, parseFloat(aa.debt || aa.debtAllocation || '0')) * weightFactor;
          exArbAssetAllocation.cash += Math.max(0, parseFloat(aa.cash || aa.cashAllocation || '0')) * weightFactor;
          exArbAssetAllocation.other += Math.max(0, parseFloat(aa.other || aa.otherAllocation || '0')) * weightFactor;
        } else if (fv.type === 'STOCK') {
          assetAllocation.equity += 100 * weightFactor;
          exArbAssetAllocation.equity += 100 * weightFactor;
        }
      }
 else {
        if (fv.type === AssetType.EPF || fv.type === AssetType.PPF || fv.type === AssetType.FIXED_DEPOSIT) {
          assetAllocation.debt += 100 * weightFactor;
          exArbAssetAllocation.debt += 100 * weightFactor;
        } else if (fv.type === AssetType.SGB || fv.type === AssetType.PHYSICAL_GOLD) {
          assetAllocation.gold += 100 * weightFactor;
          exArbAssetAllocation.gold += 100 * weightFactor;
        }
      }
    }

    return {
      totalValue: totalPortfolioValue,
      sectors: Object.entries(sectorMap)
        .map(([name, percentage]) => ({
          name,
          percentage: percentage / 100,
          value: (percentage / 100) * totalPortfolioValue,
        }))
        .sort((a, b) => b.percentage - a.percentage),
      marketCap: {
        large: { percentage: marketCap.large / 100, value: (marketCap.large / 100) * totalPortfolioValue },
        mid: { percentage: marketCap.mid / 100, value: (marketCap.mid / 100) * totalPortfolioValue },
        small: { percentage: marketCap.small / 100, value: (marketCap.small / 100) * totalPortfolioValue },
      },
      assetAllocation: {
        equity: { percentage: assetAllocation.equity / 100, value: (assetAllocation.equity / 100) * totalPortfolioValue },
        debt: { percentage: assetAllocation.debt / 100, value: (assetAllocation.debt / 100) * totalPortfolioValue },
        cash: { percentage: assetAllocation.cash / 100, value: (assetAllocation.cash / 100) * totalPortfolioValue },
        gold: { percentage: assetAllocation.gold / 100, value: (assetAllocation.gold / 100) * totalPortfolioValue },
        other: { percentage: assetAllocation.other / 100, value: (assetAllocation.other / 100) * totalPortfolioValue },
      },
      exArbitrage: {
        sectors: Object.entries(exArbSectorMap)
          .map(([name, percentage]) => ({
            name,
            percentage: percentage / 100,
            value: (percentage / 100) * totalPortfolioValue,
          }))
          .sort((a, b) => b.percentage - a.percentage),
        marketCap: {
          large: { percentage: exArbMarketCap.large / 100, value: (exArbMarketCap.large / 100) * totalPortfolioValue },
          mid: { percentage: exArbMarketCap.mid / 100, value: (exArbMarketCap.mid / 100) * totalPortfolioValue },
          small: { percentage: exArbMarketCap.small / 100, value: (exArbMarketCap.small / 100) * totalPortfolioValue },
        },
        assetAllocation: {
          equity: { percentage: exArbAssetAllocation.equity / 100, value: (exArbAssetAllocation.equity / 100) * totalPortfolioValue },
          debt: { percentage: exArbAssetAllocation.debt / 100, value: (exArbAssetAllocation.debt / 100) * totalPortfolioValue },
          cash: { percentage: exArbAssetAllocation.cash / 100, value: (exArbAssetAllocation.cash / 100) * totalPortfolioValue },
          gold: { percentage: exArbAssetAllocation.gold / 100, value: (exArbAssetAllocation.gold / 100) * totalPortfolioValue },
          arbitrage: { percentage: exArbAssetAllocation.arbitrage / 100, value: (exArbAssetAllocation.arbitrage / 100) * totalPortfolioValue },
          other: { percentage: exArbAssetAllocation.other / 100, value: (exArbAssetAllocation.other / 100) * totalPortfolioValue },
        },
      }
    };
  }

  private static normalizeSector(name: any): string {
    if (typeof name !== 'string') return 'Other';
    const map: Record<string, string> = {
      'Financial': 'Financial Services',
      'Banking': 'Financial Services',
      'Finance': 'Financial Services',
      'FMCG': 'Consumer Goods',
      'Consumer Non-Durables': 'Consumer Goods',
      'Information Technology': 'Technology',
      'IT': 'Technology',
      'Pharma': 'Healthcare',
      'Pharmaceuticals': 'Healthcare',
      'Automobile': 'Automotive',
      'Auto': 'Automotive',
    };
    const trimmed = name.trim();
    return map[trimmed] || trimmed;
  }
}
