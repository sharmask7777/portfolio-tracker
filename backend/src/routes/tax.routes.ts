import { Router, Request, Response } from 'express';
import { TaxAnalyzerService } from '../services/tax-analyzer.service';
import { HarvestingService } from '../services/harvesting.service';

const router = Router();

router.post('/simulate-sell', async (req: Request, res: Response) => {
  try {
    const { folioId, units } = req.body;
    
    if (!folioId || units === undefined) {
      return res.status(400).json({ error: 'folioId and units are required' });
    }

    const result = await TaxAnalyzerService.simulateSell(folioId, parseFloat(units));
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/harvesting-opportunities', async (req: Request, res: Response) => {
  try {
    const { userId = 'mock-user-123' } = req.query;
    const result = await HarvestingService.getHarvestingOpportunities(userId as string);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
