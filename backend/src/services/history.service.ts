import { prisma } from './db.service';
import { MarketDataService } from './market-data.service';
import { PortfolioUtils } from '../utils/portfolio.utils';

export class HistoryService {
  /**
   * Calculates and stores daily historical values for a portfolio.
   */
  public static async calculateHistory(portfolioId: string): Promise<void> {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: {
        folios: {
          include: {
            transactions: true,
            asset: true,
          },
        },
      },
    });

    if (!portfolio) return;

    // 1. Get all transactions across all folios
    const allTransactions = portfolio.folios.flatMap(f => f.transactions.map(tx => ({
      ...tx,
      amfiCode: f.asset.amfiCode,
    })));

    if (allTransactions.length === 0) return;

    // 2. Sort transactions and identify start date
    const sortedTxs = PortfolioUtils.sortTransactions(allTransactions);
    const startDate = new Date(sortedTxs[0].date);
    startDate.setUTCHours(0, 0, 0, 0);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 3. Ensure we have historical NAVs for all assets
    const amfiCodes = Array.from(new Set(portfolio.folios.map(f => f.asset.amfiCode).filter(Boolean))) as string[];
    for (const amfiCode of amfiCodes) {
      const latestNAV = await prisma.historicalNAV.findFirst({
        where: { amfiCode },
        orderBy: { date: 'desc' },
      });

      if (!latestNAV || latestNAV.date < today) {
        await MarketDataService.getHistoricalNAVs(amfiCode, startDate);
      }
    }

    // 4. Fetch all historical NAVs into memory for efficiency
    const historicalNAVs = await prisma.historicalNAV.findMany({
      where: { amfiCode: { in: amfiCodes } },
      orderBy: { date: 'asc' },
    });

    const navMap = new Map<string, Map<string, number>>();
    historicalNAVs.forEach(nav => {
      if (!navMap.has(nav.amfiCode)) navMap.set(nav.amfiCode, new Map());
      const dKey = nav.date.toISOString().split('T')[0];
      navMap.get(nav.amfiCode)!.set(dKey, nav.nav);
    });

    // 5. Daily tracking logic
    const dailyHistories = [];
    const currentUnits = new Map<string, number>();
    const currentInvested = new Map<string, number>();
    const lastKnownNAV = new Map<string, number>();

    let currentDate = new Date(startDate);
    const txByDate = new Map<string, any[]>();
    sortedTxs.forEach(tx => {
      const d = new Date(tx.date).toISOString().split('T')[0];
      if (!txByDate.has(d)) txByDate.set(d, []);
      txByDate.get(d)!.push(tx);
    });

    while (currentDate <= today) {
      const dStr = currentDate.toISOString().split('T')[0];
      
      // Update units with transactions on this day
      if (txByDate.has(dStr)) {
        txByDate.get(dStr)!.forEach(tx => {
          const key = tx.amfiCode;
          if (!key) return;

          const units = tx.units || 0;
          const amount = tx.amount || 0;
          const type = tx.type.toLowerCase();

          const isOutflow = type.includes('buy') || type.includes('purchase') || type.includes('sip') || type.includes('switch_in') || type.includes('reinvestment') || type.includes('opening_balance') || type.includes('balance_stmt');
          const isInflow = type.includes('sell') || type.includes('redemption') || type.includes('switch_out');

          currentUnits.set(key, (currentUnits.get(key) || 0) + units);
          
          if (isOutflow) {
            currentInvested.set(key, (currentInvested.get(key) || 0) + Math.abs(amount));
          } else if (isInflow) {
            currentInvested.set(key, (currentInvested.get(key) || 0) - Math.abs(amount));
          }
        });
      }

      // Calculate total value for the day
      let dailyValue = 0;
      let dailyInvested = 0;

      for (const amfiCode of amfiCodes) {
        const units = currentUnits.get(amfiCode) || 0;
        const invested = currentInvested.get(amfiCode) || 0;
        
        let nav = navMap.get(amfiCode)?.get(dStr);
        if (nav === undefined) {
          nav = lastKnownNAV.get(amfiCode) || 0;
        } else {
          lastKnownNAV.set(amfiCode, nav);
        }

        dailyValue += units * nav;
        dailyInvested += invested;
      }

      dailyHistories.push({
        portfolioId,
        date: new Date(currentDate),
        value: dailyValue,
        investedAmount: Math.max(0, dailyInvested),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 6. Save to DB
    await prisma.portfolioHistory.deleteMany({ where: { portfolioId } });
    await prisma.portfolioHistory.createMany({
      data: dailyHistories,
      skipDuplicates: true,
    });
  }

  /**
   * Calculates portfolio statistics (ATH, Max Invested, Yearly peaks)
   */
  public static async getPortfolioStats(portfolioIds: string[]) {
    const historyData = await prisma.portfolioHistory.findMany({
      where: {
        portfolioId: { in: portfolioIds },
      },
      orderBy: { date: 'asc' },
    });

    if (historyData.length === 0) {
      return {
        ath: { value: 0, date: null },
        maxInvested: { value: 0, date: null },
        yearly: [],
      };
    }

    // Aggregate by date
    const aggregated = historyData.reduce((acc: any, curr) => {
      const dateKey = curr.date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { date: curr.date, value: 0, investedAmount: 0 };
      }
      acc[dateKey].value += curr.value;
      acc[dateKey].investedAmount += curr.investedAmount;
      return acc;
    }, {});

    const dailyPoints = Object.values(aggregated) as { date: Date; value: number; investedAmount: number }[];

    let ath = { value: 0, date: null as Date | null };
    let maxInvested = { value: 0, date: null as Date | null };
    const yearlyMap = new Map<number, { year: number; ath: { value: number; date: Date | null }; maxInvested: { value: number; date: Date | null } }>();

    const currentYear = new Date().getFullYear();
    const last5Years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    dailyPoints.forEach(point => {
      // Global ATH
      if (point.value > ath.value) {
        ath = { value: point.value, date: point.date };
      }

      // Global Max Invested
      if (point.investedAmount > maxInvested.value) {
        maxInvested = { value: point.investedAmount, date: point.date };
      }

      // Yearly breakdowns
      const year = point.date.getFullYear();
      if (last5Years.includes(year)) {
        if (!yearlyMap.has(year)) {
          yearlyMap.set(year, {
            year,
            ath: { value: 0, date: null },
            maxInvested: { value: 0, date: null },
          });
        }

        const yearStats = yearlyMap.get(year)!;
        if (point.value > yearStats.ath.value) {
          yearStats.ath = { value: point.value, date: point.date };
        }
        if (point.investedAmount > yearStats.maxInvested.value) {
          yearStats.maxInvested = { value: point.investedAmount, date: point.date };
        }
      }
    });

    return {
      ath,
      maxInvested,
      yearly: Array.from(yearlyMap.values()).sort((a, b) => b.year - a.year),
    };
  }
}
