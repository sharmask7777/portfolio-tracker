import { Queue } from 'bullmq';
// Note: We need to import the functions from the actual module to test them
import { addProcessPdfJob, ProcessPdfUploadJobData, getUploadQueue } from '../../jobs/queue';

// --- Mocks setup for BullMQ ---
const mockAdd = jest.fn((name, data, opts) => ({ id: opts?.jobId || 'mock_job_id', name, data, opts }));
const mockClose = jest.fn();
const mockOn = jest.fn();
const mockWaitUntilReady = jest.fn().mockResolvedValue(undefined); // Default successful readiness

const MockQueue = jest.fn(() => ({
  add: mockAdd,
  close: mockClose,
  on: mockOn,
  waitUntilReady: mockWaitUntilReady,
}));

jest.mock('bullmq', () => ({
  Queue: MockQueue,
  Worker: jest.fn(),
  QueueScheduler: jest.fn(),
}));
// --- End Mocks setup for BullMQ ---

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    disconnect: jest.fn(),
    status: 'ready',
    // Mock other ioredis methods as needed if they are directly called
  }));
});


describe('Job Queue Module', () => {
  const MOCK_REDIS_HOST = 'mock_redis_host';
  const MOCK_REDIS_PORT = 6379;

  // Set up mock environment variables before each test
  beforeEach(() => {
    // jest.resetModules(); // Moved to individual tests where module isolation is critical
    jest.clearAllMocks(); // Clear all individual mocks (mockAdd, MockQueue etc.)
    process.env.REDIS_HOST = MOCK_REDIS_HOST;
    process.env.REDIS_PORT = MOCK_REDIS_PORT.toString();
  });

  afterEach(async () => {
    // Ensure all queue instances are properly closed after each test
    // For mocked Queue, this might not do anything, but good practice
    // if a real Queue instance were ever used.
  });

  // Test Scenario 1: Queue Initialization
  it('should initialize the BullMQ queue with correct Redis connection details', async () => {
    const { getUploadQueue } = require('../../jobs/queue'); // Re-import to get fresh state for singleton
    const queueInstance = await getUploadQueue(); // Await the async function

    expect(MockQueue).toHaveBeenCalledTimes(1); // Check against MockQueue directly
    expect(MockQueue).toHaveBeenCalledWith('pdfUploadQueue', {
      connection: expect.objectContaining({
        host: MOCK_REDIS_HOST,
        port: MOCK_REDIS_PORT,
      }),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });
    expect(mockWaitUntilReady).toHaveBeenCalledTimes(1); // Now we expect this to be called
  });

  // Test Scenario 2: Job Enqueueing
  it('should successfully enqueue a processPdfUpload job', async () => {
    const mockJobData: ProcessPdfUploadJobData = {
      userId: 'test_user_id',
      filePath: '/path/to/test.pdf',
      password: 'test_password',
      jobId: 'test_job_id',
    };

    const { addProcessPdfJob, getUploadQueue } = require('../../jobs/queue'); // Re-import to get fresh state
    await getUploadQueue(); // Initialize the queue first and await its readiness
    const job = await addProcessPdfJob(mockJobData);

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith(
      'processPdfUpload', // Job name
      mockJobData,
      expect.objectContaining({ jobId: mockJobData.jobId }) // Expecting options including jobId
    );
    // Verify that the job object returned contains an ID
    expect(job).toHaveProperty('id');
    expect(typeof job.id).toBe('string');
  });

  // Test Scenario 3: Error Handling - Redis Connection Failure during waitUntilReady
  it('should log an error and handle connection failure during queue readiness check', async () => {
    jest.resetModules(); // Ensure a fresh module load for this specific test

    // Setup the mock for Queue.waitUntilReady to reject BEFORE requiring the module
    mockWaitUntilReady.mockRejectedValueOnce(new Error('Mock Redis connection error during readiness check'));

    // Mock console.error to check if error is logged
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Ensure environment variables are present so the initial check in queue.ts passes
    process.env.REDIS_HOST = MOCK_REDIS_HOST;
    process.env.REDIS_PORT = MOCK_REDIS_PORT.toString();

    // Import *after* environment variables are set and mock is ready
    const { getUploadQueue } = require('../../jobs/queue');

    let errorThrown: any;
    try {
      await getUploadQueue(); // This should now reject because of waitUntilReady mock
    } catch (e) {
      errorThrown = e;
    }

    expect(errorThrown).toBeInstanceOf(Error);
    expect(errorThrown.message).toContain('Mock Redis connection error during readiness check');
    // Ensure console.error was called due to initialization failure from the catch block in getUploadQueue
    expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize BullMQ upload queue:'),
        expect.any(Error)
    );

    consoleErrorSpy.mockRestore(); // Restore original console.error
  });

  // Test Scenario 4: Error if Redis host or port are not defined
  it('should throw an error if redis host or port are not defined during initialization', () => {
    jest.resetModules(); // Ensure a fresh module load for this specific test
    delete process.env.REDIS_HOST; // Simulate missing host
    delete process.env.REDIS_PORT; // Simulate missing port

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    let errorThrown: any;
    try {
        // Attempt to load the module, which should throw immediately due to top-level check
        require('../../jobs/queue');
    } catch (e) {
        errorThrown = e;
    }

    expect(errorThrown).toBeDefined(); // Ensure an error was indeed thrown
    expect(errorThrown.message).toContain('REDIS_HOST and REDIS_PORT environment variables must be defined.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('REDIS_HOST and REDIS_PORT environment variables must be defined.'),
    );
    consoleErrorSpy.mockRestore();
  });

});
