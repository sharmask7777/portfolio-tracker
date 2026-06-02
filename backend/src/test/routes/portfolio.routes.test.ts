import request from 'supertest';
import express, { Express, NextFunction } from 'express';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

import portfolioRoutes from '@src/routes/portfolio.routes';
import { addProcessPdfJob, closeUploadQueue } from '@src/jobs/queue';
import { ParserService } from '@src/services/parser.service';
import { SyncService } from '@src/services/sync.service';
import { HistoryService } from '@src/services/history.service';
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
});