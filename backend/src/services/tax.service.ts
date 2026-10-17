import { AssetType } from '@prisma/client';
import { PortfolioUtils } from '../utils/portfolio.utils';

export enum TaxSection {
  SEC_111A_15 = '111A (15%)',
  SEC_111A_20 = '111A (20%)',
  SEC_112A_10 = '112A (10%)',
  SEC_112A_12_5 = '112A (12.5%)',
  SEC_50AA = '50AA (Slab)',
  SEC_112_DEBT_12_5 = '112 Debt (12.5%)',
  SEC_112_DEBT_20 = '112 Debt (20% Indexed)',
  SLAB = 'SLAB',
}

export enum AdvanceTaxQuarter {
  Q1 = 'Q1 (01/04 - 15/06)',
  Q2A = 'Q2a (16/06 - 22/07)',
  Q2B = 'Q2b (23/07 - 15/09)',
  Q3 = 'Q3 (16/09 - 15/12)',
  Q4 = 'Q4 (16/12 - 15/03)',
  Q5 = 'Q5 (16/03 - 31/03)',
}

export interface BuyLot {
  date: Date;
  units: number;
  nav: number;
  originalUnits: number;
  isin?: string;
  isBonus?: boolean;
  isAnchor?: boolean;
}

export interface RealizedGain {
  assetName: string;
  folioNumber?: string;
  isin?: string;
  pan?: string;
  assetClass: string;
  section: string;
  buyDate: Date;
  sellDate: Date;
  holdingPeriodDays: number;
  holdingType: 'Short-Term' | 'Long-Term';
  units: number;
  buyNav: number;
  sellNav: number;
  grossConsideration: number;
  costOfAcquisition: number;
  fmvAsOfJan31_2018: number;
  totalFmvJan31_2018: number;
  deemedCostOfAcquisition: number;
  transferExpenses: number;
  gain: number;
  taxType: 'STCG' | 'LTCG' | 'SLAB';
  taxRate: number;
  taxBeforeCess: number;
  cess: number;
  estimatedTax: number;
  advanceTaxQuarter: string;
  isGrandfathered: boolean;
  grandfatheredStatus: string;
  isAnchorDependent: boolean;
}

export interface TableFQuarterData {
  stcg15: number;
  stcg20: number;
  ltcg10: number;
  ltcg12_5: number;
  debtLtcg12_5: number;
  debtLtcg20: number;
  slab: number;
  totalGain: number;
  taxBeforeCess: number;
  cess: number;
  estimatedTax: number;
}

export interface AdvanceTaxAccrualMatrix {
  quarters: Record<AdvanceTaxQuarter, TableFQuarterData>;
  quarterTotals: Record<AdvanceTaxQuarter, number>;
}

export interface SectionTotalData {
  section: string;
  grossConsideration: number;
  costOfAcquisition: number;
  deemedCostOfAcquisition: number;
  transferExpenses: number;
  totalGain: number;
  taxRate: number;
  taxBeforeCess: number;
  cess: number;
  totalTax: number;
}

export type SectionTotalsMap = Record<string, SectionTotalData>;

export interface TaxSummary {
  hasSyntheticAnchors: boolean;
  realized: {
    stcg: number;
    ltcg: number;
    ltcgGrandfatheredDebt: number;
    slab: number;
    total: number;
    taxableSTCG: number;
    taxableLTCG: number;
    details: RealizedGain[];
    tableF?: AdvanceTaxAccrualMatrix;
    sectionTotals?: SectionTotalsMap;
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
  public static readonly DEFAULT_TAX_SLAB = 0.30;
  public static readonly LTCG_EXEMPTION_LIMIT_BUDGET_2024 = 125000;
  public static readonly LTCG_EXEMPTION_LIMIT_PRE_BUDGET_2024 = 100000;
  public static readonly LTCG_EXEMPTION_LIMIT = 125000;

  private static GRANDFATHER_DATE = new Date('2018-01-31T23:59:59.999Z');
  private static BUDGET_2024_DATE = new Date('2024-07-23T00:00:00.000Z');
  private static DEBT_NEW_REGIME_DATE = new Date('2023-04-01T00:00:00.000Z');

  public static toISTDateString(date: Date): string {
    const d = date instanceof Date ? date : new Date(date);
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    } catch {
      return d.toISOString().split('T')[0];
    }
  }

  public static getAdvanceTaxQuarter(date: Date): AdvanceTaxQuarter {
    const d = date instanceof Date ? date : new Date(date);
    const iso = this.toISTDateString(d);
    const parts = iso.split('-');
    const mmdd = `${parts[1]}-${parts[2]}`;

    if (mmdd >= '04-01' && mmdd <= '06-15') {
      return AdvanceTaxQuarter.Q1;
    }
    if (mmdd >= '06-16' && mmdd <= '07-22') {
      return AdvanceTaxQuarter.Q2A;
    }
    if (mmdd >= '07-23' && mmdd <= '09-15') {
      return AdvanceTaxQuarter.Q2B;
    }
    if (mmdd >= '09-16' && mmdd <= '12-15') {
      return AdvanceTaxQuarter.Q3;
    }
    if (mmdd >= '12-16' || mmdd <= '03-15') {
      return AdvanceTaxQuarter.Q4;
    }
    return AdvanceTaxQuarter.Q5;
  }

  public static calculate112AExemption(
    ltcg10: number,
    ltcg12_5: number,
    fy: string = '2024-25'
  ): {
    exempt10: number;
    exempt12_5: number;
    totalExemption: number;
    taxable10: number;
    taxable12_5: number;
    tax10: number;
    tax12_5: number;
    totalTax: number;
  } {
    const isFy2425OrLater = fy >= '2024-25';
    const limit = isFy2425OrLater
      ? this.LTCG_EXEMPTION_LIMIT_BUDGET_2024
      : this.LTCG_EXEMPTION_LIMIT_PRE_BUDGET_2024;

    const pureLtcg10 = Math.max(0, ltcg10);
    const pureLtcg12_5 = Math.max(0, ltcg12_5);

    // Sequential exhaustion: 10% tranche first, then remainder against 12.5%
    const exempt10 = Math.min(pureLtcg10, limit);
    const remainingLimit = limit - exempt10;
    const exempt12_5 = Math.min(pureLtcg12_5, remainingLimit);

    const taxable10 = pureLtcg10 - exempt10;
    const taxable12_5 = pureLtcg12_5 - exempt12_5;

    const tax10BeforeCess = taxable10 * 0.10;
    const tax10 = tax10BeforeCess + tax10BeforeCess * 0.04;

    const tax12_5BeforeCess = taxable12_5 * 0.125;
    const tax12_5 = tax12_5BeforeCess + tax12_5BeforeCess * 0.04;

    return {
      exempt10,
      exempt12_5,
      totalExemption: exempt10 + exempt12_5,
      taxable10,
      taxable12_5,
      tax10,
      tax12_5,
      totalTax: tax10 + tax12_5,
    };
  }

  public static buildAdvanceTaxMatrix(details: RealizedGain[]): AdvanceTaxAccrualMatrix {
    const quartersList = [
      AdvanceTaxQuarter.Q1,
      AdvanceTaxQuarter.Q2A,
      AdvanceTaxQuarter.Q2B,
      AdvanceTaxQuarter.Q3,
      AdvanceTaxQuarter.Q4,
      AdvanceTaxQuarter.Q5,
    ];

    const quarters: Record<AdvanceTaxQuarter, TableFQuarterData> = {} as any;
    const quarterTotals: Record<AdvanceTaxQuarter, number> = {} as any;

    for (const q of quartersList) {
      quarters[q] = {
        stcg15: 0,
        stcg20: 0,
        ltcg10: 0,
        ltcg12_5: 0,
        debtLtcg12_5: 0,
        debtLtcg20: 0,
        slab: 0,
        totalGain: 0,
        taxBeforeCess: 0,
        cess: 0,
        estimatedTax: 0,
      };
      quarterTotals[q] = 0;
    }

    for (const g of details) {
      const q = g.advanceTaxQuarter as AdvanceTaxQuarter;
      const data = quarters[q];
      if (!data) continue;

      if (g.section === TaxSection.SEC_111A_15) {
        data.stcg15 += g.gain;
      } else if (g.section === TaxSection.SEC_111A_20) {
        data.stcg20 += g.gain;
      } else if (g.section === TaxSection.SEC_112A_10) {
        data.ltcg10 += g.gain;
      } else if (g.section === TaxSection.SEC_112A_12_5) {
        data.ltcg12_5 += g.gain;
      } else if (g.section === TaxSection.SEC_112_DEBT_12_5) {
        data.debtLtcg12_5 += g.gain;
      } else if (g.section === TaxSection.SEC_112_DEBT_20) {
        data.debtLtcg20 += g.gain;
      } else {
        data.slab += g.gain;
      }

      data.totalGain += g.gain;
      data.taxBeforeCess += g.taxBeforeCess;
      data.cess += g.cess;
      data.estimatedTax += g.estimatedTax;
      quarterTotals[q] += g.estimatedTax;
    }

    return { quarters, quarterTotals };
  }

  public static buildSectionTotals(details: RealizedGain[]): SectionTotalsMap {
    const totals: SectionTotalsMap = {};

    for (const g of details) {
      if (!totals[g.section]) {
        totals[g.section] = {
          section: g.section,
          grossConsideration: 0,
          costOfAcquisition: 0,
          deemedCostOfAcquisition: 0,
          transferExpenses: 0,
          totalGain: 0,
          taxRate: g.taxRate,
          taxBeforeCess: 0,
          cess: 0,
          totalTax: 0,
        };
      }

      const t = totals[g.section];
      t.grossConsideration += g.grossConsideration;
      t.costOfAcquisition += g.costOfAcquisition;
      t.deemedCostOfAcquisition += g.deemedCostOfAcquisition;
      t.transferExpenses += g.transferExpenses;
      t.totalGain += g.gain;
      t.taxBeforeCess += g.taxBeforeCess;
      t.cess += g.cess;
      t.totalTax += g.estimatedTax;
    }

    return totals;
  }

  public static calculatePortfolioTax(
    assetName: string,
    assetType: AssetType,
    transactions: any[],
    currentNav: number,
    taxSlab: number = 0,
    grandfatherNav?: number,
    folioOptions?: {
      folioNumber?: string;
      pan?: string;
      isin?: string;
      exitLoadMetadata?: string | null;
    }
  ): TaxSummary {
    const sortedTxs = PortfolioUtils.sortTransactions(transactions);

    const buyLots: BuyLot[] = [];
    const realizedGains: RealizedGain[] = [];

    for (const tx of sortedTxs) {
      const type = tx.type.toLowerCase();
      const isBuy = type.includes('buy') || type.includes('purchase') || type.includes('sip') || 
                    type.includes('switch_in') || type.includes('reinvestment') || type.includes('opening_balance');
      const isAnchor = type.includes('opening_balance');
      const isSell = type.includes('sell') || type.includes('redemption') || type.includes('switch_out') || 
                    type.includes('transfer_out') || type.includes('off_market');
      const isBonus = type.includes('bonus');
      
      const units = Math.abs(tx.units) || 0;
      const nav = isBonus ? 0 : (Math.abs(tx.nav) || 0);
      const date = new Date(tx.date);

      if (isBuy || isBonus) {
        if (units > 0.000001) {
          buyLots.push({ date, units, nav, originalUnits: units, isBonus, isAnchor });
        }
      } else if (isSell) {
        let unitsToSell = units;
        while (unitsToSell > 0.000001 && buyLots.length > 0) {
          const lot = buyLots[0];
          const soldFromLot = Math.min(unitsToSell, lot.units);
          
          const lotTransferExpenses = folioOptions?.exitLoadMetadata
            ? this.getExitLoad(assetName, assetType, lot.date, date, soldFromLot * nav, folioOptions.exitLoadMetadata)
            : ((tx.transferExpenses as number) || (tx.exitLoad as number) || 0);

          realizedGains.push(this.calculateGain(
            assetName,
            assetType,
            lot,
            soldFromLot,
            nav,
            date,
            taxSlab,
            grandfatherNav,
            lotTransferExpenses,
            folioOptions
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

    // Set-off Logic Implementation
    let taxableSTCG = 0;
    let taxableLTCG = 0;

    const stcl = stcgRealized < 0 ? Math.abs(stcgRealized) : 0;
    const ltcl = (ltcgRealized + ltcgGrandfatheredDebtRealized) < 0 ? Math.abs(ltcgRealized + ltcgGrandfatheredDebtRealized) : 0;
    const stcg = stcgRealized > 0 ? stcgRealized : 0;
    
    let ltcgEq = ltcgRealized > 0 ? ltcgRealized : 0;
    let ltcgDebt = ltcgGrandfatheredDebtRealized > 0 ? ltcgGrandfatheredDebtRealized : 0;

    // 1. LTCL can ONLY set off LTCG
    let remainingLtcl = ltcl;
    
    const setOffDebt = Math.min(ltcgDebt, remainingLtcl);
    ltcgDebt -= setOffDebt;
    remainingLtcl -= setOffDebt;

    const setOffEq = Math.min(ltcgEq, remainingLtcl);
    ltcgEq -= setOffEq;
    remainingLtcl -= setOffEq;

    // 2. STCL can set off both STCG and LTCG
    let remainingSTCG = stcg;
    let remainingSTCL = stcl;

    const setOffST = Math.min(remainingSTCG, remainingSTCL);
    remainingSTCG -= setOffST;
    remainingSTCL -= setOffST;

    // Set off STCL against remaining LTCG Debt (20%) first, then Equity
    const setOffSTCLDebt = Math.min(ltcgDebt, remainingSTCL);
    ltcgDebt -= setOffSTCLDebt;
    remainingSTCL -= setOffSTCLDebt;

    const setOffSTCLEq = Math.min(ltcgEq, remainingSTCL);
    ltcgEq -= setOffSTCLEq;
    remainingSTCL -= setOffSTCLEq;

    taxableSTCG = remainingSTCG;
    taxableLTCG = ltcgEq + ltcgDebt;

    const hasSyntheticAnchors = buyLots.some(lot => lot.isAnchor && lot.units > 0.000001) || realizedGains.some(gain => gain.isAnchorDependent && gain.units > 0.000001);

    const tableF = this.buildAdvanceTaxMatrix(realizedGains);
    const sectionTotals = this.buildSectionTotals(realizedGains);

    return {
      hasSyntheticAnchors,
      realized: {
        stcg: stcgRealized,
        ltcg: ltcgRealized,
        ltcgGrandfatheredDebt: ltcgGrandfatheredDebtRealized,
        slab: slabRealized,
        total: stcgRealized + ltcgRealized + ltcgGrandfatheredDebtRealized + slabRealized,
        taxableSTCG,
        taxableLTCG,
        details: realizedGains,
        tableF,
        sectionTotals,
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
    transferExpenses: number = 0,
    metadata?: {
      folioNumber?: string;
      isin?: string;
      pan?: string;
      exitLoadMetadata?: string | null;
    }
  ): RealizedGain {
    const buyDate = lot.date instanceof Date ? lot.date : new Date(lot.date);
    const sellDateObj = sellDate instanceof Date ? sellDate : new Date(sellDate);

    const buyDateStr = this.toISTDateString(buyDate);
    const sellDateStr = this.toISTDateString(sellDateObj);

    const isEq = this.isEquity(assetType, assetName);
    const assetClass = isEq ? 'Equity' : (assetType === AssetType.FIXED_DEPOSIT ? 'Fixed Deposit' : 'Debt');

    const diffTime = Math.abs(sellDateObj.getTime() - buyDate.getTime());
    const holdingPeriodDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const isPostBudget2024 = sellDateStr >= '2024-07-23';
    const isPostDebtRegime = buyDateStr >= '2023-04-01';
    const isGrandfatherDateOrBefore = buyDateStr <= '2018-01-31';

    let holdingType: 'Short-Term' | 'Long-Term';
    let taxType: 'STCG' | 'LTCG' | 'SLAB';
    let section: TaxSection;
    let taxRate: number;

    if (isEq) {
      const isLongTerm = holdingPeriodDays >= 365;
      holdingType = isLongTerm ? 'Long-Term' : 'Short-Term';
      taxType = isLongTerm ? 'LTCG' : 'STCG';
      if (isLongTerm) {
        section = isPostBudget2024 ? TaxSection.SEC_112A_12_5 : TaxSection.SEC_112A_10;
        taxRate = isPostBudget2024 ? 0.125 : 0.10;
      } else {
        section = isPostBudget2024 ? TaxSection.SEC_111A_20 : TaxSection.SEC_111A_15;
        taxRate = isPostBudget2024 ? 0.20 : 0.15;
      }
    } else {
      if (isPostDebtRegime) {
        holdingType = 'Short-Term';
        taxType = 'SLAB';
        section = TaxSection.SEC_50AA;
        taxRate = taxSlab;
      } else {
        const debtLtThreshold = isPostBudget2024 ? 730 : 1095;
        const isDebtLongTerm = holdingPeriodDays >= debtLtThreshold;
        holdingType = isDebtLongTerm ? 'Long-Term' : 'Short-Term';
        taxType = isDebtLongTerm ? 'LTCG' : 'SLAB';
        if (isDebtLongTerm) {
          section = isPostBudget2024 ? TaxSection.SEC_112_DEBT_12_5 : TaxSection.SEC_112_DEBT_20;
          taxRate = isPostBudget2024 ? 0.125 : 0.20;
        } else {
          section = TaxSection.SLAB;
          taxRate = taxSlab;
        }
      }
    }

    const grossConsideration = sellNav * unitsSold;
    const costOfAcquisition = (lot.isBonus ? 0 : lot.nav) * unitsSold;
    let deemedCostOfAcquisition = costOfAcquisition;
    let fmvAsOfJan31_2018 = 0;
    let totalFmvJan31_2018 = 0;
    let isGrandfathered = false;
    let grandfatheredStatus = 'Non-Grandfathered';

    if (isEq && isGrandfatherDateOrBefore && !lot.isAnchor) {
      isGrandfathered = true;
      grandfatheredStatus = 'Grandfathered u/s 55(2)(ac)';
      if (grandfatherNav !== undefined && grandfatherNav !== null) {
        fmvAsOfJan31_2018 = grandfatherNav;
        totalFmvJan31_2018 = fmvAsOfJan31_2018 * unitsSold;
        const actualNav = lot.isBonus ? 0 : lot.nav;
        const deemedUnitCost = Math.max(actualNav, Math.min(grandfatherNav, sellNav));
        deemedCostOfAcquisition = deemedUnitCost * unitsSold;
      }
    } else if (!isEq && !isPostDebtRegime && !lot.isAnchor) {
      isGrandfathered = true;
      grandfatheredStatus = 'Grandfathered Debt (Pre-50AA)';
    }

    let actualTransferExpenses = transferExpenses || 0;
    if (!actualTransferExpenses && metadata?.exitLoadMetadata) {
      actualTransferExpenses = this.getExitLoad(
        assetName,
        assetType,
        buyDate,
        sellDateObj,
        grossConsideration,
        metadata.exitLoadMetadata
      );
    }

    const gain = grossConsideration - deemedCostOfAcquisition - actualTransferExpenses;
    const taxBeforeCess = gain > 0 ? gain * taxRate : 0;
    const cess = taxBeforeCess * 0.04;
    const estimatedTax = taxBeforeCess + cess;
    const advanceTaxQuarter = this.getAdvanceTaxQuarter(sellDateObj);

    return {
      assetName,
      folioNumber: metadata?.folioNumber,
      isin: metadata?.isin,
      pan: metadata?.pan,
      assetClass,
      section,
      buyDate,
      sellDate: sellDateObj,
      holdingPeriodDays,
      holdingType,
      units: unitsSold,
      buyNav: lot.isBonus ? 0 : lot.nav,
      sellNav,
      grossConsideration,
      costOfAcquisition,
      fmvAsOfJan31_2018,
      totalFmvJan31_2018,
      deemedCostOfAcquisition,
      transferExpenses: actualTransferExpenses,
      gain,
      taxType,
      taxRate,
      taxBeforeCess,
      cess,
      estimatedTax,
      advanceTaxQuarter,
      isGrandfathered,
      grandfatheredStatus,
      isAnchorDependent: lot.isAnchor || false,
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
      const isAnchor = type.includes('opening_balance');
      const isSell = type.includes('sell') || type.includes('redemption') || type.includes('switch_out') || 
                    type.includes('transfer_out') || type.includes('off_market');
      const isBonus = type.includes('bonus');
      const units = Math.abs(tx.units) || 0;
      const nav = isBonus ? 0 : (Math.abs(tx.nav) || 0);
      if ((isBuy || isBonus) && units > 0.000001) {
        buyLots.push({ date: new Date(tx.date), units, nav, originalUnits: units, isBonus, isAnchor });
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
    const buyDateStr = this.toISTDateString(buyDate);
    const sellDateStr = this.toISTDateString(sellDate);
    const diffTime = Math.abs(sellDate.getTime() - buyDate.getTime());
    const holdingDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const isEq = this.isEquity(assetType, assetName);

    if (isEq) {
      return holdingDays >= 365 ? 'LTCG' : 'STCG';
    }
    if (buyDateStr >= '2023-04-01') return 'SLAB';
    const isPostBudget = sellDateStr >= '2024-07-23';
    const ltThreshold = isPostBudget ? 730 : 1095;
    return holdingDays >= ltThreshold ? 'LTCG' : 'SLAB';
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
    const sellDateStr = this.toISTDateString(sellDate);
    const isPostBudget = sellDateStr >= '2024-07-23';

    if (isPostBudget) {
      if (isEq) {
        return taxType === 'LTCG' ? 0.125 : 0.20;
      }
      return taxType === 'LTCG' ? 0.125 : taxSlab;
    }
    
    // Pre-Budget 2024
    if (isEq) {
      return taxType === 'LTCG' ? 0.10 : 0.15;
    }
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
    value: number,
    metadata?: string | null
  ): number {
    if (assetType === AssetType.STOCK) return 0;
    if (assetType !== AssetType.MUTUAL_FUND) return 0;

    const name = assetName.toLowerCase();
    const diffTime = Math.abs(sellDate.getTime() - buyDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Priority 1 - Fund-Specific Metadata
    if (metadata) {
      const parsedLoad = this.parseExitLoadFromMetadata(metadata, diffDays);
      if (parsedLoad !== null) return value * parsedLoad;
    }

    // ELSS: 0% exit load (but 3-year lock-in)
    if (this.isELSS(name)) return 0;

    // Specific well-known funds or categories
    if (name.includes('parag parikh')) {
      if (diffDays < 365) return value * 0.02; // 2% < 1yr
      if (diffDays < 730) return value * 0.01; // 1% < 2yr
      return 0;
    }

    if (name.includes('arbitrage')) {
      return diffDays < 30 ? value * 0.0025 : 0;
    }

    if (name.includes('liquid')) {
      if (diffDays <= 1) return value * 0.00007; // Day 1: 0.0070%
      if (diffDays === 2) return value * 0.000065; // Day 2: 0.0065%
      if (diffDays === 3) return value * 0.00006; // Day 3: 0.0060%
      if (diffDays === 4) return value * 0.000055; // Day 4: 0.0055%
      if (diffDays === 5) return value * 0.00005; // Day 5: 0.0050%
      if (diffDays === 6) return value * 0.000045; // Day 6: 0.0045%
      return 0;
    }

    if (name.includes('overnight')) return 0;

    // Standard Equity rule: 1% if sold before 1 year (365 days)
    if (this.isEquity(assetType, name)) {
      return diffDays < 365 ? value * 0.01 : 0;
    }

    // Default Debt rule: 0.5% if < 90 days.
    return diffDays < 90 ? value * 0.005 : 0;
  }

  private static parseExitLoadFromMetadata(text: string, holdingDays: number): number | null {
    try {
      const normalized = text.toLowerCase();
      
      if (normalized.includes('no exit load') || normalized.includes('nil')) {
         const match = normalized.match(/(?:after|beyond)\s+(\d+)\s+days/);
         if (match && holdingDays > parseInt(match[1])) return 0;
      }

      const tiers: { percent: number, days: number }[] = [];
      const matches = normalized.matchAll(/(\d+(?:\.\d+)?)%\s+if\s+.*?(\d+)\s+days/g);
      
      for (const m of matches) {
        tiers.push({ percent: parseFloat(m[1]) / 100, days: parseInt(m[2]) });
      }

      if (tiers.length > 0) {
        tiers.sort((a, b) => a.days - b.days);
        for (const t of tiers) {
          if (holdingDays <= t.days) return t.percent;
        }
        return 0;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  public static isEquity(assetType: AssetType, assetName: string): boolean {
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
