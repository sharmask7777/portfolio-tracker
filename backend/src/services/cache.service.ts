import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);

export class CacheService {
  private static client: Redis | null = null;

  private static getClient(): Redis {
    if (!this.client) {
      this.client = new Redis({
        host: redisHost,
        port: redisPort,
        // Disable retry to avoid hanging if Redis is not running
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 100, 2000);
        },
      });

      this.client.on('error', (err) => {
        // Silencing error logs during tests if Redis is not available
        if (process.env.NODE_ENV !== 'test') {
          console.error('Redis error:', err);
        }
      });
    }
    return this.client;
  }

  public static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.getClient().get(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  public static async set(key: string, value: any, ttlSeconds: number = 86400): Promise<void> {
    try {
      await this.getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (e) {
    }
  }

  public static async del(key: string): Promise<void> {
    try {
      await this.getClient().del(key);
    } catch (e) {
    }
  }

  public static async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}
