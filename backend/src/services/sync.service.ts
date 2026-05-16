import { prisma } from './db.service';
import crypto from 'crypto';

export class SyncService {
  public static async syncPortfolio(userId: string, parsedData: any) {
    // 1. Ensure User and Portfolio exist
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // For now, auto-create a user if it doesn't exist (mocking auth)
      user = await prisma.user.create({
        data: {
          id: userId,
          email: `${userId}@example.com`,
          password: 'mock-password',
        },
      });
    }

    let portfolio = await prisma.portfolio.findFirst({
      where: { userId },
    });

    if (!portfolio) {
      portfolio = await prisma.portfolio.create({
        data: {
          name: 'Default Portfolio',
          userId,
        },
      });
    }

    const results = [];
    const investor = parsedData.investor_info || parsedData.investor || {};

    // 2. Loop through Folios and Transactions
    // casparser JSON structure: { folios: [ { folio: "...", amc: "...", schemes: [ { isin: "...", transactions: [...] } ] } ] }
    for (const folioData of parsedData.folios || []) {
      for (const schemeData of folioData.schemes || []) {
        const fundName = schemeData.scheme || schemeData.name;
        // Upsert Asset
        const asset = await prisma.asset.upsert({
          where: { isin: schemeData.isin || schemeData.amfi || fundName },
          update: {
            name: fundName,
            amfiCode: schemeData.amfi,
          },
          create: {
            type: 'MUTUAL_FUND',
            name: fundName,
            isin: schemeData.isin,
            amfiCode: schemeData.amfi,
          },
        });

        // Upsert Folio
        const folio = await prisma.folio.upsert({
          where: {
            number_assetId_portfolioId: {
              number: folioData.folio,
              assetId: asset.id,
              portfolioId: portfolio.id,
            },
          },
          update: {
            amc: folioData.amc,
            pan: investor.pan,
          },
          create: {
            number: folioData.folio,
            amc: folioData.amc,
            pan: investor.pan,
            assetId: asset.id,
            portfolioId: portfolio.id,
          },
        });

        // Add Transactions
        const transactions = [...(schemeData.transactions || [])];
        const originalCount = transactions.length;

        // 1. First, upsert all REAL transactions to establish current DB state
        for (const tx of transactions) {
          try {
            // Deduplication hash: Do NOT include trailing balance, as that changes between statements
            const txString = `${portfolio.id}-${folioData.folio}-${schemeData.isin}-${tx.date}-${tx.type}-${tx.amount}-${tx.units}-${tx.nav}`;
            const externalId = crypto.createHash('md5').update(txString).digest('hex');
            
            const cleanValue = (val: any) => {
              const parsed = parseFloat(val);
              return isNaN(parsed) ? 0 : parsed;
            };

            await prisma.transaction.upsert({
              where: { externalId },
              update: { nav: cleanValue(tx.nav), balance: cleanValue(tx.balance) },
              create: {
                date: new Date(tx.date),
                type: tx.type,
                amount: cleanValue(tx.amount),
                units: cleanValue(tx.units),
                nav: cleanValue(tx.nav),
                balance: cleanValue(tx.balance),
                folioId: folio.id,
                externalId,
              },
            });
          } catch (e) { console.error('Failed to sync real tx:', e); }
        }

        // 2. Now, calculate the "Anchor" (Missing Cost/Units)
        // The latest statement is our ground truth for total current units and cost.
        const allTxsForFolio = await prisma.transaction.findMany({
          where: { folioId: folio.id }
        });

        // Filter for "Real" transactions (those that actually happened)
        const realTxs = allTxsForFolio.filter(t => !['OPENING_BALANCE', 'BALANCE_STMT'].includes(t.type));
        
        const totalRealUnits = realTxs.reduce((acc, t) => acc + t.units, 0);
        const totalRealCost = realTxs.reduce((acc, t) => {
          const type = t.type.toLowerCase();
          const isOutflow = type.includes('buy') || type.includes('purchase') || type.includes('sip') || type.includes('reinvestment') || type.includes('switch_in');
          const isInflow = type.includes('sell') || type.includes('redemption') || type.includes('switch_out');
          return isOutflow ? acc + Math.abs(t.amount) : isInflow ? acc - Math.abs(t.amount) : acc;
        }, 0);

        const anchorUnits = Math.max(0, schemeData.close - totalRealUnits);
        const anchorCost = Math.max(0, (schemeData.valuation?.cost || 0) - totalRealCost);

        if (anchorUnits > 0.001 || anchorCost > 0) {
          // Legacy Fix: Date the anchor 365 days before the first real transaction (or today)
          // This ensures XIRR reflects a realistic annualized return for legacy holdings
          // instead of blowing up due to a short 1-month statement window.
          const firstRealTxDate = realTxs.length > 0 
            ? new Date(Math.min(...realTxs.map(t => t.date.getTime())))
            : new Date();
          const anchorDate = new Date(firstRealTxDate.getTime() - 365 * 24 * 60 * 60 * 1000);

          await prisma.transaction.upsert({
            where: { externalId: `ANCHOR-${folio.id}` },
            update: {
              amount: anchorCost,
              units: anchorUnits,
              nav: anchorUnits > 0 ? anchorCost / anchorUnits : 0,
              balance: anchorUnits, // This is a legacy anchor, balance is just the units
              date: anchorDate,
            },
            create: {
              date: anchorDate,
              type: 'OPENING_BALANCE',
              amount: anchorCost,
              units: anchorUnits,
              nav: anchorUnits > 0 ? anchorCost / anchorUnits : 0,
              balance: anchorUnits,
              folioId: folio.id,
              externalId: `ANCHOR-${folio.id}`,
            }
          });
        } else {
          // If all units are accounted for by real transactions, remove the anchor
          await prisma.transaction.deleteMany({
            where: { externalId: `ANCHOR-${folio.id}` }
          });
        }
      }
    }

    return { status: 'success', portfolioId: portfolio.id };
  }
}
