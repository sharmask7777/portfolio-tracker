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
      const type = tx.type.toLowerCase();
      
      // Ignore tax/duty/charge transactions as they often carry 0 balance in CAS
      const isAuxiliary = type.includes('tax') || type.includes('duty') || type.includes('charge') || type.includes('stt');
      
      if (!isAuxiliary) {
        return tx.balance || 0;
      }
    }

    // Fallback to the absolute last transaction if no primary transaction found
    return sorted[sorted.length - 1].balance || 0;
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
      const type = tx.type.toLowerCase();
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
  public static sortTransactions<T extends { date: string | Date; createdAt?: string | Date; id?: string }>(transactions: T[]): T[] {
    return [...transactions].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      
      if (a.createdAt && b.createdAt) {
        const createA = new Date(a.createdAt).getTime();
        const createB = new Date(b.createdAt).getTime();
        if (createA !== createB) return createA - createB;
      }
      
      return (a.id || '').localeCompare(b.id || '');
    });
  }
}
