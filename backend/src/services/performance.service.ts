import { xirr } from 'node-irr';

export interface PerformanceMetrics {
  absoluteReturn: number;
  cagr: number;
  xirr: number;
  investedAmount: number;
  currentValue: number;
  totalGain: number;
}

export class PerformanceService {
  /**
   * Calculates XIRR for a set of transactions using node-irr for better stability.
   */
  public static calculateXIRR(
    transactions: { amount: number; date: Date }[],
    currentValue: number,
    asOfDate: Date = new Date(),
  ): number {
    if (transactions.length === 0) return 0;

    const flows = transactions.map((t) => ({
      amount: t.amount,
      date: t.date,
    }));

    // Add final "redemption" of the current value
    if (currentValue > 0) {
      flows.push({
        amount: currentValue,
        date: asOfDate,
      });
    }

    try {
      const result = xirr(flows);
      // node-irr returns the daily rate. Annualize it: (1 + r)^365 - 1
      return Math.pow(1 + result.rate, 365) - 1;
    } catch (e) {
      console.error('XIRR calculation failed:', e);
      return 0;
    }
  }

  /**
   * Calculates CAGR (Compound Annual Growth Rate).
   */
  public static calculateCAGR(
    investedAmount: number,
    currentValue: number,
    startDate: Date,
    endDate: Date = new Date(),
  ): number {
    if (investedAmount <= 0 || currentValue <= 0) return 0;

    const diffInMs = endDate.getTime() - startDate.getTime();
    const years = diffInMs / (1000 * 60 * 60 * 24 * 365.25);

    if (years <= 0) return 0;

    // Formula: (CurrentValue / InvestedAmount) ^ (1 / years) - 1
    return Math.pow(currentValue / investedAmount, 1 / years) - 1;
  }

  /**
   * Calculates Absolute Return.
   */
  public static calculateAbsoluteReturn(investedAmount: number, currentValue: number): number {
    if (investedAmount <= 0) return 0;
    return (currentValue - investedAmount) / investedAmount;
  }

  /**
   * Aggregates metrics for a given set of transactions and current price.
   */
  public static getMetrics(
    transactions: any[],
    currentPrice: number,
    currentUnits: number,
  ): PerformanceMetrics {
    // Standardize signs: Money Out of pocket (Negative), Money In to pocket (Positive)
    const normalizedTransactions = transactions.map((tx) => {
      const type = tx.type.toLowerCase();
      
      // Money Out (Investment)
      const isOutflow = type.includes('buy') || 
                        type.includes('purchase') ||
                        type.includes('sip') ||
                        type.includes('switch_in') ||
                        type.includes('reinvestment');
      
      // Money In (Redemption/Dividend Payout)
      const isInflow = type.includes('sell') ||
                       type.includes('redemption') ||
                       type.includes('switch_out') ||
                       type.includes('payout');

      return {
        amount: isOutflow ? -Math.abs(tx.amount) : Math.abs(tx.amount),
        date: new Date(tx.date),
      };
    });

    const investedAmount = transactions.reduce((acc, tx) => {
      const type = tx.type.toLowerCase();
      // Invested amount is strictly out-of-pocket money. 
      // Reinvestments are technically gains reinvested, but in Indian CAS they are counted as acquisitions.
      const isOutflow = type.includes('buy') || 
                        type.includes('purchase') ||
                        type.includes('sip') ||
                        type.includes('switch_in') ||
                        type.includes('reinvestment');
      
      const isInflow = type.includes('sell') ||
                       type.includes('redemption') ||
                       type.includes('switch_out');
                       
      return isOutflow ? acc + Math.abs(tx.amount) : isInflow ? acc - Math.abs(tx.amount) : acc;
    }, 0);

    const currentValue = currentUnits * currentPrice;
    const totalGain = currentValue - investedAmount;

    const firstTxDate = normalizedTransactions.reduce(
      (min, tx) => (tx.date < min ? tx.date : min),
      normalizedTransactions[0]?.date || new Date(),
    );

    return {
      investedAmount,
      currentValue,
      totalGain,
      absoluteReturn: this.calculateAbsoluteReturn(investedAmount, currentValue),
      cagr: this.calculateCAGR(investedAmount, currentValue, firstTxDate),
      xirr: this.calculateXIRR(normalizedTransactions, currentValue),
    };
  }
}
