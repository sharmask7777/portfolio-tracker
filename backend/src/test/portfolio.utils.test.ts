import { PortfolioUtils } from '../utils/portfolio.utils';

describe('PortfolioUtils', () => {
  describe('getLatestUnits', () => {
    it('should handle same-day transactions deterministically using createdAt', () => {
      const transactions = [
        {
          id: 'tx1',
          date: '2024-01-01T00:00:00.000Z',
          type: 'PURCHASE',
          balance: 100,
          createdAt: '2024-01-01T10:00:00.000Z'
        },
        {
          id: 'tx2',
          date: '2024-01-01T00:00:00.000Z',
          type: 'REVERSAL',
          balance: 0,
          createdAt: '2024-01-01T11:00:00.000Z'
        }
      ];

      // Regardless of input order, it should sort by createdAt and return the last balance (0)
      const units1 = PortfolioUtils.getLatestUnits(transactions);
      const units2 = PortfolioUtils.getLatestUnits([...transactions].reverse());

      expect(units1).toBe(0);
      expect(units2).toBe(0);
    });

    it('should handle same-day transactions deterministically using id if createdAt is missing', () => {
      const transactions = [
        {
          id: 'a',
          date: '2024-01-01T00:00:00.000Z',
          type: 'PURCHASE',
          balance: 100
        },
        {
          id: 'b',
          date: '2024-01-01T00:00:00.000Z',
          type: 'REVERSAL',
          balance: 0
        }
      ];

      // Should sort by id ('a' before 'b') and return balance of 'b' (0)
      const units = PortfolioUtils.getLatestUnits(transactions);
      expect(units).toBe(0);
    });
  });
});
