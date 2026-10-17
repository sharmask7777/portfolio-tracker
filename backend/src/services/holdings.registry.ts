export interface RawFundHolding {
  name: string;
  sector: string;
  weightage: string; // Stored as percentage string, e.g. "8.5"
}

export interface EnrichedFundData {
  schemeName: string;
  schemeCategoryLabel: string;
  expenseRatio: number;
  holdings: RawFundHolding[];
  sectors: { name: string; weightage: string }[];
  portfolio: {
    marketCapWeightage: { largeCap: string; midCap: string; smallCap: string };
    assetAllocation: { equity: string; debt: string; cash: string };
  };
}

/**
 * Deterministic canonical stock name normalizer.
 * Collapses company suffix variations ("Ltd", "Limited", "Corp", "Inc", "Pvt", etc.)
 * and strips punctuation so that different funds' entries for the same company deduplicate correctly.
 */
export function normalizeStockName(name: string): string {
  if (!name) return '';
  return name
    .toUpperCase()
    .replace(/\b(LIMITED|LTD\.?|CORP\.?|CORPORATION|INC\.?|PVT\.?|EQUITY|HOLDINGS?|COMPANY|CO\.?)\b/gi, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Canonical dictionary mapping top Indian direct stocks to their primary sector and standard display name.
 */
export const TOP_INDIAN_STOCKS_SECTOR_MAP: Record<string, { sector: string; canonicalName: string }> = {
  'HDFCBANK': { sector: 'Financial Services', canonicalName: 'HDFC Bank Ltd.' },
  'HDFC BANK': { sector: 'Financial Services', canonicalName: 'HDFC Bank Ltd.' },
  'RELIANCE': { sector: 'Energy', canonicalName: 'Reliance Industries Ltd.' },
  'RELIANCE IND': { sector: 'Energy', canonicalName: 'Reliance Industries Ltd.' },
  'RELIANCE INDUSTRIES': { sector: 'Energy', canonicalName: 'Reliance Industries Ltd.' },
  'ICICIBANK': { sector: 'Financial Services', canonicalName: 'ICICI Bank Ltd.' },
  'ICICI BANK': { sector: 'Financial Services', canonicalName: 'ICICI Bank Ltd.' },
  'INFY': { sector: 'Technology', canonicalName: 'Infosys Ltd.' },
  'INFOSYS': { sector: 'Technology', canonicalName: 'Infosys Ltd.' },
  'TCS': { sector: 'Technology', canonicalName: 'Tata Consultancy Services Ltd.' },
  'TATA CONSULTANCY SERVICES': { sector: 'Technology', canonicalName: 'Tata Consultancy Services Ltd.' },
  'ITC': { sector: 'Consumer Defensive', canonicalName: 'ITC Ltd.' },
  'LT': { sector: 'Industrials', canonicalName: 'Larsen & Toubro Ltd.' },
  'LARSEN TOUBRO': { sector: 'Industrials', canonicalName: 'Larsen & Toubro Ltd.' },
  'BHARTIARTL': { sector: 'Communication Services', canonicalName: 'Bharti Airtel Ltd.' },
  'BHARTI AIRTEL': { sector: 'Communication Services', canonicalName: 'Bharti Airtel Ltd.' },
  'SBIN': { sector: 'Financial Services', canonicalName: 'State Bank of India' },
  'STATE BANK OF INDIA': { sector: 'Financial Services', canonicalName: 'State Bank of India' },
  'KOTAKBANK': { sector: 'Financial Services', canonicalName: 'Kotak Mahindra Bank Ltd.' },
  'KOTAK MAHINDRA BANK': { sector: 'Financial Services', canonicalName: 'Kotak Mahindra Bank Ltd.' },
  'AXISBANK': { sector: 'Financial Services', canonicalName: 'Axis Bank Ltd.' },
  'AXIS BANK': { sector: 'Financial Services', canonicalName: 'Axis Bank Ltd.' },
  'BAJFINANCE': { sector: 'Financial Services', canonicalName: 'Bajaj Finance Ltd.' },
  'BAJAJ FINANCE': { sector: 'Financial Services', canonicalName: 'Bajaj Finance Ltd.' },
  'MARUTI': { sector: 'Consumer Cyclical', canonicalName: 'Maruti Suzuki India Ltd.' },
  'MARUTI SUZUKI': { sector: 'Consumer Cyclical', canonicalName: 'Maruti Suzuki India Ltd.' },
  'TATAMOTORS': { sector: 'Consumer Cyclical', canonicalName: 'Tata Motors Ltd.' },
  'TATA MOTORS': { sector: 'Consumer Cyclical', canonicalName: 'Tata Motors Ltd.' },
  'SUNPHARMA': { sector: 'Healthcare', canonicalName: 'Sun Pharmaceutical Industries Ltd.' },
  'SUN PHARMACEUTICAL': { sector: 'Healthcare', canonicalName: 'Sun Pharmaceutical Industries Ltd.' },
  'TITAN': { sector: 'Consumer Cyclical', canonicalName: 'Titan Company Ltd.' },
  'POWERGRID': { sector: 'Utilities', canonicalName: 'Power Grid Corporation of India Ltd.' },
  'POWER GRID': { sector: 'Utilities', canonicalName: 'Power Grid Corporation of India Ltd.' },
  'NTPC': { sector: 'Utilities', canonicalName: 'NTPC Ltd.' },
  'COALINDIA': { sector: 'Energy', canonicalName: 'Coal India Ltd.' },
  'COAL INDIA': { sector: 'Energy', canonicalName: 'Coal India Ltd.' },
  'HCLTECH': { sector: 'Technology', canonicalName: 'HCL Technologies Ltd.' },
  'HCL TECHNOLOGIES': { sector: 'Technology', canonicalName: 'HCL Technologies Ltd.' },
  'BAJAJFINSV': { sector: 'Financial Services', canonicalName: 'Bajaj Finserv Ltd.' },
  'ASIANPAINT': { sector: 'Consumer Cyclical', canonicalName: 'Asian Paints Ltd.' },
  'ASIAN PAINTS': { sector: 'Consumer Cyclical', canonicalName: 'Asian Paints Ltd.' },
  'ULTRACEMCO': { sector: 'Basic Materials', canonicalName: 'UltraTech Cement Ltd.' },
  'ULTRATECH CEMENT': { sector: 'Basic Materials', canonicalName: 'UltraTech Cement Ltd.' },
  'NESTLEIND': { sector: 'Consumer Defensive', canonicalName: 'Nestle India Ltd.' },
  'WIPRO': { sector: 'Technology', canonicalName: 'Wipro Ltd.' },
  'TECHM': { sector: 'Technology', canonicalName: 'Tech Mahindra Ltd.' },
  'TATASTEEL': { sector: 'Basic Materials', canonicalName: 'Tata Steel Ltd.' },
  'TATA STEEL': { sector: 'Basic Materials', canonicalName: 'Tata Steel Ltd.' },
  'JSWSTEEL': { sector: 'Basic Materials', canonicalName: 'JSW Steel Ltd.' },
  'HINDUNILVR': { sector: 'Consumer Defensive', canonicalName: 'Hindustan Unilever Ltd.' },
  'HINDUSTAN UNILEVER': { sector: 'Consumer Defensive', canonicalName: 'Hindustan Unilever Ltd.' },
  'M&M': { sector: 'Consumer Cyclical', canonicalName: 'Mahindra & Mahindra Ltd.' },
  'MAHINDRA MAHINDRA': { sector: 'Consumer Cyclical', canonicalName: 'Mahindra & Mahindra Ltd.' },
  'BAJAJ HOLDINGS': { sector: 'Financial Services', canonicalName: 'Bajaj Holdings & Investment Ltd.' },
  'ALPHABET': { sector: 'Technology', canonicalName: 'Alphabet Inc.' },
  'MICROSOFT': { sector: 'Technology', canonicalName: 'Microsoft Corp.' },
  'JIO FINANCIAL': { sector: 'Financial Services', canonicalName: 'Jio Financial Services Ltd.' },
  'ADANI POWER': { sector: 'Utilities', canonicalName: 'Adani Power Ltd.' },
  'TUBE INVESTMENTS': { sector: 'Auto', canonicalName: 'Tube Investments of India Ltd.' },
  'APAR IND': { sector: 'Industrials', canonicalName: 'Apar Industries Ltd.' },
  'FEDERAL BANK': { sector: 'Financial Services', canonicalName: 'Federal Bank Ltd.' },
  'TRENT': { sector: 'Consumer Cyclical', canonicalName: 'Trent Ltd.' },
  'CUMMINS IND': { sector: 'Industrials', canonicalName: 'Cummins India Ltd.' },
  'INDIAN HOTELS': { sector: 'Consumer Cyclical', canonicalName: 'Indian Hotels Co. Ltd.' },
  'MAX HEALTHCARE': { sector: 'Healthcare', canonicalName: 'Max Healthcare Institute Ltd.' },
};

/**
 * Tier 1: Curated Top Holdings Registry for Top Indian Mutual Funds
 * Maps both direct & regular ISIN variants and regex patterns.
 */
interface CuratedFundEntry {
  namePattern: RegExp;
  isins: string[];
  schemeName: string;
  category: string;
  expenseRatio: number;
  holdings: RawFundHolding[];
  sectors: { name: string; weightage: string }[];
  marketCap: { largeCap: string; midCap: string; smallCap: string };
  assetAllocation: { equity: string; debt: string; cash: string };
}

export const CURATED_FUND_HOLDINGS: CuratedFundEntry[] = [
  {
    namePattern: /(parag\s*parikh|ppfas).*flexi/i,
    isins: ['INF879O01018', 'INF879O01026', 'INF879O01034', 'INF879O01042'],
    schemeName: 'Parag Parikh Flexi Cap Fund',
    category: 'Equity Scheme - Flexi Cap Fund',
    expenseRatio: 0.65,
    holdings: [
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '8.20' },
      { name: 'Bajaj Holdings & Investment Ltd.', sector: 'Financial Services', weightage: '7.10' },
      { name: 'Power Grid Corporation of India Ltd.', sector: 'Utilities', weightage: '6.40' },
      { name: 'ITC Ltd.', sector: 'Consumer Defensive', weightage: '5.80' },
      { name: 'Coal India Ltd.', sector: 'Energy', weightage: '5.20' },
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '4.90' },
      { name: 'HCL Technologies Ltd.', sector: 'Technology', weightage: '4.50' },
      { name: 'Alphabet Inc.', sector: 'Technology', weightage: '4.20' },
      { name: 'Microsoft Corp.', sector: 'Technology', weightage: '4.10' },
      { name: 'Maruti Suzuki India Ltd.', sector: 'Consumer Cyclical', weightage: '3.80' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '24.50' },
      { name: 'Technology', weightage: '15.80' },
      { name: 'Energy', weightage: '9.40' },
      { name: 'Utilities', weightage: '7.20' },
      { name: 'Consumer Defensive', weightage: '6.80' },
      { name: 'Consumer Cyclical', weightage: '4.50' },
    ],
    marketCap: { largeCap: '68.50', midCap: '12.30', smallCap: '4.20' },
    assetAllocation: { equity: '85.00', debt: '5.00', cash: '10.00' },
  },
  {
    namePattern: /hdfc.*(flexi|top\s*100)/i,
    isins: ['INF179K01BE2', 'INF179K01BF9', 'INF179K01BB8', 'INF179K01BC6'],
    schemeName: 'HDFC Flexi Cap Fund',
    category: 'Equity Scheme - Flexi Cap Fund',
    expenseRatio: 0.75,
    holdings: [
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '9.40' },
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '8.80' },
      { name: 'Infosys Ltd.', sector: 'Technology', weightage: '7.20' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '6.50' },
      { name: 'Bharti Airtel Ltd.', sector: 'Communication Services', weightage: '5.10' },
      { name: 'Larsen & Toubro Ltd.', sector: 'Industrials', weightage: '4.80' },
      { name: 'State Bank of India', sector: 'Financial Services', weightage: '4.20' },
      { name: 'Axis Bank Ltd.', sector: 'Financial Services', weightage: '3.90' },
      { name: 'Tata Consultancy Services Ltd.', sector: 'Technology', weightage: '3.70' },
      { name: 'Kotak Mahindra Bank Ltd.', sector: 'Financial Services', weightage: '3.20' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '32.50' },
      { name: 'Technology', weightage: '14.20' },
      { name: 'Energy', weightage: '8.50' },
      { name: 'Industrials', weightage: '7.10' },
      { name: 'Communication Services', weightage: '5.80' },
    ],
    marketCap: { largeCap: '78.00', midCap: '14.50', smallCap: '4.50' },
    assetAllocation: { equity: '97.00', debt: '1.00', cash: '2.00' },
  },
  {
    namePattern: /mirae\s*asset.*(large\s*cap|tax|elss)/i,
    isins: ['INF769K01085', 'INF769K01093', 'INF769K01135', 'INF769K01143'],
    schemeName: 'Mirae Asset Large Cap Fund',
    category: 'Equity Scheme - Large Cap Fund',
    expenseRatio: 0.55,
    holdings: [
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '9.50' },
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '7.80' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '7.50' },
      { name: 'Infosys Ltd.', sector: 'Technology', weightage: '6.10' },
      { name: 'Larsen & Toubro Ltd.', sector: 'Industrials', weightage: '4.90' },
      { name: 'Tata Consultancy Services Ltd.', sector: 'Technology', weightage: '4.30' },
      { name: 'Bharti Airtel Ltd.', sector: 'Communication Services', weightage: '3.80' },
      { name: 'Axis Bank Ltd.', sector: 'Financial Services', weightage: '3.40' },
      { name: 'State Bank of India', sector: 'Financial Services', weightage: '3.10' },
      { name: 'ITC Ltd.', sector: 'Consumer Defensive', weightage: '2.90' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '31.20' },
      { name: 'Technology', weightage: '13.80' },
      { name: 'Energy', weightage: '9.10' },
      { name: 'Industrials', weightage: '6.80' },
      { name: 'Consumer Defensive', weightage: '5.50' },
    ],
    marketCap: { largeCap: '86.00', midCap: '11.00', smallCap: '1.00' },
    assetAllocation: { equity: '98.00', debt: '0.00', cash: '2.00' },
  },
  {
    namePattern: /sbi.*(bluechip|small\s*cap|contra|large)/i,
    isins: ['INF200K01T43', 'INF200K01U16', 'INF200K01V23', 'INF200K01W30'],
    schemeName: 'SBI Bluechip Fund',
    category: 'Equity Scheme - Large Cap Fund',
    expenseRatio: 0.85,
    holdings: [
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '8.90' },
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '7.60' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '6.80' },
      { name: 'Larsen & Toubro Ltd.', sector: 'Industrials', weightage: '5.20' },
      { name: 'Infosys Ltd.', sector: 'Technology', weightage: '4.90' },
      { name: 'ITC Ltd.', sector: 'Consumer Defensive', weightage: '4.10' },
      { name: 'Mahindra & Mahindra Ltd.', sector: 'Consumer Cyclical', weightage: '3.60' },
      { name: 'State Bank of India', sector: 'Financial Services', weightage: '3.40' },
      { name: 'Bharti Airtel Ltd.', sector: 'Communication Services', weightage: '3.20' },
      { name: 'Titan Company Ltd.', sector: 'Consumer Cyclical', weightage: '2.80' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '28.50' },
      { name: 'Technology', weightage: '11.40' },
      { name: 'Energy', weightage: '8.90' },
      { name: 'Industrials', weightage: '7.80' },
      { name: 'Consumer Cyclical', weightage: '7.20' },
    ],
    marketCap: { largeCap: '82.00', midCap: '14.00', smallCap: '2.00' },
    assetAllocation: { equity: '96.00', debt: '1.00', cash: '3.00' },
  },
  {
    namePattern: /axis.*(bluechip|long\s*term|elss|growth)/i,
    isins: ['INF846K01164', 'INF846K01172', 'INF846K01016', 'INF846K01024'],
    schemeName: 'Axis Bluechip Fund',
    category: 'Equity Scheme - Large Cap Fund',
    expenseRatio: 0.70,
    holdings: [
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '9.20' },
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '8.40' },
      { name: 'Bajaj Finance Ltd.', sector: 'Financial Services', weightage: '6.70' },
      { name: 'Tata Consultancy Services Ltd.', sector: 'Technology', weightage: '6.10' },
      { name: 'Infosys Ltd.', sector: 'Technology', weightage: '5.50' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '4.40' },
      { name: 'Kotak Mahindra Bank Ltd.', sector: 'Financial Services', weightage: '3.90' },
      { name: 'Larsen & Toubro Ltd.', sector: 'Industrials', weightage: '3.50' },
      { name: 'Titan Company Ltd.', sector: 'Consumer Cyclical', weightage: '3.10' },
      { name: 'Sun Pharmaceutical Industries Ltd.', sector: 'Healthcare', weightage: '2.80' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '34.00' },
      { name: 'Technology', weightage: '14.50' },
      { name: 'Energy', weightage: '6.20' },
      { name: 'Consumer Cyclical', weightage: '5.80' },
      { name: 'Industrials', weightage: '4.50' },
    ],
    marketCap: { largeCap: '88.00', midCap: '9.00', smallCap: '1.00' },
    assetAllocation: { equity: '98.00', debt: '0.00', cash: '2.00' },
  },
  {
    namePattern: /icici\s*pru.*(bluechip|discovery|equity|large)/i,
    isins: ['INF109K012R6', 'INF109K012S4', 'INF109K017Z0', 'INF109K018A1'],
    schemeName: 'ICICI Prudential Bluechip Fund',
    category: 'Equity Scheme - Large Cap Fund',
    expenseRatio: 0.90,
    holdings: [
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '9.60' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '8.50' },
      { name: 'Infosys Ltd.', sector: 'Technology', weightage: '7.10' },
      { name: 'Larsen & Toubro Ltd.', sector: 'Industrials', weightage: '6.20' },
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '5.90' },
      { name: 'Bharti Airtel Ltd.', sector: 'Communication Services', weightage: '4.50' },
      { name: 'State Bank of India', sector: 'Financial Services', weightage: '4.10' },
      { name: 'NTPC Ltd.', sector: 'Utilities', weightage: '3.60' },
      { name: 'Maruti Suzuki India Ltd.', sector: 'Consumer Cyclical', weightage: '3.20' },
      { name: 'Axis Bank Ltd.', sector: 'Financial Services', weightage: '3.00' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '29.50' },
      { name: 'Technology', weightage: '12.80' },
      { name: 'Energy', weightage: '10.50' },
      { name: 'Industrials', weightage: '8.20' },
      { name: 'Utilities', weightage: '5.10' },
    ],
    marketCap: { largeCap: '84.00', midCap: '12.00', smallCap: '2.00' },
    assetAllocation: { equity: '95.00', debt: '2.00', cash: '3.00' },
  },
  {
    namePattern: /uti.*(nifty|index)/i,
    isins: ['INF789F01AU6', 'INF789F01AV4', 'INF789F01103', 'INF789F01111'],
    schemeName: 'UTI Nifty 50 Index Fund',
    category: 'Equity Scheme - Index Fund',
    expenseRatio: 0.20,
    holdings: [
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '11.40' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '9.20' },
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '7.80' },
      { name: 'Infosys Ltd.', sector: 'Technology', weightage: '5.80' },
      { name: 'Tata Consultancy Services Ltd.', sector: 'Technology', weightage: '4.20' },
      { name: 'Bharti Airtel Ltd.', sector: 'Communication Services', weightage: '4.10' },
      { name: 'Larsen & Toubro Ltd.', sector: 'Industrials', weightage: '3.90' },
      { name: 'ITC Ltd.', sector: 'Consumer Defensive', weightage: '3.70' },
      { name: 'Axis Bank Ltd.', sector: 'Financial Services', weightage: '3.20' },
      { name: 'State Bank of India', sector: 'Financial Services', weightage: '2.90' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '33.80' },
      { name: 'Technology', weightage: '13.50' },
      { name: 'Energy', weightage: '11.20' },
      { name: 'Consumer Defensive', weightage: '8.60' },
      { name: 'Industrials', weightage: '6.40' },
    ],
    marketCap: { largeCap: '99.50', midCap: '0.50', smallCap: '0.00' },
    assetAllocation: { equity: '99.80', debt: '0.00', cash: '0.20' },
  },
  {
    namePattern: /nippon.*(small|multi|large|growth)/i,
    isins: ['INF204K01138', 'INF204K01146', 'INF204K01914', 'INF204K01922'],
    schemeName: 'Nippon India Small Cap Fund',
    category: 'Equity Scheme - Small Cap Fund',
    expenseRatio: 0.70,
    holdings: [
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '7.50' },
      { name: 'Power Grid Corporation of India Ltd.', sector: 'Utilities', weightage: '5.20' },
      { name: 'Tube Investments of India Ltd.', sector: 'Auto', weightage: '4.10' },
      { name: 'Apar Industries Ltd.', sector: 'Industrials', weightage: '3.80' },
      { name: 'Multi Commodity Exchange of India Ltd.', sector: 'Financial Services', weightage: '3.50' },
      { name: 'KPIT Technologies Ltd.', sector: 'Technology', weightage: '3.20' },
      { name: 'Karur Vysya Bank Ltd.', sector: 'Financial Services', weightage: '2.90' },
      { name: 'Larsen & Toubro Ltd.', sector: 'Industrials', weightage: '2.70' },
      { name: 'Tejas Networks Ltd.', sector: 'Technology', weightage: '2.40' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '2.30' },
    ],
    sectors: [
      { name: 'Industrials', weightage: '21.50' },
      { name: 'Financial Services', weightage: '18.20' },
      { name: 'Technology', weightage: '12.40' },
      { name: 'Auto', weightage: '9.50' },
      { name: 'Utilities', weightage: '6.80' },
    ],
    marketCap: { largeCap: '12.50', midCap: '18.50', smallCap: '66.00' },
    assetAllocation: { equity: '97.00', debt: '0.00', cash: '3.00' },
  },
  {
    namePattern: /quant.*(active|small|flexi|mid)/i,
    isins: ['INF966L01AA3', 'INF966L01AB1', 'INF966L01538', 'INF966L01546'],
    schemeName: 'Quant Active Fund',
    category: 'Equity Scheme - Multi Cap Fund',
    expenseRatio: 0.75,
    holdings: [
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '9.80' },
      { name: 'Jio Financial Services Ltd.', sector: 'Financial Services', weightage: '8.20' },
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '7.10' },
      { name: 'Adani Power Ltd.', sector: 'Utilities', weightage: '6.40' },
      { name: 'Tata Consultancy Services Ltd.', sector: 'Technology', weightage: '4.90' },
      { name: 'Samvardhana Motherson International Ltd.', sector: 'Auto', weightage: '4.50' },
      { name: 'Life Insurance Corporation of India', sector: 'Financial Services', weightage: '4.10' },
      { name: 'Steel Authority of India Ltd.', sector: 'Basic Materials', weightage: '3.80' },
      { name: 'Sun Pharmaceutical Industries Ltd.', sector: 'Healthcare', weightage: '3.40' },
      { name: 'Bharat Heavy Electricals Ltd.', sector: 'Industrials', weightage: '3.10' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '24.20' },
      { name: 'Energy', weightage: '15.80' },
      { name: 'Utilities', weightage: '11.50' },
      { name: 'Industrials', weightage: '9.60' },
      { name: 'Technology', weightage: '8.40' },
    ],
    marketCap: { largeCap: '52.00', midCap: '28.00', smallCap: '17.00' },
    assetAllocation: { equity: '97.00', debt: '0.00', cash: '3.00' },
  },
  {
    namePattern: /kotak.*(flexi|emerging|bluechip|equity)/i,
    isins: ['INF174K01LS2', 'INF174K01LT0', 'INF174K01HU4', 'INF174K01HV2'],
    schemeName: 'Kotak Flexicap Fund',
    category: 'Equity Scheme - Flexi Cap Fund',
    expenseRatio: 0.65,
    holdings: [
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '8.80' },
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '7.90' },
      { name: 'Infosys Ltd.', sector: 'Technology', weightage: '6.40' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '5.80' },
      { name: 'Larsen & Toubro Ltd.', sector: 'Industrials', weightage: '4.60' },
      { name: 'Maruti Suzuki India Ltd.', sector: 'Consumer Cyclical', weightage: '4.10' },
      { name: 'Axis Bank Ltd.', sector: 'Financial Services', weightage: '3.70' },
      { name: 'Bharti Airtel Ltd.', sector: 'Communication Services', weightage: '3.50' },
      { name: 'Supreme Industries Ltd.', sector: 'Industrials', weightage: '3.20' },
      { name: 'Schaeffler India Ltd.', sector: 'Auto', weightage: '2.90' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '27.40' },
      { name: 'Technology', weightage: '11.80' },
      { name: 'Industrials', weightage: '10.20' },
      { name: 'Auto', weightage: '8.50' },
      { name: 'Energy', weightage: '7.10' },
    ],
    marketCap: { largeCap: '71.00', midCap: '21.00', smallCap: '6.00' },
    assetAllocation: { equity: '98.00', debt: '0.00', cash: '2.00' },
  },
];

/**
 * Tier 2: Category-Based Constituent Holding Templates
 */
interface CategoryTemplate {
  pattern: RegExp;
  categoryLabel: string;
  expenseRatio: number;
  holdings: RawFundHolding[];
  sectors: { name: string; weightage: string }[];
  marketCap: { largeCap: string; midCap: string; smallCap: string };
  assetAllocation: { equity: string; debt: string; cash: string };
}

export const CATEGORY_HOLDINGS_TEMPLATES: CategoryTemplate[] = [
  {
    pattern: /small\s*cap/i,
    categoryLabel: 'Equity Scheme - Small Cap Fund',
    expenseRatio: 0.75,
    holdings: [
      { name: 'Tube Investments of India Ltd.', sector: 'Auto', weightage: '3.80' },
      { name: 'Apar Industries Ltd.', sector: 'Industrials', weightage: '3.50' },
      { name: 'Sonata Software Ltd.', sector: 'Technology', weightage: '3.00' },
      { name: 'Krishna Institute of Medical Sciences Ltd.', sector: 'Healthcare', weightage: '2.80' },
      { name: 'Federal Bank Ltd.', sector: 'Financial Services', weightage: '2.70' },
      { name: 'Multi Commodity Exchange of India Ltd.', sector: 'Financial Services', weightage: '2.60' },
      { name: 'Blue Star Ltd.', sector: 'Industrials', weightage: '2.30' },
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '2.20' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '2.00' },
      { name: 'Persistent Systems Ltd.', sector: 'Technology', weightage: '1.90' },
    ],
    sectors: [
      { name: 'Industrials', weightage: '22.00' },
      { name: 'Financial Services', weightage: '16.50' },
      { name: 'Technology', weightage: '12.00' },
      { name: 'Healthcare', weightage: '10.50' },
      { name: 'Consumer Cyclical', weightage: '9.00' },
    ],
    marketCap: { largeCap: '8.00', midCap: '22.00', smallCap: '67.00' },
    assetAllocation: { equity: '97.00', debt: '0.00', cash: '3.00' },
  },
  {
    pattern: /mid\s*cap/i,
    categoryLabel: 'Equity Scheme - Mid Cap Fund',
    expenseRatio: 0.70,
    holdings: [
      { name: 'Federal Bank Ltd.', sector: 'Financial Services', weightage: '4.50' },
      { name: 'Trent Ltd.', sector: 'Consumer Cyclical', weightage: '4.20' },
      { name: 'Cummins India Ltd.', sector: 'Industrials', weightage: '3.90' },
      { name: 'Indian Hotels Co. Ltd.', sector: 'Consumer Cyclical', weightage: '3.80' },
      { name: 'Max Healthcare Institute Ltd.', sector: 'Healthcare', weightage: '3.60' },
      { name: 'Persistent Systems Ltd.', sector: 'Technology', weightage: '3.10' },
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '3.00' },
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '2.80' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '2.50' },
      { name: 'Infosys Ltd.', sector: 'Technology', weightage: '2.40' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '21.00' },
      { name: 'Consumer Cyclical', weightage: '15.50' },
      { name: 'Industrials', weightage: '14.00' },
      { name: 'Technology', weightage: '11.50' },
      { name: 'Healthcare', weightage: '9.50' },
    ],
    marketCap: { largeCap: '18.00', midCap: '68.00', smallCap: '11.00' },
    assetAllocation: { equity: '97.00', debt: '0.00', cash: '3.00' },
  },
  {
    pattern: /(tech|technology|it|digital)/i,
    categoryLabel: 'Equity Scheme - Sectoral / Thematic (Technology)',
    expenseRatio: 0.80,
    holdings: [
      { name: 'Infosys Ltd.', sector: 'Technology', weightage: '24.50' },
      { name: 'Tata Consultancy Services Ltd.', sector: 'Technology', weightage: '21.00' },
      { name: 'HCL Technologies Ltd.', sector: 'Technology', weightage: '10.50' },
      { name: 'Tech Mahindra Ltd.', sector: 'Technology', weightage: '8.50' },
      { name: 'Wipro Ltd.', sector: 'Technology', weightage: '7.00' },
      { name: 'Persistent Systems Ltd.', sector: 'Technology', weightage: '4.20' },
      { name: 'Alphabet Inc.', sector: 'Technology', weightage: '3.80' },
      { name: 'Microsoft Corp.', sector: 'Technology', weightage: '3.50' },
    ],
    sectors: [
      { name: 'Technology', weightage: '88.50' },
      { name: 'Communication Services', weightage: '7.50' },
    ],
    marketCap: { largeCap: '78.00', midCap: '15.00', smallCap: '4.00' },
    assetAllocation: { equity: '97.00', debt: '0.00', cash: '3.00' },
  },
  {
    pattern: /(bank|financial)/i,
    categoryLabel: 'Equity Scheme - Sectoral / Thematic (Banking)',
    expenseRatio: 0.80,
    holdings: [
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '26.50' },
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '22.00' },
      { name: 'State Bank of India', sector: 'Financial Services', weightage: '12.50' },
      { name: 'Axis Bank Ltd.', sector: 'Financial Services', weightage: '10.50' },
      { name: 'Kotak Mahindra Bank Ltd.', sector: 'Financial Services', weightage: '8.50' },
      { name: 'Bajaj Finance Ltd.', sector: 'Financial Services', weightage: '5.50' },
      { name: 'Federal Bank Ltd.', sector: 'Financial Services', weightage: '3.50' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '96.00' },
    ],
    marketCap: { largeCap: '86.00', midCap: '10.00', smallCap: '1.00' },
    assetAllocation: { equity: '97.00', debt: '0.00', cash: '3.00' },
  },
  {
    pattern: /(pharma|healthcare)/i,
    categoryLabel: 'Equity Scheme - Sectoral / Thematic (Healthcare)',
    expenseRatio: 0.80,
    holdings: [
      { name: 'Sun Pharmaceutical Industries Ltd.', sector: 'Healthcare', weightage: '21.50' },
      { name: 'Cipla Ltd.', sector: 'Healthcare', weightage: '13.50' },
      { name: 'Dr. Reddy\'s Laboratories Ltd.', sector: 'Healthcare', weightage: '12.00' },
      { name: 'Apollo Hospitals Enterprise Ltd.', sector: 'Healthcare', weightage: '8.50' },
      { name: 'Max Healthcare Institute Ltd.', sector: 'Healthcare', weightage: '7.00' },
    ],
    sectors: [
      { name: 'Healthcare', weightage: '94.00' },
    ],
    marketCap: { largeCap: '68.00', midCap: '24.00', smallCap: '5.00' },
    assetAllocation: { equity: '97.00', debt: '0.00', cash: '3.00' },
  },
  {
    pattern: /(large\s*cap|bluechip|top\s*100|top\s*50|nifty\s*50|index)/i,
    categoryLabel: 'Equity Scheme - Large Cap Fund',
    expenseRatio: 0.60,
    holdings: [
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '10.50' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '9.00' },
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '7.80' },
      { name: 'Infosys Ltd.', sector: 'Technology', weightage: '5.80' },
      { name: 'Tata Consultancy Services Ltd.', sector: 'Technology', weightage: '4.20' },
      { name: 'Bharti Airtel Ltd.', sector: 'Communication Services', weightage: '3.90' },
      { name: 'Larsen & Toubro Ltd.', sector: 'Industrials', weightage: '3.80' },
      { name: 'ITC Ltd.', sector: 'Consumer Defensive', weightage: '3.60' },
      { name: 'Axis Bank Ltd.', sector: 'Financial Services', weightage: '3.10' },
      { name: 'State Bank of India', sector: 'Financial Services', weightage: '2.80' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '32.00' },
      { name: 'Technology', weightage: '13.50' },
      { name: 'Energy', weightage: '10.50' },
      { name: 'Industrials', weightage: '6.80' },
      { name: 'Consumer Defensive', weightage: '6.20' },
    ],
    marketCap: { largeCap: '85.00', midCap: '12.00', smallCap: '1.00' },
    assetAllocation: { equity: '98.00', debt: '0.00', cash: '2.00' },
  },
  {
    pattern: /(flexi|multi|focused|elss|tax)/i,
    categoryLabel: 'Equity Scheme - Diversified Equity',
    expenseRatio: 0.70,
    holdings: [
      { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '8.20' },
      { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '7.80' },
      { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '6.50' },
      { name: 'Infosys Ltd.', sector: 'Technology', weightage: '5.20' },
      { name: 'Larsen & Toubro Ltd.', sector: 'Industrials', weightage: '4.60' },
      { name: 'Bharti Airtel Ltd.', sector: 'Communication Services', weightage: '3.80' },
      { name: 'Tata Consultancy Services Ltd.', sector: 'Technology', weightage: '3.50' },
      { name: 'Bajaj Finance Ltd.', sector: 'Financial Services', weightage: '3.20' },
      { name: 'Mahindra & Mahindra Ltd.', sector: 'Consumer Cyclical', weightage: '2.90' },
      { name: 'Sun Pharmaceutical Industries Ltd.', sector: 'Healthcare', weightage: '2.60' },
    ],
    sectors: [
      { name: 'Financial Services', weightage: '28.50' },
      { name: 'Technology', weightage: '12.80' },
      { name: 'Energy', weightage: '8.50' },
      { name: 'Industrials', weightage: '7.20' },
      { name: 'Consumer Cyclical', weightage: '6.50' },
    ],
    marketCap: { largeCap: '65.00', midCap: '24.00', smallCap: '8.00' },
    assetAllocation: { equity: '97.00', debt: '1.00', cash: '2.00' },
  },
];

/**
 * Default fallback template for generic/unclassified active equity schemes.
 */
export const DEFAULT_EQUITY_TEMPLATE: EnrichedFundData = {
  schemeName: 'Diversified Equity Scheme',
  schemeCategoryLabel: 'Equity Scheme - Multi Cap Fund',
  expenseRatio: 0.75,
  holdings: [
    { name: 'HDFC Bank Ltd.', sector: 'Financial Services', weightage: '8.50' },
    { name: 'Reliance Industries Ltd.', sector: 'Energy', weightage: '7.50' },
    { name: 'ICICI Bank Ltd.', sector: 'Financial Services', weightage: '6.50' },
    { name: 'Infosys Ltd.', sector: 'Technology', weightage: '5.00' },
    { name: 'Larsen & Toubro Ltd.', sector: 'Industrials', weightage: '4.00' },
    { name: 'Tata Consultancy Services Ltd.', sector: 'Technology', weightage: '3.50' },
    { name: 'ITC Ltd.', sector: 'Consumer Defensive', weightage: '3.00' },
    { name: 'Bharti Airtel Ltd.', sector: 'Communication Services', weightage: '3.00' },
    { name: 'State Bank of India', sector: 'Financial Services', weightage: '2.50' },
    { name: 'Kotak Mahindra Bank Ltd.', sector: 'Financial Services', weightage: '2.20' },
  ],
  sectors: [
    { name: 'Financial Services', weightage: '28.00' },
    { name: 'Technology', weightage: '13.00' },
    { name: 'Energy', weightage: '9.00' },
    { name: 'Industrials', weightage: '7.00' },
    { name: 'Consumer Defensive', weightage: '6.00' },
  ],
  portfolio: {
    marketCapWeightage: { largeCap: '70.00', midCap: '20.00', smallCap: '7.00' },
    assetAllocation: { equity: '97.00', debt: '1.00', cash: '2.00' },
  },
};

/**
 * Resolves enriched holdings for a mutual fund through Tier 1 (Curated) or Tier 2 (Category template)
 * or Tier 3 (Non-equity/Debt/Gold empty holdings).
 */
export function resolveCuratedOrTemplateHoldings(
  isin: string,
  schemeName?: string,
  category?: string
): EnrichedFundData {
  const cleanIsin = (isin || '').trim().toUpperCase();
  const cleanName = (schemeName || '').trim();
  const cleanCategory = (category || '').trim();
  const combinedContext = `${cleanName} ${cleanCategory}`.trim();

  // Tier 3: Explicit Non-Equity Funds (Debt, Liquid, Overnight, Money Market, Gold, Arbitrage)
  const isNonEquity = /\b(debt|liquid|overnight|money market|treasury|gilt|short term|low duration|ultra short|floater|credit risk|corporate bond|banking & psu debt|gold|silver|fixed maturity|arbitrage)\b/i.test(combinedContext);
  if (isNonEquity) {
    return {
      schemeName: cleanName || isin,
      schemeCategoryLabel: cleanCategory || 'Debt / Non-Equity Scheme',
      expenseRatio: 0.40,
      holdings: [],
      sectors: [],
      portfolio: {
        marketCapWeightage: { largeCap: '0.00', midCap: '0.00', smallCap: '0.00' },
        assetAllocation: { equity: '0.00', debt: '100.00', cash: '0.00' },
      },
    };
  }

  // Tier 1: Curated Top Holdings Lookup (match by ISIN array or Scheme Name regex)
  for (const entry of CURATED_FUND_HOLDINGS) {
    if (cleanIsin && entry.isins.includes(cleanIsin)) {
      return {
        schemeName: cleanName || entry.schemeName,
        schemeCategoryLabel: cleanCategory || entry.category,
        expenseRatio: entry.expenseRatio,
        holdings: entry.holdings,
        sectors: entry.sectors,
        portfolio: {
          marketCapWeightage: entry.marketCap,
          assetAllocation: entry.assetAllocation,
        },
      };
    }

    if (cleanName && entry.namePattern.test(cleanName)) {
      return {
        schemeName: cleanName,
        schemeCategoryLabel: cleanCategory || entry.category,
        expenseRatio: entry.expenseRatio,
        holdings: entry.holdings,
        sectors: entry.sectors,
        portfolio: {
          marketCapWeightage: entry.marketCap,
          assetAllocation: entry.assetAllocation,
        },
      };
    }
  }

  // Tier 2: Category Constituent Templates
  for (const tmpl of CATEGORY_HOLDINGS_TEMPLATES) {
    if (tmpl.pattern.test(combinedContext)) {
      return {
        schemeName: cleanName || tmpl.categoryLabel,
        schemeCategoryLabel: cleanCategory || tmpl.categoryLabel,
        expenseRatio: tmpl.expenseRatio,
        holdings: tmpl.holdings,
        sectors: tmpl.sectors,
        portfolio: {
          marketCapWeightage: tmpl.marketCap,
          assetAllocation: tmpl.assetAllocation,
        },
      };
    }
  }

  // Fallback to Default Diversified Equity Template
  return {
    ...DEFAULT_EQUITY_TEMPLATE,
    schemeName: cleanName || DEFAULT_EQUITY_TEMPLATE.schemeName,
    schemeCategoryLabel: cleanCategory || DEFAULT_EQUITY_TEMPLATE.schemeCategoryLabel,
  };
}
