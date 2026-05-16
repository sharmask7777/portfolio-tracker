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
    
    // 1. Calculate values for all folios in parallel
    const folioCalculations = await Promise.all(
      portfolio.folios.map(async (folio) => {
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
          type: folio.asset.type
        } : null;
      })
    );

    const folioValues = folioCalculations.filter((v): v is NonNullable<typeof v> => v !== null);
    totalPortfolioValue = folioValues.reduce((acc, fv) => acc + fv.value, 0);

    const sectorMap: Record<string, number> = {};
    const marketCap = { large: 0, mid: 0, small: 0 };
    const assetAllocation = { equity: 0, debt: 0, cash: 0, gold: 0, other: 0 };

    // 2. Fetch all holdings in parallel
    const holdingsResults = await Promise.all(
      folioValues.map(async (fv) => {
        if (fv.type === 'MUTUAL_FUND' || fv.type === 'STOCK') {
          const data = await MarketDataService.getHoldings(fv.isin);
          return { fv, data };
        }
        return { fv, data: null };
      })
    );

    // 3. Aggregate from holdings data
    for (const { fv, data } of holdingsResults) {
      const weightFactor = fv.value / (totalPortfolioValue || 1);

      if (fv.type === 'MUTUAL_FUND' || fv.type === 'STOCK') {
        if (!data) {
          assetAllocation.equity += 100 * weightFactor;
          continue;
        }

        if (data.sectors) {
          for (const s of data.sectors) {
            let sName = s.sector || s.name || s.sectorName;
            sName = this.normalizeSector(sName);
            const sWeight = parseFloat(s.weightage || s.percent || '0');
            sectorMap[sName] = (sectorMap[sName] || 0) + sWeight * weightFactor;
          }
        }

        if (data.portfolio?.marketCapWeightage) {
          const mc = data.portfolio.marketCapWeightage;
          marketCap.large += parseFloat(mc.largeCap || mc.giant || '0') * weightFactor;
          marketCap.mid += parseFloat(mc.midCap || '0') * weightFactor;
          marketCap.small += parseFloat(mc.smallCap || mc.tiny || '0') * weightFactor;
        }

        if (data.portfolio?.assetAllocation) {
          const aa = data.portfolio.assetAllocation;
          assetAllocation.equity += parseFloat(aa.equity || aa.equityAllocation || '0') * weightFactor;
          assetAllocation.debt += parseFloat(aa.debt || aa.debtAllocation || '0') * weightFactor;
          assetAllocation.cash += parseFloat(aa.cash || aa.cashAllocation || '0') * weightFactor;
          assetAllocation.other += parseFloat(aa.other || aa.otherAllocation || '0') * weightFactor;
        }
      } else {
        if (fv.type === AssetType.EPF || fv.type === AssetType.PPF || fv.type === AssetType.FIXED_DEPOSIT) {
          assetAllocation.debt += 100 * weightFactor;
        } else if (fv.type === AssetType.SGB || fv.type === AssetType.PHYSICAL_GOLD) {
          assetAllocation.gold += 100 * weightFactor;
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
