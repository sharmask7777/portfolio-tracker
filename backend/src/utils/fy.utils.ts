export class FYUtils {
  /**
   * Returns the FY string for a given date (e.g., "2024-25")
   */
  public static getFY(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    
    if (month >= 3) { // April onwards
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  /**
   * Returns the start and end dates for a given FY string (e.g., "2024-25")
   */
  public static getFYDates(fy: string): { start: Date; end: Date } {
    const [startYearStr] = fy.split('-');
    const startYear = parseInt(startYearStr, 10);
    return {
      start: new Date(startYear, 3, 1),
      end: new Date(startYear + 1, 2, 31, 23, 59, 59),
    };
  }

  /**
   * Returns a list of recent FYs (current + last N)
   */
  public static getRecentFYs(count: number = 3): string[] {
    const currentFY = this.getFY();
    const [startYearStr] = currentFY.split('-');
    let startYear = parseInt(startYearStr, 10);
    
    const fys = [];
    for (let i = 0; i < count; i++) {
      fys.push(`${startYear}-${(startYear + 1).toString().slice(-2)}`);
      startYear--;
    }
    return fys;
  }
}
