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
  expenseAnalysis: {
    totalAnnualFees: number;
    weightedAvgTer: number;
    categoryBreakdown: { category: string; totalFees: number; avgTer: number; percentage: number; value: number }[];
    fundBreakdown: { name: string; isin: string; category: string; ter: number; annualizedFee: number; value: number }[];
  };
  fundCategoryAllocation: {
    active: { percentage: number; value: number };
    index: { percentage: number; value: number };
    arbitrage: { percentage: number; value: number };
    other: { percentage: number; value: number };
  };
}

export class XRayService {
  public static async getXRayData(portfolioId: string, userId: string): Promise<XRayData> {
    const allFolios = await this.getFoliosForContext(portfolioId, userId);
    
    // 1. Calculate values for all folios in parallel
    const { folioValues, totalPortfolioValue } = await this.calculateFolioValues(allFolios);

    // 2. Fetch all holdings in parallel
    const holdingsResults = await this.fetchHoldings(folioValues);

    // 3. Aggregate from holdings data
    return this.aggregateHoldings(holdingsResults, totalPortfolioValue);
  }

  private static async getFoliosForContext(portfolioId: string, userId: string) {
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
    return portfolios.flatMap(p => p.folios);
  }

  private static async calculateFolioValues(allFolios: any[]) {
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
    const totalPortfolioValue = folioValues.reduce((acc, fv) => acc + fv.value, 0);
    return { folioValues, totalPortfolioValue };
  }

  private static async fetchHoldings(folioValues: any[]) {
    return Promise.all(
      folioValues.map(async (fv) => {
        if (fv.type === 'MUTUAL_FUND' || fv.type === 'STOCK') {
          const data = await MarketDataService.getHoldings(fv.isin);
          return { fv, data };
        }
        return { fv, data: null };
      })
    );
  }

  private static aggregateHoldings(holdingsResults: any[], totalPortfolioValue: number): XRayData {
    const sectorMap: Record<string, number> = {};
    const marketCap = { large: 0, mid: 0, small: 0 };
    const assetAllocation = { equity: 0, debt: 0, cash: 0, gold: 0, other: 0 };

    const exArbSectorMap: Record<string, number> = {};
    const exArbMarketCap = { large: 0, mid: 0, small: 0 };
    const exArbAssetAllocation = { equity: 0, debt: 0, cash: 0, gold: 0, arbitrage: 0, other: 0 };

    let totalFees = 0;
    const fundBreakdown: { name: string; isin: string; category: string; ter: number; annualizedFee: number; value: number }[] = [];
    const categoryFees: Record<string, { fee: number; terSum: number; value: number; count: number }> = {};
    const fundCategoryValues = { active: 0, index: 0, arbitrage: 0, other: 0 };

    for (const { fv, data } of holdingsResults) {
      const weightFactor = fv.value / (totalPortfolioValue || 1);
      const isArbitrage = fv.type === 'MUTUAL_FUND' && (fv.name?.toLowerCase().includes('arbitrage') || false);

      if (fv.type === 'MUTUAL_FUND' || fv.type === 'STOCK') {
        if (fv.type === 'MUTUAL_FUND') {
          const ter = data?.expenseRatio || 0;
          const annualizedFee = (fv.value * ter) / 100;
          totalFees += annualizedFee;

          const category = this.parseCategory(fv.name || '', data?.schemeCategory || '');

          fundBreakdown.push({
            name: fv.name || '',
            isin: fv.isin,
            category,
            ter,
            annualizedFee,
            value: fv.value
          });

          if (!categoryFees[category]) {
            categoryFees[category] = { fee: 0, terSum: 0, value: 0, count: 0 };
          }
          categoryFees[category].fee += annualizedFee;
          categoryFees[category].value += fv.value;
          categoryFees[category].terSum += ter * fv.value;
          
          if (category === 'Active Equity') fundCategoryValues.active += fv.value;
          else if (category === 'Index') fundCategoryValues.index += fv.value;
          else if (category === 'Arbitrage') fundCategoryValues.arbitrage += fv.value;
          else fundCategoryValues.other += fv.value;
        }

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
      } else {
        if (fv.type === AssetType.EPF || fv.type === AssetType.PPF || fv.type === AssetType.FIXED_DEPOSIT) {
          assetAllocation.debt += 100 * weightFactor;
          exArbAssetAllocation.debt += 100 * weightFactor;
        } else if (fv.type === AssetType.SGB || fv.type === AssetType.PHYSICAL_GOLD) {
          assetAllocation.gold += 100 * weightFactor;
          exArbAssetAllocation.gold += 100 * weightFactor;
        }
      }
    }

    const totalMfValue = fundBreakdown.reduce((sum, f) => sum + f.value, 0);
    const weightedAvgTer = totalMfValue > 0 ? (totalFees / totalMfValue) * 100 : 0;
    
    const categoryBreakdown = Object.entries(categoryFees).map(([category, stats]) => ({
      category,
      totalFees: stats.fee,
      avgTer: stats.value > 0 ? (stats.terSum / stats.value) : 0,
      percentage: totalMfValue > 0 ? stats.value / totalMfValue : 0,
      value: stats.value
    }));
    
    const fundCategoryAllocation = {
      active: { percentage: totalPortfolioValue > 0 ? fundCategoryValues.active / totalPortfolioValue : 0, value: fundCategoryValues.active },
      index: { percentage: totalPortfolioValue > 0 ? fundCategoryValues.index / totalPortfolioValue : 0, value: fundCategoryValues.index },
      arbitrage: { percentage: totalPortfolioValue > 0 ? fundCategoryValues.arbitrage / totalPortfolioValue : 0, value: fundCategoryValues.arbitrage },
      other: { percentage: totalPortfolioValue > 0 ? fundCategoryValues.other / totalPortfolioValue : 0, value: fundCategoryValues.other },
    };

    return {
      totalValue: totalPortfolioValue,
      expenseAnalysis: {
        totalAnnualFees: totalFees,
        weightedAvgTer,
        categoryBreakdown,
        fundBreakdown
      },
      fundCategoryAllocation,
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

  private static parseCategory(name: string, schemeCat: string): string {
    const lowerName = name.toLowerCase();
    const lowerCat = (schemeCat || '').toLowerCase();
    if (lowerName.includes('arbitrage') || lowerCat.includes('arbitrage')) return 'Arbitrage';
    if (lowerName.includes('index') || lowerCat.includes('index')) return 'Index';
    if (lowerCat.includes('international') || lowerCat.includes('global')) return 'International';
    return 'Active Equity';
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
