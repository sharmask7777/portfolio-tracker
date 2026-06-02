export interface XRayData {
  sectors: { name: string; percentage: number; value: number }[];
  marketCap: {
    large: { percentage: number; value: number };
    mid: { percentage: number; value: number };
    small: { percentage: number; value: number };
  };
  assetAllocation: {
    equity: { percentage: number; value: number };
    debt: { percentage: number; value: number };
    cash: { percentage: number; value: number };
    gold: { percentage: number; value: number };
    other: { percentage: number; value: number };
  };
  totalValue: number;
  exArbitrage?: {
    sectors: { name: string; percentage: number; value: number }[];
    marketCap: {
      large: { percentage: number; value: number };
      mid: { percentage: number; value: number };
      small: { percentage: number; value: number };
    };
    assetAllocation: {
      equity: { percentage: number; value: number };
      debt: { percentage: number; value: number };
      cash: { percentage: number; value: number };
      gold: { percentage: number; value: number };
      arbitrage: { percentage: number; value: number };
      other: { percentage: number; value: number };
    };
  };
  expenseAnalysis: {
    totalAnnualFees: number;
    weightedAvgTer: number;
    categoryBreakdown: { category: string; totalFees: number; avgTer: number; percentage: number; value: number }[];
    fundBreakdown: { name: string; isin: string; category: string; ter: number; annualizedFee: number; value: number }[];
  };
  fundCategoryAllocation: {
    active: { percentage: number; value: number };
    index: { percentage: number; value: number };
    arbitrage: { percentage: number; value: number };
    other: { percentage: number; value: number };
  };
}
