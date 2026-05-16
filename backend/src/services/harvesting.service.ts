import { prisma } from './db.service';
import { TaxService } from './tax.service';
import { MarketDataService } from './market-data.service';
import { AssetType } from '@prisma/client';
import { PortfolioUtils } from '../utils/portfolio.utils';

export interface HarvestingOpportunity {
  folioId: string;
  schemeName: string;
  unitsToHarvest: number;
  unrealizedGain: number;
  currentValue: number;
}

export interface HarvestingSummary {
  realizedLTCG_FY: number;
  remainingExemption: number;
  totalPotentialHarvest: number;
  opportunities: HarvestingOpportunity[];
  estimatedTaxSavings: number;
}

export class HarvestingService {
  private static LTCG_EXEMPTION_LIMIT = 125000;

  /**
   * Identifies LTCG harvesting opportunities for a user.
   */
  public static async getHarvestingOpportunities(userId: string): Promise<HarvestingSummary> {
    const portfolio = await prisma.portfolio.findFirst({
      where: { userId },
      include: {
        folios: {
          include: {
            asset: true,
            transactions: { orderBy: { date: 'asc' } },
          },
        },
      },
    });

    if (!portfolio) throw new Error('Portfolio not found');

    // 1. Calculate Realized LTCG for current FY
    const fyDates = this.getCurrentFYDates();
    let realizedLTCG_FY = 0;

    for (const folio of portfolio.folios) {
      const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
      const lastNav = PortfolioUtils.getLatestNAV(folio.transactions);
      const currentPrice = liveNav > 0 ? liveNav : lastNav;

      const taxSummary = TaxService.calculatePortfolioTax(
        folio.asset.name,
        folio.asset.type,
        folio.transactions,
        currentPrice
      );

      // Filter gains realized in current FY
      const fyGains = taxSummary.realized.details.filter(
        (g) => g.taxType === 'LTCG' && g.sellDate >= fyDates.start && g.sellDate <= fyDates.end
      );
      
      realizedLTCG_FY += fyGains.reduce((acc, g) => acc + g.gain, 0);
    }

    const remainingExemption = Math.max(0, this.LTCG_EXEMPTION_LIMIT - realizedLTCG_FY);
    const opportunities: HarvestingOpportunity[] = [];
    let totalPotentialHarvest = 0;

    // 2. Scan for Unrealized LTCG in Equity Holdings
    if (remainingExemption > 0) {
      for (const folio of portfolio.folios) {
        if (folio.asset.type !== AssetType.MUTUAL_FUND && folio.asset.type !== AssetType.STOCK) continue;

        const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
        const lastNav = PortfolioUtils.getLatestNAV(folio.transactions);
        const currentPrice = liveNav > 0 ? liveNav : lastNav;

        const activeLots = TaxService.getActiveBuyLots(folio.transactions);
        const now = new Date();

        for (const lot of activeLots) {
          const diffTime = Math.abs(now.getTime() - lot.date.getTime());
          const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);

          // Only LTCG lots (> 1 year) with gains
          if (diffYears >= 1.0 && currentPrice > lot.nav) {
            const unrealizedGain = (currentPrice - lot.nav) * lot.units;
            
            // We can only harvest up to the remaining exemption across all lots
            const harvestableGain = Math.min(unrealizedGain, remainingExemption - totalPotentialHarvest);
            
            if (harvestableGain > 0) {
              const unitsToHarvest = harvestableGain / (currentPrice - lot.nav);
              
              opportunities.push({
                folioId: folio.id,
                schemeName: folio.asset.name,
                unitsToHarvest,
                unrealizedGain: harvestableGain,
                currentValue: unitsToHarvest * currentPrice,
              });

              totalPotentialHarvest += harvestableGain;
            }
          }
          if (totalPotentialHarvest >= remainingExemption) break;
        }
        if (totalPotentialHarvest >= remainingExemption) break;
      }
    }

    return {
      realizedLTCG_FY,
      remainingExemption,
      totalPotentialHarvest,
      opportunities,
      estimatedTaxSavings: totalPotentialHarvest * 0.125, // 12.5% LTCG savings
    };
  }

  private static getCurrentFYDates(): { start: Date; end: Date } {
    const now = new Date();
    const currentYear = now.getFullYear();
    const isPostMarch = now.getMonth() >= 3; // April is month 3 (0-indexed)
    
    const startYear = isPostMarch ? currentYear : currentYear - 1;
    return {
      start: new Date(startYear, 3, 1), // April 1st
      end: new Date(startYear + 1, 2, 31, 23, 59, 59), // March 31st
    };
  }
}
