import { Worker, Job } from 'bullmq';
import * as fs from 'fs';
import path from 'path';
import { ProcessPdfUploadJobData } from './jobs/queue';
import { ParserService } from './services/parser.service';
import { SyncService } from './services/sync.service';
import { HistoryService } from './services/history.service';
import { prisma } from './services/db.service';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;

const connection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
};

export async function processPdfJob(job: Job<ProcessPdfUploadJobData>): Promise<void> {
  const { userId, filePath, password, jobId } = job.data;
  console.log(`Processing job ${jobId} for user ${userId}`);

  try {
    await prisma.uploadJob.update({ where: { id: jobId }, data: { status: 'PROCESSING', startedAt: new Date() } });

    console.log(`[Worker] Checking if file exists at: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      const dirPath = path.dirname(filePath);
      const dirExists = fs.existsSync(dirPath);
      const dirContents = dirExists ? fs.readdirSync(dirPath) : 'DIR NOT FOUND';
      const errorMsg = `[Worker] File not found at path: ${filePath}. Directory exists: ${dirExists}. Directory contents: ${JSON.stringify(dirContents)}. Current working directory: ${process.cwd()}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`Parsing PDF for job ${jobId}`);
    const parsedData = await ParserService.parseCAS(filePath, password);

    console.log(`Syncing portfolio for job ${jobId}`);
    const syncResult = await SyncService.syncPortfolio(userId, parsedData);

    if (syncResult.portfolioIds && Array.isArray(syncResult.portfolioIds)) {
      console.log(`Calculating history for portfolios: ${syncResult.portfolioIds.join(', ')}`);
      for (const pId of syncResult.portfolioIds) {
        await HistoryService.calculateHistory(pId);
      }
    }

    await prisma.uploadJob.update({ where: { id: jobId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    console.log(`Successfully completed job ${jobId}`);

  } catch (error: any) {
    console.error(`Failed to process job ${jobId}:`, error);
    await prisma.uploadJob.update({ where: { id: jobId }, data: { status: 'FAILED', message: error.message, completedAt: new Date() } });
    throw error; // Rethrow to let BullMQ handle the failure (retries, etc.)
  } finally {
    // Clean up uploaded file
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up temporary file: ${filePath}`);
      }
    } catch (cleanupError) {
      console.error(`Failed to clean up temporary file ${filePath}:`, cleanupError);
    }
  }
}

// Only start the worker if this file is run directly (not imported in tests)
if (require.main === module) {
  console.log('Starting PDF Upload Worker...');
  const worker = new Worker<ProcessPdfUploadJobData>(
    'pdfUploadQueue',
    processPdfJob,
    { connection }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} has failed with ${err.message}`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Closing worker...');
    await worker.close();
    process.exit(0);
  });
}
