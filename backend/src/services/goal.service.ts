import { prisma } from './db.service';

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
  public static async createGoal(portfolioId: string, name: string, targetAmount: number, targetDate: Date) {
    return prisma.goal.create({
      data: {
        portfolioId,
        name,
        targetAmount,
        targetDate,
      },
    });
  }

  /**
   * Calculates metrics for a goal against a portfolio's current value.
   */
  public static async getGoalMetrics(goalId: string, currentPortfolioValue: number): Promise<GoalMetrics> {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) throw new Error('Goal not found');

    const progressPercentage = (currentPortfolioValue / goal.targetAmount);
    const shortfall = Math.max(0, goal.targetAmount - currentPortfolioValue);
    
    const diffTime = goal.targetDate.getTime() - new Date().getTime();
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      currentValue: currentPortfolioValue,
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
         orderBy: { targetDate: 'asc' },
       });
    } else {
      const p = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
      if (p) {
        goals = await prisma.goal.findMany({
          where: { portfolioId },
          orderBy: { targetDate: 'asc' },
        });
      } else {
        // Assume profile ID
        goals = await prisma.goal.findMany({
          where: { portfolio: { managedProfileId: portfolioId } },
          orderBy: { targetDate: 'asc' },
        });
      }
    }

    return goals.map(goal => {
      const progressPercentage = goal.targetAmount > 0 ? (currentPortfolioValue / goal.targetAmount) : 0;
      const shortfall = Math.max(0, goal.targetAmount - currentPortfolioValue);
      
      const diffTime = goal.targetDate.getTime() - new Date().getTime();
      const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...goal,
        metrics: {
          currentValue: currentPortfolioValue,
          progressPercentage,
          shortfall,
          remainingDays,
        }
      };
    });
  }
}
