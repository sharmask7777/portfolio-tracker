import { prisma } from './db.service';
import { FamilyService } from './family.service';
import crypto from 'crypto';

export class SyncService {
  public static async syncPortfolio(userId: string, parsedData: any) {
    // Ensure User exists
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

    const results = [];
    const investor = parsedData.investor_info || parsedData.investor || {};

    // 2. Loop through Folios and Transactions
    // casparser JSON structure: { folios: [ { folio: "...", amc: "...", schemes: [ { isin: "...", transactions: [...] } ] } ] }
    for (const folioData of parsedData.folios || []) {
      for (const schemeData of folioData.schemes || []) {
        const fundName = schemeData.scheme || schemeData.name;
        
        // FINANCIAL INTELLIGENCE: Multi-PAN Splitting (REQ-10.1, D-02)
        // Extract PAN from scheme or folio level (Handling both casing from different parser versions)
        const currentPan = schemeData.pan || schemeData.PAN || folioData.pan || folioData.PAN || investor.pan || investor.PAN || 'UNKNOWN';
        const profile = await FamilyService.getOrCreateManagedProfile(userId, currentPan);
        
        // Find or Create Portfolio for this profile
        let currentPortfolio = await prisma.portfolio.findFirst({
          where: { userId, managedProfileId: profile.id },
        });

        if (!currentPortfolio) {
          currentPortfolio = await prisma.portfolio.create({
            data: {
              name: `${profile.name}'s Portfolio`,
              userId,
              managedProfileId: profile.id,
            },
          });
        }

        // Upsert Asset
        const asset = await prisma.asset.upsert({
          where: { isin: schemeData.isin || 'MISSING-' + (schemeData.amfi || fundName) },
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

        // Upsert Folio (Now scoped to the specific portfolio for this profile)
        const folio = await prisma.folio.upsert({
          where: {
            number_assetId_portfolioId: {
              number: folioData.folio,
              assetId: asset.id,
              portfolioId: currentPortfolio.id,
            },
          },
          update: {
            amc: folioData.amc,
            pan: currentPan,
          },
          create: {
            number: folioData.folio,
            amc: folioData.amc,
            pan: currentPan,
            assetId: asset.id,
            portfolioId: currentPortfolio.id,
          },
        });

        // Add Transactions
        const transactions = [...(schemeData.transactions || [])];
        const originalCount = transactions.length;

        // 1. First, upsert all REAL transactions to establish current DB state
        for (const tx of transactions) {
          try {
            // Deduplication hash: Do NOT include trailing balance, as that changes between statements
            const txString = `${currentPortfolio.id}-${folioData.folio}-${schemeData.isin}-${tx.date}-${tx.type}-${tx.amount}-${tx.units}-${tx.nav}`;
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

        // If closing balance is zero, we MUST NOT have an anchor
        if (schemeData.close === 0 || (anchorUnits <= 0.001 && anchorCost <= 0)) {
          await prisma.transaction.deleteMany({
            where: { externalId: `ANCHOR-${folio.id}` }
          });
        } else {
          // FINANCIAL INTELLIGENCE: Intelligent Anchor Dating
          // Instead of guessing 1 year, we estimate the holding period based on the gain 
          // and the expected return for the asset class.
          const assetType = (schemeData.type || 'EQUITY').toUpperCase();
          const expectedAnnualReturn = assetType.includes('EQUITY') ? 0.12 : 
                                       assetType.includes('DEBT') ? 0.07 : 
                                       assetType.includes('LIQUID') ? 0.05 : 0.10;
          
          const avgCostPrice = anchorUnits > 0 ? anchorCost / anchorUnits : 0;
          const currentPrice = schemeData.valuation?.nav || avgCostPrice;
          
          let impliedYears = 1; // Default
          if (avgCostPrice > 0 && currentPrice > avgCostPrice) {
            const totalGainRatio = currentPrice / avgCostPrice;
            // Formula: years = ln(gainRatio) / ln(1 + r)
            impliedYears = Math.log(totalGainRatio) / Math.log(1 + expectedAnnualReturn);
            // Cap at 10 years for sanity
            impliedYears = Math.min(10, Math.max(0.5, impliedYears));
          }

          const firstRealTxDate = realTxs.length > 0 
            ? new Date(Math.min(...realTxs.map(t => t.date.getTime())))
            : new Date();
          const anchorDate = new Date(firstRealTxDate.getTime() - (impliedYears * 365.25 * 24 * 60 * 60 * 1000));

          await prisma.transaction.upsert({
            where: { externalId: `ANCHOR-${folio.id}` },
            update: {
              amount: anchorCost,
              units: anchorUnits,
              nav: anchorUnits > 0 ? anchorCost / anchorUnits : 0,
              balance: anchorUnits,
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
        }
      }
    }

    return { status: 'success' };
  }
}
