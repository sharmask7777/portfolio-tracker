import { TaxAnalyzerService } from './tax-analyzer.service';
import { TaxService } from './tax.service';
import { MarketDataService } from './market-data.service';
import { prisma } from './db.service';

jest.mock('./market-data.service');
jest.mock('./db.service', () => ({
  prisma: {
    folio: {
      findUnique: jest.fn(),
    },
  },
}));

describe('TaxAnalyzerService', () => {
  it('should simulate sell and return tax impact for partial holdings', async () => {
    (prisma.folio.findUnique as jest.Mock).mockResolvedValue({
      id: 'f1',
      asset: { name: 'Fund A', type: 'MUTUAL_FUND', amfiCode: '101' },
      transactions: [
        { type: 'BUY', units: 10, nav: 100, date: new Date('2023-01-01'), amount: 1000 },
        { type: 'BUY', units: 10, nav: 200, date: new Date('2024-01-01'), amount: 2000 },
      ],
    });

    (MarketDataService.getLatestNAV as jest.Mock).mockResolvedValue(250);

    // Simulate selling 15 units
    // 10 units from 1st buy (LTCG if today > Jan 2024)
    // 5 units from 2nd buy (STCG if today is say May 2024)
    // For this test, let's assume we are in Aug 2024 (Budget 2024 applied)
    const result = await TaxAnalyzerService.simulateSell('f1', 15);

    expect(result.unitsToSell).toBe(15);
    expect(result.estimatedValue).toBe(15 * 250);
    // Matched 2 lots
    expect(result.matchedLots.length).toBe(2);
    expect(result.matchedLots[0].units).toBe(10);
    expect(result.matchedLots[1].units).toBe(5);
  });

  it('should throw error if insufficient units', async () => {
    (prisma.folio.findUnique as jest.Mock).mockResolvedValue({
      id: 'f1',
      asset: { name: 'Fund A', type: 'MUTUAL_FUND' },
      transactions: [{ type: 'BUY', units: 10, nav: 100, date: new Date(), amount: 1000 }],
    });

    await expect(TaxAnalyzerService.simulateSell('f1', 20)).rejects.toThrow('Insufficient units');
  });
});
