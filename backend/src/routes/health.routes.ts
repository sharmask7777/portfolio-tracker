import { Router, Request, Response } from 'express';
import { HealthService } from '../services/health.service';
import { GoalService } from '../services/goal.service';
import { XRayService } from '../services/xray.service';

const router = Router();

router.get('/:portfolioId/insights', async (req: Request, res: Response) => {
  try {
    const { portfolioId } = req.params;
    const { userId = 'mock-user-123' } = req.query;
    const insights = await HealthService.getPortfolioHealth(portfolioId as string, userId as string);
    res.status(200).json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:portfolioId/goals', async (req: Request, res: Response) => {
  try {
    const { portfolioId } = req.params;
    const { name, targetAmount, targetDate } = req.body;
    const goal = await GoalService.createGoal(portfolioId as string, name, parseFloat(targetAmount), new Date(targetDate));
    res.status(200).json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:portfolioId/goals', async (req: Request, res: Response) => {
  try {
    const { portfolioId } = req.params;
    const { userId = 'mock-user-123' } = req.query;
    const xrayData = await XRayService.getXRayData(portfolioId as string, userId as string);
    const goals = await GoalService.listGoals(portfolioId as string, xrayData.totalValue, userId as string);
    res.status(200).json(goals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
