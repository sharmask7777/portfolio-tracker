import * as fc from 'fast-check';
import { MockTransaction, MockScheme, MockFolio, MockCAS } from '../test-utils/MockCASGenerator';

/**
 * Arbitrary for a single transaction.
 * Note: This generates "raw" data; balance sanity is handled at the Scheme level.
 */
export const arbitraryTransactionRaw = fc.record({
  date: fc.integer({ 
    min: new Date('2020-01-01').getTime(), 
    max: new Date('2025-12-31').getTime() 
  }).map(t => new Date(t).toISOString().split('T')[0]),
  type: fc.constantFrom('PURCHASE', 'REDEMPTION', 'SWITCH_IN', 'SWITCH_OUT', 'BONUS', 'DIVIDEND_REINVESTMENT'),
  amount: fc.float({ min: 100, max: 100000 }),
  nav: fc.float({ min: 10, max: 5000 }),
});

export const arbitraryScheme = fc.record({
  scheme: fc.string({ minLength: 5, maxLength: 50 }),
  isin: fc.string({ minLength: 12, maxLength: 12 }),
  amfi: fc.string({ minLength: 6, maxLength: 6 }),
  rawTransactions: fc.array(arbitraryTransactionRaw, { minLength: 1, maxLength: 20 }),
}).map((data): MockScheme => {
  let currentBalance = 0;
  const sortedRaw = data.rawTransactions.sort((a, b) => a.date.localeCompare(b.date));
  
  const transactions: MockTransaction[] = sortedRaw.map(raw => {
    let { type, amount, nav, date } = raw;
    let units = 0;

    // Ensure we don't redeem more than we have
    if (['REDEMPTION', 'SWITCH_OUT'].includes(type)) {
      if (currentBalance <= 0) {
        type = 'PURCHASE'; // Convert to purchase if no balance
      }
    }

    switch (type) {
      case 'PURCHASE':
      case 'SWITCH_IN':
      case 'DIVIDEND_REINVESTMENT':
        units = parseFloat((amount / nav).toFixed(3));
        currentBalance += units;
        break;
      case 'REDEMPTION':
      case 'SWITCH_OUT':
        // Redeem a random portion of current balance
        const redeemFactor = Math.random(); 
        units = parseFloat((currentBalance * redeemFactor).toFixed(3));
        if (units < 0.001 && currentBalance >= 0.001) units = 0.001;
        amount = parseFloat((units * nav).toFixed(2));
        currentBalance -= units;
        break;
      case 'BONUS':
        units = parseFloat((currentBalance * 0.1).toFixed(3)); // 10% bonus
        nav = 0;
        amount = 0;
        currentBalance += units;
        break;
    }

    return {
      date,
      description: type,
      amount,
      units,
      nav,
      balance: parseFloat(currentBalance.toFixed(3)),
      type,
    };
  });

  return {
    scheme: data.scheme,
    isin: data.isin,
    amfi: data.amfi,
    transactions,
  };
});

export const arbitraryFolio = fc.record({
  folio: fc.string({ minLength: 8, maxLength: 12 }),
  amc: fc.string({ minLength: 10, maxLength: 40 }),
  PAN: fc.string({ minLength: 10, maxLength: 10 }),
  schemes: fc.array(arbitraryScheme, { minLength: 1, maxLength: 5 }),
});

export const arbitraryCAS = fc.record({
  meta: fc.record({
    cas_type: fc.constant('DETAILED'),
    statement_period: fc.record({
      from: fc.constant('2020-01-01'),
      to: fc.constant('2025-12-31'),
    }),
  }),
  investor_info: fc.record({
    name: fc.string({ minLength: 5, maxLength: 50 }),
    email: fc.string({ minLength: 5, maxLength: 50 }),
    pan: fc.string({ minLength: 10, maxLength: 10 }),
    mobile: fc.string({ minLength: 10, maxLength: 10 }),
    address: fc.string({ minLength: 10, maxLength: 100 }),
  }),
  folios: fc.array(arbitraryFolio, { minLength: 1, maxLength: 3 }),
}).map((cas): MockCAS => cas as MockCAS);
