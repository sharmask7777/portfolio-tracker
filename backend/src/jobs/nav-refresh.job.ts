import cron from 'node-cron';
import { prisma } from '../services/db.service';
import { MarketDataService } from '../services/market-data.service';
import { CacheService } from '../services/cache.service';

export class NAVRefreshJob {
  /**
   * Starts the daily NAV refresh job.
   * Runs at 00:00 every day.
   */
  public static start() {
    cron.schedule('0 0 * * *', async () => {
      console.log('Running daily NAV refresh job...');
      await this.refreshAllNAVs();
    });
  }

  public static async refreshAllNAVs() {
    try {
      const assets = await prisma.asset.findMany({
        where: { amfiCode: { not: null } },
        select: { amfiCode: true },
      });

      const uniqueAmfiCodes = Array.from(new Set(assets.map((a) => a.amfiCode as string)));

      console.log(`Refreshing NAVs for ${uniqueAmfiCodes.length} assets...`);

      for (const amfiCode of uniqueAmfiCodes) {
        // Clearing cache first to force a fresh fetch
        await CacheService.del(`nav:${amfiCode}`);
        const newNav = await MarketDataService.getLatestNAV(amfiCode);
        console.log(`Updated NAV for ${amfiCode}: ${newNav}`);
      }

      console.log('NAV refresh job completed.');
    } catch (e) {
      console.error('NAV refresh job failed:', e);
    }
  }
}
