import { Router, Request, Response } from 'express';
import multer from 'multer';
import { ParserService } from '../services/parser.service';
import { SyncService } from '../services/sync.service';
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
              orderBy: { date: 'desc' },
            },
          },
        },
      },
    });

    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    res.status(200).json(portfolio);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
