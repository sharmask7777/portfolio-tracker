import { Job } from 'bullmq';
import * as fs from 'fs';
import { processPdfJob } from '../worker'; // Will export the processor function
import { ParserService } from '../services/parser.service';
import { SyncService } from '../services/sync.service';
import { HistoryService } from '../services/history.service';
import { ProcessPdfUploadJobData } from '../jobs/queue';

// Mock dependencies
jest.mock('fs');
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
  })),
}));
jest.mock('../services/parser.service');
jest.mock('../services/sync.service');
jest.mock('../services/history.service');

describe('Background Worker - processPdfJob', () => {
  const mockJobData: ProcessPdfUploadJobData = {
    userId: 'testUser123',
    filePath: '/tmp/test.pdf',
    password: 'password123',
    jobId: 'job123',
  };

  let mockJob: Job<ProcessPdfUploadJobData>;

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true); // Ensure cleanup path executes
    mockJob = {
      id: 'job123',
      name: 'processPdfUpload',
      data: mockJobData,
    } as Job<ProcessPdfUploadJobData>;
  });

  it('should successfully process a job and trigger all services', async () => {
    const parsedData = { dummy: 'data' };
    const syncResult = { portfolioIds: ['p1', 'p2'] };

    (ParserService.parseCAS as jest.Mock).mockResolvedValue(parsedData);
    (SyncService.syncPortfolio as jest.Mock).mockResolvedValue(syncResult);
    (HistoryService.calculateHistory as jest.Mock).mockResolvedValue(undefined);

    await processPdfJob(mockJob);

    expect(ParserService.parseCAS).toHaveBeenCalledWith('/tmp/test.pdf', 'password123');
    expect(SyncService.syncPortfolio).toHaveBeenCalledWith('testUser123', parsedData);
    expect(HistoryService.calculateHistory).toHaveBeenCalledTimes(2);
    expect(HistoryService.calculateHistory).toHaveBeenCalledWith('p1');
    expect(HistoryService.calculateHistory).toHaveBeenCalledWith('p2');
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test.pdf');
  });

  it('should handle parser failure and still cleanup file', async () => {
    const error = new Error('Parser Failed');
    (ParserService.parseCAS as jest.Mock).mockRejectedValue(error);

    await expect(processPdfJob(mockJob)).rejects.toThrow('Parser Failed');

    expect(ParserService.parseCAS).toHaveBeenCalled();
    expect(SyncService.syncPortfolio).not.toHaveBeenCalled();
    expect(HistoryService.calculateHistory).not.toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test.pdf');
  });

  it('should handle sync failure and still cleanup file', async () => {
    const parsedData = { dummy: 'data' };
    const error = new Error('Sync Failed');

    (ParserService.parseCAS as jest.Mock).mockResolvedValue(parsedData);
    (SyncService.syncPortfolio as jest.Mock).mockRejectedValue(error);

    await expect(processPdfJob(mockJob)).rejects.toThrow('Sync Failed');

    expect(ParserService.parseCAS).toHaveBeenCalled();
    expect(SyncService.syncPortfolio).toHaveBeenCalled();
    expect(HistoryService.calculateHistory).not.toHaveBeenCalled();
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test.pdf');
  });
});
