import { AssetType } from '@prisma/client';

export interface BuyLot {
  date: Date;
  units: number;
  nav: number;
  originalUnits: number;
  isin?: string;
}

export interface RealizedGain {
  assetName: string;
  buyDate: Date;
  sellDate: Date;
  units: number;
  buyNav: number;
  sellNav: number;
  gain: number;
  taxType: 'STCG' | 'LTCG';
  holdingPeriodDays: number;
  isGrandfathered: boolean;
}

export interface TaxSummary {
  realized: {
    stcg: number;
    ltcg: number;
    total: number;
    details: RealizedGain[];
  };
  unrealized: {
    stcg: number;
    ltcg: number;
    total: number;
  };
}

export class TaxService {
  private static GRANDFATHER_DATE = new Date('2018-01-31');

  /**
   * Calculates realized and unrealized gains for a set of transactions.
   */
  public static calculatePortfolioTax(
    assetName: string,
    assetType: AssetType,
    transactions: any[],
    currentNav: number,
    grandfatherNav?: number,
  ): TaxSummary {
    const sortedTxs = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const buyLots: BuyLot[] = [];
    const realizedGains: RealizedGain[] = [];

    for (const tx of sortedTxs) {
      const isBuy = tx.type.toLowerCase().includes('buy') || 
                   tx.type.toLowerCase().includes('purchase') || 
                   tx.type.toLowerCase().includes('sip');
      
      const units = Math.abs(tx.units);
      const nav = Math.abs(tx.nav);
      const date = new Date(tx.date);

      if (isBuy) {
        buyLots.push({ date, units, nav, originalUnits: units });
      } else {
        // Sell logic (FIFO)
        let unitsToSell = units;
        while (unitsToSell > 0 && buyLots.length > 0) {
          const lot = buyLots[0];
          const soldFromLot = Math.min(unitsToSell, lot.units);
          
          realizedGains.push(this.calculateGain(
            assetName,
            assetType,
            lot,
            soldFromLot,
            nav,
            date,
            grandfatherNav
          ));

          lot.units -= soldFromLot;
          unitsToSell -= soldFromLot;

          if (lot.units <= 0) {
            buyLots.shift();
          }
        }
      }
    }

    // Calculate Unrealized Gains from remaining lots
    const now = new Date();
    let uSTCG = 0;
    let uLTCG = 0;

    for (const lot of buyLots) {
      if (lot.units <= 0) continue;
      
      const gain = (currentNav - lot.nav) * lot.units;
      const isLongTerm = this.isLongTerm(lot.date, now, assetType);
      
      if (isLongTerm) uLTCG += gain;
      else uSTCG += gain;
    }

    const stcgRealized = realizedGains.filter(g => g.taxType === 'STCG').reduce((acc, g) => acc + g.gain, 0);
    const ltcgRealized = realizedGains.filter(g => g.taxType === 'LTCG').reduce((acc, g) => acc + g.gain, 0);

    return {
      realized: {
        stcg: stcgRealized,
        ltcg: ltcgRealized,
        total: stcgRealized + ltcgRealized,
        details: realizedGains,
      },
      unrealized: {
        stcg: uSTCG,
        ltcg: uLTCG,
        total: uSTCG + uLTCG,
      }
    };
  }

  private static calculateGain(
    assetName: string,
    assetType: AssetType,
    lot: BuyLot,
    unitsSold: number,
    sellNav: number,
    sellDate: Date,
    grandfatherNav?: number,
  ): RealizedGain {
    let effectiveBuyNav = lot.nav;
    let isGrandfathered = false;

    // Grandfathering Logic for Equity (Jan 31, 2018)
    if (assetType === AssetType.MUTUAL_FUND && lot.date < this.GRANDFATHER_DATE && grandfatherNav) {
      isGrandfathered = true;
      // Formula: Cost of acquisition = Higher of (Actual Cost) and (Lower of FMV on 31-Jan-2018 and Sale Price)
      const fmv = grandfatherNav;
      effectiveBuyNav = Math.max(lot.nav, Math.min(fmv, sellNav));
    }

    const gain = (sellNav - effectiveBuyNav) * unitsSold;
    const diffTime = Math.abs(sellDate.getTime() - lot.date.getTime());
    const holdingPeriodDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      assetName,
      buyDate: lot.date,
      sellDate,
      units: unitsSold,
      buyNav: lot.nav,
      sellNav,
      gain,
      taxType: this.isLongTerm(lot.date, sellDate, assetType) ? 'LTCG' : 'STCG',
      holdingPeriodDays,
      isGrandfathered,
    };
  }

  private static isLongTerm(buyDate: Date, sellDate: Date, assetType: AssetType): boolean {
    const diffTime = Math.abs(sellDate.getTime() - buyDate.getTime());
    const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    
    if (assetType === AssetType.MUTUAL_FUND || assetType === AssetType.STOCK) {
      return diffYears >= 1.0;
    }
    // Debt funds post-2023 are always slab rate (effectively STCG for tracking), 
    // but we can add more nuanced logic here later.
    return diffYears >= 3.0;
  }
}
