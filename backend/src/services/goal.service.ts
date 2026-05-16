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
   * Lists all goals for a portfolio.
   */
  public static async listGoals(portfolioId: string) {
    return prisma.goal.findMany({
      where: { portfolioId },
      orderBy: { targetDate: 'asc' },
    });
  }
}
