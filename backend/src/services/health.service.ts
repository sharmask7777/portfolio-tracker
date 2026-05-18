import { XRayService } from './xray.service';
import { OverlapService } from './overlap.service';
import { GoalService } from './goal.service';
import { prisma } from './db.service';

export interface HealthInsight {
  type: 'CONCENTRATION' | 'OVERLAP' | 'DRIFT' | 'INFO';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  recommendation: string;
}

export class HealthService {
  /**
   * Generates health insights for a portfolio/profile.
   */
  public static async getPortfolioHealth(portfolioId: string, userId: string = 'mock-user-123'): Promise<HealthInsight[]> {
    const insights: HealthInsight[] = [];

    // 1. Sector Concentration Check
    const xrayData = await XRayService.getXRayData(portfolioId, userId);
    for (const sector of xrayData.sectors) {
      if (sector.percentage > 0.3) {
        insights.push({
          type: 'CONCENTRATION',
          severity: sector.percentage > 0.45 ? 'HIGH' : 'MEDIUM',
          message: `High concentration in ${sector.name} sector (${(sector.percentage * 100).toFixed(1)}%).`,
          recommendation: `Consider diversifying into other sectors to reduce structural risk.`,
        });
      }
    }

    // 2. Stock Overlap Check
    const exposures = await OverlapService.getPortfolioExposures(portfolioId, userId);
    for (const stock of exposures.slice(0, 5)) {
      if (stock.percentage > 0.1) {
        insights.push({
          type: 'OVERLAP',
          severity: stock.percentage > 0.15 ? 'HIGH' : 'MEDIUM',
          message: `Significant exposure to ${stock.name} (${(stock.percentage * 100).toFixed(1)}%).`,
          recommendation: `This stock is held across ${stock.contributions.length} funds. Review if you are over-exposed.`,
        });
      }
    }

    // 3. Asset Allocation Drift (Example: Target 70/30)
    const equity = xrayData.assetAllocation.equity.percentage;
    if (equity > 0.8) {
      insights.push({
        type: 'DRIFT',
        severity: 'MEDIUM',
        message: `High equity exposure (${(equity * 100).toFixed(1)}%).`,
        recommendation: `Ensure this aligns with your risk profile. Consider rebalancing towards Debt/Gold.`,
      });
    }

    // 4. Goal Progress Check
    const goals = await GoalService.listGoals(portfolioId, xrayData.totalValue, userId);
    for (const goal of goals) {
      if (goal.metrics.progressPercentage < 0.2 && goal.metrics.remainingDays < 365) {
        insights.push({
          type: 'DRIFT',
          severity: 'HIGH',
          message: `Goal "${goal.name}" is severely behind schedule.`,
          recommendation: `You have achieved only ${(goal.metrics.progressPercentage * 100).toFixed(1)}% of your target with less than a year left. Consider increasing contributions.`,
        });
      }
    }

    if (insights.length === 0) {
      insights.push({
        type: 'INFO',
        severity: 'LOW',
        message: 'Your portfolio looks well-diversified.',
        recommendation: 'Continue monitoring regular rebalancing opportunities.',
      });
    }

    return insights;
  }
}
