import { OverlapService } from './overlap.service';
import { MarketDataService } from './market-data.service';
import { prisma } from './db.service';

jest.mock('./market-data.service');
jest.mock('./db.service', () => ({
  prisma: {
    portfolio: {
      findUnique: jest.fn(),
    },
  },
}));

describe('OverlapService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFundOverlap', () => {
    it('should calculate common holdings percentage correctly', async () => {
      (MarketDataService.getHoldings as jest.Mock).mockImplementation((isin) => {
        if (isin === 'ISIN1') {
          return Promise.resolve({
            schemeName: 'Fund A',
            holdings: [
              { name: 'Stock X', weightage: '10' },
              { name: 'Stock Y', weightage: '20' },
            ],
          });
        }
        return Promise.resolve({
          schemeName: 'Fund B',
          holdings: [
            { name: 'Stock X', weightage: '5' },
            { name: 'Stock Z', weightage: '15' },
          ],
        });
      });

      const result = await OverlapService.getFundOverlap('ISIN1', 'ISIN2');
      expect(result?.overlapPercentage).toBe(5); // min(10, 5) = 5
      expect(result?.commonStocks[0].name).toBe('Stock X');
    });
  });

  describe('getPortfolioExposures', () => {
    it('should aggregate stock exposures across folios', async () => {
      (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
        id: 'p1',
        folios: [
          {
            asset: { isin: 'ISIN1', amfiCode: '101', name: 'Fund A', type: 'MUTUAL_FUND' },
            transactions: [{ type: 'BUY', units: 100, balance: 100, nav: 10, date: new Date() }],
          },
        ],
      });

      (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(10);
      (MarketDataService.getHoldings as jest.Mock).mockResolvedValue({
        holdings: [
          { name: 'Stock X', weightage: '50', sector: 'Tech' },
        ],
      });

      const exposures = await OverlapService.getPortfolioExposures('p1', 'u1');
      // Folio Value = 100 * 10 = 1000
      // Stock X absolute = 1000 * 0.5 = 500
      expect(exposures[0].name).toBe('Stock X');
      expect(exposures[0].absoluteValue).toBe(500);
      expect(exposures[0].percentage).toBe(0.5);
    });
  });
});
