// Simple mock data generator without heavy external dependencies to avoid ESM issues in Jest
export interface MockTransaction {
  date: string;
  description: string;
  amount: number;
  units: number;
  nav: number;
  balance: number;
  type: string;
}

export interface MockScheme {
  scheme: string;
  isin: string;
  amfi: string;
  transactions: MockTransaction[];
}

export interface MockFolio {
  folio: string;
  amc: string;
  PAN: string;
  schemes: MockScheme[];
}

export interface MockCAS {
  meta: {
    cas_type: string;
    statement_period: { from: string; to: string };
  };
  investor_info?: {
    name: string;
    email: string;
    pan: string;
    mobile: string;
    address: string;
  };
  investor?: {
    name: string;
    email: string;
    pan: string;
    mobile: string;
    address: string;
  };
  folios: MockFolio[];
}

export class MockCASGenerator {
  public static generate(options: {
    numFolios?: number;
    numSchemesPerFolio?: number;
    numTransactionsPerScheme?: number;
  } = {}): MockCAS {
    const {
      numFolios = 1,
      numSchemesPerFolio = 1,
      numTransactionsPerScheme = 3,
    } = options;

    const pan = 'ABCDE1234F';

    return {
      meta: {
        cas_type: 'DETAILED',
        statement_period: { from: '2020-01-01', to: '2023-01-01' },
      },
      investor_info: {
        name: 'TEST INVESTOR',
        email: 'test@example.com',
        pan,
        mobile: '9876543210',
        address: 'Test Address',
      },
      folios: Array.from({ length: numFolios }, (_, i) => ({
        folio: `FOLIO_${Math.random().toString(36).substring(7)}`,
        amc: 'TEST AMC',
        PAN: pan,
        schemes: Array.from({ length: numSchemesPerFolio }, (_, j) => ({
          scheme: `SCHEME_${i}_${j}`,
          isin: `INF_ISIN_${i}_${j}`,
          amfi: `12345${i}${j}`,
          transactions: Array.from({ length: numTransactionsPerScheme }, (_, k) => ({
            date: `2022-01-0${k + 1}`,
            description: 'PURCHASE',
            amount: 1000,
            units: 10,
            nav: 100,
            balance: 10 * (k + 1),
            type: 'PURCHASE',
          })),
        })),
      })),
    };
  }
}
