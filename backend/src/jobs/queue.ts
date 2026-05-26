import { Queue, Job } from 'bullmq';

// Define the interface for the job data
export interface ProcessPdfUploadJobData {
  userId: string;
  filePath: string;
  password?: string; // Password might be optional for some PDFs
  jobId: string;
}

const REDIS_HOST_ENV = process.env.REDIS_HOST;
const REDIS_PORT_ENV = process.env.REDIS_PORT;

const REDIS_HOST = REDIS_HOST_ENV || 'localhost';
const REDIS_PORT = REDIS_PORT_ENV ? parseInt(REDIS_PORT_ENV, 10) : 6379;

// Create a singleton queue instance
let uploadQueue: Queue<ProcessPdfUploadJobData, any, string> | null = null;

export async function getUploadQueue(): Promise<Queue<ProcessPdfUploadJobData, any, string>> {
  if (!uploadQueue) {
    try {
      const connection = { // Define connection object here
        host: REDIS_HOST,
        port: REDIS_PORT,
      };
      uploadQueue = new Queue<ProcessPdfUploadJobData, any, string>('pdfUploadQueue', {
        connection,
        // Add default job options if necessary, e.g., attempts, backoff
        defaultJobOptions: {
          attempts: 1, // PDF upload jobs are one-shot because files are cleaned up after the first attempt
        },
      });

      // Optional: Log queue events for debugging
      // uploadQueue.on('error', (error: Error) => {
      //   console.error('Queue error:', error);
      // });
      // uploadQueue.on('waiting', (jobId: string) => {
      //   console.log(`Job ${jobId} is waiting.`);
      // });
      // uploadQueue.on('active', (job: Job<ProcessPdfUploadJobData>) => {
      //   console.log(`Job ${job.id} started.`);
      // });
      // uploadQueue.on('completed', (job: Job<ProcessPdfUploadJobData>, result: any) => {
      //   console.log(`Job ${job.id} completed. Result: ${result}`);
      // });
      // uploadQueue.on('failed', (job: Job<ProcessPdfUploadJobData> | undefined, error: Error) => {
      //   console.error(`Job ${job?.id} failed with error:`, error);
      // });

      // Ensure the queue is ready before proceeding (important for worker startup)
      await uploadQueue.waitUntilReady(); // Await this promise

      console.log('BullMQ upload queue initialized and connected to Redis.');
    } catch (e) {
      console.error('Failed to initialize BullMQ upload queue:', e);
      throw e;
    }
  }
  return uploadQueue;
}

// Function to add a job to the queue
export async function addProcessPdfJob(data: ProcessPdfUploadJobData): Promise<Job<ProcessPdfUploadJobData>> {
  const queue = await getUploadQueue();
  // Use data.jobId for the BullMQ job ID to track its status
  return queue.add('processPdfUpload', data, { jobId: data.jobId });
}

// Function to close the queue connection gracefully (useful for shutdown)
export async function closeUploadQueue(): Promise<void> {
  if (uploadQueue) {
    await uploadQueue.close();
    uploadQueue = null;
    console.log('BullMQ upload queue closed.');
  }
}
