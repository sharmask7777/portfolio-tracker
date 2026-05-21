import { prisma } from './db.service';
import { TaxService, RealizedGain } from './tax.service';
import { MarketDataService } from './market-data.service';
import { PortfolioUtils } from '../utils/portfolio.utils';

export interface SimulationResult {
  assetName: string;
  unitsToSell: number;
  estimatedValue: number;
  totalGain: number;
  exitLoad: number;
  taxBreakdown: {
    stcg: { amount: number; tax: number };
    ltcg: { amount: number; tax: number };
    slab: { amount: number; tax: number };
    totalTax: number;
  };
  matchedLots: RealizedGain[];
}

export class TaxAnalyzerService {
  /**
   * Simulates a sell and returns estimated tax impact.
   */
  public static async simulateSell(folioId: string, unitsToSell: number, taxSlab: number = 0.30): Promise<SimulationResult> {
    try {
      const folio = await prisma.folio.findUnique({
        where: { id: folioId },
        include: { 
          asset: true, 
          transactions: { orderBy: { date: 'asc' } } 
        },
      });

      if (!folio) throw new Error('Folio not found');

      const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
      const lastNav = PortfolioUtils.getLatestNAV(folio.transactions);
      const currentPrice = liveNav > 0 ? liveNav : lastNav;

      // Get current buy lots
      const activeLots = TaxService.getActiveBuyLots(folio.transactions);
      const lockedUnits = TaxService.getLockedUnits(folio.asset.name, folio.transactions);
      const totalUnits = PortfolioUtils.getLatestUnits(folio.transactions);
      
      if (unitsToSell > (totalUnits - lockedUnits + 0.0001)) {
        throw new Error(`Insufficient sellable units. ${lockedUnits.toFixed(3)} units are locked (ELSS 3yr). Available: ${(totalUnits - lockedUnits).toFixed(3)}`);
      }
      
      let remainingToSell = unitsToSell;
      const matchedGains: RealizedGain[] = [];
      const sellDate = new Date();
      let totalExitLoad = 0;

      for (const lot of activeLots) {
        if (remainingToSell <= 0.000001) break;

        const unitsFromLot = Math.min(remainingToSell, lot.units);
        const lotValue = unitsFromLot * currentPrice;

        // Calculate Exit Load for this specific lot
        totalExitLoad += TaxService.getExitLoad(
          folio.asset.name,
          folio.asset.type,
          lot.date,
          sellDate,
          lotValue,
          folio.asset.exitLoadMetadata
        );
        
        const gainRecord = TaxService.calculateGain(
          folio.asset.name,
          folio.asset.type,
          { ...lot, units: unitsFromLot },
          unitsFromLot,
          currentPrice,
          sellDate,
          taxSlab
        );

        matchedGains.push(gainRecord);
        remainingToSell -= unitsFromLot;
      }

      if (remainingToSell > 0.001) {
        throw new Error(`Insufficient units. Available: ${(unitsToSell - remainingToSell).toFixed(3)}`);
      }

      // Aggregate tax breakdown
      const breakdown = {
        stcg: { amount: 0, tax: 0 },
        ltcg: { amount: 0, tax: 0 },
        slab: { amount: 0, tax: 0 },
        totalTax: 0,
      };

      for (const g of matchedGains) {
        if (g.taxType === 'STCG') {
          breakdown.stcg.amount += g.gain;
          breakdown.stcg.tax += g.estimatedTax;
        } else if (g.taxType === 'LTCG') {
          breakdown.ltcg.amount += g.gain;
          breakdown.ltcg.tax += g.estimatedTax;
        } else {
          breakdown.slab.amount += g.gain;
          breakdown.slab.tax += g.estimatedTax;
        }
        breakdown.totalTax += g.estimatedTax;
      }

      return {
        assetName: folio.asset.name,
        unitsToSell,
        estimatedValue: unitsToSell * currentPrice,
        totalGain: matchedGains.reduce((acc, g) => acc + g.gain, 0),
        exitLoad: totalExitLoad,
        taxBreakdown: breakdown,
        matchedLots: matchedGains,
      };
    } catch (err: any) {
      console.error('[Simulation] Fatal error:', err);
      throw err;
    }
  }
}
