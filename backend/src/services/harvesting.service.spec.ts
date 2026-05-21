import { HarvestingService } from './harvesting.service';
import { TaxService } from './tax.service';
import { MarketDataService } from './market-data.service';
import { prisma } from './db.service';
import { AssetType } from '@prisma/client';

jest.mock('./market-data.service');
jest.mock('./db.service', () => ({
  prisma: {
    portfolio: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('HarvestingService', () => {
  it('should identify harvesting opportunities within exemption limit', async () => {
    const mockDate = new Date('2024-05-16'); // In FY 2024-25
    (prisma.portfolio.findMany as jest.Mock).mockResolvedValue([{
      id: 'p1',
      folios: [
        {
          id: 'f1',
          asset: { name: 'Equity Fund', type: AssetType.MUTUAL_FUND, amfiCode: '101' },
          transactions: [
            { type: 'BUY', units: 100, nav: 100, date: new Date('2022-01-01'), amount: 10000, balance: 100 },
          ],
        },
      ],
    }]);

    (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(200);

    // Unrealized gain = (200 - 100) * 100 = 10,000
    // Remaining exemption = 1,25,000 (if no realized gains)
    const result = await HarvestingService.getHarvestingOpportunities('consolidated', 'u1');

    expect(result.remainingExemption).toBe(125000);
    expect(result.totalPotentialHarvest).toBe(10000);
    expect(result.opportunities.length).toBe(1);
    expect(result.opportunities[0].unrealizedGain).toBe(10000);
    expect(result.estimatedTaxSavings).toBe(1250); // 10,000 * 12.5%
  });
});
