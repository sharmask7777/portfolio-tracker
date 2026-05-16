import { AssetType } from '@prisma/client';

export interface BuyLot {
  date: Date;
  units: number;
  nav: number;
  originalUnits: number;
  isin?: string;
  isBonus?: boolean;
}

export interface RealizedGain {
  assetName: string;
  buyDate: Date;
  sellDate: Date;
  units: number;
  buyNav: number;
  sellNav: number;
  gain: number;
  taxType: 'STCG' | 'LTCG' | 'SLAB';
  holdingPeriodDays: number;
  isGrandfathered: boolean;
  taxRate: number;
}

export interface TaxSummary {
  realized: {
    stcg: number;
    ltcg: number;
    slab: number; // For new debt funds
    total: number;
    details: RealizedGain[];
  };
  unrealized: {
    stcg: number;
    ltcg: number;
    slab: number;
    total: number;
  };
}

export class TaxService {
  private static GRANDFATHER_DATE = new Date('2018-01-31');
  private static BUDGET_2024_DATE = new Date('2024-07-23');
  private static DEBT_NEW_REGIME_DATE = new Date('2023-04-01');

  /**
   * Calculates realized and unrealized gains with refined 2024 budget rules.
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
      const type = tx.type.toLowerCase();
      const isBuy = type.includes('buy') || type.includes('purchase') || type.includes('sip');
      const isBonus = type.includes('bonus');
      
      const units = Math.abs(tx.units);
      const nav = isBonus ? 0 : Math.abs(tx.nav);
      const date = new Date(tx.date);

      if (isBuy || isBonus) {
        buyLots.push({ date, units, nav, originalUnits: units, isBonus });
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
            Math.abs(tx.nav),
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

    // Calculate Unrealized Gains
    const now = new Date();
    let uSTCG = 0;
    let uLTCG = 0;
    let uSlab = 0;

    for (const lot of buyLots) {
      if (lot.units <= 0) continue;
      
      const gain = (currentNav - lot.nav) * lot.units;
      const taxType = this.getTaxType(lot.date, now, assetType);
      
      if (taxType === 'LTCG') uLTCG += gain;
      else if (taxType === 'STCG') uSTCG += gain;
      else uSlab += gain;
    }

    const stcgRealized = realizedGains.filter(g => g.taxType === 'STCG').reduce((acc, g) => acc + g.gain, 0);
    const ltcgRealized = realizedGains.filter(g => g.taxType === 'LTCG').reduce((acc, g) => acc + g.gain, 0);
    const slabRealized = realizedGains.filter(g => g.taxType === 'SLAB').reduce((acc, g) => acc + g.gain, 0);

    return {
      realized: {
        stcg: stcgRealized,
        ltcg: ltcgRealized,
        slab: slabRealized,
        total: stcgRealized + ltcgRealized + slabRealized,
        details: realizedGains,
      },
      unrealized: {
        stcg: uSTCG,
        ltcg: uLTCG,
        slab: uSlab,
        total: uSTCG + uLTCG + uSlab,
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
    if (this.isEquity(assetType, assetName) && lot.date < this.GRANDFATHER_DATE && grandfatherNav) {
      isGrandfathered = true;
      effectiveBuyNav = Math.max(lot.nav, Math.min(grandfatherNav, sellNav));
    }

    const gain = (sellNav - effectiveBuyNav) * unitsSold;
    const diffTime = Math.abs(sellDate.getTime() - lot.date.getTime());
    const holdingPeriodDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const taxType = this.getTaxType(lot.date, sellDate, assetType);
    const taxRate = this.getTaxRate(taxType, sellDate);

    return {
      assetName,
      buyDate: lot.date,
      sellDate,
      units: unitsSold,
      buyNav: lot.nav,
      sellNav,
      gain,
      taxType,
      holdingPeriodDays,
      isGrandfathered,
      taxRate,
    };
  }

  private static getTaxType(buyDate: Date, sellDate: Date, assetType: AssetType): 'STCG' | 'LTCG' | 'SLAB' {
    const diffTime = Math.abs(sellDate.getTime() - buyDate.getTime());
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
    
    if (this.isEquity(assetType, '')) {
      return diffMonths >= 12 ? 'LTCG' : 'STCG';
    }

    // Debt Fund Logic
    if (buyDate >= this.DEBT_NEW_REGIME_DATE) {
      return 'SLAB'; // All new debt funds are taxed at slab rate
    }

    // Old Debt Funds (Grandfathered)
    const ltThreshold = sellDate >= this.BUDGET_2024_DATE ? 24 : 36;
    return diffMonths >= ltThreshold ? 'LTCG' : 'STCG';
  }

  private static getTaxRate(taxType: 'STCG' | 'LTCG' | 'SLAB', sellDate: Date): number {
    if (taxType === 'SLAB') return 0; // Depends on user's income

    if (sellDate >= this.BUDGET_2024_DATE) {
      return taxType === 'LTCG' ? 0.125 : 0.20;
    }
    return taxType === 'LTCG' ? 0.10 : 0.15;
  }

  private static isEquity(assetType: AssetType, assetName: string): boolean {
    // Basic heuristic: STOCKS and typical MFs in our CAS parser are equity-oriented.
    // In a real system, we'd check the AMFI category.
    return assetType === AssetType.STOCK || assetType === AssetType.MUTUAL_FUND;
  }
}
