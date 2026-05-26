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

    const xray = await XRayService.getXRayData('p1', 'u1');
    
    expect(xray.totalValue).toBe(1000);
    expect(xray.sectors[0].name).toBe('Financial Services');
    expect(xray.sectors[0].percentage).toBe(0.2);
    expect(xray.marketCap.large.percentage).toBe(0.6);
    expect(xray.assetAllocation.equity.percentage).toBe(0.9);
  });

  it('should treat arbitrage funds as 100% debt in standard asset allocation and 100% arbitrage in ex-arbitrage', async () => {
    (prisma.portfolio.findUnique as jest.Mock).mockResolvedValue({
      id: 'p2',
      folios: [
        {
          asset: { isin: 'ISIN2', amfiCode: '102', name: 'Kotak Arbitrage Fund', type: 'MUTUAL_FUND' },
          transactions: [{ type: 'BUY', units: 100, balance: 100, nav: 10, date: new Date() }],
        },
      ],
    });

    (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(10);
    (MarketDataService.getHoldings as jest.Mock).mockResolvedValue({
      sectors: [{ name: 'Banking', weightage: '20' }],
      portfolio: {
        marketCapWeightage: { largeCap: '60', midCap: '30', smallCap: '10' },
        assetAllocation: { equity: '65', debt: '25', cash: '10' },
      },
    });

    const xray = await XRayService.getXRayData('p2', 'u1');

    expect(xray.totalValue).toBe(1000);
    // In standard asset allocation, standard debt should be 100% (since arbitrage behaves like debt), and equity 0%
    expect(xray.assetAllocation.equity.percentage).toBe(0.0);
    expect(xray.assetAllocation.debt.percentage).toBe(1.0);
    expect(xray.assetAllocation.cash.percentage).toBe(0.0);

    // In ex-arbitrage, equity should be 0%, debt 0%, cash 0%, and arbitrage 100%
    expect(xray.exArbitrage?.assetAllocation.equity.percentage).toBe(0.0);
    expect(xray.exArbitrage?.assetAllocation.debt.percentage).toBe(0.0);
    expect(xray.exArbitrage?.assetAllocation.cash.percentage).toBe(0.0);
    expect(xray.exArbitrage?.assetAllocation.arbitrage.percentage).toBe(1.0);
  });
});
