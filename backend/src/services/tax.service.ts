import { AssetType } from '@prisma/client';
import { PortfolioUtils } from '../utils/portfolio.utils';

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
  estimatedTax: number;
}

export interface TaxSummary {
  realized: {
    stcg: number;
    ltcg: number;
    ltcgGrandfatheredDebt: number;
    slab: number;
    total: number;
    taxableSTCG: number;
    taxableLTCG: number;
    details: RealizedGain[];
  };
  unrealized: {
    stcg: number;
    ltcg: number;
    ltcgGrandfatheredDebt: number;
    slab: number;
    total: number;
  };
}

export class TaxService {
  private static GRANDFATHER_DATE = new Date('2018-01-31');
  private static BUDGET_2024_DATE = new Date('2024-07-23');
  private static DEBT_NEW_REGIME_DATE = new Date('2023-04-01');

  public static calculatePortfolioTax(
    assetName: string,
    assetType: AssetType,
    transactions: any[],
    currentNav: number,
    taxSlab: number = 0,
    grandfatherNav?: number,
  ): TaxSummary {
    const sortedTxs = PortfolioUtils.sortTransactions(transactions);

    const buyLots: BuyLot[] = [];
    const realizedGains: RealizedGain[] = [];

    for (const tx of sortedTxs) {
      const type = tx.type.toLowerCase();
      const isBuy = type.includes('buy') || type.includes('purchase') || type.includes('sip') || 
                    type.includes('switch_in') || type.includes('reinvestment') || type.includes('opening_balance');
      const isSell = type.includes('sell') || type.includes('redemption') || type.includes('switch_out') || 
                    type.includes('transfer_out') || type.includes('off_market');
      const isBonus = type.includes('bonus');
      
      const units = Math.abs(tx.units) || 0;
      const nav = isBonus ? 0 : (Math.abs(tx.nav) || 0);
      const date = new Date(tx.date);

      if (isBuy || isBonus) {
        buyLots.push({ date, units, nav, originalUnits: units, isBonus });
      } else if (isSell) {
        let unitsToSell = units;
        while (unitsToSell > 0.000001 && buyLots.length > 0) {
          const lot = buyLots[0];
          const soldFromLot = Math.min(unitsToSell, lot.units);
          
          realizedGains.push(this.calculateGain(
            assetName,
            assetType,
            lot,
            soldFromLot,
            nav,
            date,
            taxSlab,
            grandfatherNav
          ));

          lot.units -= soldFromLot;
          unitsToSell -= soldFromLot;

          if (lot.units <= 0.000001) {
            buyLots.shift();
          }
        }
      }
    }

    const now = new Date();
    let uSTCG = 0;
    let uLTCG = 0;
    let uLTCGDebt = 0;
    let uSlab = 0;

    for (const lot of buyLots) {
      if (lot.units <= 0) continue;
      const gain = (currentNav - lot.nav) * lot.units;
      const taxType = this.getTaxType(lot.date, now, assetType, assetName);
      const isEq = this.isEquity(assetType, assetName);

      if (taxType === 'LTCG') {
        if (isEq) uLTCG += gain;
        else uLTCGDebt += gain;
      }
      else if (taxType === 'STCG') uSTCG += gain;
      else uSlab += gain;
    }

    const isEq = this.isEquity(assetType, assetName);
    const stcgRealized = realizedGains.filter(g => g.taxType === 'STCG').reduce((acc, g) => acc + g.gain, 0);
    const ltcgRealized = realizedGains.filter(g => g.taxType === 'LTCG' && isEq).reduce((acc, g) => acc + g.gain, 0);
    const ltcgGrandfatheredDebtRealized = realizedGains.filter(g => g.taxType === 'LTCG' && !isEq).reduce((acc, g) => acc + g.gain, 0);
    const slabRealized = realizedGains.filter(g => g.taxType === 'SLAB').reduce((acc, g) => acc + g.gain, 0);

    // Set-off Logic Implementation (Standard Equity-focused for now, Debt LTCG is usually separate but let's keep it simple)
    let taxableSTCG = 0;
    let taxableLTCG = 0;

    const stcl = stcgRealized < 0 ? Math.abs(stcgRealized) : 0;
    const ltcl = (ltcgRealized + ltcgGrandfatheredDebtRealized) < 0 ? Math.abs(ltcgRealized + ltcgGrandfatheredDebtRealized) : 0;
    const stcg = stcgRealized > 0 ? stcgRealized : 0;
    const ltcg = (ltcgRealized + ltcgGrandfatheredDebtRealized) > 0 ? (ltcgRealized + ltcgGrandfatheredDebtRealized) : 0;

    // 1. LTCL can ONLY set off LTCG
    let remainingLTCG = Math.max(0, ltcg - ltcl);

    // 2. STCL can set off both STCG and LTCG
    let remainingSTCG = stcg;
    let remainingSTCL = stcl;

    const setOffST = Math.min(remainingSTCG, remainingSTCL);
    remainingSTCG -= setOffST;
    remainingSTCL -= setOffST;

    const setOffLT = Math.min(remainingLTCG, remainingSTCL);
    remainingLTCG -= setOffLT;
    remainingSTCL -= setOffLT;

    taxableSTCG = remainingSTCG;
    taxableLTCG = remainingLTCG;

    return {
      realized: {
        stcg: stcgRealized,
        ltcg: ltcgRealized,
        ltcgGrandfatheredDebt: ltcgGrandfatheredDebtRealized,
        slab: slabRealized,
        total: stcgRealized + ltcgRealized + ltcgGrandfatheredDebtRealized + slabRealized,
        taxableSTCG,
        taxableLTCG,
        details: realizedGains,
      },
      unrealized: {
        stcg: uSTCG,
        ltcg: uLTCG,
        ltcgGrandfatheredDebt: uLTCGDebt,
        slab: uSlab,
        total: uSTCG + uLTCG + uLTCGDebt + uSlab,
      }
    };
  }

  public static calculateUnrealizedTax(
    assetName: string,
    assetType: AssetType,
    transactions: any[],
    currentNav: number,
    taxSlab: number = 0,
    grandfatherNav?: number,
  ): number {
    const summary = this.calculatePortfolioTax(assetName, assetType, transactions, currentNav, taxSlab, grandfatherNav);
    const now = new Date();
    
    let estimatedTax = 0;
    
    if (summary.unrealized.stcg > 0) {
      estimatedTax += summary.unrealized.stcg * this.getTaxRate('STCG', now, assetType, assetName, taxSlab);
    }
    
    if (summary.unrealized.ltcg > 0) {
      estimatedTax += summary.unrealized.ltcg * this.getTaxRate('LTCG', now, assetType, assetName, taxSlab);
    }

    if (summary.unrealized.ltcgGrandfatheredDebt > 0) {
      estimatedTax += summary.unrealized.ltcgGrandfatheredDebt * this.getTaxRate('LTCG', now, assetType, assetName, taxSlab);
    }
    
    if (summary.unrealized.slab > 0) {
      estimatedTax += summary.unrealized.slab * this.getTaxRate('SLAB', now, assetType, assetName, taxSlab);
    }
    
    return estimatedTax;
  }

  public static calculateGain(
    assetName: string,
    assetType: AssetType,
    lot: BuyLot,
    unitsSold: number,
    sellNav: number,
    sellDate: Date,
    taxSlab: number = 0,
    grandfatherNav?: number,
  ): RealizedGain {
    let effectiveBuyNav = lot.nav;
    let isGrandfathered = false;
    const isEq = this.isEquity(assetType, assetName);

    if (isEq && lot.date < this.GRANDFATHER_DATE && grandfatherNav) {
      isGrandfathered = true;
      effectiveBuyNav = Math.max(lot.nav, Math.min(grandfatherNav, sellNav));
    } else if (!isEq && lot.date < this.DEBT_NEW_REGIME_DATE) {
       // Debt grandfathered means purchased before April 1, 2023
       isGrandfathered = true;
    }

    const gain = (sellNav - effectiveBuyNav) * unitsSold;
    const diffTime = Math.abs(sellDate.getTime() - lot.date.getTime());
    const holdingPeriodDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const taxType = this.getTaxType(lot.date, sellDate, assetType, assetName);
    const taxRate = this.getTaxRate(taxType, sellDate, assetType, assetName, taxSlab);

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
      estimatedTax: gain > 0 ? gain * taxRate : 0,
    };
  }

  /**
   * Returns current holding lots for an asset.
   */
  public static getActiveBuyLots(transactions: any[]): BuyLot[] {
    const sortedTxs = PortfolioUtils.sortTransactions(transactions);
    const buyLots: BuyLot[] = [];
    for (const tx of sortedTxs) {
      const type = tx.type.toLowerCase();
      const isBuy = type.includes('buy') || type.includes('purchase') || type.includes('sip') || 
                    type.includes('switch_in') || type.includes('reinvestment') || type.includes('opening_balance');
      const isSell = type.includes('sell') || type.includes('redemption') || type.includes('switch_out') || 
                    type.includes('transfer_out') || type.includes('off_market');
      const isBonus = type.includes('bonus');
      const units = Math.abs(tx.units) || 0;
      const nav = isBonus ? 0 : (Math.abs(tx.nav) || 0);
      if (isBuy || isBonus) {
        buyLots.push({ date: new Date(tx.date), units, nav, originalUnits: units, isBonus });
      } else if (isSell) {
        let unitsToSell = units;
        while (unitsToSell > 0.000001 && buyLots.length > 0) {
          const lot = buyLots[0];
          const soldFromLot = Math.min(unitsToSell, lot.units);
          lot.units -= soldFromLot;
          unitsToSell -= soldFromLot;
          if (lot.units <= 0.000001) buyLots.shift();
        }
      }
    }
    return buyLots;
  }

  private static getTaxType(buyDate: Date, sellDate: Date, assetType: AssetType, assetName: string): 'STCG' | 'LTCG' | 'SLAB' {
    const diffTime = Math.abs(sellDate.getTime() - buyDate.getTime());
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
    if (this.isEquity(assetType, assetName)) {
      return diffMonths >= 12 ? 'LTCG' : 'STCG';
    }
    if (buyDate >= this.DEBT_NEW_REGIME_DATE) return 'SLAB';
    const ltThreshold = sellDate >= this.BUDGET_2024_DATE ? 24 : 36;
    return diffMonths >= ltThreshold ? 'LTCG' : 'SLAB'; // Debt STCG is always taxed at Slab rates
  }

  private static getTaxRate(
    taxType: 'STCG' | 'LTCG' | 'SLAB', 
    sellDate: Date, 
    assetType: AssetType, 
    assetName: string,
    taxSlab: number = 0
  ): number {
    if (taxType === 'SLAB') return taxSlab;
    const isEq = this.isEquity(assetType, assetName);

    if (sellDate >= this.BUDGET_2024_DATE) {
      if (isEq) {
        return taxType === 'LTCG' ? 0.125 : 0.20;
      }
      return taxType === 'LTCG' ? 0.125 : taxSlab; // Debt LTCG post-budget is 12.5%
    }
    
    // Pre-Budget 2024
    if (isEq) {
      return taxType === 'LTCG' ? 0.10 : 0.15;
    }
    // Debt LTCG pre-budget was 20% (with indexation)
    return taxType === 'LTCG' ? 0.20 : taxSlab;
  }

  public static isELSS(assetName: string): boolean {
    const name = assetName.toLowerCase();
    return name.includes('elss') || name.includes('tax saver') || name.includes('tax plan');
  }

  public static getLockedUnits(assetName: string, transactions: any[]): number {
    if (!this.isELSS(assetName)) return 0;
    
    const activeLots = this.getActiveBuyLots(transactions);
    const now = new Date();
    let lockedUnits = 0;

    for (const lot of activeLots) {
      const diffTime = now.getTime() - lot.date.getTime();
      const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
      if (diffYears < 3.0) {
        lockedUnits += lot.units;
      }
    }

    return lockedUnits;
  }

  public static getExitLoad(
    assetName: string,
    assetType: AssetType,
    buyDate: Date,
    sellDate: Date,
    value: number
  ): number {
    if (assetType !== AssetType.MUTUAL_FUND) return 0;

    const name = assetName.toLowerCase();
    const diffTime = Math.abs(sellDate.getTime() - buyDate.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    // Liquid/Overnight funds usually have 0 or very short (7 day) exit load
    if (name.includes('liquid') || name.includes('overnight')) {
      if (diffDays < 7 && name.includes('liquid')) return value * 0.00005; // Tiny tiered load for liquid
      return 0;
    }

    // Standard Equity/Hybrid rule: 1% if sold before 1 year (365 days)
    if (this.isEquity(assetType, assetName)) {
      return diffDays < 365 ? value * 0.01 : 0;
    }

    // Default Debt rule: Many have 0 exit load or 0.25-0.5% for short periods. 
    // We'll use 0.5% if < 90 days for general debt as a safe conservative estimate.
    return diffDays < 90 ? value * 0.005 : 0;
  }

  private static isEquity(assetType: AssetType, assetName: string): boolean {
    if (assetType === AssetType.STOCK) return true;
    if (assetType === AssetType.MUTUAL_FUND) {
      const name = assetName.toLowerCase();
      const debtKeywords = ['debt', 'bond', 'liquid', 'gilt', 'money market', 'overnight', 'credit risk', 'conservative', 'income', 'duration', 'treasury'];
      const isDebt = debtKeywords.some(keyword => name.includes(keyword));
      return !isDebt;
    }
    return false;
  }
}
