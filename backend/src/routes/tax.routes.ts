import { Router, Request, Response } from 'express';
import { TaxAnalyzerService } from '../services/tax-analyzer.service';
import { HarvestingService } from '../services/harvesting.service';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/simulate-sell', async (req: Request, res: Response) => {
  try {
    const { folioId, units, taxSlab } = req.body;
    
    if (!folioId) return res.status(400).json({ error: 'Folio ID is required' });
    
    const parsedUnits = parseFloat(units);
    if (isNaN(parsedUnits) || parsedUnits <= 0) {
      return res.status(400).json({ error: 'Valid units are required' });
    }

    const slabValue = taxSlab ? parseFloat(taxSlab as string) : 0.30;
    const result = await TaxAnalyzerService.simulateSell(folioId as string, parsedUnits, slabValue);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Simulation error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/harvesting-opportunities', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { scopeId = 'consolidated' } = req.query;
    const result = await HarvestingService.getHarvestingOpportunities(scopeId as string, userId);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
