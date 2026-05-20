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
import { HistoryService } from '../services/history.service';
import { prisma } from '../services/db.service';
import { authMiddleware } from '../middleware/authMiddleware';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { addProcessPdfJob, ProcessPdfUploadJobData } from '../jobs/queue';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.use(authMiddleware);

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { password } = req.body;
    const userId = req.user!.id;
    const filePath = req.file.path;

    const jobId = uuidv4();
    
    // Create tracking record in DB
    await prisma.uploadJob.create({
      data: {
        id: jobId,
        userId: userId,
        filePath: filePath,
        status: 'PENDING'
      }
    });

    await addProcessPdfJob({ userId, filePath, password, jobId });

    // Clean up uploaded file is done in the worker, so remove it from here.
    // fs.unlinkSync(filePath); // Moved to worker

    res.status(202).json({ jobId, message: 'PDF upload accepted and processing has started.' });
  } catch (error: any) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/manual-asset', async (req: Request, res: Response) => {
  try {
    const { type, name, units, balanceDate } = req.body;
    const userId = req.user!.id;

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
    const { familyGroupId, profileId, taxSlab } = req.query;
    const userId = req.user!.id;
    const slabValue = taxSlab ? parseFloat(taxSlab as string) : 0.30;

    let portfolios: any[] = [];

    if (familyGroupId) {
      portfolios = await FamilyService.getFamilyPortfolios(familyGroupId as string);
    } else if (profileId) {
      // FINANCIAL INTELLIGENCE: Individual Member Filtering (REQ-10.4, V3-FAM-03)
      portfolios = await prisma.portfolio.findMany({
        where: { userId, managedProfileId: profileId as string },
        include: {
          folios: {
            include: {
              asset: true,
              transactions: { orderBy: { date: 'asc' } },
            },
          },
        },
      });
    } else {
      // Consolidated Family View
      portfolios = await prisma.portfolio.findMany({
        where: { userId },
        include: {
          folios: {
            include: {
              asset: true,
              transactions: { orderBy: { date: 'asc' } },
            },
          },
        },
      });
    }

    if (portfolios.length === 0) {
      return res.status(200).json({ folios: [], metrics: { totalInvested: 0, totalValue: 0, totalGain: 0, xirr: 0, postTaxXirr: 0 } });
    }

    // Aggregate all folios across all selected portfolios
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
        
        metrics = PerformanceService.getMetrics(folio.transactions, currentPrice, {
          currentUnitsOverride: currentUnits,
          taxSlab: slabValue,
          assetType: folio.asset.type,
          assetName: folio.asset.name,
        });
        
        if (currentUnits <= 0) {
          metrics.currentValue = 0;
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
          postTaxXirr: altMetrics.annualRate,
          postTaxAbsoluteReturn: folio.transactions[folio.transactions.length - 1]?.amount ? (altMetrics.currentValue - folio.transactions[folio.transactions.length - 1].amount) / folio.transactions[folio.transactions.length - 1].amount : 0,
          estimatedTax: 0,
        };
        currentPrice = altMetrics.currentValue / (currentUnits || 1);
      }

      return { ...folio, metrics: { ...metrics, currentPrice } };
    }));

    const totalInvested = enrichedFolios.reduce((acc, f) => acc + f.metrics.investedAmount, 0);
    const totalValue = enrichedFolios.reduce((acc, f) => acc + f.metrics.currentValue, 0);
    const totalEstimatedTax = enrichedFolios.reduce((acc, f) => acc + (f.metrics.estimatedTax || 0), 0);

    const activeFolios = enrichedFolios.filter(f => Math.abs(f.metrics.currentValue) > 0.01 || Math.abs(f.metrics.investedAmount) > 0.01);

    const allTransactions = allFolios.flatMap((f) => 
      f.transactions.map((tx: any) => {
        const type = tx.type.toLowerCase();
        const isOutflow = type.includes('buy') || type.includes('purchase') || type.includes('sip') || type.includes('switch_in') || type.includes('reinvestment') || type.includes('opening_balance');
        return {
          amount: isOutflow ? -Math.abs(tx.amount) : Math.abs(tx.amount),
          date: new Date(tx.date),
        };
      })
    );

    const overallXirr = PerformanceService.calculateXIRR(allTransactions, totalValue);
    
    // D-05: Post-Tax Total & XIRR
    const postTaxTotalValue = Math.max(0, totalValue - totalEstimatedTax);
    const overallPostTaxXirr = PerformanceService.calculateXIRR(allTransactions, postTaxTotalValue);

    res.status(200).json({
      id: profileId || familyGroupId || 'consolidated',
      name: profileId ? 'Member View' : familyGroupId ? 'Family Portfolio' : 'Consolidated Portfolio',
      folios: activeFolios,
      metrics: {
        totalInvested,
        totalValue,
        postTaxTotalValue,
        totalGain: totalValue - totalInvested,
        absoluteReturn: totalInvested > 0 ? (totalValue - totalInvested) / totalInvested : 0,
        xirr: overallXirr,
        postTaxXirr: overallPostTaxXirr,
        estimatedTax: totalEstimatedTax,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/exposures', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const exposures = await OverlapService.getPortfolioExposures(id as string, userId);
    res.status(200).json(exposures);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/xray', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const xrayData = await XRayService.getXRayData(id as string, userId);
    res.status(200).json(xrayData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/tax-summary', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { taxSlab } = req.query;
    const slabValue = taxSlab ? parseFloat(taxSlab as string) : 0.30;

    let portfolios: any[] = [];

    if (id === 'consolidated') {
      portfolios = await prisma.portfolio.findMany({
        where: { userId },
        include: {
          folios: {
            include: {
              asset: true,
              transactions: { orderBy: { date: 'asc' } },
            },
          },
        },
      });
    } else {
      const p = await prisma.portfolio.findFirst({
        where: { id: id as string, userId },
        include: {
          folios: {
            include: {
              asset: true,
              transactions: { orderBy: { date: 'asc' } },
            },
          },
        },
      });

      if (p) {
        portfolios = [p];
      } else {
        portfolios = await prisma.portfolio.findMany({
          where: { managedProfileId: id as string, userId },
          include: {
            folios: {
              include: {
                asset: true,
                transactions: { orderBy: { date: 'asc' } },
              },
            },
          },
        });
      }
    }

    if (portfolios.length === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const allFolios = portfolios.flatMap(p => p.folios);

    const summaries = await Promise.all(allFolios.map(async (folio) => {
      const liveNav = await MarketDataService.getLatestNAV(folio.asset.amfiCode || '');
      const lastNav = PortfolioUtils.getLatestNAV(folio.transactions);
      const currentPrice = liveNav > 0 ? liveNav : lastNav;

      return TaxService.calculatePortfolioTax(
        folio.asset.name,
        folio.asset.type,
        folio.transactions,
        currentPrice,
        slabValue
      );
    }));

    // Aggregate overall
    const aggregate = {
      realized: {
        stcg: summaries.reduce((acc, s) => acc + s.realized.stcg, 0),
        ltcg: summaries.reduce((acc, s) => acc + s.realized.ltcg, 0),
        slab: summaries.reduce((acc, s) => acc + s.realized.slab, 0),
        total: summaries.reduce((acc, s) => acc + s.realized.total, 0),
      },
      unrealized: {
        stcg: summaries.reduce((acc, s) => acc + s.unrealized.stcg, 0),
        ltcg: summaries.reduce((acc, s) => acc + s.unrealized.ltcg, 0),
        slab: summaries.reduce((acc, s) => acc + s.unrealized.slab, 0),
        total: summaries.reduce((acc, s) => acc + s.unrealized.total, 0),
      },
      details: summaries.flatMap(s => s.realized.details).sort((a, b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime()),
    };

    res.status(200).json(aggregate);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { from, to } = req.query;

    let portfolioIds: string[] = [];

    if (id === 'consolidated') {
      const portfolios = await prisma.portfolio.findMany({
        where: { userId },
        select: { id: true },
      });
      portfolioIds = portfolios.map(p => p.id);
    } else {
      // Check if ID is a ManagedProfile or Portfolio
      const portfolio = await prisma.portfolio.findFirst({ where: { id: id as string, userId } });
      if (portfolio) {
        portfolioIds = [id as string];
      } else {
        const managedPortfolios = await prisma.portfolio.findMany({
          where: { managedProfileId: id as string, userId },
          select: { id: true },
        });
        portfolioIds = managedPortfolios.map(p => p.id);
      }
    }

    if (portfolioIds.length === 0) {
      return res.status(200).json([]);
    }

    const historyData = await prisma.portfolioHistory.findMany({
      where: {
        portfolioId: { in: portfolioIds },
        date: {
          gte: from ? new Date(from as string) : undefined,
          lte: to ? new Date(to as string) : undefined,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Aggregate by date
    const aggregated = historyData.reduce((acc: any, curr) => {
      const dateKey = curr.date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { date: curr.date, value: 0, investedAmount: 0 };
      }
      acc[dateKey].value += curr.value;
      acc[dateKey].investedAmount += curr.investedAmount;
      return acc;
    }, {});

    res.status(200).json(Object.values(aggregated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    let portfolioIds: string[] = [];

    if (id === 'consolidated') {
      const portfolios = await prisma.portfolio.findMany({
        where: { userId },
        select: { id: true },
      });
      portfolioIds = portfolios.map(p => p.id);
    } else {
      // Check if ID is a ManagedProfile or Portfolio
      const portfolio = await prisma.portfolio.findFirst({ where: { id: id as string, userId } });
      if (portfolio) {
        portfolioIds = [id as string];
      } else {
        const managedPortfolios = await prisma.portfolio.findMany({
          where: { managedProfileId: id as string, userId },
          select: { id: true },
        });
        portfolioIds = managedPortfolios.map(p => p.id);
      }
    }

    if (portfolioIds.length === 0) {
      return res.status(200).json({
        ath: { value: 0, date: null },
        maxInvested: { value: 0, date: null },
        yearly: [],
      });
    }

    const stats = await HistoryService.getPortfolioStats(portfolioIds);
    res.status(200).json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/purge', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Use a transaction to ensure all-or-nothing deletion
    await prisma.$transaction([
      // 1. Delete all goals associated with portfolios of this user
      prisma.goal.deleteMany({
        where: { portfolio: { userId } }
      }),
      // 2. Delete all transactions associated with folios of this user
      prisma.transaction.deleteMany({
        where: { folio: { portfolio: { userId } } }
      }),
      // 3. Delete all folios associated with portfolios of this user
      prisma.folio.deleteMany({
        where: { portfolio: { userId } }
      }),
      // 4. Delete all portfolios for this user
      prisma.portfolio.deleteMany({
        where: { userId }
      }),
      // 5. Delete all managed profiles for this user
      prisma.managedProfile.deleteMany({
        where: { userId }
      }),
    ]);

    res.status(200).json({ status: 'success', message: 'All user data has been purged.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/upload-status/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const userId = req.user!.id;

    const job = await prisma.uploadJob.findUnique({
      where: { id: jobId }
    });

    if (!job || job.userId !== userId) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.status(200).json(job);
  } catch (error: any) {
    console.error(`Error fetching job status for ${req.params.jobId}:`, error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

export default router;

