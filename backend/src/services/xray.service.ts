import { prisma } from './db.service';
import { MarketDataService } from './market-data.service';

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
    other: { percentage: number; value: number };
  };
  totalValue: number;
}

export class XRayService {
  public static async getXRayData(portfolioId: string): Promise<XRayData> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        folios: {
          include: { asset: true, transactions: { orderBy: { date: 'asc' } } },
        },
      },
    });

    if (!portfolio) throw new Error('Portfolio not found');

    let totalPortfolioValue = 0;
    const folioValues: { isin: string; amfi: string; value: number }[] = [];

    // 1. Calculate values for all folios
    for (const folio of portfolio.folios) {
      const lastTx = folio.transactions[folio.transactions.length - 1];
      const currentUnits = lastTx?.balance || 0;
      const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
      const currentPrice = liveNav > 0 ? liveNav : (lastTx?.nav || 0);
      const value = currentUnits * currentPrice;

      if (value > 0 && folio.asset.isin) {
        totalPortfolioValue += value;
        folioValues.push({ isin: folio.asset.isin, amfi: folio.asset.amfiCode || '', value });
      }
    }

    const sectorMap: Record<string, number> = {};
    const marketCap = { large: 0, mid: 0, small: 0 };
    const assetAllocation = { equity: 0, debt: 0, cash: 0, other: 0 };

    // 2. Aggregate from holdings data
    for (const fv of folioValues) {
      const data = await MarketDataService.getHoldings(fv.isin);
      if (!data) continue;

      const weightFactor = fv.value / totalPortfolioValue;

      // Sector Aggregation
      if (data.sectors) {
        for (const s of data.sectors) {
          const sName = s.name || s.sectorName;
          const sWeight = parseFloat(s.weightage || s.percent || '0');
          sectorMap[sName] = (sectorMap[sName] || 0) + sWeight * weightFactor;
        }
      }

      // Market Cap Aggregation
      if (data.portfolio?.marketCapWeightage) {
        const mc = data.portfolio.marketCapWeightage;
        marketCap.large += parseFloat(mc.largeCap || mc.giant || '0') * weightFactor;
        marketCap.mid += parseFloat(mc.midCap || '0') * weightFactor;
        marketCap.small += parseFloat(mc.smallCap || mc.tiny || '0') * weightFactor;
      } else if (data.marketCapWeightage) {
          const mc = data.marketCapWeightage;
          marketCap.large += parseFloat(mc.largeCap || mc.giant || '0') * weightFactor;
          marketCap.mid += parseFloat(mc.midCap || '0') * weightFactor;
          marketCap.small += parseFloat(mc.smallCap || mc.tiny || '0') * weightFactor;
      }

      // Asset Allocation Aggregation
      if (data.portfolio?.assetAllocation) {
        const aa = data.portfolio.assetAllocation;
        assetAllocation.equity += parseFloat(aa.equity || '0') * weightFactor;
        assetAllocation.debt += parseFloat(aa.debt || '0') * weightFactor;
        assetAllocation.cash += parseFloat(aa.cash || '0') * weightFactor;
        assetAllocation.other += parseFloat(aa.other || '0') * weightFactor;
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
        other: { percentage: assetAllocation.other / 100, value: (assetAllocation.other / 100) * totalPortfolioValue },
      },
    };
  }
}
