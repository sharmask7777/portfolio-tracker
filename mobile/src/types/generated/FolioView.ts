export interface FolioTransaction {
  type?: string;
  units?: number;
  nav?: number;
  date: string;
  amount?: number;
}

export interface FolioMetrics {
  currentPrice?: number;
  investedAmount?: number;
  currentValue?: number;
  totalGain?: number;
  absoluteReturn?: number;
  cagr?: number;
  xirr?: number;
}

export interface FolioView {
  id: string;
  name?: string;
  folioNumber?: string;
  asset?: {
    name?: string;
    type?: string;
  };
  metrics?: FolioMetrics;
  transactions?: FolioTransaction[];
}
