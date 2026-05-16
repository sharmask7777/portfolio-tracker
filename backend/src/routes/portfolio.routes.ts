import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ParserService } from '../services/parser.service';
import { SyncService } from '../services/sync.service';
import { PerformanceService } from '../services/performance.service';
import { MarketDataService } from '../services/market-data.service';
import { PortfolioUtils } from '../utils/portfolio.utils';
import { OverlapService } from '../services/overlap.service';
import { XRayService } from '../services/xray.service';
import { TaxService } from '../services/tax.service';
import { FamilyService } from '../services/family.service';
import { AlternativeAssetService } from '../services/alternative-assets.service';
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

router.post('/manual-asset', async (req: Request, res: Response) => {
  try {
    const { userId = 'mock-user-123', type, name, units, balanceDate } = req.body;

    const portfolio = await prisma.portfolio.findFirst({ where: { userId } });
    if (!portfolio) throw new Error('Portfolio not found');

    const asset = await prisma.asset.create({
      data: {
        type,
        name,
        symbol: `${type}_${Date.now()}`,
      },
    });

    const folio = await prisma.folio.create({
      data: {
        number: `MANUAL_${Date.now()}`,
        portfolioId: portfolio.id,
        assetId: asset.id,
      },
    });

    await prisma.transaction.create({
      data: {
        date: new Date(balanceDate || new Date()),
        type: 'PURCHASE',
        amount: parseFloat(units),
        units: parseFloat(units),
        nav: 1,
        balance: parseFloat(units),
        folioId: folio.id,
      },
    });

    res.status(200).json({ status: 'success', assetId: asset.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { userId = 'mock-user-123', familyGroupId } = req.query;

    let portfolios: any[] = [];

    if (familyGroupId) {
      portfolios = await FamilyService.getFamilyPortfolios(familyGroupId as string);
    } else {
      const singlePortfolio = await prisma.portfolio.findFirst({
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
      if (singlePortfolio) portfolios = [singlePortfolio];
    }

    if (portfolios.length === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Aggregate all folios across all portfolios
    const allFolios = portfolios.flatMap(p => p.folios);

    // Enrich with performance metrics
    const enrichedFolios = await Promise.all(allFolios.map(async (folio) => {
      const currentUnits = PortfolioUtils.getLatestUnits(folio.transactions);
      
      const lastTx = folio.transactions[folio.transactions.length - 1];
      let currentPrice = lastTx?.nav || 0;
      let metrics: any = null;

      if (folio.asset.type === 'MUTUAL_FUND' || folio.asset.type === 'STOCK') {
        if (folio.asset.amfiCode) {
          const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode);
          if (liveNav > 0) currentPrice = liveNav;
        }
        
        // If the fund is closed (zero units), current value is always 0
        metrics = PerformanceService.getMetrics(folio.transactions, currentPrice, currentUnits);
        
        // Ensure closed positions have zero current value
        if (currentUnits <= 0) {
          metrics.currentValue = 0;
          // Note: totalGain will reflect the realized profit/loss
        }
      } else {
        // Alternative Assets
        const altMetrics = await AlternativeAssetService.calculateValue(
          folio.asset.type,
          currentUnits,
          folio.transactions[folio.transactions.length - 1]?.date
        );
        metrics = {
          investedAmount: folio.transactions[folio.transactions.length - 1]?.amount || 0,
          currentValue: altMetrics.currentValue,
          totalGain: altMetrics.accruedInterest || (altMetrics.currentValue - (folio.transactions[folio.transactions.length - 1]?.amount || 0)),
          absoluteReturn: folio.transactions[folio.transactions.length - 1]?.amount ? (altMetrics.currentValue - folio.transactions[folio.transactions.length - 1].amount) / folio.transactions[folio.transactions.length - 1].amount : 0,
          xirr: altMetrics.annualRate,
          cagr: altMetrics.annualRate,
        };
        currentPrice = altMetrics.currentValue / (currentUnits || 1);
      }

      return { ...folio, metrics: { ...metrics, currentPrice } };
    }));

    const totalInvested = enrichedFolios.reduce((acc, f) => acc + f.metrics.investedAmount, 0);
    const totalValue = enrichedFolios.reduce((acc, f) => acc + f.metrics.currentValue, 0);

    // Filter for active folios or those with significant remaining invested amount (realized gains/losses)
    const activeFolios = enrichedFolios.filter(f => Math.abs(f.metrics.currentValue) > 0.01 || Math.abs(f.metrics.investedAmount) > 0.01);

    const allTransactions = allFolios.flatMap((f) => 
      f.transactions.map((tx: any) => ({
        amount: tx.type.toLowerCase().includes('buy') || 
                tx.type.toLowerCase().includes('purchase') ||
                tx.type.toLowerCase().includes('sip') ||
                tx.type.toLowerCase().includes('switch_in') ||
                tx.type.toLowerCase().includes('reinvestment')
                ? -Math.abs(tx.amount) : Math.abs(tx.amount),
        date: new Date(tx.date),
      }))
    );

    const overallXirr = PerformanceService.calculateXIRR(allTransactions, totalValue);

    res.status(200).json({
      id: familyGroupId || portfolios[0].id,
      name: familyGroupId ? 'Family Portfolio' : portfolios[0].name,
      folios: activeFolios,
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

router.get('/:id/overlap', async (req: Request, res: Response) => {
  // Not used in this turn, but good for context
});

router.get('/:id/xray', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const xrayData = await XRayService.getXRayData(id as string);
    res.status(200).json(xrayData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/tax-summary', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: id as string },
      include: {
        folios: {
          include: {
            asset: true,
            transactions: { orderBy: { date: 'asc' } },
          },
        },
      },
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const summaries = await Promise.all(portfolio.folios.map(async (folio) => {
      const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
      const lastNav = PortfolioUtils.getLatestNAV(folio.transactions);
      const currentPrice = liveNav > 0 ? liveNav : lastNav;

      return TaxService.calculatePortfolioTax(
        folio.asset.name,
        folio.asset.type,
        folio.transactions,
        currentPrice
      );
    }));

    // Aggregate overall
    const aggregate = {
      realized: { stcg: 0, ltcg: 0, total: 0 },
      unrealized: { stcg: 0, ltcg: 0, total: 0 },
      details: summaries.flatMap(s => s.realized.details),
    };

    for (const s of summaries) {
      aggregate.realized.stcg += s.realized.stcg;
      aggregate.realized.ltcg += s.realized.ltcg;
      aggregate.realized.total += s.realized.total;
      aggregate.unrealized.stcg += s.unrealized.stcg;
      aggregate.unrealized.ltcg += s.unrealized.ltcg;
      aggregate.unrealized.total += s.unrealized.total;
    }

    res.status(200).json(aggregate);
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
