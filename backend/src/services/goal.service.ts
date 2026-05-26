import { prisma } from './db.service';
import { MarketDataService } from './market-data.service';
import { AlternativeAssetService } from './alternative-assets.service';
import { PortfolioUtils } from '../utils/portfolio.utils';

export interface GoalMetrics {
  currentValue: number;
  progressPercentage: number;
  shortfall: number;
  remainingDays: number;
}

export class GoalService {
  /**
   * Creates a new financial goal.
   */
  public static async createGoal(
    portfolioId: string,
    name: string,
    targetAmount: number,
    targetDate: Date,
    userId: string,
    assetIds?: string[]
  ) {
    let actualPortfolioId = portfolioId;
    if (portfolioId === 'consolidated') {
      const firstPortfolio = await prisma.portfolio.findFirst({
        where: { userId },
      });
      if (!firstPortfolio) {
        throw new Error('No portfolio found to associate with the goal.');
      }
      actualPortfolioId = firstPortfolio.id;
    } else {
      const p = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
      if (!p) {
        // Check if it's a managed profile ID
        const profilePortfolio = await prisma.portfolio.findFirst({
          where: { managedProfileId: portfolioId },
        });
        if (profilePortfolio) {
          actualPortfolioId = profilePortfolio.id;
        } else {
          throw new Error('Portfolio not found.');
        }
      }
    }

    return prisma.goal.create({
      data: {
        portfolioId: actualPortfolioId,
        name,
        targetAmount,
        targetDate,
        assets: assetIds && assetIds.length > 0 ? {
          connect: assetIds.map(id => ({ id })),
        } : undefined,
      },
      include: {
        assets: true,
      },
    });
  }

  /**
   * Updates an existing financial goal.
   */
  public static async updateGoal(
    goalId: string,
    name: string,
    targetAmount: number,
    targetDate: Date,
    assetIds?: string[]
  ) {
    return prisma.goal.update({
      where: { id: goalId },
      data: {
        name,
        targetAmount,
        targetDate,
        assets: assetIds ? {
          set: assetIds.map(id => ({ id })),
        } : undefined,
      },
      include: {
        assets: true,
      },
    });
  }

  /**
   * Deletes a financial goal.
   */
  public static async deleteGoal(goalId: string) {
    return prisma.goal.delete({
      where: { id: goalId },
    });
  }

  /**
   * Calculates metrics for a goal against a portfolio's current value.
   */
  public static async getGoalMetrics(goalId: string, currentPortfolioValue: number): Promise<GoalMetrics> {
    const goal = await prisma.goal.findUnique({
      where: { id: goalId },
      include: { assets: true },
    });
    if (!goal) throw new Error('Goal not found');

    let valueToUse = currentPortfolioValue;
    if (goal.assets && goal.assets.length > 0) {
      const folios = await prisma.folio.findMany({
        where: { portfolioId: goal.portfolioId },
        include: { asset: true, transactions: { orderBy: { date: 'asc' } } },
      });
      let attachedValue = 0;
      const attachedAssetIds = new Set(goal.assets.map(a => a.id));
      for (const folio of folios) {
        if (attachedAssetIds.has(folio.assetId)) {
          const currentUnits = PortfolioUtils.getLatestUnits(folio.transactions);
          if (currentUnits <= 0) continue;
          let value = 0;
          if (folio.asset.type === 'MUTUAL_FUND' || folio.asset.type === 'STOCK') {
            const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
            const currentPrice = liveNav > 0 ? liveNav : PortfolioUtils.getLatestNAV(folio.transactions);
            value = currentUnits * currentPrice;
          } else {
            const lastTx = folio.transactions[folio.transactions.length - 1];
            const alt = await AlternativeAssetService.calculateValue(folio.asset.type, currentUnits, lastTx?.date);
            value = alt.currentValue;
          }
          attachedValue += value;
        }
      }
      valueToUse = attachedValue;
    }

    const progressPercentage = (valueToUse / goal.targetAmount);
    const shortfall = Math.max(0, goal.targetAmount - valueToUse);
    
    const diffTime = goal.targetDate.getTime() - new Date().getTime();
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      currentValue: valueToUse,
      progressPercentage,
      shortfall,
      remainingDays,
    };
  }

  /**
   * Lists all goals for a portfolio/profile with progress metrics.
   */
  public static async listGoals(portfolioId: string, currentPortfolioValue: number, userId: string) {
    let goals: any[] = [];

    if (portfolioId === 'consolidated') {
       goals = await prisma.goal.findMany({
         where: { portfolio: { userId } },
         include: { assets: true },
         orderBy: { targetDate: 'asc' },
       });
    } else {
      const p = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
      if (p) {
        goals = await prisma.goal.findMany({
          where: { portfolioId },
          include: { assets: true },
          orderBy: { targetDate: 'asc' },
        });
      } else {
        // Assume profile ID
        goals = await prisma.goal.findMany({
          where: { portfolio: { managedProfileId: portfolioId } },
          include: { assets: true },
          orderBy: { targetDate: 'asc' },
        });
      }
    }

    // Fetch all folios in given scope to calculate specific asset values
    let folios: any[] = [];
    if (portfolioId === 'consolidated') {
      folios = await prisma.folio.findMany({
        where: { portfolio: { userId } },
        include: { asset: true, transactions: { orderBy: { date: 'asc' } } },
      });
    } else {
      const p = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
      if (p) {
        folios = await prisma.folio.findMany({
          where: { portfolioId },
          include: { asset: true, transactions: { orderBy: { date: 'asc' } } },
        });
      } else {
        // Managed profile
        folios = await prisma.folio.findMany({
          where: { portfolio: { managedProfileId: portfolioId } },
          include: { asset: true, transactions: { orderBy: { date: 'asc' } } },
        });
      }
    }

    const folioValues: Record<string, number> = {};
    for (const folio of folios) {
      const currentUnits = PortfolioUtils.getLatestUnits(folio.transactions);
      if (currentUnits <= 0) continue;

      let value = 0;
      if (folio.asset.type === 'MUTUAL_FUND' || folio.asset.type === 'STOCK') {
        const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
        const currentPrice = liveNav > 0 ? liveNav : PortfolioUtils.getLatestNAV(folio.transactions);
        value = currentUnits * currentPrice;
      } else {
        const lastTx = folio.transactions[folio.transactions.length - 1];
        const alt = await AlternativeAssetService.calculateValue(folio.asset.type, currentUnits, lastTx?.date);
        value = alt.currentValue;
      }
      folioValues[folio.asset.id] = (folioValues[folio.asset.id] || 0) + value;
    }

    return goals.map(goal => {
      let valueToUse = currentPortfolioValue;
      if (goal.assets && goal.assets.length > 0) {
        valueToUse = goal.assets.reduce((sum: number, asset: any) => sum + (folioValues[asset.id] || 0), 0);
      }
      const progressPercentage = goal.targetAmount > 0 ? (valueToUse / goal.targetAmount) : 0;
      const shortfall = Math.max(0, goal.targetAmount - valueToUse);
      
      const diffTime = goal.targetDate.getTime() - new Date().getTime();
      const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...goal,
        metrics: {
          currentValue: valueToUse,
          progressPercentage,
          shortfall,
          remainingDays,
        }
      };
    });
  }
}
