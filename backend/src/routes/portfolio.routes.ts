import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ParserService } from '../services/parser.service';
import { SyncService } from '../services/sync.service';
import { PerformanceService } from '../services/performance.service';
import { MarketDataService } from '../services/market-data.service';
import { OverlapService } from '../services/overlap.service';
import { prisma } from '../services/db.service';
import fs from 'fs';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { password, userId = 'mock-user-123' } = req.body;
    const filePath = req.file.path;

    const parsedData = await ParserService.parseCAS(filePath, password);
    const syncResult = await SyncService.syncPortfolio(userId, parsedData);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.status(200).json(syncResult);
  } catch (error: any) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { userId = 'mock-user-123' } = req.query;

    const portfolio = await prisma.portfolio.findFirst({
      where: { userId: userId as string },
      include: {
        folios: {
          include: {
            asset: true,
            transactions: {
              orderBy: { date: 'asc' },
            },
          },
        },
      },
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Enrich with performance metrics
    const enrichedFolios = await Promise.all(portfolio.folios.map(async (folio) => {
      const lastTx = folio.transactions[folio.transactions.length - 1];
      let currentPrice = lastTx?.nav || 0;
      
      // Try to get real-time NAV if AMFI code is available
      if (folio.asset.amfiCode) {
        const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode);
        if (liveNav > 0) {
          currentPrice = liveNav;
        }
      }

      const currentUnits = lastTx?.balance || 0;

      const metrics = PerformanceService.getMetrics(
        folio.transactions,
        currentPrice,
        currentUnits,
      );

      return {
        ...folio,
        metrics,
      };
    }));

    // Overall portfolio metrics
    const totalInvested = enrichedFolios.reduce((acc, f) => acc + f.metrics.investedAmount, 0);
    const totalValue = enrichedFolios.reduce((acc, f) => acc + f.metrics.currentValue, 0);
    
    // For overall XIRR, we need to aggregate all transactions across all folios
    const allTransactions = portfolio.folios.flatMap((f) => 
      f.transactions.map((tx) => ({
        amount: tx.type.toLowerCase().includes('buy') || 
                tx.type.toLowerCase().includes('purchase') ||
                tx.type.toLowerCase().includes('sip') 
                ? -Math.abs(tx.amount) : Math.abs(tx.amount),
        date: new Date(tx.date),
      }))
    );

    const overallXirr = PerformanceService.calculateXIRR(allTransactions, totalValue);

    res.status(200).json({
      ...portfolio,
      folios: enrichedFolios,
      metrics: {
        totalInvested,
        totalValue,
        totalGain: totalValue - totalInvested,
        absoluteReturn: totalInvested > 0 ? (totalValue - totalInvested) / totalInvested : 0,
        xirr: overallXirr,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/exposures', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const exposures = await OverlapService.getPortfolioExposures(id as string);
    res.status(200).json(exposures);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/compare-overlap', async (req: Request, res: Response) => {
  try {
    const { isinA, isinB } = req.query;
    if (!isinA || !isinB) {
      return res.status(400).json({ error: 'isinA and isinB are required' });
    }
    const overlap = await OverlapService.getFundOverlap(isinA as string, isinB as string);
    res.status(200).json(overlap);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
