import { AssetType } from '@prisma/client';
import { MarketDataService } from './market-data.service';

export interface AlternativeAssetMetrics {
  currentValue: number;
  accruedInterest: number;
  annualRate: number;
}

export class AlternativeAssetService {
  private static EPF_RATE = 0.0825; // 8.25%
  private static PPF_RATE = 0.0710; // 7.10%

  /**
   * Calculates the current value of an alternative asset.
   * @param type AssetType (EPF, PPF, SGB, PHYSICAL_GOLD)
   * @param units Quantity (Grams for gold, Units for SGB, Balance for EPF/PPF)
   * @param lastBalanceDate The date of the last known balance
   */
  public static async calculateValue(
    type: AssetType,
    units: number,
    lastBalanceDate: Date = new Date(),
  ): Promise<AlternativeAssetMetrics> {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastBalanceDate.getTime());
    const years = diffTime / (1000 * 60 * 60 * 24 * 365.25);

    switch (type) {
      case AssetType.EPF: {
        const accrued = units * (Math.pow(1 + this.EPF_RATE, years) - 1);
        return {
          currentValue: units + accrued,
          accruedInterest: accrued,
          annualRate: this.EPF_RATE,
        };
      }
      case AssetType.PPF: {
        const accrued = units * (Math.pow(1 + this.PPF_RATE, years) - 1);
        return {
          currentValue: units + accrued,
          accruedInterest: accrued,
          annualRate: this.PPF_RATE,
        };
      }
      case AssetType.SGB:
      case AssetType.PHYSICAL_GOLD: {
        const goldPrice = await MarketDataService.getGoldPrice();
        return {
          currentValue: units * goldPrice,
          accruedInterest: 0, // Simplified for MVP
          annualRate: 0,
        };
      }
      default:
        return { currentValue: units, accruedInterest: 0, annualRate: 0 };
    }
  }
}
