import { Router, Request, Response } from 'express';
import { HealthService } from '../services/health.service';
import { GoalService } from '../services/goal.service';
import { XRayService } from '../services/xray.service';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/:portfolioId/insights', async (req: Request, res: Response) => {
  try {
    const { portfolioId } = req.params;
    const userId = req.user!.id;
    const insights = await HealthService.getPortfolioHealth(portfolioId as string, userId);
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
    const userId = req.user!.id;
    const xrayData = await XRayService.getXRayData(portfolioId as string, userId);
    const goals = await GoalService.listGoals(portfolioId as string, xrayData.totalValue, userId);
    res.status(200).json(goals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
