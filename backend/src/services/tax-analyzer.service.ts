import { prisma } from './db.service';
import { TaxService, RealizedGain } from './tax.service';
import { MarketDataService } from './market-data.service';

export interface SimulationResult {
  assetName: string;
  unitsToSell: number;
  estimatedValue: number;
  totalGain: number;
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
  public static async simulateSell(folioId: string, unitsToSell: number): Promise<SimulationResult> {
    const folio = await prisma.folio.findUnique({
      where: { id: folioId },
      include: { 
        asset: true, 
        transactions: { orderBy: { date: 'asc' } } 
      },
    });

    if (!folio) throw new Error('Folio not found');

    const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
    const lastTx = folio.transactions[folio.transactions.length - 1];
    const currentPrice = liveNav > 0 ? liveNav : (lastTx?.nav || 0);

    // Get current buy lots
    const activeLots = TaxService.getActiveBuyLots(folio.transactions);
    
    let remainingToSell = unitsToSell;
    const matchedGains: RealizedGain[] = [];
    const sellDate = new Date();

    for (const lot of activeLots) {
      if (remainingToSell <= 0) break;

      const unitsFromLot = Math.min(remainingToSell, lot.units);
      
      const gainRecord = TaxService.calculateGain(
        folio.asset.name,
        folio.asset.type,
        { ...lot, units: unitsFromLot },
        unitsFromLot,
        currentPrice,
        sellDate
        // Note: Grandfather NAV could be fetched here if needed
      );

      matchedGains.push(gainRecord);
      remainingToSell -= unitsFromLot;
    }

    if (remainingToSell > 0) {
      throw new Error(`Insufficient units in folio. Requested: ${unitsToSell}, Available: ${unitsToSell - remainingToSell}`);
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
      }
      breakdown.totalTax += g.estimatedTax;
    }

    return {
      assetName: folio.asset.name,
      unitsToSell,
      estimatedValue: unitsToSell * currentPrice,
      totalGain: matchedGains.reduce((acc, g) => acc + g.gain, 0),
      taxBreakdown: breakdown,
      matchedLots: matchedGains,
    };
  }
}
