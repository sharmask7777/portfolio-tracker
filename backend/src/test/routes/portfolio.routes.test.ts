import request from 'supertest';
import express, { Express, NextFunction } from 'express';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import portfolioRoutes from '@src/routes/portfolio.routes';
import { addProcessPdfJob, closeUploadQueue } from '@src/jobs/queue';
import { ParserService } from '@src/services/parser.service';
import { SyncService } from '@src/services/sync.service';
import { HistoryService } from '@src/services/history.service';
import { MarketDataService } from '@src/services/market-data.service';
import { PerformanceService } from '@src/services/performance.service';
import { PortfolioUtils } from '@src/utils/portfolio.utils';
import { authMiddleware } from '@src/middleware/authMiddleware';
import { jest } from '@jest/globals';
import { prismaMock } from '@src/test/db.mock';

jest.setTimeout(15000);

// --- Mocks for Services ---
jest.mock('fs');
jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

jest.mock('@src/jobs/queue', () => ({
  addProcessPdfJob: jest.fn() as jest.MockedFunction<typeof addProcessPdfJob>,
  closeUploadQueue: jest.fn() as jest.MockedFunction<typeof closeUploadQueue>,
}));

jest.mock('@src/services/parser.service');
jest.mock('@src/services/sync.service');
jest.mock('@src/services/history.service');
jest.mock('@src/services/performance.service');
jest.mock('@src/services/market-data.service');
jest.mock('@src/utils/portfolio.utils');
jest.mock('@src/services/overlap.service');
jest.mock('@src/services/xray.service');
jest.mock('@src/services/tax.service');
jest.mock('@src/services/family.service');
jest.mock('@src/services/alternative-assets.service');

jest.mock('@src/services/db.service', () => {
  return require('@src/test/db.mock');
});
jest.mock('@src/middleware/authMiddleware', () => ({
  authMiddleware: jest.fn((req: unknown, _res: unknown, next: (err?: unknown) => void) => {
    (req as { user?: { id: string } }).user = { id: 'testUserId' };
    next();
  }),
}));

// --- Multer Mock Setup ---
export const multerMockConfig = {
  shouldProvideFile: true,
  password: 'pdfPassword123'
};

const tempFilePath = '/tmp/test-file.pdf';

jest.mock('multer', () => {
  const mockSingleMiddleware = jest.fn((req: unknown, _res: unknown, next: NextFunction) => {
    const typedReq = req as { file?: unknown, body?: Record<string, unknown> };
    if (multerMockConfig.shouldProvideFile) {
      typedReq.file = { path: tempFilePath, originalname: 'test.pdf', mimetype: 'application/pdf', size: 1024 };
    } else {
      typedReq.file = undefined;
    }
    typedReq.body = typedReq.body || {};
    typedReq.body.password = multerMockConfig.password;
    next();
  });

  const mockSingleMethod = jest.fn(() => mockSingleMiddleware);
  const mockMulterFunction = jest.fn(() => ({
    single: mockSingleMethod,
  }));

  return {
    __esModule: true,
    default: mockMulterFunction,
  };
});
// --- End Multer Mock Setup ---

let app: Express;

describe('Portfolio Routes - /upload endpoint', () => {

  beforeAll(() => {
    process.env.REDIS_HOST = 'mock_redis';
    process.env.REDIS_PORT = '6379';

    app = express();
    app.use(express.json());
    app.use(authMiddleware);
    app.use('/api/portfolio', portfolioRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset config for each test
    multerMockConfig.shouldProvideFile = true;
    multerMockConfig.password = 'pdfPassword123';

    (uuidv4 as jest.Mock).mockReturnValue('mockJobId123');

    jest.mocked(addProcessPdfJob).mockResolvedValue({ id: 'mockJobId123' } as never);
    jest.mocked(closeUploadQueue).mockResolvedValue(undefined);

    prismaMock.uploadJob.create.mockResolvedValue({ id: 'mockJobId123', status: 'PENDING' } as any);
    prismaMock.uploadJob.update.mockResolvedValue({ id: 'mockJobId123', status: 'PROCESSING' } as any);
  });

  afterAll(async () => {
    await jest.mocked(closeUploadQueue)();
  });

  it('should return 202 Accepted, enqueue job, and not call synchronous processing for a valid PDF upload', async () => {
    const res = await request(app)
      .post('/api/portfolio/upload')
      .attach('file', Buffer.from('dummy pdf content'), { filename: 'test.pdf', contentType: 'application/pdf' })
      .field('password', 'pdfPassword123');

    expect(res.statusCode).toEqual(202);
    expect(res.body).toEqual({
      jobId: 'mockJobId123',
      message: 'PDF upload accepted and processing has started.',
    });

    expect(jest.mocked(addProcessPdfJob)).toHaveBeenCalledTimes(1);
    expect(jest.mocked(addProcessPdfJob)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'testUserId',
        filePath: tempFilePath,
        password: 'pdfPassword123',
        jobId: 'mockJobId123',
      })
    );

    expect(ParserService.parseCAS).not.toHaveBeenCalled();
    expect(SyncService.syncPortfolio).not.toHaveBeenCalled();
    expect(HistoryService.calculateHistory).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled(); // File cleanup moved to worker
  });

  it('should return 400 Bad Request if no file is uploaded', async () => {
    // Configure mock to not provide a file
    multerMockConfig.shouldProvideFile = false;
    multerMockConfig.password = 'anyPassword';

    const res = await request(app)
      .post('/api/portfolio/upload')
      .field('password', 'anyPassword');

    expect(res.statusCode).toEqual(400);
    expect(res.body).toEqual({ error: 'No file uploaded' });
    expect(jest.mocked(addProcessPdfJob)).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });

  it('should return 500 Internal Server Error if addProcessPdfJob fails', async () => {
    const errorMessage = 'Failed to enqueue job due to Redis error';
    jest.mocked(addProcessPdfJob).mockRejectedValueOnce(new Error(errorMessage));

    const res = await request(app)
      .post('/api/portfolio/upload')
      .attach('file', Buffer.from('dummy pdf content'), { filename: 'test.pdf', contentType: 'application/pdf' })
      .field('password', 'pdfPassword123');

    expect(res.statusCode).toEqual(500);
    expect(res.body).toEqual({ error: errorMessage });
    expect(jest.mocked(addProcessPdfJob)).toHaveBeenCalledTimes(1);
    
    // The route handler should still attempt to unlink the file if job queueing fails
    // Wait, let's look at the catch block in portfolio.routes.ts
    // It says: if (req.file) { fs.unlinkSync(req.file.path); }
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
    expect(fs.unlinkSync).toHaveBeenCalledWith(tempFilePath);
  });

  describe('GET /api/portfolio/upload-status/:jobId', () => {
    const mockJobId = 'test-job-123';
    
    it('should return 200 OK with job data if found and authorized', async () => {
      const mockJobData = {
        id: mockJobId,
        userId: 'testUserId',
        status: 'COMPLETED',
        message: null,
        completedAt: new Date().toISOString(),
      };
       
      prismaMock.uploadJob.findUnique.mockResolvedValue(mockJobData as any);

      const res = await request(app).get(`/api/portfolio/upload-status/${mockJobId}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockJobData);
      expect(prismaMock.uploadJob.findUnique).toHaveBeenCalledWith({ where: { id: mockJobId } });
    });

    it('should return 404 Not Found if job does not exist', async () => {
       
      prismaMock.uploadJob.findUnique.mockResolvedValue(null);

      const res = await request(app).get(`/api/portfolio/upload-status/${mockJobId}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body).toEqual({ error: 'Job not found' });
    });

    it('should return 404 Not Found if job belongs to another user', async () => {
      const mockJobData = {
        id: mockJobId,
        userId: 'otherUserId', // Different from testUserId
        status: 'COMPLETED',
      };
       
      prismaMock.uploadJob.findUnique.mockResolvedValue(mockJobData as any);

      const res = await request(app).get(`/api/portfolio/upload-status/${mockJobId}`);

      expect(res.statusCode).toEqual(404); // Return 404 to avoid leaking existence
      expect(res.body).toEqual({ error: 'Job not found' });
    });

    it('should return 500 Internal Server Error if database query fails', async () => {
       
      prismaMock.uploadJob.findUnique.mockRejectedValue(new Error('DB Error'));

      const res = await request(app).get(`/api/portfolio/upload-status/${mockJobId}`);

      expect(res.statusCode).toEqual(500);
      expect(res.body).toEqual({ error: 'DB Error' });
    });
  });

  describe('GET /api/portfolio/summary day change integration', () => {
    it('should calculate accurate day change and day change percentage through the summary route', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'testUserId', taxSlab: 0.3 } as any);
      prismaMock.portfolio.findMany.mockResolvedValue([
        {
          id: 'p-1',
          userId: 'testUserId',
          folios: [
            {
              id: 'f-1',
              number: '12345',
              asset: { id: 'a-1', name: 'Fund A', type: 'MUTUAL_FUND', amfiCode: '122639' },
              transactions: [{ id: 'tx-1', type: 'PURCHASE', date: new Date('2023-01-01'), amount: 10000, nav: 100, units: 100 }],
            },
          ],
        },
      ] as any);

      (PortfolioUtils.getLatestUnits as jest.Mock).mockReturnValue(100);
      (MarketDataService.getNAVChange as any).mockResolvedValue({
        currentPrice: 110,
        previousPrice: 108,
        change: 2,
        changePercentage: 1.85,
        currentDate: '16-10-2026',
        previousDate: '15-10-2026',
      });
      (PerformanceService.calculateXIRR as jest.Mock).mockReturnValue(0.12);
      (PerformanceService.getMetrics as jest.Mock).mockReturnValue({
        investedAmount: 10000,
        currentValue: 11000,
        totalGain: 1000,
        absoluteReturn: 0.1,
        xirr: 0.12,
        postTaxXirr: 0.1,
        postTaxAbsoluteReturn: 0.08,
        estimatedTax: 100,
      });

      const res = await request(app).get('/api/portfolio/summary');
      expect(res.statusCode).toEqual(200);
      expect(res.body.folios).toHaveLength(1);
      expect(res.body.folios[0].metrics.dayChange).toBe(200); // (110 - 108) * 100 = 200
      expect(res.body.folios[0].metrics.dayChangePercentage).toBeCloseTo(1.8518, 2);
      expect(res.body.metrics.dayChange).toBe(200);
      expect(res.body.metrics.dayChangePercentage).toBeCloseTo(1.8518, 2);
    });

    it('should set dayChange to 0 when holding has 0 units (closed folio)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'testUserId', taxSlab: 0.3 } as any);
      prismaMock.portfolio.findMany.mockResolvedValue([
        {
          id: 'p-1',
          userId: 'testUserId',
          folios: [
            {
              id: 'f-1',
              number: '12345',
              asset: { id: 'a-1', name: 'Fund A', type: 'MUTUAL_FUND', amfiCode: '122639' },
              transactions: [{ id: 'tx-1', type: 'PURCHASE', date: new Date('2023-01-01'), amount: 0, nav: 100, units: 0 }],
            },
          ],
        },
      ] as any);

      (PortfolioUtils.getLatestUnits as jest.Mock).mockReturnValue(0);
      (PerformanceService.calculateXIRR as jest.Mock).mockReturnValue(0);
      (PerformanceService.getMetrics as jest.Mock).mockReturnValue({
        investedAmount: 0,
        currentValue: 0,
        totalGain: 0,
        absoluteReturn: 0,
        xirr: 0,
        postTaxXirr: 0,
        postTaxAbsoluteReturn: 0,
        estimatedTax: 0,
      });

      const res = await request(app).get('/api/portfolio/summary');

      expect(res.statusCode).toEqual(200);
      expect(res.body.folios).toHaveLength(0); // Closed folios filtered out from activeFolios
      expect(res.body.metrics.dayChange).toBe(0);
      expect(res.body.metrics.dayChangePercentage).toBe(0);
    });
  });
});