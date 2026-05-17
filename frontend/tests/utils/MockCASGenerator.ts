import { faker } from '@faker-js/faker';

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

    const pan = this.generatePAN();

    const fromDate = faker.date.past({ years: 5 });
    const toDate = new Date();

    return {
      meta: {
        cas_type: 'DETAILED',
        statement_period: {
          from: fromDate.toISOString().split('T')[0],
          to: toDate.toISOString().split('T')[0],
        },
      },
      investor_info: {
        name: faker.person.fullName().toUpperCase(),
        email: faker.internet.email(),
        pan,
        mobile: faker.phone.number(),
        address: faker.location.streetAddress(true),
      },
      folios: Array.from({ length: numFolios }, () => {
        const folioNumber = faker.string.numeric(8);
        const amcName = `${faker.company.name()} Mutual Fund`.toUpperCase();
        return {
          folio: folioNumber,
          amc: amcName,
          PAN: pan,
          schemes: Array.from({ length: numSchemesPerFolio }, (_, j) => {
            const schemeName = faker.finance.accountName().toUpperCase();
            const isin = `INF${faker.string.alphanumeric({ length: 9, casing: 'upper' })}`;
            const amfi = faker.string.numeric(6);

            let currentBalance = 0;
            const transactions: MockTransaction[] = [];
            const sortedDates = Array.from({ length: numTransactionsPerScheme }, () =>
              faker.date.between({ from: fromDate, to: toDate })
            ).sort((a, b) => a.getTime() - b.getTime());

            for (let k = 0; k < numTransactionsPerScheme; k++) {
              const date = sortedDates[k].toISOString().split('T')[0];
              const type = this.getRandomTransactionType(currentBalance);

              let units = 0;
              let nav = parseFloat(faker.finance.amount({ min: 10, max: 1000, dec: 4 }));
              let amount = 0;

              // Extreme NAV case
              if (Math.random() < 0.05) {
                nav = parseFloat(faker.finance.amount({ min: 1000000, max: 2000000, dec: 4 }));
              }

              switch (type) {
                case 'PURCHASE':
                case 'SWITCH_IN':
                  amount = parseFloat(faker.finance.amount({ min: 500, max: 100000, dec: 2 }));
                  units = parseFloat((amount / nav).toFixed(3));
                  currentBalance += units;
                  break;
                case 'REDEMPTION':
                case 'SWITCH_OUT':
                  units = parseFloat(
                    faker.finance.amount({
                      min: 0.001,
                      max: Math.max(0.001, currentBalance),
                      dec: 3,
                    })
                  );
                  amount = parseFloat((units * nav).toFixed(2));
                  currentBalance -= units;
                  break;
                case 'BONUS':
                  units = parseFloat(
                    faker.finance.amount({
                      min: 1,
                      max: Math.max(1, currentBalance),
                      dec: 3,
                    })
                  );
                  nav = 0;
                  amount = 0;
                  currentBalance += units;
                  break;
                case 'DIVIDEND_REINVESTMENT':
                  amount = parseFloat(faker.finance.amount({ min: 10, max: 1000, dec: 2 }));
                  units = parseFloat((amount / nav).toFixed(3));
                  currentBalance += units;
                  break;
              }

              transactions.push({
                date,
                description: type,
                amount,
                units,
                nav,
                balance: parseFloat(currentBalance.toFixed(3)),
                type,
              });
            }

            return {
              scheme: schemeName,
              isin,
              amfi,
              transactions,
            };
          }),
        };
      }),
    };
  }

  private static generatePAN(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const firstFive = Array.from({ length: 5 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
    const middleFour = faker.string.numeric(4);
    const last = chars.charAt(Math.floor(Math.random() * chars.length));
    return firstFive + middleFour + last;
  }

  private static getRandomTransactionType(currentBalance: number): string {
    const types = ['PURCHASE', 'DIVIDEND_REINVESTMENT'];
    if (currentBalance > 0) {
      types.push('REDEMPTION', 'SWITCH_OUT', 'BONUS');
      // Higher weight for standard transactions
      if (Math.random() < 0.2) return 'SWITCH_IN';
      if (Math.random() < 0.1) return 'SWITCH_OUT';
      if (Math.random() < 0.05) return 'BONUS';
    }
    return faker.helpers.arrayElement(types);
  }
}
