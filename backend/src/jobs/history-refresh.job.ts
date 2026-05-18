import cron from 'node-cron';
import { prisma } from '../services/db.service';
import { HistoryService } from '../services/history.service';

export class HistoryRefreshJob {
  /**
   * Starts the daily history refresh job.
   * Runs at 01:00 every day (after NAV refresh).
   */
  public static start() {
    cron.schedule('0 1 * * *', async () => {
      console.log('Running daily Portfolio History refresh job...');
      await this.refreshAllHistories();
    });
  }

  public static async refreshAllHistories() {
    try {
      const portfolios = await prisma.portfolio.findMany({
        select: { id: true },
      });

      console.log(`Refreshing history for ${portfolios.length} portfolios...`);

      for (const portfolio of portfolios) {
        try {
          await HistoryService.calculateHistory(portfolio.id);
          console.log(`Updated history for portfolio: ${portfolio.id}`);
        } catch (e) {
          console.error(`Failed to update history for portfolio ${portfolio.id}:`, e);
        }
      }

      console.log('Portfolio History refresh job completed.');
    } catch (e) {
      console.error('Portfolio History refresh job failed:', e);
    }
  }
}
