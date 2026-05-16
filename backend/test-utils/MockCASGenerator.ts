import { faker } from '@faker-js/faker';

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
  investor: {
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
    includeEdgeCases?: boolean;
  } = {}): MockCAS {
    const {
      numFolios = faker.number.int({ min: 1, max: 3 }),
      numSchemesPerFolio = faker.number.int({ min: 1, max: 2 }),
      numTransactionsPerScheme = faker.number.int({ min: 2, max: 10 }),
      includeEdgeCases = false,
    } = options;

    const pan = faker.helpers.replaceSymbols('?????####?').toUpperCase();
    const startDate = faker.date.past({ years: 5 });
    const endDate = new Date();

    return {
      meta: {
        cas_type: 'DETAILED',
        statement_period: {
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0],
        },
      },
      investor: {
        name: faker.person.fullName().toUpperCase(),
        email: faker.internet.email(),
        pan,
        mobile: faker.phone.number(),
        address: faker.location.streetAddress(true),
      },
      folios: Array.from({ length: numFolios }, () => this.generateFolio(pan, numSchemesPerFolio, numTransactionsPerScheme, includeEdgeCases)),
    };
  }

  private static generateFolio(pan: string, numSchemes: number, numTxs: number, includeEdgeCases: boolean): MockFolio {
    const amc = faker.helpers.arrayElement(['HDFC Mutual Fund', 'SBI Mutual Fund', 'ICICI Prudential MF', 'Axis Mutual Fund']);
    return {
      folio: `${faker.number.int({ min: 10000000, max: 99999999 })}/${faker.number.int({ min: 0, max: 9 })}`,
      amc,
      PAN: pan,
      schemes: Array.from({ length: numSchemes }, () => this.generateScheme(amc, numTxs, includeEdgeCases)),
    };
  }

  private static generateScheme(amc: string, numTxs: number, includeEdgeCases: boolean): MockScheme {
    const schemeName = `${amc} ${faker.finance.accountName()} Fund - Direct Plan - Growth`;
    let balance = 0;
    let currentDate = faker.date.past({ years: 3 });

    const transactions: MockTransaction[] = [];

    for (let i = 0; i < numTxs; i++) {
      const type = this.getRandomTxType(i === 0, includeEdgeCases);
      const amount = type === 'BONUS' ? 0 : faker.number.float({ min: 500, max: 10000, fractionDigits: 2 });
      const nav = faker.number.float({ min: 10, max: 500, fractionDigits: 4 });
      
      let units = 0;
      if (type === 'PURCHASE' || type === 'SIP' || type === 'SWITCH_IN' || type === 'REINVESTMENT') {
        units = amount / nav;
        balance += units;
      } else if (type === 'BONUS') {
        units = balance * faker.number.float({ min: 0.1, max: 1.0 }); // 1:10 to 1:1 bonus
        balance += units;
      } else {
        // Redemption/Switch Out
        const unitsToSell = Math.min(balance, balance * faker.number.float({ min: 0.1, max: 0.5 }));
        units = -unitsToSell;
        balance -= unitsToSell;
      }

      transactions.push({
        date: currentDate.toISOString().split('T')[0],
        description: type,
        amount: Math.abs(units * nav),
        units: parseFloat(units.toFixed(3)),
        nav,
        balance: parseFloat(balance.toFixed(3)),
        type,
      });

      // Move date forward
      currentDate = new Date(currentDate.getTime() + faker.number.int({ min: 1, max: 60 }) * 24 * 60 * 60 * 1000);
    }

    return {
      scheme: schemeName,
      isin: faker.helpers.replaceSymbols('INF#########'),
      amfi: faker.number.int({ min: 100000, max: 199999 }).toString(),
      transactions,
    };
  }

  private static getRandomTxType(isFirst: boolean, includeEdgeCases: boolean): string {
    if (isFirst) return 'PURCHASE';
    
    const baseTypes = ['PURCHASE', 'SIP', 'REDEMPTION', 'SWITCH_OUT', 'SWITCH_IN'];
    const edgeTypes = ['BONUS', 'REINVESTMENT', 'DIVIDEND_PAYOUT'];

    const pool = includeEdgeCases ? [...baseTypes, ...edgeTypes] : baseTypes;
    return faker.helpers.arrayElement(pool);
  }
}
