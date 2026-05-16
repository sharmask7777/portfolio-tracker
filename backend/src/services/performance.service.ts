import xirr from 'xirr';

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
   * Calculates XIRR for a set of transactions.
   * @param transactions Array of transactions with amount and date. 
   *                    Amount should be negative for investments and positive for redemptions.
   * @param currentValue Current market value of the holdings (treated as a final positive cash flow).
   * @param asOfDate The date for the current valuation (default: now).
   */
  public static calculateXIRR(
    transactions: { amount: number; date: Date }[],
    currentValue: number,
    asOfDate: Date = new Date(),
  ): number {
    if (transactions.length === 0) return 0;

    const flows = transactions.map((t) => ({
      amount: t.amount,
      when: t.date,
    }));

    // Add final "redemption" of the current value
    if (currentValue > 0) {
      flows.push({
        amount: currentValue,
        when: asOfDate,
      });
    }

    try {
      // xirr returns a decimal (e.g., 0.1 for 10%). 
      // Some libraries throw if IRR cannot be found (Newton-Raphson doesn't converge).
      return xirr(flows);
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
    // Standardize signs: Purchase is money out (Negative), Redemption is money in (Positive)
    const normalizedTransactions = transactions.map((tx) => {
      const isOutflow = tx.type.toLowerCase().includes('buy') || 
                        tx.type.toLowerCase().includes('purchase') ||
                        tx.type.toLowerCase().includes('sip');
      
      return {
        amount: isOutflow ? -Math.abs(tx.amount) : Math.abs(tx.amount),
        date: new Date(tx.date),
      };
    });

    const investedAmount = transactions.reduce((acc, tx) => {
      const isOutflow = tx.type.toLowerCase().includes('buy') || 
                        tx.type.toLowerCase().includes('purchase') ||
                        tx.type.toLowerCase().includes('sip');
      return isOutflow ? acc + Math.abs(tx.amount) : acc - Math.abs(tx.amount);
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
