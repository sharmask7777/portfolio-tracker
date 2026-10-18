export class PortfolioUtils {
  /**
   * Safely gets the latest unit balance from a list of transactions.
   * Skips auxiliary transactions like taxes/duties that might have 0 balance.
   */
  public static getLatestUnits(transactions: any[]): number {
    if (!transactions || transactions.length === 0) return 0;

    // Sort by date ascending to ensure we look from the end of the chronological list
    const sorted = this.sortTransactions(transactions);

    // Look for the last transaction that is a unit-bearing type
    // We iterate backwards to find the most recent balance update
    for (let i = sorted.length - 1; i >= 0; i--) {
      const tx = sorted[i];
      const type = (tx.type || '').toLowerCase();
      
      // Ignore tax/duty/charge/misc transactions as they often carry 0 balance in CAS
      const isAuxiliary = type.includes('tax') || type.includes('duty') || type.includes('charge') || type.includes('stt') || (type.includes('misc') && (!tx.units || Math.abs(tx.units) < 0.0001));
      
      if (!isAuxiliary && tx.balance !== null && tx.balance !== undefined) {
        const bal = parseFloat(String(tx.balance));
        return (!isNaN(bal) && Math.abs(bal) >= 0.001) ? bal : 0;
      }
    }

    // Fallback to the absolute last transaction if no primary transaction found
    const lastBal = parseFloat(String(sorted[sorted.length - 1].balance));
    return (!isNaN(lastBal) && Math.abs(lastBal) >= 0.001) ? lastBal : 0;
  }

  /**
   * Safely gets the latest NAV from a list of transactions.
   * Skips auxiliary transactions like taxes/duties that might have 0 NAV.
   */
  public static getLatestNAV(transactions: any[]): number {
    if (!transactions || transactions.length === 0) return 0;

    const sorted = this.sortTransactions(transactions);

    for (let i = sorted.length - 1; i >= 0; i--) {
      const tx = sorted[i];
      const type = (tx.type || '').toLowerCase();
      const isAuxiliary = type.includes('tax') || type.includes('duty') || type.includes('charge') || type.includes('stt');
      
      if (!isAuxiliary && tx.nav > 0) {
        return tx.nav;
      }
    }

    return sorted[sorted.length - 1].nav || 0;
  }

  /**
   * Sorts transactions chronologically with a deterministic tie-breaker for same-day transactions.
   */
  public static sortTransactions<T extends { date: string | Date; createdAt?: string | Date; id?: string; type?: string }>(transactions: T[]): T[] {
    return [...transactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;

      // On same day, process BUYS/INFLOWS before SELLS/REDEMPTIONS so balance drops properly
      const isSellA = (a.type || '').toLowerCase().includes('sell') || (a.type || '').toLowerCase().includes('redemption');
      const isSellB = (b.type || '').toLowerCase().includes('sell') || (b.type || '').toLowerCase().includes('redemption');
      if (isSellA !== isSellB) {
        return isSellA ? 1 : -1;
      }
      
      if (a.createdAt && b.createdAt) {
        const createA = new Date(a.createdAt).getTime();
        const createB = new Date(b.createdAt).getTime();
        if (createA !== createB) return createA - createB;
      }
      
      return (a.id || '').localeCompare(b.id || '');
    });
  }
  /**
   * Safely calculates net invested amount for a set of transactions.
   */
  public static getTotalInvested(transactions: any[]): number {
    if (!transactions || transactions.length === 0) return 0;
    return transactions.reduce((acc, tx) => {
      const type = (tx.type || '').toLowerCase();
      const isOutflow = type.includes('buy') || 
                        type.includes('purchase') ||
                        type.includes('sip') ||
                        type.includes('switch_in') ||
                        type.includes('reinvestment') ||
                        type.includes('balance_stmt') ||
                        type.includes('opening_balance') ||
                        type.includes('tax') ||
                        type.includes('duty') ||
                        type.includes('charge') ||
                        type.includes('stt');

      const isInflow = type.includes('sell') ||
                       type.includes('redemption') ||
                       type.includes('switch_out');

      return isOutflow ? acc + Math.abs(tx.amount || 0) : isInflow ? acc - Math.abs(tx.amount || 0) : acc;
    }, 0);
  }
}

