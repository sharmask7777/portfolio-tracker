import { AlternativeAssetService } from './alternative-assets.service';
import { MarketDataService } from './market-data.service';
import { AssetType } from '@prisma/client';

jest.mock('./market-data.service');

describe('AlternativeAssetService', () => {
  it('should calculate EPF value with 8.25% annual compounding', async () => {
    const lastBalanceDate = new Date();
    lastBalanceDate.setFullYear(lastBalanceDate.getFullYear() - 1);
    
    const result = await AlternativeAssetService.calculateValue(AssetType.EPF, 100, lastBalanceDate);
    // 100 * (1 + 0.0825)^1 = 108.25
    expect(result.currentValue).toBeCloseTo(108.25, 1);
    expect(result.accruedInterest).toBeCloseTo(8.25, 1);
  });

  it('should calculate Gold value using live price', async () => {
    (MarketDataService.getGoldPrice as jest.Mock).mockResolvedValue(7000);
    
    const result = await AlternativeAssetService.calculateValue(AssetType.PHYSICAL_GOLD, 10);
    // 10 grams * 7000/g = 70,000
    expect(result.currentValue).toBe(70000);
  });
});
