import { XRayService } from './xray.service';
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

describe('XRayService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should aggregate sector, market cap, and asset allocation data', async () => {
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
      sectors: [{ name: 'Banking', weightage: '20' }],
      portfolio: {
        marketCapWeightage: { largeCap: '60', midCap: '30', smallCap: '10' },
        assetAllocation: { equity: '90', debt: '5', cash: '5' },
      },
    });

    const xray = await XRayService.getXRayData('p1');
    
    expect(xray.totalValue).toBe(1000);
    expect(xray.sectors[0].name).toBe('Financial Services');
    expect(xray.sectors[0].percentage).toBe(0.2);
    expect(xray.marketCap.large.percentage).toBe(0.6);
    expect(xray.assetAllocation.equity.percentage).toBe(0.9);
  });
});
